import { suppressOr3ApiNetworkErrorLogsFor } from '~/utils/or3ApiNetworkLogs';
import { useActiveHost } from './useActiveHost';

export const RESTART_NETWORK_ERROR_SUPPRESSION_MS = 65_000;

/** Suppresses host network error logs for the paired computer during service restart. */
export function useRestartNetworkLogSuppression() {
    const { activeHost } = useActiveHost();

    function suppressNetworkErrorsForActiveHost(
        ms = RESTART_NETWORK_ERROR_SUPPRESSION_MS,
    ) {
        const baseUrl = activeHost.value?.baseUrl?.trim();
        if (!baseUrl) return;
        suppressOr3ApiNetworkErrorLogsFor(ms, { baseUrl });
    }

    return suppressNetworkErrorsForActiveHost;
}
