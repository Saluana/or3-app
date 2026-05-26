import { useActiveHost } from './useActiveHost';
import { canUseHostApi } from './useSecureHostTokens';

let bootstrappedHostId = '';
let bootstrapPromise: Promise<void> | null = null;

/**
 * One coordinated refresh per host after PIN unlock / credentials settle.
 * Prevents duplicate parallel calls that trip service auth rate limits.
 */
export async function bootstrapHostWorkspace(options?: {
    force?: boolean;
}): Promise<void> {
    if (!import.meta.client) return;

    const { activeHost } = useActiveHost();
    const host = activeHost.value;
    if (!canUseHostApi(host)) return;

    const hostId = host?.id ?? '';
    if (!hostId) return;

    if (options?.force) {
        bootstrappedHostId = '';
    }

    if (
        !options?.force &&
        bootstrappedHostId === hostId &&
        bootstrapPromise
    ) {
        return bootstrapPromise;
    }

    if (!options?.force && bootstrappedHostId === hostId && !bootstrapPromise) {
        return;
    }

    bootstrapPromise = (async () => {
        const [
            { useHostReachability },
            { useComputerStatus },
            { useApprovals },
            { useChatRunners },
            { useJobs },
        ] = await Promise.all([
            import('./useHostReachability'),
            import('./useComputerStatus'),
            import('./useApprovals'),
            import('./useChatRunners'),
            import('./useJobs'),
        ]);

        await Promise.allSettled([
            useHostReachability().reconcileStatus(),
            useComputerStatus().refreshStatus(),
            useApprovals().loadPendingCount(),
            useChatRunners().refresh(),
            useJobs().loadAgentRunners(),
        ]);

        bootstrappedHostId = hostId;
    })().finally(() => {
        bootstrapPromise = null;
    });

    return bootstrapPromise;
}

export function resetHostWorkspaceBootstrap(hostId?: string) {
    if (!hostId || bootstrappedHostId === hostId) {
        bootstrappedHostId = '';
    }
}
