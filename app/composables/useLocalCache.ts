import { ref } from 'vue'
import type { Or3AppState, Or3HostProfile } from '~/types/app-state'
import { useSecureHostTokens, withResolvedHostTokens } from './useSecureHostTokens'

const STORAGE_KEY = 'or3-app:v1:state'

const defaultState = (): Or3AppState => ({
  activeHostId: null,
  hosts: [],
  sessions: [],
  messages: [],
  drafts: {},
  recentJobs: {},
  lastKnownStatus: {},
  preferences: {},
})

const state = ref<Or3AppState>(defaultState())
let loaded = false

function serializableState() {
  return {
    ...state.value,
    hosts: state.value.hosts.map(({ token: _token, pairedToken: _pairedToken, sessionToken: _sessionToken, ...host }) => host),
  }
}

function persistSessionTokens() {
  useSecureHostTokens().replaceTokens(state.value.hosts)
}

function load() {
  if (loaded || !import.meta.client) return
  loaded = true
  const tokenStore = useSecureHostTokens()
  const raw = localStorage.getItem(STORAGE_KEY)
  if (!raw) return

  try {
    const parsed = { ...defaultState(), ...JSON.parse(raw) } as Or3AppState
    const tokens = tokenStore.loadAllTokens()
    state.value = {
      ...parsed,
      hosts: (parsed.hosts ?? []).map((host) => withResolvedHostTokens({
        ...host,
        pairedToken: tokens[host.id]?.pairedToken,
        sessionToken: tokens[host.id]?.sessionToken,
      })),
    }
    persist()
    void tokenStore.hydrateTokens().then((nativeTokens) => {
		if (!Object.keys(nativeTokens).length) return
		state.value = {
			...state.value,
			hosts: state.value.hosts.map((host) => withResolvedHostTokens({
				...host,
				pairedToken: nativeTokens[host.id]?.pairedToken ?? host.pairedToken,
				sessionToken: nativeTokens[host.id]?.sessionToken ?? host.sessionToken,
			})),
		}
		persist()
	})
  } catch {
    state.value = defaultState()
  }
}

function persist() {
  if (!import.meta.client) return
  localStorage.setItem(STORAGE_KEY, JSON.stringify(serializableState()))
  persistSessionTokens()
}

export function useLocalCache() {
  load()

  function updateHost(host: Or3HostProfile) {
    const normalizedHost = withResolvedHostTokens(host)
    const existing = state.value.hosts.findIndex((item) => item.id === host.id)
    if (existing >= 0) state.value.hosts.splice(existing, 1, normalizedHost)
    else state.value.hosts.push(normalizedHost)
    state.value.activeHostId = normalizedHost.id
    persist()
  }

  function setActiveHost(hostId: string) {
    state.value.activeHostId = hostId
    persist()
  }

  function removeHost(hostId: string) {
    state.value.hosts = state.value.hosts.filter((host) => host.id !== hostId)
    if (state.value.activeHostId === hostId) state.value.activeHostId = state.value.hosts[0]?.id ?? null
    persist()
  }

  function setDraft(key: string, value: string) {
    state.value.drafts[key] = value
    persist()
  }

  function setLastKnownStatus(hostId: string, value: unknown) {
    state.value.lastKnownStatus[hostId] = { value, checkedAt: new Date().toISOString() }
    persist()
  }

  function clearAll() {
    state.value = defaultState()
    if (import.meta.client) {
      localStorage.removeItem(STORAGE_KEY)
    }
    useSecureHostTokens().replaceTokens([])
  }

  return {
    state,
    persist,
    updateHost,
    setActiveHost,
    removeHost,
    setDraft,
    setLastKnownStatus,
    clearAll,
  }
}
