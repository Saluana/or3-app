import { computed, ref } from 'vue'
import type { DeviceInfo, HealthResponse, PairingExchangeResponse, PairingRequestResponse } from '~/types/or3-api'
import type { Or3HostProfile } from '~/types/app-state'
import { useLocalCache } from './useLocalCache'
import { useOr3Api } from './useOr3Api'

interface StartPairingInput {
  baseUrl: string
  displayName: string
  deviceName: string
}

const pendingPairing = ref<PairingRequestResponse | null>(null)
const pairingError = ref<string | null>(null)
const pairingHost = ref<{ baseUrl: string; displayName: string; deviceName: string } | null>(null)

function hostIdFromUrl(baseUrl: string) {
  return baseUrl.trim().replace(/^https?:\/\//, '').replace(/[^a-z0-9]+/gi, '-').replace(/^-|-$/g, '').toLowerCase() || 'local'
}

export function usePairing() {
  const cache = useLocalCache()
  const api = useOr3Api()
  const isPairing = computed(() => Boolean(pendingPairing.value))

  async function startPairing(input: StartPairingInput) {
    pairingError.value = null
    pairingHost.value = input
    const baseUrl = input.baseUrl.trim().replace(/\/+$/, '')
    const response = await fetch(`${baseUrl}/internal/v1/pairing/requests`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({
        role: 'operator',
        display_name: input.deviceName || 'or3-app',
        origin: 'or3-app',
      }),
    })

    if (!response.ok) {
      pairingError.value = 'Could not start pairing. Confirm or3-intern service is running and reachable.'
      throw new Error(pairingError.value)
    }

    pendingPairing.value = await response.json() as PairingRequestResponse
    return pendingPairing.value
  }

  async function exchangeCode(code = pendingPairing.value?.code) {
    if (!pendingPairing.value || !pairingHost.value || !code) throw new Error('No pairing request is active')
    const baseUrl = pairingHost.value.baseUrl.trim().replace(/\/+$/, '')
    const requestId = pendingPairing.value.request_id ?? pendingPairing.value.id
    const response = await fetch(`${baseUrl}/internal/v1/pairing/exchange`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({ request_id: requestId, code }),
    })

    if (!response.ok) {
      pairingError.value = 'Pairing is not approved yet or the code expired.'
      throw new Error(pairingError.value)
    }

    const exchanged = await response.json() as PairingExchangeResponse
    const host: Or3HostProfile = {
      id: hostIdFromUrl(baseUrl),
      name: pairingHost.value.displayName || 'My Computer',
      baseUrl,
      token: exchanged.token,
      role: exchanged.role,
      deviceId: exchanged.device_id,
      status: 'unknown',
      lastSeenAt: new Date().toISOString(),
    }

    cache.updateHost(host)
    pendingPairing.value = null
    pairingHost.value = null
    return host
  }

  async function verifyActiveHost() {
    const health = await api.request<HealthResponse>('/internal/v1/health')
    const activeHostId = cache.state.value.activeHostId
    const activeHost = cache.state.value.hosts.find((host) => host.id === activeHostId)
    if (activeHost) cache.updateHost({ ...activeHost, status: 'online', lastSeenAt: new Date().toISOString() })
    return health
  }

  async function listDevices() {
    const response = await api.request<{ items?: DeviceInfo[] } | DeviceInfo[]>('/internal/v1/devices')
    return Array.isArray(response) ? response : response.items ?? []
  }

  async function revokeDevice(deviceId: string) {
    return await api.request<{ device_id: string; status: string }>(`/internal/v1/devices/${encodeURIComponent(deviceId)}/revoke`, { method: 'POST' })
  }

  async function rotateDevice(deviceId: string) {
    return await api.request<{ device_id: string; token: string }>(`/internal/v1/devices/${encodeURIComponent(deviceId)}/rotate`, { method: 'POST' })
  }

  return {
    pendingPairing,
    pairingError,
    isPairing,
    startPairing,
    exchangeCode,
    verifyActiveHost,
    listDevices,
    revokeDevice,
    rotateDevice,
  }
}
