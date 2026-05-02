import { computed, ref } from 'vue'
import type { AppActionDescriptor, AppBootstrapResponse, CapabilitiesResponse, HealthResponse, ReadinessResponse } from '~/types/or3-api'
import { coerceReadinessPayload } from '~/utils/or3/readiness'
import { useLocalCache } from './useLocalCache'
import { useOr3Api } from './useOr3Api'

const health = ref<HealthResponse | null>(null)
const readiness = ref<ReadinessResponse | null>(null)
const capabilities = ref<CapabilitiesResponse | null>(null)
const bootstrap = ref<AppBootstrapResponse | null>(null)
const loadingStatus = ref(false)

export function useComputerStatus() {
  const api = useOr3Api()
  const cache = useLocalCache()

  const isOnline = computed(() => health.value?.status === 'ok' || health.value?.status === 'healthy')
  const restartAction = computed<AppActionDescriptor | null>(() => bootstrap.value?.actions?.find((action) => action.id === 'restart-service') ?? null)

  async function refreshStatusFallback() {
    const [healthResult, readinessResult, capabilitiesResult] = await Promise.allSettled([
      api.request<HealthResponse>('/internal/v1/health'),
      api.request<ReadinessResponse>('/internal/v1/readiness'),
      api.request<CapabilitiesResponse>('/internal/v1/capabilities'),
    ])

    if (healthResult.status === 'fulfilled') {
      health.value = healthResult.value
    } else {
      health.value = null
    }

    if (readinessResult.status === 'fulfilled') {
      readiness.value = readinessResult.value
    } else {
      readiness.value = coerceReadinessPayload(readinessResult.reason)
    }

    if (capabilitiesResult.status === 'fulfilled') {
      capabilities.value = capabilitiesResult.value
    } else {
      capabilities.value = null
    }

    if (healthResult.status === 'rejected' && capabilitiesResult.status === 'rejected') {
      throw healthResult.reason
    }
  }

  async function refreshStatus() {
    loadingStatus.value = true
    try {
      try {
        const nextBootstrap = await api.request<AppBootstrapResponse>('/internal/v1/app/bootstrap')
        bootstrap.value = nextBootstrap
        health.value = nextBootstrap.status?.health ?? null
        readiness.value = nextBootstrap.status?.readiness ?? null
        capabilities.value = nextBootstrap.status?.capabilities ?? null
      } catch (error: any) {
        if (![404, 405].includes(error?.status) && error?.code !== 'capability_unavailable') {
          throw error
        }
        bootstrap.value = null
        await refreshStatusFallback()
      }

      const hostId = cache.state.value.activeHostId
      if (hostId && health.value && capabilities.value) {
        cache.setLastKnownStatus(hostId, { health: health.value, readiness: readiness.value, capabilities: capabilities.value })
      }
    } finally {
      loadingStatus.value = false
    }
  }

  return { health, readiness, capabilities, bootstrap, restartAction, loadingStatus, isOnline, refreshStatus }
}
