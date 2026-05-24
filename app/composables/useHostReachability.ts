import type { HealthResponse } from '~/types/or3-api';
import { ELECTRON_HOST_PROFILE_ID, useActiveHost } from './useActiveHost';
import { needsUnlock } from './usePinLock';
import { useLocalCache } from './useLocalCache';
import { useOr3Api } from './useOr3Api';

/** Clear stale offline/unauthorized host status after unlock or reload. */
export function useHostReachability() {
    const api = useOr3Api();
    const cache = useLocalCache();
    const { activeHost, updateHost, isPaired } = useActiveHost();

    function restoreOnlineFromCache(host: NonNullable<typeof activeHost.value>) {
        const entry = cache.state.value.lastKnownStatus[host.id]?.value as
            | { health?: HealthResponse | null }
            | undefined;
        const cachedHealth = entry?.health;
        if (
            cachedHealth?.status !== 'ok' &&
            cachedHealth?.status !== 'healthy'
        ) {
            return false;
        }
        updateHost({
            ...host,
            status: 'online',
            lastSeenAt: host.lastSeenAt ?? new Date().toISOString(),
        });
        return true;
    }

    async function reconcileStatus() {
        const host = activeHost.value;
        if (!host || !isPaired.value || needsUnlock()) return;
        if (host.id === ELECTRON_HOST_PROFILE_ID) return;
        if (host.status === 'online') return;

        if (
            (host.status === 'offline' || host.status === 'unauthorized') &&
            restoreOnlineFromCache(host)
        ) {
            return;
        }

        try {
            await api.request<{ status?: string }>('/internal/v1/health', {
                requireAuth: false,
                trackHostStatus: false,
                baseUrl: host.baseUrl,
            });
            updateHost({
                ...host,
                status: 'online',
                lastSeenAt: new Date().toISOString(),
            });
        } catch {
            // Leave persisted status unchanged when the host is still unreachable.
        }
    }

    return { reconcileStatus };
}
