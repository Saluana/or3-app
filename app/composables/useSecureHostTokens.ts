import type { Or3HostProfile } from '~/types/app-state'
import { deleteHostTokensFromNativeStorage, getNativeSecureStorageMode, readHostTokensFromNativeStorage, writeHostTokensToNativeStorage } from '~/utils/auth/nativeSecureStorage'

const HOST_TOKEN_STORAGE_KEY = 'or3-app:v1:secure-host-tokens'

export interface HostTokenRecord {
  pairedToken?: string
  sessionToken?: string
  origin?: string
}

export function normalizedHostOrigin(baseUrl?: string | null) {
  const source = baseUrl?.trim()
  if (!source) return undefined
  try {
    return new URL(source).origin
  } catch {
    return undefined
  }
}

function normalizeHostTokens(tokens?: HostTokenRecord | null) {
  const pairedToken = tokens?.pairedToken?.trim() || undefined
  const sessionToken = tokens?.sessionToken?.trim() || undefined
  const origin = tokens?.origin?.trim() || undefined
  return { pairedToken, sessionToken, origin }
}

function hostTokenOriginMatches(host?: Partial<Or3HostProfile> | null) {
  const tokenOrigin = host?.tokenOrigin?.trim()
  if (!tokenOrigin) return true
  const hostOrigin = normalizedHostOrigin(host?.baseUrl)
  return Boolean(hostOrigin && tokenOrigin === hostOrigin)
}

function readHostTokenMap() {
  if (getNativeSecureStorageMode() === 'native-secure') return {} as Record<string, HostTokenRecord>
  if (typeof sessionStorage === 'undefined') return {} as Record<string, HostTokenRecord>
  let raw = sessionStorage.getItem(HOST_TOKEN_STORAGE_KEY)
  if (!raw && typeof localStorage !== 'undefined') {
    raw = localStorage.getItem(HOST_TOKEN_STORAGE_KEY)
    localStorage.removeItem(HOST_TOKEN_STORAGE_KEY)
  }
  if (!raw) return {} as Record<string, HostTokenRecord>
  try {
    const parsed = JSON.parse(raw) as Record<string, HostTokenRecord>
    return Object.fromEntries(Object.entries(parsed).map(([hostId, value]) => [hostId, normalizeHostTokens(value)]))
  } catch {
    sessionStorage.removeItem(HOST_TOKEN_STORAGE_KEY)
    return {} as Record<string, HostTokenRecord>
  }
}

function writeHostTokenMap(tokens: Record<string, HostTokenRecord>) {
  if (typeof sessionStorage === 'undefined') return
  const entries = Object.entries(tokens)
    .map(([hostId, value]) => [hostId, normalizeHostTokens(value)] as const)
    .filter(([, value]) => Boolean(value.pairedToken || value.sessionToken))
  const normalized = Object.fromEntries(entries) as Record<string, HostTokenRecord>
  const storageMode = getNativeSecureStorageMode()
  if (storageMode === 'native-secure') {
    sessionStorage.removeItem(HOST_TOKEN_STORAGE_KEY)
    if (typeof localStorage !== 'undefined') localStorage.removeItem(HOST_TOKEN_STORAGE_KEY)
    if (!Object.keys(normalized).length) {
      void deleteHostTokensFromNativeStorage()
    } else {
      void writeHostTokensToNativeStorage(normalized)
    }
    return
  }
  if (!Object.keys(normalized).length) {
    sessionStorage.removeItem(HOST_TOKEN_STORAGE_KEY)
    if (typeof localStorage !== 'undefined') localStorage.removeItem(HOST_TOKEN_STORAGE_KEY)
    return
  }
  sessionStorage.setItem(HOST_TOKEN_STORAGE_KEY, JSON.stringify(normalized))
  if (typeof localStorage !== 'undefined') localStorage.removeItem(HOST_TOKEN_STORAGE_KEY)
}

export function resolveHostAuthTokens(host?: Partial<Or3HostProfile> | null) {
  if (!hostTokenOriginMatches(host)) return { authToken: undefined, sessionToken: undefined }
  const sessionToken = host?.sessionToken?.trim() || undefined
  const pairedToken = host?.pairedToken?.trim() || host?.token?.trim() || undefined
  return {
    authToken: sessionToken || pairedToken,
    sessionToken,
  }
}

export function resolvePreferredHostToken(host?: Partial<Or3HostProfile> | null) {
  return resolveHostAuthTokens(host).authToken
}

export function withResolvedHostTokens<T extends Partial<Or3HostProfile>>(host: T): T & Pick<Or3HostProfile, 'token' | 'pairedToken' | 'sessionToken'> {
  const hostOrigin = normalizedHostOrigin(host.baseUrl)
  const existingTokenOrigin = host.tokenOrigin?.trim() || undefined
  const originMatches = !existingTokenOrigin || (hostOrigin && existingTokenOrigin === hostOrigin)
  const pairedToken = host.pairedToken?.trim() || host.token?.trim() || undefined
  const sessionToken = host.sessionToken?.trim() || undefined
  const nextPairedToken = originMatches ? pairedToken : undefined
  const nextSessionToken = originMatches ? sessionToken : undefined
  const tokenOrigin = nextPairedToken || nextSessionToken ? existingTokenOrigin || hostOrigin : undefined
  return {
    ...host,
    pairedToken: nextPairedToken,
    sessionToken: nextSessionToken,
    token: nextSessionToken || nextPairedToken,
    tokenOrigin,
  }
}

export function useSecureHostTokens() {
  function loadAllTokens() {
    return readHostTokenMap()
  }

  async function hydrateTokens() {
    if (typeof localStorage === 'undefined') return {} as Record<string, HostTokenRecord>
    if (getNativeSecureStorageMode() === 'native-secure') return await readHostTokensFromNativeStorage()
    const current = readHostTokenMap()
    if (Object.keys(current).length) return current
    return current
  }

  function getTokens(hostId: string) {
    return normalizeHostTokens(readHostTokenMap()[hostId])
  }

  function setTokens(hostId: string, tokens: HostTokenRecord) {
    const current = readHostTokenMap()
    current[hostId] = normalizeHostTokens(tokens)
    writeHostTokenMap(current)
    return current[hostId]
  }

  function clearTokens(hostId: string) {
    const current = readHostTokenMap()
    delete current[hostId]
    writeHostTokenMap(current)
  }

  function replaceTokens(hosts: Array<Pick<Or3HostProfile, 'id' | 'baseUrl' | 'pairedToken' | 'sessionToken' | 'token' | 'tokenOrigin'>>) {
    const next = Object.fromEntries(hosts.map((host) => {
      const resolved = withResolvedHostTokens(host)
      return [host.id, { pairedToken: resolved.pairedToken, sessionToken: resolved.sessionToken, origin: resolved.tokenOrigin }]
    })) as Record<string, HostTokenRecord>
    writeHostTokenMap(next)
  }

  return {
    loadAllTokens,
    hydrateTokens,
    getTokens,
    setTokens,
    clearTokens,
    replaceTokens,
  }
}
