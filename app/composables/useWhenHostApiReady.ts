import { watch, type WatchStopHandle } from 'vue';
import { bootstrapHostWorkspace } from './useHostWorkspaceBootstrap';
import { useActiveHost } from './useActiveHost';
import { canUseHostApi } from './useSecureHostTokens';

/**
 * Run work only after PIN unlock and host tokens are available.
 * Re-runs when credentials become ready again (e.g. after PIN unlock).
 */
export function useWhenHostApiReady(
    run: () => void | Promise<void>,
    options?: { immediate?: boolean },
): WatchStopHandle {
    const { activeHost } = useActiveHost();

    return watch(
        () =>
            canUseHostApi(activeHost.value) ? activeHost.value?.id ?? '' : '',
        (hostId) => {
            if (!hostId) return;
            void (async () => {
                await bootstrapHostWorkspace();
                await Promise.resolve(run());
            })();
        },
        { immediate: options?.immediate ?? true },
    );
}
