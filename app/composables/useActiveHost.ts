import { computed } from 'vue';
import type { Or3HostProfile } from '~/types/app-state';
import { useLocalCache } from './useLocalCache';
import { useElectronHostSetup } from './useElectronHostSetup';
import { hasPinProtectedTokenStore } from './usePinLock';

export const ELECTRON_HOST_PROFILE_ID = 'electron-local-host';
export const ELECTRON_HOST_TOKEN_SENTINEL = 'electron-local-service-token';

function normalizeElectronHostBaseUrl(baseUrl?: string) {
    if (!baseUrl) return '';
    try {
        const url = new URL(baseUrl);
        if (url.hostname === '0.0.0.0') url.hostname = '127.0.0.1';
        return url.toString().replace(/\/$/, '');
    } catch {
        return baseUrl.replace('://0.0.0.0:', '://127.0.0.1:');
    }
}

export function useActiveHost() {
    const cache = useLocalCache();
    const electronHost = useElectronHostSetup();

    const hosts = computed(() => cache.state.value.hosts);
    const activeHost = computed<Or3HostProfile | null>(() => {
        if (electronHost.isElectronHostMode.value) {
            const status = electronHost.serviceStatus.value;
            const baseUrl = normalizeElectronHostBaseUrl(status.baseUrl || electronHost.setupState.value.serviceBaseUrl);
            if (baseUrl) {
                return {
                    id: ELECTRON_HOST_PROFILE_ID,
                    name: electronHost.setupState.value.machineName || 'This computer',
                    baseUrl,
                    token: ELECTRON_HOST_TOKEN_SENTINEL,
                    role: 'admin',
                    lastSeenAt: status.state === 'online' ? new Date().toISOString() : undefined,
                    status: status.state === 'online' ? 'online' : status.state === 'stopped' ? 'offline' : 'unknown',
                };
            }
        }
        const id = cache.state.value.activeHostId;
        return (
            hosts.value.find((host) => host.id === id) ?? hosts.value[0] ?? null
        );
    });

    function hostRetainsPairing(host: Or3HostProfile | null | undefined) {
        if (!host?.baseUrl) return false;
        if (host.authMode === 'secure-session') return true;
        if (host.token || host.pairedToken) return true;
        if (hasPinProtectedTokenStore()) return true;
        return false;
    }

    const isPaired = computed(() => hostRetainsPairing(activeHost.value));
    const isConnected = computed(
        () => isPaired.value && activeHost.value?.status === 'online',
    );

    function disconnectActiveHost() {
        if (activeHost.value?.id === ELECTRON_HOST_PROFILE_ID) return false;
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
