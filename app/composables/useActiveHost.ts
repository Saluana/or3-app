import { computed } from 'vue';
import type { Or3HostProfile } from '~/types/app-state';
import { useLocalCache } from './useLocalCache';

export function useActiveHost() {
    const cache = useLocalCache();

    const hosts = computed(() => cache.state.value.hosts);
    const activeHost = computed<Or3HostProfile | null>(() => {
        const id = cache.state.value.activeHostId;
        return (
            hosts.value.find((host) => host.id === id) ?? hosts.value[0] ?? null
        );
    });

    const isPaired = computed(() => Boolean(activeHost.value?.token));
    const isConnected = computed(
        () => isPaired.value && activeHost.value?.status === 'online',
    );

    function disconnectActiveHost() {
        if (!activeHost.value) return false;
        cache.removeHost(activeHost.value.id);
        return true;
    }

    return {
        hosts,
        activeHost,
        isPaired,
        isConnected,
        setActiveHost: cache.setActiveHost,
        updateHost: cache.updateHost,
        removeHost: cache.removeHost,
        disconnectActiveHost,
    };
}
