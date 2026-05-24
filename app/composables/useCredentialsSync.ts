import { nextTick } from 'vue';
import { useActiveHost } from './useActiveHost';
import { useHostReachability } from './useHostReachability';
import { useLocalCache } from './useLocalCache';
import { useSecureHostTokens, withResolvedHostTokens } from './useSecureHostTokens';
import { getDecryptedTokens, needsUnlock } from './usePinLock';

let syncInFlight: Promise<void> | null = null;

/**
 * After PIN unlock, merge decrypted tokens into host profiles and reconcile
 * connection status before host API consumers run.
 */
export async function syncCredentialsAfterUnlock(): Promise<void> {
    if (!import.meta.client) return;
    if (needsUnlock() && !getDecryptedTokens()) return;
    if (syncInFlight) return syncInFlight;

    syncInFlight = (async () => {
        const cache = useLocalCache();
        const tokenStore = useSecureHostTokens();
        cache.forceReload();

        const tokenMap = tokenStore.loadAllTokens();
        if (Object.keys(tokenMap).length) {
            cache.state.value = {
                ...cache.state.value,
                hosts: cache.state.value.hosts.map((host) =>
                    withResolvedHostTokens({
                        ...host,
                        pairedToken:
                            tokenMap[host.id]?.pairedToken ?? host.pairedToken,
                        sessionToken:
                            tokenMap[host.id]?.sessionToken ??
                            host.sessionToken,
                        tokenOrigin:
                            tokenMap[host.id]?.origin ?? host.tokenOrigin,
                    }),
                ),
            };
        }

        await nextTick();
        await useHostReachability().reconcileStatus();
    })().finally(() => {
        syncInFlight = null;
    });

    return syncInFlight;
}
