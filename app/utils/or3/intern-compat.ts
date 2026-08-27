import {
    createInternTransport,
    InternClientError,
    type InternTransport,
} from '@or3/intern-client';

const DEFAULT_REQUEST_TIMEOUT_MS = 30_000;
const DEFAULT_STREAM_CONNECT_TIMEOUT_MS = 15_000;

function compatibilityHeaderName(name: string): string {
    return name
        .split('-')
        .map((part) => {
            const lower = part.toLowerCase();
            if (lower === 'or3') return 'Or3';
            return `${lower.charAt(0).toUpperCase()}${lower.slice(1)}`;
        })
        .join('-');
}

function compatibilityFetch(
    input: RequestInfo | URL,
    init?: RequestInit,
): Promise<Response> {
    const headers: Record<string, string> = {};
    new Headers(init?.headers).forEach((value, name) => {
        headers[compatibilityHeaderName(name)] = value;
    });
    return globalThis.fetch(input, { ...init, headers });
}

/**
 * Compatibility boundary for or3-app.
 *
 * Existing composables continue to own host selection, secure-session
 * enrollment, PIN gating, and host status. Raw HTTP/SSE execution is delegated
 * to the framework-free client so both Nuxt applications share URL validation,
 * timeout, abort, redaction, and stream parsing behavior.
 */
export function createOr3InternTransport(baseUrl: string): InternTransport {
    return createInternTransport({
        baseUrl,
        fetch: compatibilityFetch,
        defaultTimeoutMs: DEFAULT_REQUEST_TIMEOUT_MS,
        streamConnectTimeoutMs: DEFAULT_STREAM_CONNECT_TIMEOUT_MS,
    });
}

type InternErrorDetails = {
    payload?: unknown;
    requestId?: string;
    status?: number;
};

function isRecord(value: unknown): value is Record<string, unknown> {
    return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

export function internErrorDetails(
    error: unknown,
): InternErrorDetails | undefined {
    if (!(error instanceof InternClientError) || !isRecord(error.details)) {
        return undefined;
    }
    return {
        payload: error.details.payload,
        requestId:
            typeof error.details.requestId === 'string'
                ? error.details.requestId
                : error.requestId,
        status:
            typeof error.details.status === 'number'
                ? error.details.status
                : error.status,
    };
}

export function isInternClientError(
    error: unknown,
): error is InternClientError {
    return error instanceof InternClientError;
}
