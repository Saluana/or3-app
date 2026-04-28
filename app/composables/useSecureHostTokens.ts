import type { Or3HostProfile } from '~/types/app-state'
import { deleteHostTokensFromNativeStorage, readHostTokensFromNativeStorage, writeHostTokensToNativeStorage } from '~/utils/auth/nativeSecureStorage'

const HOST_TOKEN_STORAGE_KEY = 'or3-app:v1:secure-host-tokens'

export interface HostTokenRecord {
  pairedToken?: string
  sessionToken?: string
}

function normalizeHostTokens(tokens?: HostTokenRecord | null) {
  const pairedToken = tokens?.pairedToken?.trim() || undefined
  const sessionToken = tokens?.sessionToken?.trim() || undefined
  return { pairedToken, sessionToken }
}

function readHostTokenMap() {
  if (!import.meta.client) return {} as Record<string, HostTokenRecord>
  const raw = sessionStorage.getItem(HOST_TOKEN_STORAGE_KEY)
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
  if (!import.meta.client) return
  const entries = Object.entries(tokens)
    .map(([hostId, value]) => [hostId, normalizeHostTokens(value)] as const)
    .filter(([, value]) => Boolean(value.pairedToken || value.sessionToken))
  const normalized = Object.fromEntries(entries) as Record<string, HostTokenRecord>
  if (!Object.keys(normalized).length) {
    sessionStorage.removeItem(HOST_TOKEN_STORAGE_KEY)
    void deleteHostTokensFromNativeStorage()
    return
  }
  sessionStorage.setItem(HOST_TOKEN_STORAGE_KEY, JSON.stringify(normalized))
  void writeHostTokensToNativeStorage(normalized)
}

export function resolvePreferredHostToken(host?: Partial<Or3HostProfile> | null) {
  return host?.sessionToken?.trim() || host?.token?.trim() || host?.pairedToken?.trim() || undefined
}

export function withResolvedHostTokens<T extends Partial<Or3HostProfile>>(host: T): T & Pick<Or3HostProfile, 'token' | 'pairedToken' | 'sessionToken'> {
  const pairedToken = host.pairedToken?.trim() || host.token?.trim() || undefined
  const sessionToken = host.sessionToken?.trim() || undefined
  return {
    ...host,
    pairedToken,
    sessionToken,
    token: sessionToken || pairedToken,
  }
}

export function useSecureHostTokens() {
  function loadAllTokens() {
    return readHostTokenMap()
  }

  async function hydrateTokens() {
    if (!import.meta.client) return {} as Record<string, HostTokenRecord>
    const current = readHostTokenMap()
    if (Object.keys(current).length) return current
    const nativeTokens = await readHostTokensFromNativeStorage()
    if (Object.keys(nativeTokens).length) writeHostTokenMap(nativeTokens)
    return nativeTokens
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

  function replaceTokens(hosts: Array<Pick<Or3HostProfile, 'id' | 'pairedToken' | 'sessionToken' | 'token'>>) {
    const next = Object.fromEntries(hosts.map((host) => {
      const resolved = withResolvedHostTokens(host)
      return [host.id, { pairedToken: resolved.pairedToken, sessionToken: resolved.sessionToken }]
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
