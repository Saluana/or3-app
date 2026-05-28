import type { Or3AppError } from '~/types/app-state';
import { coerceErrorText, serializeErrorForLog } from '~/utils/assistant-stream/errors';
import type { AuthChallengeCode, AuthChallengeError } from '~/types/auth';
import type { Or3SseEvent } from '~/types/or3-api';
import { createLogger } from '~/utils/logger';
import { getActiveTraceId } from '~/utils/logTrace';
import {
    logHostNetworkError,
    suppressOr3ApiNetworkErrorLogsFor,
} from '~/utils/or3ApiNetworkLogs';

export { suppressOr3ApiNetworkErrorLogsFor };
import { readSseStream } from '~/utils/or3/sse';
import {
    buildSecureSessionStartPayload,
    loadSecureConnectionState,
    validateSecureSessionClaims,
    type SecureSessionClaims,
} from '~/utils/or3/secure-connections';
import { ELECTRON_HOST_PROFILE_ID, useActiveHost } from './useActiveHost';
import { useElectronHostSetup } from './useElectronHostSetup';
import { ensurePinSessionActive, needsUnlock } from './usePinLock';
import {
    hostHasUsableCredentials,
    normalizedHostOrigin,
    resolveHostAuthTokens,
    withResolvedHostTokens,
} from './useSecureHostTokens';

let hostAuthCooldownUntil = 0;
let hostAuthCooldownMessage = '';
const inflightGetRequests = new Map<string, Promise<unknown>>();

function dedupeGetRequest<T>(key: string, run: () => Promise<T>): Promise<T> {
    const existing = inflightGetRequests.get(key);
    if (existing) return existing as Promise<T>;
    const promise = run().finally(() => {
        if (inflightGetRequests.get(key) === promise) {
            inflightGetRequests.delete(key);
        }
    });
    inflightGetRequests.set(key, promise);
    return promise;
}

function getRequestDedupeKey(
    method: string,
    path: string,
    baseUrl?: string,
    activeBaseUrl?: string,
) {
    if (method !== 'GET') return '';
    const root = normalizeBaseUrl(baseUrl || activeBaseUrl || '');
    return root ? `${root}:${path}` : '';
}

const secureSessionCache: Record<
    string,
    {
        claims?: SecureSessionClaims;
        pending?: Promise<SecureSessionClaims>;
    }
> = {};

export interface Or3ApiRequestOptions {
    method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
    body?: unknown;
    headers?: Record<string, string>;
    signal?: AbortSignal;
    baseUrl?: string;
    acceptSse?: boolean;
    requireAuth?: boolean;
    preferPairedToken?: boolean;
    trackHostStatus?: boolean;
    onOpen?: ((response: Response) => Promise<void> | void) | undefined;
    onAuthChallenge?: (
        challenge: AuthChallengeError,
    ) => Promise<boolean | void> | boolean | void;
    /** @internal */
    _retryInvalidToken?: boolean;
    /** @internal */
    _skipDedupe?: boolean;
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

function isAbortError(value: unknown) {
    return (
        (value instanceof DOMException && value.name === 'AbortError') ||
        (value instanceof Error && value.name === 'AbortError')
    );
}

function hostAuthCooldownError(): Or3AppError | null {
    const remaining = hostAuthCooldownUntil - Date.now();
    if (remaining <= 0) return null;
    return {
        code: 'auth_rate_limited',
        status: 429,
        message:
            hostAuthCooldownMessage ||
            'The local OR3 service is catching up. Try again in a moment.',
        retryAfterMs: remaining,
        retryAfterSeconds: Math.max(1, Math.ceil(remaining / 1000)),
    };
}

function noteHostAuthCooldown(error: Or3AppError) {
    if (error.status !== 429 && error.code !== 'auth_rate_limited') return;
    const retryAfterMs = Math.min(
        Math.max(error.retryAfterMs || 0, 5_000),
        30_000,
    );
    hostAuthCooldownUntil = Math.max(
        hostAuthCooldownUntil,
        Date.now() + retryAfterMs,
    );
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
        coerceErrorText(
            typeof payload === 'string'
                ? payload
                : payload?.message ?? payload?.error,
        ) || undefined;
    const payloadCode = typeof payload === 'object' ? payload.code : undefined;
    const challengeCode = normalizeChallengeCode(
        typeof payloadCode === 'string' ? payloadCode : undefined,
    );
    const normalizedPayloadCode =
        typeof payloadCode === 'string' ? payloadCode.trim() : '';
    const capabilityCeiling =
        message?.toLowerCase().includes('service capability ceiling') ?? false;
    const code = capabilityCeiling
        ? 'capability_unavailable'
        : normalizedPayloadCode &&
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
        const token = await window.or3Desktop?.intern
            .issueServiceToken({ method, path })
            .catch(() => null);
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

    function clearStaleSessionCredential() {
        if (!activeHost.value?.sessionToken?.trim()) return false;
        const pairedToken =
            activeHost.value.pairedToken?.trim() ||
            activeHost.value.token?.trim();
        updateHost(
            withResolvedHostTokens({
                ...activeHost.value,
                sessionToken: undefined,
                pairedToken: pairedToken || activeHost.value.pairedToken,
                token: pairedToken,
            }),
        );
        return true;
    }

    function shouldTrackHostStatus(options: Or3ApiRequestOptions) {
        return options.trackHostStatus !== false;
    }

    function shouldUpdateHostStatusFromRequest() {
        if (needsUnlock()) return false;
        return hostHasUsableCredentials(activeHost.value);
    }

    function shouldMarkHostUnauthorized(error: Or3AppError) {
        return (
            error.code === 'invalid_token' ||
            error.code === 'missing_token' ||
            error.code === 'token_replay'
        );
    }

    async function resolveSecureSessionToken(explicitBaseUrl?: string) {
        const host = activeHost.value;
        if (!host || host.authMode !== 'secure-session') return undefined;
        if (!destinationMatchesTokenOrigin(host.baseUrl, explicitBaseUrl))
            return undefined;
        const hostId = host.secureHostId || host.id;
        const cached = secureSessionCache[hostId];
        const now = Date.now();
        if (cached?.claims && cached.claims.expires_at_unix_ms > now + 30_000) {
            return cached.claims.session_id;
        }
        if (cached?.pending) return (await cached.pending).session_id;

        const pending = (async () => {
            const state = await loadSecureConnectionState();
            const identity = state.deviceIdentity;
            const enrollment = state.hosts?.[hostId];
            if (!identity || !enrollment) {
                throw {
                    code: 'auth_required',
                    status: 401,
                    message:
                        'This secure device enrollment is missing. Pair this device again.',
                } satisfies Or3AppError;
            }
            const routeId =
                host.secureSessionRouteId ||
                `direct:${normalizeBaseUrl(host.baseUrl)}`;
            const body = await buildSecureSessionStartPayload(
                identity,
                enrollment,
                routeId,
            );
            const response = await fetch(
                `${normalizeBaseUrl(explicitBaseUrl || host.baseUrl)}/internal/v1/secure-connections/sessions`,
                {
                    method: 'POST',
                    headers: {
                        Accept: 'application/json',
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify(body),
                },
            );
            if (!response.ok) {
                const payload = await readError(response);
                throw mapError(response.status, payload);
            }
            const result = (await response.json()) as { claims?: unknown };
            if (!validateSecureSessionClaims(result.claims)) {
                throw {
                    code: 'auth_required',
                    status: 401,
                    message: 'The computer returned an invalid secure session.',
                } satisfies Or3AppError;
            }
            updateHost({
                ...host,
                status: 'online',
                lastSeenAt: new Date().toISOString(),
            });
            return result.claims;
        })();

        secureSessionCache[hostId] = { pending };
        try {
            const claims = await pending;
            secureSessionCache[hostId] = { claims };
            return claims.session_id;
        } catch (error) {
            delete secureSessionCache[hostId];
            updateActiveHostStatus('unauthorized', explicitBaseUrl);
            throw error;
        }
    }

    async function request<T>(
        path: string,
        options: Or3ApiRequestOptions = {},
    ): Promise<T> {
        const method =
            options.method || (options.body === undefined ? 'GET' : 'POST');
        const dedupeKey =
            !options._skipDedupe &&
            !options.onAuthChallenge &&
            !options.signal &&
            options.body === undefined
                ? getRequestDedupeKey(
                      method,
                      path,
                      options.baseUrl,
                      activeHost.value?.baseUrl,
                  )
                : '';
        if (dedupeKey) {
            return dedupeGetRequest(dedupeKey, () =>
                requestOnce<T>(path, options, method),
            );
        }
        return requestOnce<T>(path, options, method);
    }

    async function requestOnce<T>(
        path: string,
        options: Or3ApiRequestOptions = {},
        method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE' = options.method ||
            (options.body === undefined ? 'GET' : 'POST'),
    ): Promise<T> {
        await ensureElectronHostLoaded();
        const requiresAuth = options.requireAuth !== false;
        const includesAuth = requiresAuth && destinationMatchesTokenOrigin(
            activeHost.value?.baseUrl,
            options.baseUrl,
        );
        const trackHostStatus = shouldTrackHostStatus(options);
        if (requiresAuth) ensurePinSessionActive();
        if (requiresAuth && needsUnlock()) {
            throw {
                code: 'pin_locked',
                status: 401,
                message: 'Unlock OR3 with your PIN to continue.',
            } satisfies Or3AppError;
        }
        const cooldown = hostAuthCooldownError();
        if (cooldown) throw cooldown;
        const electronAuthToken = includesAuth
            ? await resolveElectronHostToken(method, path)
            : undefined;
        const secureSessionToken = includesAuth
            ? await resolveSecureSessionToken(options.baseUrl)
            : undefined;
        const authToken = includesAuth
            ? electronAuthToken ||
              secureSessionToken ||
              resolveRequestAuthToken(options.preferPairedToken)
            : undefined;
        const sessionToken = includesAuth
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

        const formBody = options.body instanceof FormData;
        if (options.body !== undefined && !formBody)
            headers['Content-Type'] = 'application/json';
        if (authToken && includesAuth)
            headers.Authorization = `Bearer ${authToken}`;
        if (electronAuthToken && includesAuth)
            headers['X-Or3-Auth-Method'] = 'shared-secret';
        if (secureSessionToken && includesAuth)
            headers['X-Or3-Auth-Method'] = 'secure-session';
        if (sessionToken && includesAuth)
            headers['X-Or3-Session'] = sessionToken;
        const traceId = getActiveTraceId();
        if (traceId && !headers['X-Trace-Id']) headers['X-Trace-Id'] = traceId;
        const requestBody: BodyInit | undefined =
            options.body === undefined
                ? undefined
                : formBody
                  ? (options.body as FormData)
                  : JSON.stringify(options.body);

        let response: Response;
        try {
            response = await fetch(buildUrl(path, options.baseUrl), {
                method,
                headers,
                body: requestBody,
                signal: options.signal,
            });
        } catch (error) {
            if (isAbortError(error)) {
                throw {
                    code: 'aborted',
                    status: 0,
                    message: 'Request was stopped.',
                    cause: error,
                } satisfies Or3AppError;
            }
            if (trackHostStatus && shouldUpdateHostStatusFromRequest()) {
                updateActiveHostStatus('offline', options.baseUrl);
            }
            logHostNetworkError(
                logger,
                'request',
                options.baseUrl || activeHost.value?.baseUrl,
                {
                    path,
                    method,
                    ...serializeErrorForLog(error),
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
                    return await request<T>(path, {
                        ...options,
                        onAuthChallenge: undefined,
                        _skipDedupe: true,
                    });
                }
            }
            const errorMeta = {
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
            };
            const requiresApproval =
                typeof payload === 'object' &&
                payload.requires_approval === true;
            if (response.status === 401 || response.status === 403) {
                logger.debug(
                    'request:auth_error',
                    'Request returned an auth error response',
                    errorMeta,
                );
            } else if (requiresApproval) {
                logger.info(
                    'request:approval_required',
                    'Action is waiting for operator approval',
                    errorMeta,
                );
            } else {
                logger.warn(
                    'request:error_response',
                    'Request returned an error response',
                    errorMeta,
                );
            }
            const error = mapError(response.status, payload);
            if (
                includesAuth &&
                response.status === 401 &&
                error.code === 'invalid_token' &&
                activeHost.value?.sessionToken?.trim() &&
                !options._retryInvalidToken &&
                clearStaleSessionCredential()
            ) {
                return await request<T>(path, {
                    ...options,
                    _retryInvalidToken: true,
                    _skipDedupe: true,
                });
            }
            if (
                trackHostStatus &&
                shouldUpdateHostStatusFromRequest() &&
                !needsUnlock()
            ) {
                if (shouldMarkHostUnauthorized(error)) {
                    updateActiveHostStatus('unauthorized', options.baseUrl);
                } else if (response.status !== 401 && response.status !== 403) {
                    updateActiveHostStatus('online', options.baseUrl);
                }
            }
            if (includesAuth && response.status === 429) {
                noteHostAuthCooldown(error);
            }
            throw error;
        }
        if (includesAuth) {
            hostAuthCooldownUntil = 0;
            hostAuthCooldownMessage = '';
        }
        if (trackHostStatus && shouldUpdateHostStatusFromRequest()) {
            updateActiveHostStatus('online', options.baseUrl);
        }
        if (response.status === 204) return undefined as T;
        return (await response.json()) as T;
    }

    async function* stream(
        path: string,
        options: Or3ApiRequestOptions = {},
    ): AsyncIterable<Or3SseEvent> {
        await ensureElectronHostLoaded();
        const requiresAuth = options.requireAuth !== false;
        const includesAuth = requiresAuth && destinationMatchesTokenOrigin(
            activeHost.value?.baseUrl,
            options.baseUrl,
        );
        const method = options.method || 'POST';
        if (requiresAuth) ensurePinSessionActive();
        if (requiresAuth && needsUnlock()) {
            throw {
                code: 'pin_locked',
                status: 401,
                message: 'Unlock OR3 with your PIN to continue.',
            } satisfies Or3AppError;
        }
        const cooldown = hostAuthCooldownError();
        if (cooldown) throw cooldown;
        const electronAuthToken = includesAuth
            ? await resolveElectronHostToken(method, path)
            : undefined;
        const secureSessionToken = includesAuth
            ? await resolveSecureSessionToken(options.baseUrl)
            : undefined;
        const authToken = includesAuth
            ? electronAuthToken ||
              secureSessionToken ||
              resolveRequestAuthToken(options.preferPairedToken)
            : undefined;
        const sessionToken = includesAuth
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

        const formBody = options.body instanceof FormData;
        if (options.body !== undefined && !formBody)
            headers['Content-Type'] = 'application/json';
        if (authToken && includesAuth)
            headers.Authorization = `Bearer ${authToken}`;
        if (electronAuthToken && includesAuth)
            headers['X-Or3-Auth-Method'] = 'shared-secret';
        if (secureSessionToken && includesAuth)
            headers['X-Or3-Auth-Method'] = 'secure-session';
        if (sessionToken && includesAuth)
            headers['X-Or3-Session'] = sessionToken;
        const traceId = getActiveTraceId();
        if (traceId && !headers['X-Trace-Id']) headers['X-Trace-Id'] = traceId;
        const requestBody: BodyInit | undefined =
            options.body === undefined
                ? undefined
                : formBody
                  ? (options.body as FormData)
                  : JSON.stringify(options.body);

        let response: Response;
        try {
            response = await fetch(buildUrl(path, options.baseUrl), {
                method,
                headers,
                body: requestBody,
                signal: options.signal,
            });
        } catch (error) {
            if (isAbortError(error)) {
                throw {
                    code: 'aborted',
                    status: 0,
                    message: 'Request was stopped.',
                    cause: error,
                } satisfies Or3AppError;
            }
            logHostNetworkError(
                logger,
                'stream:network',
                options.baseUrl || activeHost.value?.baseUrl,
                {
                    path,
                    method,
                    ...serializeErrorForLog(error),
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
                    ...serializeErrorForLog(
                        typeof payload === 'object' ? payload : { message: payload },
                    ),
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
            if (isAbortError(error)) {
                throw {
                    code: 'aborted',
                    status: 0,
                    message: 'Request was stopped.',
                    cause: error,
                } satisfies Or3AppError;
            }
            logHostNetworkError(
                logger,
                'stream:read',
                options.baseUrl || activeHost.value?.baseUrl,
                {
                    path,
                    ...serializeErrorForLog(error),
                },
            );
            throw error;
        } finally {
            logger.info('stream:close', 'SSE stream closed', { path });
        }
    }

    return { request, stream, buildUrl, normalizeBaseUrl };
}
