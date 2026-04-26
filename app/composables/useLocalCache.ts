import { ref } from 'vue'
import type { Or3AppState, Or3HostProfile } from '~/types/app-state'

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
    hosts: state.value.hosts.map(({ token: _token, ...host }) => host),
  }
}

function load() {
  if (loaded || !import.meta.client) return
  loaded = true
  const raw = localStorage.getItem(STORAGE_KEY)
  if (!raw) return

  try {
    state.value = { ...defaultState(), ...JSON.parse(raw) }
    persist()
  } catch {
    state.value = defaultState()
  }
}

function persist() {
  if (!import.meta.client) return
  localStorage.setItem(STORAGE_KEY, JSON.stringify(serializableState()))
}

export function useLocalCache() {
  load()

  function updateHost(host: Or3HostProfile) {
    const existing = state.value.hosts.findIndex((item) => item.id === host.id)
    if (existing >= 0) state.value.hosts.splice(existing, 1, host)
    else state.value.hosts.push(host)
    state.value.activeHostId = host.id
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
    if (import.meta.client) localStorage.removeItem(STORAGE_KEY)
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
