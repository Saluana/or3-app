import { computed, ref } from 'vue'
import type { CapabilitiesResponse, HealthResponse, ReadinessResponse } from '~/types/or3-api'
import { useLocalCache } from './useLocalCache'
import { useOr3Api } from './useOr3Api'

const health = ref<HealthResponse | null>(null)
const readiness = ref<ReadinessResponse | null>(null)
const capabilities = ref<CapabilitiesResponse | null>(null)
const loadingStatus = ref(false)

export function useComputerStatus() {
  const api = useOr3Api()
  const cache = useLocalCache()

  const isOnline = computed(() => health.value?.status === 'ok' || health.value?.status === 'healthy')

  async function refreshStatus() {
    loadingStatus.value = true
    try {
      const [nextHealth, nextReadiness, nextCapabilities] = await Promise.all([
        api.request<HealthResponse>('/internal/v1/health'),
        api.request<ReadinessResponse>('/internal/v1/readiness'),
        api.request<CapabilitiesResponse>('/internal/v1/capabilities'),
      ])
      health.value = nextHealth
      readiness.value = nextReadiness
      capabilities.value = nextCapabilities
      const hostId = cache.state.value.activeHostId
      if (hostId) cache.setLastKnownStatus(hostId, { health: nextHealth, readiness: nextReadiness, capabilities: nextCapabilities })
    } finally {
      loadingStatus.value = false
    }
  }

  return { health, readiness, capabilities, loadingStatus, isOnline, refreshStatus }
}
