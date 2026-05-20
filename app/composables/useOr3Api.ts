import type { Or3AppError } from '~/types/app-state';
import type { AuthChallengeCode, AuthChallengeError } from '~/types/auth';
import type { Or3SseEvent } from '~/types/or3-api';
import { createLogger } from '~/utils/logger';
import { getActiveTraceId } from '~/utils/logTrace';
import { readSseStream } from '~/utils/or3/sse';
import {
    ELECTRON_HOST_PROFILE_ID,
    useActiveHost,
} from './useActiveHost';
import { useElectronHostSetup } from './useElectronHostSetup';
import {
    normalizedHostOrigin,
    resolveHostAuthTokens,
} from './useSecureHostTokens';

let suppressNetworkErrorLogsUntil = 0;
let hostAuthCooldownUntil = 0;
let hostAuthCooldownMessage = '';

export interface Or3ApiRequestOptions {
    method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
    body?: unknown;
    headers?: Record<string, string>;
    signal?: AbortSignal;
    baseUrl?: string;
    acceptSse?: boolean;
    requireAuth?: boolean;
    preferPairedToken?: boolean;
    onOpen?: ((response: Response) => Promise<void> | void) | undefined;
    onAuthChallenge?: (
        challenge: AuthChallengeError,
    ) => Promise<boolean | void> | boolean | void;
}

interface Or3ApiErrorPayload {
    error?: string;
    message?: string;
    code?: Or3AppError['code'] | string;
    request_id?: number | string;
    approval_id?: number | string;
    [key: string]: unknown;
}

function normalizeBaseUrl(baseUrl: string) {
    return baseUrl.trim().replace(/\/+$/, '');
}

function destinationMatchesTokenOrigin(
    activeBaseUrl?: string,
    destinationBaseUrl?: string,
) {
    if (!destinationBaseUrl) return true;
    const destinationOrigin = normalizedHostOrigin(destinationBaseUrl);
    const activeOrigin = normalizedHostOrigin(activeBaseUrl);
    if (!destinationOrigin || !activeOrigin) return false;
    return destinationOrigin === activeOrigin;
}

export function suppressOr3ApiNetworkErrorLogsFor(ms: number) {
    const duration = Math.max(0, Number(ms) || 0);
    suppressNetworkErrorLogsUntil = Math.max(
        suppressNetworkErrorLogsUntil,
        Date.now() + duration,
    );
}

function shouldLogNetworkError() {
    return Date.now() > suppressNetworkErrorLogsUntil;
}

function hostAuthCooldownError(): Or3AppError | null {
    const remaining = hostAuthCooldownUntil - Date.now();
    if (remaining <= 0) return null;
    return {
        code: 'auth_rate_limited',
        status: 429,
        message: hostAuthCooldownMessage || 'The local OR3 service is catching up. Try again in a moment.',
        retryAfterMs: remaining,
        retryAfterSeconds: Math.max(1, Math.ceil(remaining / 1000)),
    };
}

function noteHostAuthCooldown(error: Or3AppError) {
    if (error.status !== 429 && error.code !== 'auth_rate_limited') return;
    const retryAfterMs = Math.min(Math.max(error.retryAfterMs || 0, 5_000), 30_000);
    hostAuthCooldownUntil = Math.max(hostAuthCooldownUntil, Date.now() + retryAfterMs);
    hostAuthCooldownMessage = error.message;
}

function normalizeChallengeCode(
    code?: string,
): Or3AppError['code'] | undefined {
    const normalized = code?.trim().toUpperCase() as
        | AuthChallengeCode
        | undefined;
    switch (normalized) {
        case 'SESSION_REQUIRED':
            return 'session_required';
        case 'SESSION_EXPIRED':
            return 'session_expired';
        case 'PASSKEY_REQUIRED':
            return 'passkey_required';
        case 'STEP_UP_REQUIRED':
            return 'step_up_required';
        case 'AUTH_UNSUPPORTED':
            return 'auth_unsupported';
        default:
            return undefined;
    }
}

function toAuthChallenge(
    payload?: string | Or3ApiErrorPayload,
    status?: number,
): AuthChallengeError | null {
    if (!payload || typeof payload === 'string') return null;
    const code = payload.code?.toString().trim().toUpperCase() as
        | AuthChallengeCode
        | undefined;
    if (
        !code ||
        ![
            'SESSION_REQUIRED',
            'SESSION_EXPIRED',
            'PASSKEY_REQUIRED',
            'STEP_UP_REQUIRED',
            'AUTH_UNSUPPORTED',
        ].includes(code)
    ) {
        return null;
    }
    const retryAfterSeconds =
        typeof payload.retry_after_seconds === 'number'
            ? payload.retry_after_seconds
            : typeof payload.retryAfterSeconds === 'number'
              ? payload.retryAfterSeconds
              : undefined;
    return {
        code,
        message:
            payload.message?.toString() ||
            payload.error?.toString() ||
            'Authentication is required.',
        status,
        retryAfterSeconds,
        retryAfterMs: retryAfterSeconds ? retryAfterSeconds * 1000 : undefined,
    };
}

const passthroughErrorCodes = new Set<string>([
    'unauthorized',
    'not_found',
    'method_not_allowed',
    'forbidden',
    'rate_limited',
    'validation_failed',
    'capability_unavailable',
    'request_too_large',
    'conflict',
    'timeout',
    'request_failed',
    'missing_token',
    'invalid_token',
    'token_replay',
    'auth_rate_limited',
    'session_required',
    'session_expired',
    'passkey_required',
    'step_up_required',
    'auth_unsupported',
    'approval_required',
    'terminal_unavailable',
    'runner_missing',
    'runner_auth_missing',
    'unsupported_native_session',
    'runner_chat_turn_active',
    'runner_chat_session_not_found',
    'runner_chat_turn_not_found',
    'runner_chat_aborted',
    'chat_session_not_found',
    'invalid_fork_anchor',
    'fork_anchor_incomplete',
    'unsupported_native_fork',
]);

function mapError(
    status: number,
    payload?: string | Or3ApiErrorPayload,
    cause?: unknown,
): Or3AppError {
    const message =
        typeof payload === 'string'
            ? payload
            : payload?.message || payload?.error;
    const payloadCode = typeof payload === 'object' ? payload.code : undefined;
    const challengeCode = normalizeChallengeCode(
        typeof payloadCode === 'string' ? payloadCode : undefined,
    );
    const normalizedPayloadCode =
        typeof payloadCode === 'string' ? payloadCode.trim() : '';
    const code =
        normalizedPayloadCode &&
        passthroughErrorCodes.has(normalizedPayloadCode)
            ? (normalizedPayloadCode as Or3AppError['code'])
            : challengeCode
              ? challengeCode
              : status === 401
                ? 'auth_required'
                : status === 403
                  ? 'forbidden'
                  : status === 404
                    ? 'file_not_found'
                    : status === 429
                      ? 'rate_limited'
                      : status === 400
                        ? 'validation_failed'
                        : status === 503
                          ? 'capability_unavailable'
                          : 'unknown';

    return {
        ...(typeof payload === 'object' ? payload : {}),
        code,
        status,
        message: message || `Request failed with status ${status}`,
        retryAfterSeconds:
            typeof payload === 'object' &&
            typeof payload.retry_after_seconds === 'number'
                ? payload.retry_after_seconds
                : undefined,
        retryAfterMs:
            typeof payload === 'object' &&
            typeof payload.retry_after_seconds === 'number'
                ? payload.retry_after_seconds * 1000
                : undefined,
        authChallengeCode:
            typeof payloadCode === 'string' ? payloadCode : undefined,
        cause,
    };
}

async function readError(response: Response) {
    const text = await response.text().catch(() => '');
    if (!text) return response.statusText;
    try {
        return JSON.parse(text) as Or3ApiErrorPayload;
    } catch {
        return text;
    }
}

export function useOr3Api() {
    const { activeHost, updateHost } = useActiveHost();
    const electronHost = useElectronHostSetup();
    const logger = createLogger('api');

    async function ensureElectronHostLoaded() {
        if (typeof window === 'undefined' || !window.or3Desktop) return;
        await electronHost.ensureLoaded?.().catch(() => undefined);
    }

    function canUpdateActiveHostStatus(explicitBaseUrl?: string) {
        if (!activeHost.value) return false;
        if (activeHost.value.id === ELECTRON_HOST_PROFILE_ID) return false;
        if (!explicitBaseUrl) return true;
        return (
            normalizeBaseUrl(explicitBaseUrl) ===
            normalizeBaseUrl(activeHost.value.baseUrl)
        );
    }

    function updateActiveHostStatus(
        status: 'online' | 'offline' | 'unauthorized' | 'unknown',
        explicitBaseUrl?: string,
    ) {
        if (!canUpdateActiveHostStatus(explicitBaseUrl) || !activeHost.value)
            return;

        const nextLastSeenAt =
            status === 'online'
                ? new Date().toISOString()
                : activeHost.value.lastSeenAt;

        if (
            activeHost.value.status === status &&
            nextLastSeenAt === activeHost.value.lastSeenAt
        ) {
            return;
        }

        updateHost({
            ...activeHost.value,
            status,
            lastSeenAt: nextLastSeenAt,
        });
    }

    function buildUrl(path: string, explicitBaseUrl?: string) {
        const baseUrl = explicitBaseUrl || activeHost.value?.baseUrl;
        if (!baseUrl) throw mapError(0, 'No or3-intern host is configured');
        const normalizedPath = path.startsWith('/') ? path : `/${path}`;
        return `${normalizeBaseUrl(baseUrl)}${normalizedPath}`;
    }

    async function resolveElectronHostToken(method: string, path: string) {
        if (!electronHost.isElectronHostMode.value) return undefined;
        if (activeHost.value?.id !== ELECTRON_HOST_PROFILE_ID) return undefined;
        if (typeof window === 'undefined') return undefined;
        const token = await window.or3Desktop?.intern.issueServiceToken({ method, path }).catch(() => null);
        return token?.token?.trim() || undefined;
    }

    function resolveRequestAuthToken(preferPairedToken?: boolean) {
        if (activeHost.value?.id === ELECTRON_HOST_PROFILE_ID) return undefined;
        const tokens = resolveHostAuthTokens(activeHost.value);
        if (!preferPairedToken) return tokens.authToken;
        return activeHost.value?.tokenOrigin && !tokens.authToken
            ? undefined
            : activeHost.value?.pairedToken?.trim() || undefined;
    }

    function resolveRequestSessionToken() {
        if (activeHost.value?.id === ELECTRON_HOST_PROFILE_ID) return undefined;
        return resolveHostAuthTokens(activeHost.value).sessionToken;
    }

    async function request<T>(
        path: string,
        options: Or3ApiRequestOptions = {},
    ): Promise<T> {
        await ensureElectronHostLoaded();
        const requiresAuth = options.requireAuth !== false;
        const method = options.method || (options.body === undefined ? 'GET' : 'POST');
        const destinationAllowsHostAuth = destinationMatchesTokenOrigin(
            activeHost.value?.baseUrl,
            options.baseUrl,
        );
        const cooldown = activeHost.value?.id === ELECTRON_HOST_PROFILE_ID ? hostAuthCooldownError() : null;
        if (cooldown) throw cooldown;
        const electronAuthToken = destinationAllowsHostAuth
            ? await resolveElectronHostToken(method, path)
            : undefined;
        const authToken = destinationAllowsHostAuth
            ? electronAuthToken || resolveRequestAuthToken(options.preferPairedToken)
            : undefined;
        const sessionToken = destinationAllowsHostAuth
            ? resolveRequestSessionToken()
            : undefined;
        if (requiresAuth && !authToken) {
            throw {
                code: 'auth_required',
                status: 401,
                message:
                    'Connect to your computer and finish pairing before using this area.',
            } satisfies Or3AppError;
        }

        const headers: Record<string, string> = {
            Accept: 'application/json',
            ...options.headers,
        };

        if (options.body !== undefined)
            headers['Content-Type'] = 'application/json';
        if (authToken && requiresAuth)
            headers.Authorization = `Bearer ${authToken}`;
        if (electronAuthToken && requiresAuth)
            headers['X-Or3-Auth-Method'] = 'shared-secret';
        if (sessionToken && requiresAuth)
            headers['X-Or3-Session'] = sessionToken;
        const traceId = getActiveTraceId();
        if (traceId && !headers['X-Trace-Id']) headers['X-Trace-Id'] = traceId;

        let response: Response;
        try {
            response = await fetch(buildUrl(path, options.baseUrl), {
                method,
                headers,
                body:
                    options.body === undefined
                        ? undefined
                        : JSON.stringify(options.body),
                signal: options.signal,
            });
        } catch (error) {
            updateActiveHostStatus('offline', options.baseUrl);
            const payload = {
                path,
                method,
                error: error instanceof Error ? error.message : String(error),
            };
            if (shouldLogNetworkError()) {
                logger.error(
                    'request:network_error',
                    'Could not reach host',
                    payload,
                );
            } else {
                logger.debug(
                    'request:network_error_suppressed',
                    'Host is restarting',
                    payload,
                );
            }
            throw {
                code: 'host_unreachable',
                message: 'Could not reach the selected computer.',
                cause: error,
            } satisfies Or3AppError;
        }

        if (!response.ok) {
            const payload = await readError(response);
            if (response.status === 401 || response.status === 403) {
                updateActiveHostStatus('unauthorized', options.baseUrl);
            } else {
                updateActiveHostStatus('online', options.baseUrl);
            }
            const challenge = toAuthChallenge(payload, response.status);
            if (challenge && options.onAuthChallenge) {
                const shouldRetry = await options.onAuthChallenge(challenge);
                if (shouldRetry !== false) {
                    return await request<T>(path, {
                        ...options,
                        onAuthChallenge: undefined,
                    });
                }
            }
            logger.warn(
                'request:error_response',
                'Request returned an error response',
                {
                    path,
                    status: response.status,
                    requestId:
                        response.headers.get('X-Request-Id') ||
                        (typeof payload === 'object'
                            ? payload.request_id
                            : undefined),
                    responseTraceId:
                        response.headers.get('X-Trace-Id') ||
                        (typeof payload === 'object' &&
                        typeof payload.trace_id === 'string'
                            ? payload.trace_id
                            : undefined),
                },
            );
            const error = mapError(response.status, payload);
            if (activeHost.value?.id === ELECTRON_HOST_PROFILE_ID) noteHostAuthCooldown(error);
            throw error;
        }
        if (activeHost.value?.id === ELECTRON_HOST_PROFILE_ID) {
            hostAuthCooldownUntil = 0;
            hostAuthCooldownMessage = '';
        }
        updateActiveHostStatus('online', options.baseUrl);
        if (response.status === 204) return undefined as T;
        return (await response.json()) as T;
    }

    async function* stream(
        path: string,
        options: Or3ApiRequestOptions = {},
    ): AsyncIterable<Or3SseEvent> {
        await ensureElectronHostLoaded();
        const requiresAuth = options.requireAuth !== false;
        const method = options.method || 'POST';
        const destinationAllowsHostAuth = destinationMatchesTokenOrigin(
            activeHost.value?.baseUrl,
            options.baseUrl,
        );
        const cooldown = activeHost.value?.id === ELECTRON_HOST_PROFILE_ID ? hostAuthCooldownError() : null;
        if (cooldown) throw cooldown;
        const electronAuthToken = destinationAllowsHostAuth
            ? await resolveElectronHostToken(method, path)
            : undefined;
        const authToken = destinationAllowsHostAuth
            ? electronAuthToken || resolveRequestAuthToken(options.preferPairedToken)
            : undefined;
        const sessionToken = destinationAllowsHostAuth
            ? resolveRequestSessionToken()
            : undefined;
        if (requiresAuth && !authToken) {
            throw {
                code: 'auth_required',
                status: 401,
                message:
                    'Connect to your computer and finish pairing before using this area.',
            } satisfies Or3AppError;
        }

        const headers: Record<string, string> = {
            Accept: 'text/event-stream',
            ...options.headers,
        };

        if (options.body !== undefined)
            headers['Content-Type'] = 'application/json';
        if (authToken && requiresAuth)
            headers.Authorization = `Bearer ${authToken}`;
        if (electronAuthToken && requiresAuth)
            headers['X-Or3-Auth-Method'] = 'shared-secret';
        if (sessionToken && requiresAuth)
            headers['X-Or3-Session'] = sessionToken;
        const traceId = getActiveTraceId();
        if (traceId && !headers['X-Trace-Id']) headers['X-Trace-Id'] = traceId;

        let response: Response;
        try {
            response = await fetch(buildUrl(path, options.baseUrl), {
                method,
                headers,
                body:
                    options.body === undefined
                        ? undefined
                        : JSON.stringify(options.body),
                signal: options.signal,
            });
        } catch (error) {
            logger.error(
                'stream:network_error',
                'Could not reach host stream',
                {
                    path,
                    method,
                    error:
                        error instanceof Error ? error.message : String(error),
                },
            );
            throw {
                code: 'host_unreachable',
                message: 'Could not reach the selected computer.',
                cause: error,
            } satisfies Or3AppError;
        }

        if (!response.ok) {
            const payload = await readError(response);
            const challenge = toAuthChallenge(payload, response.status);
            if (challenge && options.onAuthChallenge) {
                const shouldRetry = await options.onAuthChallenge(challenge);
                if (shouldRetry !== false) {
                    yield* stream(path, {
                        ...options,
                        onAuthChallenge: undefined,
                    });
                    return;
                }
            }
            logger.warn(
                'stream:error_response',
                'Stream returned an error response',
                {
                    path,
                    status: response.status,
                    requestId:
                        response.headers.get('X-Request-Id') ||
                        (typeof payload === 'object'
                            ? payload.request_id
                            : undefined),
                    responseTraceId:
                        response.headers.get('X-Trace-Id') ||
                        (typeof payload === 'object' &&
                        typeof payload.trace_id === 'string'
                            ? payload.trace_id
                            : undefined),
                },
            );
            throw mapError(response.status, payload);
        }
        if (options.onOpen) await options.onOpen(response);
        if (!response.body)
            throw {
                code: 'stream_failed',
                message: 'The service did not return a stream.',
            } satisfies Or3AppError;

        logger.info('stream:open', 'SSE stream opened', {
            path,
            status: response.status,
            requestId: response.headers.get('X-Request-Id') || undefined,
            responseTraceId: response.headers.get('X-Trace-Id') || undefined,
        });
        try {
            yield* readSseStream(response.body);
        } catch (error) {
            logger.error('stream:error', 'SSE stream failed while reading', {
                path,
                error: error instanceof Error ? error.message : String(error),
            });
            throw error;
        } finally {
            logger.info('stream:close', 'SSE stream closed', { path });
        }
    }

    return { request, stream, buildUrl, normalizeBaseUrl };
}
