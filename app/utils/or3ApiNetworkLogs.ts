import type { AppLogger } from '~/utils/logger';

type NetworkErrorLogSuppression = {
    until: number;
    baseUrl: string;
};

let networkErrorLogSuppression: NetworkErrorLogSuppression | null = null;

function normalizeHostBaseUrl(baseUrl: string) {
    return baseUrl.trim().replace(/\/+$/, '');
}

export function suppressOr3ApiNetworkErrorLogsFor(
    ms: number,
    scope: { baseUrl?: string },
) {
    const duration = Math.max(0, Number(ms) || 0);
    if (duration <= 0) return;

    const baseUrl = normalizeHostBaseUrl(scope.baseUrl?.trim() || '');
    if (!baseUrl) return;

    const until = Math.max(
        networkErrorLogSuppression?.until ?? 0,
        Date.now() + duration,
    );
    networkErrorLogSuppression = { until, baseUrl };
}

export function shouldLogHostNetworkError(requestBaseUrl?: string) {
    const suppression = networkErrorLogSuppression;
    if (!suppression || Date.now() > suppression.until) {
        networkErrorLogSuppression = null;
        return true;
    }

    const normalizedRequestBaseUrl = normalizeHostBaseUrl(
        requestBaseUrl?.trim() || '',
    );
    if (!normalizedRequestBaseUrl) return true;

    return normalizedRequestBaseUrl !== suppression.baseUrl;
}

type HostNetworkLogChannel = 'request' | 'stream:network' | 'stream:read';

const hostNetworkLogLabels: Record<
    HostNetworkLogChannel,
    { errorEvent: string; suppressedEvent: string; detail: string }
> = {
    request: {
        errorEvent: 'request:network_error',
        suppressedEvent: 'request:network_error_suppressed',
        detail: 'Could not reach host',
    },
    'stream:network': {
        errorEvent: 'stream:network_error',
        suppressedEvent: 'stream:network_error_suppressed',
        detail: 'Could not reach host stream',
    },
    'stream:read': {
        errorEvent: 'stream:error',
        suppressedEvent: 'stream:error_suppressed',
        detail: 'SSE stream failed while reading',
    },
};

export function logHostNetworkError(
    logger: AppLogger,
    channel: HostNetworkLogChannel,
    requestBaseUrl: string | undefined,
    payload: Record<string, unknown>,
) {
    const labels = hostNetworkLogLabels[channel];
    if (shouldLogHostNetworkError(requestBaseUrl)) {
        logger.error(labels.errorEvent, labels.detail, payload);
        return;
    }
    logger.debug(labels.suppressedEvent, 'Host is restarting', payload);
}

/** @internal */
export function resetHostNetworkErrorLogSuppressionForTests() {
    networkErrorLogSuppression = null;
}
