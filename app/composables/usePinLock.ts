import { gcm } from '@noble/ciphers/aes.js'
import { pbkdf2 } from '@noble/hashes/pbkdf2.js'
import { sha256 } from '@noble/hashes/sha2.js'
import { computed, readonly, ref } from 'vue'
import type { HostTokenRecord } from './useSecureHostTokens'

const PIN_LOCK_CONFIG_KEY = 'or3-app:v1:pin-lock-config'
const PIN_LOCKOUT_KEY = 'or3-app:v1:pin-lockout'
const HOST_TOKEN_STORAGE_KEY = 'or3-app:v1:secure-host-tokens'
const PIN_UNLOCK_SESSION_KEY = 'or3-app:v1:pin-unlock-session'

interface PinLockConfig {
  enabled: boolean
  salt: string
  unlockDurationMs?: number
}

interface EncryptedTokenBlob {
  v?: number
  iv: string
  data: string
}

interface PinLockoutState {
  failedAttempts: number
  lockedUntilTs: number | null
}

interface PinUnlockedSession {
  salt: string
  keyHex: string
  expiresAtTs: number
}

let _config: PinLockConfig | null = null
let _decryptedTokens: Record<string, HostTokenRecord> | null = null
let _cachedKey: Uint8Array | null = null
let _failedAttempts = 0
let _lockedUntilTs: number | null = null
let _initialized = false
let _lifecycleHandlersAttached = false
let _wasBackgrounded = false

const pinEnabledState = ref(false)
const decryptedTokensState = ref<Record<string, HostTokenRecord> | null>(null)
const unlockDurationState = ref(0)
const unlockRequiredState = computed(
  () => pinEnabledState.value && decryptedTokensState.value === null,
)
const unlockedState = computed(
  () => pinEnabledState.value && decryptedTokensState.value !== null,
)

export const PIN_MAX_ATTEMPTS = 5
export const PIN_LOCKOUT_MS = 5 * 60 * 1000
export const PIN_MIN_LENGTH = 4
export const PIN_MAX_LENGTH = 6
export const PIN_UNLOCK_IMMEDIATE_MS = 0
export const PIN_UNLOCK_DEFAULT_MS = 10 * 60 * 1000
const PIN_PATTERN = /^\d{4,6}$/

function syncReactiveState() {
  pinEnabledState.value = _config?.enabled === true
  decryptedTokensState.value = _decryptedTokens
  unlockDurationState.value = _config?.unlockDurationMs ?? PIN_UNLOCK_DEFAULT_MS
}

function randomBytes(length: number): Uint8Array {
  if (typeof crypto === 'undefined' || typeof crypto.getRandomValues !== 'function') {
    throw new Error('Secure random number generation is unavailable in this browser.')
  }
  return crypto.getRandomValues(new Uint8Array(length))
}

function hexToBytes(hex: string): Uint8Array {
  const bytes = new Uint8Array(hex.length / 2)
  for (let i = 0; i < hex.length; i += 2) {
    bytes[i / 2] = Number.parseInt(hex.slice(i, i + 2), 16)
  }
  return bytes
}

function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
}

function generateSalt(): Uint8Array {
  return randomBytes(16)
}

function validatePin(pin: string): string | null {
  if (!PIN_PATTERN.test(pin)) {
    if (pin.length < PIN_MIN_LENGTH || pin.length > PIN_MAX_LENGTH) {
      return `PIN must be ${PIN_MIN_LENGTH}-${PIN_MAX_LENGTH} digits.`
    }
    return 'PIN must contain only digits.'
  }
  return null
}

function sanitizeUnlockDurationMs(durationMs: unknown): number {
  const parsed = typeof durationMs === 'number' ? durationMs : Number(durationMs)
  if (!Number.isFinite(parsed) || parsed < 0) return PIN_UNLOCK_DEFAULT_MS
  return Math.floor(parsed)
}

function clearUnlockedSessionCache() {
  if (typeof sessionStorage !== 'undefined') {
    sessionStorage.removeItem(PIN_UNLOCK_SESSION_KEY)
  }
}

function persistUnlockedSession() {
  if (!_config?.enabled || !_cachedKey) {
    clearUnlockedSessionCache()
    return
  }

  const unlockDurationMs = sanitizeUnlockDurationMs(_config.unlockDurationMs)
  if (unlockDurationMs <= PIN_UNLOCK_IMMEDIATE_MS) {
    clearUnlockedSessionCache()
    return
  }

  const session: PinUnlockedSession = {
    salt: _config.salt,
    keyHex: bytesToHex(_cachedKey),
    expiresAtTs: Date.now() + unlockDurationMs,
  }

  if (typeof sessionStorage !== 'undefined') {
    sessionStorage.setItem(PIN_UNLOCK_SESSION_KEY, JSON.stringify(session))
  }
}

function readUnlockedSession(): PinUnlockedSession | null {
  if (typeof sessionStorage === 'undefined') return null

  const raw = sessionStorage.getItem(PIN_UNLOCK_SESSION_KEY)
  if (!raw) return null

  try {
    const parsed = JSON.parse(raw) as Partial<PinUnlockedSession>
    if (!parsed || typeof parsed !== 'object') {
      clearUnlockedSessionCache()
      return null
    }

    if (
      typeof parsed.salt !== 'string'
      || typeof parsed.keyHex !== 'string'
      || typeof parsed.expiresAtTs !== 'number'
      || !Number.isFinite(parsed.expiresAtTs)
    ) {
      clearUnlockedSessionCache()
      return null
    }

    if (parsed.expiresAtTs <= Date.now()) {
      clearUnlockedSessionCache()
      return null
    }

    return {
      salt: parsed.salt,
      keyHex: parsed.keyHex,
      expiresAtTs: parsed.expiresAtTs,
    }
  } catch {
    clearUnlockedSessionCache()
    return null
  }
}

function restoreUnlockedSession() {
  if (!_config?.enabled) return false

  const session = readUnlockedSession()
  if (!session || session.salt !== _config.salt) {
    if (session && session.salt !== _config.salt) clearUnlockedSessionCache()
    return false
  }

  try {
    const key = hexToBytes(session.keyHex)
    const tokens = readAndDecryptBlob(key)
    if (tokens === null) {
      clearUnlockedSessionCache()
      return false
    }

    _cachedKey = key
    _decryptedTokens = tokens
    return true
  } catch {
    clearUnlockedSessionCache()
    return false
  }
}

function handleBackgrounding() {
  if (!_config?.enabled || _decryptedTokens === null) return
  _wasBackgrounded = true

  const unlockDurationMs = sanitizeUnlockDurationMs(_config.unlockDurationMs)
  if (unlockDurationMs <= PIN_UNLOCK_IMMEDIATE_MS) {
    lock()
    return
  }

  if (_cachedKey === null) return
  persistUnlockedSession()
}

function handleForegrounding() {
  clearExpiredLockout()

  if (_config?.enabled && _wasBackgrounded) {
    _wasBackgrounded = false

    if (sanitizeUnlockDurationMs(_config.unlockDurationMs) > PIN_UNLOCK_IMMEDIATE_MS && readUnlockedSession() === null) {
      lock()
      return
    }
  }

  if (_decryptedTokens === null) {
    restoreUnlockedSession()
    syncReactiveState()
  }
}

function ensureLifecycleHandlers() {
  if (_lifecycleHandlersAttached || typeof document === 'undefined' || typeof window === 'undefined') return
  _lifecycleHandlersAttached = true

  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') {
      handleBackgrounding()
    } else if (document.visibilityState === 'visible') {
      handleForegrounding()
    }
  })

  window.addEventListener('pagehide', () => {
    handleBackgrounding()
  })

  window.addEventListener('pageshow', () => {
    handleForegrounding()
  })
}

function persistLockout() {
  if (typeof localStorage === 'undefined') return
  if (_failedAttempts > 0 || _lockedUntilTs) {
    localStorage.setItem(PIN_LOCKOUT_KEY, JSON.stringify({
      failedAttempts: _failedAttempts,
      lockedUntilTs: _lockedUntilTs,
    } satisfies PinLockoutState))
  } else {
    localStorage.removeItem(PIN_LOCKOUT_KEY)
  }
}

function clearExpiredLockout() {
  if (_lockedUntilTs !== null && _lockedUntilTs <= Date.now()) {
    _failedAttempts = 0
    _lockedUntilTs = null
    persistLockout()
  }
}

function loadLockout() {
  if (typeof localStorage === 'undefined') return
  _failedAttempts = 0
  _lockedUntilTs = null

  const raw = localStorage.getItem(PIN_LOCKOUT_KEY)
  if (!raw) return

  try {
    const parsed = JSON.parse(raw) as number | Partial<PinLockoutState>
    if (typeof parsed === 'number') {
      _lockedUntilTs = parsed
    } else if (parsed && typeof parsed === 'object') {
      _failedAttempts = Math.min(
        PIN_MAX_ATTEMPTS,
        Math.max(0, Number.isFinite(parsed.failedAttempts) ? Number(parsed.failedAttempts) : 0),
      )
      _lockedUntilTs = typeof parsed.lockedUntilTs === 'number'
        ? parsed.lockedUntilTs
        : null
    } else {
      localStorage.removeItem(PIN_LOCKOUT_KEY)
      return
    }
  } catch {
    const ts = Number.parseInt(raw, 10)
    if (Number.isNaN(ts)) {
      localStorage.removeItem(PIN_LOCKOUT_KEY)
      return
    }
    _lockedUntilTs = ts
  }

  if ((_lockedUntilTs !== null && !Number.isFinite(_lockedUntilTs)) || !Number.isFinite(_failedAttempts)) {
    localStorage.removeItem(PIN_LOCKOUT_KEY)
    return
  }
  clearExpiredLockout()
  persistLockout()
}

function recordFailedAttempt() {
  clearExpiredLockout()
  _failedAttempts += 1
  if (_failedAttempts >= PIN_MAX_ATTEMPTS) {
    _lockedUntilTs = Date.now() + PIN_LOCKOUT_MS
  }
  persistLockout()
}

function resetLockout() {
  _failedAttempts = 0
  _lockedUntilTs = null
  persistLockout()
}

function deriveKey(pin: string, saltHex: string): Uint8Array {
  const salt = hexToBytes(saltHex)
  const enc = new TextEncoder()
  return pbkdf2(sha256, enc.encode(pin), salt, { c: 100_000, dkLen: 32 })
}

function encrypt(plaintext: string, key: Uint8Array): string {
  const iv = randomBytes(12)
  const enc = new TextEncoder()
  const aes = gcm(key, iv)
  const ciphertext = aes.encrypt(enc.encode(plaintext))
  return JSON.stringify({
    v: 1,
    iv: bytesToHex(iv),
    data: bytesToHex(ciphertext),
  })
}

function decrypt(encrypted: string, key: Uint8Array): string {
  const { iv, data } = JSON.parse(encrypted) as EncryptedTokenBlob
  const dec = new TextDecoder()
  const aes = gcm(key, hexToBytes(iv))
  const plaintext = aes.decrypt(hexToBytes(data))
  return dec.decode(plaintext)
}

function readConfig(): PinLockConfig | null {
  if (typeof localStorage === 'undefined') return null
  const raw = localStorage.getItem(PIN_LOCK_CONFIG_KEY)
  if (!raw) return null
  try {
    const parsed = JSON.parse(raw) as PinLockConfig
    if (parsed.enabled && parsed.salt) {
      return {
        enabled: true,
        salt: parsed.salt,
        unlockDurationMs: sanitizeUnlockDurationMs(parsed.unlockDurationMs),
      }
    }
    return null
  } catch {
    return null
  }
}

function writeConfig(config: PinLockConfig | null) {
  if (typeof localStorage === 'undefined') return
  if (config?.enabled) {
    localStorage.setItem(PIN_LOCK_CONFIG_KEY, JSON.stringify(config))
  } else {
    localStorage.removeItem(PIN_LOCK_CONFIG_KEY)
  }
}

function readEncryptedBlob(): string | null {
  if (typeof localStorage === 'undefined') return null
  return localStorage.getItem(HOST_TOKEN_STORAGE_KEY)
}

function writeEncryptedBlob(blob: string) {
  if (typeof localStorage === 'undefined') return
  localStorage.setItem(HOST_TOKEN_STORAGE_KEY, blob)
}

function clearLegacySessionTokenStorage() {
  if (typeof sessionStorage === 'undefined') return
  sessionStorage.removeItem(HOST_TOKEN_STORAGE_KEY)
}

function clearTokenStorage() {
  clearLegacySessionTokenStorage()
  if (typeof localStorage === 'undefined') return
  localStorage.removeItem(HOST_TOKEN_STORAGE_KEY)
}

function isEncryptedTokenBlob(value: unknown): value is EncryptedTokenBlob {
  if (!value || typeof value !== 'object') return false
  return 'iv' in value && 'data' in value
}

function parsePlainTokenMap(raw: string | null): Record<string, HostTokenRecord> | null {
  if (!raw) return null
  try {
    const parsed = JSON.parse(raw) as Record<string, HostTokenRecord> | EncryptedTokenBlob
    if (!parsed || typeof parsed !== 'object' || isEncryptedTokenBlob(parsed)) {
      return null
    }
    return parsed as Record<string, HostTokenRecord>
  } catch {
    return null
  }
}

function readPlainTokenMap() {
  if (typeof localStorage === 'undefined') return {} as Record<string, HostTokenRecord>

  return (
    parsePlainTokenMap(localStorage.getItem(HOST_TOKEN_STORAGE_KEY))
    ?? (typeof sessionStorage !== 'undefined'
      ? parsePlainTokenMap(sessionStorage.getItem(HOST_TOKEN_STORAGE_KEY))
      : null)
    ?? ({} as Record<string, HostTokenRecord>)
  )
}

function refreshPinStateFromStorage() {
  if (typeof localStorage === 'undefined') return

  const previousSalt = _config?.salt ?? null
  const nextConfig = readConfig()
  const saltChanged = previousSalt !== null && nextConfig?.enabled === true && nextConfig.salt !== previousSalt

  _initialized = true
  _config = nextConfig

  if (!nextConfig?.enabled || saltChanged) {
    _decryptedTokens = null
    _cachedKey = null
    clearUnlockedSessionCache()
  }

  loadLockout()

  if (nextConfig?.enabled && _decryptedTokens === null) {
    restoreUnlockedSession()
  }

  syncReactiveState()
}

function ensureInit() {
  if (typeof localStorage === 'undefined') return
  if (_initialized) return
  ensureLifecycleHandlers()
  refreshPinStateFromStorage()
}

export function usePinLockState() {
  ensureInit()
  return {
    isEnabled: readonly(pinEnabledState),
    needsUnlock: unlockRequiredState,
    isUnlocked: unlockedState,
    unlockDurationMs: readonly(unlockDurationState),
    refresh: refreshPinStateFromStorage,
  }
}

export function isPinEnabled(): boolean {
  ensureInit()
  return pinEnabledState.value
}

export function needsUnlock(): boolean {
  ensureInit()
  return unlockRequiredState.value
}

export function isUnlocked(): boolean {
  ensureInit()
  return unlockedState.value
}

export function isLockedOut(): boolean {
  ensureInit()
  clearExpiredLockout()
  return _lockedUntilTs !== null && _lockedUntilTs > Date.now()
}

export function getLockoutRemainingMs(): number {
  ensureInit()
  clearExpiredLockout()
  if (!_lockedUntilTs) return 0
  return Math.max(0, _lockedUntilTs - Date.now())
}

export function getAttemptsRemaining(): number {
  ensureInit()
  clearExpiredLockout()
  return Math.max(0, PIN_MAX_ATTEMPTS - _failedAttempts)
}

export function getDecryptedTokens(): Record<string, HostTokenRecord> | null {
  ensureInit()
  return _decryptedTokens
}

export function lock() {
  _decryptedTokens = null
  _cachedKey = null
  clearUnlockedSessionCache()
  syncReactiveState()
}

function readAndDecryptBlob(key: Uint8Array): Record<string, HostTokenRecord> | null {
  const blob = readEncryptedBlob()
  if (!blob) return null
  try {
    const plaintext = decrypt(blob, key)
    return JSON.parse(plaintext) as Record<string, HostTokenRecord>
  } catch {
    return null
  }
}

export async function unlock(pin: string): Promise<{ success: boolean; error?: string }> {
  ensureInit()
  if (!isPinEnabled()) return { success: false, error: 'PIN lock is not enabled.' }

  if (isLockedOut()) {
    const sec = Math.ceil(getLockoutRemainingMs() / 1000)
    return { success: false, error: `Too many attempts. Try again in ${sec}s.` }
  }

  const validationError = validatePin(pin)
  if (validationError) return { success: false, error: validationError }

  try {
    const key = deriveKey(pin, _config!.salt)
    const tokens = readAndDecryptBlob(key)
    if (tokens === null) {
      recordFailedAttempt()
      return { success: false, error: getAttemptsRemaining() > 0 ? `Incorrect PIN. ${getAttemptsRemaining()} attempts remaining.` : 'Incorrect PIN. Locked out.' }
    }
    _decryptedTokens = tokens
    _cachedKey = key
    persistUnlockedSession()
    resetLockout()
    syncReactiveState()
    return { success: true }
  } catch (err) {
    recordFailedAttempt()
    const message = err instanceof Error ? err.message : String(err)
    console.error('[pin-lock] unlock failed:', err)
    return { success: false, error: getAttemptsRemaining() > 0 ? `Unlock failed. ${message}` : 'Locked out.' }
  }
}

export function encryptAndStore(tokens: Record<string, HostTokenRecord>): boolean {
  ensureInit()
  if (!isPinEnabled() || !_cachedKey) return false
  try {
    const plaintext = JSON.stringify(tokens)
    const blob = encrypt(plaintext, _cachedKey)
    clearLegacySessionTokenStorage()
    writeEncryptedBlob(blob)
    _decryptedTokens = tokens
    persistUnlockedSession()
    syncReactiveState()
    return true
  } catch (err) {
    console.error('[pin-lock] persist failed:', err)
    return false
  }
}

export async function enable(pin: string, unlockDurationMs = PIN_UNLOCK_DEFAULT_MS): Promise<{ success: boolean; error?: string }> {
  ensureInit()
  if (isPinEnabled()) return { success: false, error: 'PIN lock is already enabled.' }

  const validationError = validatePin(pin)
  if (validationError) return { success: false, error: validationError }

  try {
    const salt = bytesToHex(generateSalt())
    const key = deriveKey(pin, salt)
    const tokensToStore = readPlainTokenMap()
    const plaintext = JSON.stringify(tokensToStore)
    const blob = encrypt(plaintext, key)
    const nextUnlockDurationMs = sanitizeUnlockDurationMs(unlockDurationMs)

    _config = { enabled: true, salt, unlockDurationMs: nextUnlockDurationMs }
    writeConfig(_config)
    clearLegacySessionTokenStorage()
    writeEncryptedBlob(blob)
    _decryptedTokens = tokensToStore
    _cachedKey = key
    persistUnlockedSession()
    resetLockout()
    syncReactiveState()
    return { success: true }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    console.error('[pin-lock] enable failed:', err)
    return { success: false, error: `PIN lock setup failed. ${message || 'Please try again.'}` }
  }
}

export async function disable(pin: string): Promise<{ success: boolean; error?: string }> {
  ensureInit()
  if (!isPinEnabled()) return { success: false, error: 'PIN lock is not enabled.' }

  if (isLockedOut()) {
    const sec = Math.ceil(getLockoutRemainingMs() / 1000)
    return { success: false, error: `Too many attempts. Try again in ${sec}s.` }
  }

  const validationError = validatePin(pin)
  if (validationError) return { success: false, error: validationError }

  try {
    const key = deriveKey(pin, _config!.salt)
    const tokens = readAndDecryptBlob(key)
    if (tokens === null) {
      recordFailedAttempt()
      return { success: false, error: getAttemptsRemaining() > 0 ? `Incorrect PIN. ${getAttemptsRemaining()} attempts remaining.` : 'Incorrect PIN. Locked out.' }
    }

    _config = null
    _decryptedTokens = null
    _cachedKey = null
  clearUnlockedSessionCache()
    writeConfig(null)
    clearTokenStorage()
    if (typeof localStorage !== 'undefined' && Object.keys(tokens).length) {
      localStorage.setItem(HOST_TOKEN_STORAGE_KEY, JSON.stringify(tokens))
    }
    resetLockout()
    syncReactiveState()
    return { success: true }
  } catch (err) {
    recordFailedAttempt()
    const message = err instanceof Error ? err.message : String(err)
    console.error('[pin-lock] disable failed:', err)
    return { success: false, error: getAttemptsRemaining() > 0 ? `Disable failed. ${message}` : 'Locked out.' }
  }
}

export async function changePin(oldPin: string, newPin: string): Promise<{ success: boolean; error?: string }> {
  ensureInit()
  if (!isPinEnabled()) return { success: false, error: 'PIN lock is not enabled.' }

  if (isLockedOut()) {
    const sec = Math.ceil(getLockoutRemainingMs() / 1000)
    return { success: false, error: `Too many attempts. Try again in ${sec}s.` }
  }

  const validationError = validatePin(newPin)
  if (validationError) return { success: false, error: validationError }

  try {
    const key = deriveKey(oldPin, _config!.salt)
    const tokens = readAndDecryptBlob(key)
    if (tokens === null) {
      recordFailedAttempt()
      return { success: false, error: getAttemptsRemaining() > 0 ? `Current PIN is incorrect. ${getAttemptsRemaining()} attempts remaining.` : 'Current PIN is incorrect. Locked out.' }
    }

    const newSalt = bytesToHex(generateSalt())
    const newKey = deriveKey(newPin, newSalt)
    const plaintext = JSON.stringify(tokens)
    const blob = encrypt(plaintext, newKey)

    _config = {
      enabled: true,
      salt: newSalt,
      unlockDurationMs: sanitizeUnlockDurationMs(_config?.unlockDurationMs),
    }
    writeConfig(_config)
    clearLegacySessionTokenStorage()
    writeEncryptedBlob(blob)
    _cachedKey = newKey
    _decryptedTokens = tokens
    persistUnlockedSession()
    resetLockout()
    syncReactiveState()
    return { success: true }
  } catch (err) {
    recordFailedAttempt()
    const message = err instanceof Error ? err.message : String(err)
    console.error('[pin-lock] change-pin failed:', err)
    return { success: false, error: getAttemptsRemaining() > 0 ? `PIN change failed. ${message}` : 'Locked out.' }
  }
}

export function resetPinLock() {
  ensureInit()
  _config = null
  _decryptedTokens = null
  _cachedKey = null
  clearUnlockedSessionCache()
  writeConfig(null)
  resetLockout()
  clearTokenStorage()
  syncReactiveState()
}

export function setUnlockDuration(durationMs: number) {
  ensureInit()
  const nextUnlockDurationMs = sanitizeUnlockDurationMs(durationMs)

  if (_config?.enabled) {
    _config = {
      ..._config,
      unlockDurationMs: nextUnlockDurationMs,
    }
    writeConfig(_config)

    if (_decryptedTokens !== null && _cachedKey !== null) {
      persistUnlockedSession()
    } else {
      clearUnlockedSessionCache()
    }
  }

  unlockDurationState.value = nextUnlockDurationMs
  return nextUnlockDurationMs
}
