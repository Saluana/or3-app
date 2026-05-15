import { computed, ref, watch } from 'vue';
import type { Or3AppError } from '~/types/app-state';
import type {
    AuthCapabilities,
    AuthChallengeError,
    AuthChallengeCode,
    AuthSessionState,
    PasskeyLoginResult,
    WebAuthnCeremonyResponse,
} from '~/types/auth';
import {
    getWebAuthnAssertion,
    normalizeWebAuthnError,
} from '~/utils/auth/webauthn';
import { createLogger } from '~/utils/logger';
import { useActiveHost } from './useActiveHost';
import { useOr3Api } from './useOr3Api';
import { withResolvedHostTokens } from './useSecureHostTokens';

const capabilities = ref<AuthCapabilities | null>(null);
const sessionState = ref<AuthSessionState | null>(null);
const pending = ref(false);
const lastChallenge = ref<AuthChallengeError | null>(null);
let capabilitiesHostKey = '';
let initialized = false;
const logger = createLogger('auth_session');

function errorMessage(error: unknown) {
    return error instanceof Error
        ? error.message
        : String(error ?? 'unknown_error');
}

function asAuthChallenge(error: unknown): AuthChallengeError | null {
    const candidate = error as Partial<Or3AppError> | null | undefined;
    const code =
        candidate?.authChallengeCode ||
        (typeof candidate?.code === 'string'
            ? candidate.code.toUpperCase()
            : undefined);
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
    return {
        code: code as AuthChallengeCode,
        message: candidate?.message || 'Authentication is required.',
        status: candidate?.status,
        retryAfterMs: candidate?.retryAfterMs,
        retryAfterSeconds: candidate?.retryAfterSeconds,
    };
}

export function useAuthSession() {
    const api = useOr3Api();
    const { activeHost, updateHost } = useActiveHost();

    function syncActiveHost(
        tokens: { pairedToken?: string; sessionToken?: string },
        extra: Record<string, unknown> = {},
    ) {
        if (!activeHost.value) return;
        updateHost(
            withResolvedHostTokens({
                ...activeHost.value,
                ...extra,
                pairedToken:
                    tokens.pairedToken ??
                    activeHost.value.pairedToken ??
                    activeHost.value.token,
                sessionToken: tokens.sessionToken,
            }),
        );
    }

    function clearSessionToken() {
        if (!activeHost.value) return;
        sessionState.value = null;
        syncActiveHost({
            pairedToken: activeHost.value.pairedToken ?? activeHost.value.token,
            sessionToken: undefined,
        });
    }

    async function loadCapabilities(force = false) {
        const hostKey = `${activeHost.value?.id || ''}:${activeHost.value?.baseUrl || ''}`;
        if (capabilities.value && capabilitiesHostKey === hostKey && !force) {
            logger.debug(
                'capabilities:cache_hit',
                'Using cached auth capabilities',
                { hostKey },
            );
            return capabilities.value;
        }
        logger.info('capabilities:load', 'Loading auth capabilities', {
            force,
            hostKey,
        });
        capabilitiesHostKey = hostKey;
        try {
            capabilities.value = await api.request<AuthCapabilities>(
                '/internal/v1/auth/capabilities',
                { requireAuth: false },
            );
            logger.info('capabilities:loaded', 'Auth capabilities loaded', {
                passkeyMode: capabilities.value?.passkeyMode ?? null,
                sessionRequired: Boolean(capabilities.value?.sessionRequired),
            });
            return capabilities.value;
        } catch (error) {
            logger.error(
                'capabilities:error',
                'Failed to load auth capabilities',
                {
                    error: errorMessage(error),
                },
            );
            throw error;
        }
    }

    async function refreshSession() {
        if (!activeHost.value?.sessionToken) {
            sessionState.value = null;
            logger.debug(
                'session:skip_refresh',
                'Skipped session refresh without a session token',
            );
            return null;
        }
        logger.info('session:refresh', 'Refreshing auth session', {
            hostId: activeHost.value?.id ?? null,
        });
        try {
            const response = await api.request<AuthSessionState>(
                '/internal/v1/auth/session',
            );
            sessionState.value = response;
            if (activeHost.value) {
                syncActiveHost(
                    {
                        pairedToken:
                            activeHost.value.pairedToken ??
                            activeHost.value.token,
                        sessionToken: activeHost.value.sessionToken,
                    },
                    { role: response.role || activeHost.value.role },
                );
            }
            logger.info('session:refreshed', 'Auth session refreshed', {
                role: response.role || null,
            });
            return response;
        } catch (error) {
            const challenge = asAuthChallenge(error);
            if (
                challenge?.code === 'SESSION_EXPIRED' ||
                challenge?.code === 'SESSION_REQUIRED'
            ) {
                logger.warn(
                    'session:expired',
                    'Auth session expired or is required again',
                    {
                        code: challenge.code,
                    },
                );
                clearSessionToken();
            } else {
                logger.warn(
                    'session:refresh_error',
                    'Failed to refresh auth session',
                    {
                        error: errorMessage(error),
                    },
                );
            }
            throw error;
        }
    }

    async function loginWithPasskey(reason = 'sign-in') {
        pending.value = true;
        logger.info('login:start', 'Passkey login started', { reason });
        try {
            const begin = await api.request<WebAuthnCeremonyResponse>(
                '/internal/v1/auth/passkeys/login/begin',
                {
                    method: 'POST',
                    body: { reason },
                    preferPairedToken: true,
                },
            );
            const credential = await getWebAuthnAssertion(
                begin.options as Record<string, unknown>,
            );
            const result = await api.request<PasskeyLoginResult>(
                '/internal/v1/auth/passkeys/login/finish',
                {
                    method: 'POST',
                    body: { ceremonyId: begin.ceremonyId, credential },
                    preferPairedToken: true,
                },
            );
            if (activeHost.value) {
                syncActiveHost(
                    {
                        pairedToken:
                            activeHost.value.pairedToken ??
                            activeHost.value.token,
                        sessionToken: result.sessionToken,
                    },
                    {
                        role:
                            result.role ||
                            result.session.role ||
                            activeHost.value.role,
                    },
                );
            }
            await refreshSession();
            lastChallenge.value = null;
            logger.info('login:complete', 'Passkey login completed', {
                reason,
                role: result.role || result.session.role || null,
            });
            return result;
        } catch (error) {
            const normalized = normalizeWebAuthnError(error);
            logger.warn('login:error', 'Passkey login failed', {
                reason,
                error: errorMessage(normalized),
            });
            throw normalized;
        } finally {
            pending.value = false;
        }
    }

    async function logout(reason = 'logout') {
        if (!activeHost.value?.sessionToken) {
            logger.debug(
                'logout:skip',
                'Skipped logout without an active session token',
            );
            clearSessionToken();
            return;
        }
        logger.info('logout:start', 'Auth session logout started', { reason });
        try {
            await api.request('/internal/v1/auth/session/revoke', {
                method: 'POST',
                body: { reason },
            });
            logger.info('logout:complete', 'Auth session logout completed', {
                reason,
            });
        } catch (error) {
            logger.warn('logout:error', 'Auth session revoke failed', {
                reason,
                error: errorMessage(error),
            });
            throw error;
        } finally {
            clearSessionToken();
        }
    }

    async function runStepUp(reason = 'sensitive-action') {
        if (!activeHost.value?.sessionToken)
            throw {
                code: 'session_required',
                message: 'Sign in with a passkey first.',
            } satisfies Or3AppError;
        pending.value = true;
        logger.info('step_up:start', 'Step-up authentication started', {
            reason,
        });
        try {
            const begin = await api.request<WebAuthnCeremonyResponse>(
                '/internal/v1/auth/step-up/begin',
                {
                    method: 'POST',
                    body: { reason },
                },
            );
            const credential = await getWebAuthnAssertion(
                begin.options as Record<string, unknown>,
            );
            await api.request<{ session: AuthSessionState['session'] }>(
                '/internal/v1/auth/step-up/finish',
                {
                    method: 'POST',
                    body: { ceremonyId: begin.ceremonyId, credential, reason },
                },
            );
            await refreshSession();
            lastChallenge.value = null;
            logger.info(
                'step_up:complete',
                'Step-up authentication completed',
                {
                    reason,
                },
            );
        } catch (error) {
            const normalized = normalizeWebAuthnError(error);
            logger.warn('step_up:error', 'Step-up authentication failed', {
                reason,
                error: errorMessage(normalized),
            });
            throw normalized;
        } finally {
            pending.value = false;
        }
    }

    async function resolveChallenge(
        challenge: AuthChallengeError,
        reason = 'sensitive-action',
    ) {
        lastChallenge.value = challenge;
        logger.info('challenge:resolve', 'Resolving auth challenge', {
            code: challenge.code,
            reason,
        });
        if (challenge.code === 'AUTH_UNSUPPORTED') {
            logger.warn(
                'challenge:unsupported',
                'Auth challenge is unsupported',
                {
                    code: challenge.code,
                },
            );
            return false;
        }
        if (
            challenge.code === 'SESSION_REQUIRED' ||
            challenge.code === 'SESSION_EXPIRED' ||
            challenge.code === 'PASSKEY_REQUIRED'
        ) {
            await loginWithPasskey(reason);
            return true;
        }
        if (challenge.code === 'STEP_UP_REQUIRED') {
            await runStepUp(reason);
            return true;
        }
        return false;
    }

    function challengeHandler(reason = 'sensitive-action') {
        return async (challenge: AuthChallengeError) =>
            await resolveChallenge(challenge, reason);
    }

    async function retryWithAuth<T>(
        operation: (handler: ReturnType<typeof challengeHandler>) => Promise<T>,
        reason = 'sensitive-action',
    ) {
        let lastError: unknown;
        for (let attempt = 0; attempt < 3; attempt += 1) {
            try {
                return await operation(challengeHandler(reason));
            } catch (error) {
                const challenge = asAuthChallenge(error);
                if (!challenge) throw error;
                lastError = error;
                logger.warn(
                    'retry:challenge',
                    'Retrying operation after auth challenge',
                    {
                        attempt: attempt + 1,
                        code: challenge.code,
                        reason,
                    },
                );
                const recovered = await resolveChallenge(challenge, reason);
                if (!recovered) throw error;
            }
        }
        throw lastError;
    }

    if (!initialized) {
        initialized = true;
        watch(
            () =>
                `${activeHost.value?.id || ''}:${activeHost.value?.baseUrl || ''}:${activeHost.value?.sessionToken || ''}`,
            async () => {
                const hostKey = `${activeHost.value?.id || ''}:${activeHost.value?.baseUrl || ''}`;
                if (capabilitiesHostKey && capabilitiesHostKey !== hostKey) {
                    capabilities.value = null;
                    capabilitiesHostKey = '';
                }
                if (activeHost.value?.sessionToken) {
                    await refreshSession().catch(() => undefined);
                } else {
                    sessionState.value = null;
                }
            },
            { immediate: true },
        );
    }

    return {
        capabilities: computed(() => capabilities.value),
        session: computed(() => sessionState.value),
        isAuthenticated: computed(() =>
            Boolean(sessionState.value?.session?.id),
        ),
        isPending: computed(() => pending.value),
        lastChallenge: computed(() => lastChallenge.value),
        loadCapabilities,
        refreshSession,
        loginWithPasskey,
        logout,
        runStepUp,
        resolveChallenge,
        challengeHandler,
        retryWithAuth,
        clearSessionToken,
    };
}
