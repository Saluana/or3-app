import { computed } from 'vue'
import type { Or3HostProfile } from '~/types/app-state'
import { useLocalCache } from './useLocalCache'

export function useActiveHost() {
  const cache = useLocalCache()

  const hosts = computed(() => cache.state.value.hosts)
  const activeHost = computed<Or3HostProfile | null>(() => {
    const id = cache.state.value.activeHostId
    return hosts.value.find((host) => host.id === id) ?? hosts.value[0] ?? null
  })

  const isConnected = computed(() => Boolean(activeHost.value?.token))

  return {
    hosts,
    activeHost,
    isConnected,
    setActiveHost: cache.setActiveHost,
    updateHost: cache.updateHost,
    removeHost: cache.removeHost,
  }
}
