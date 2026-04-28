import { computed, ref, watch } from 'vue'
import type { Or3AppError } from '~/types/app-state'
import type { AuthCapabilities, AuthChallengeError, AuthChallengeCode, AuthSessionState, PasskeyLoginResult, WebAuthnCeremonyResponse } from '~/types/auth'
import { getWebAuthnAssertion, normalizeWebAuthnError } from '~/utils/auth/webauthn'
import { useActiveHost } from './useActiveHost'
import { useOr3Api } from './useOr3Api'
import { withResolvedHostTokens } from './useSecureHostTokens'

const capabilities = ref<AuthCapabilities | null>(null)
const sessionState = ref<AuthSessionState | null>(null)
const pending = ref(false)
const lastChallenge = ref<AuthChallengeError | null>(null)
let initialized = false

function asAuthChallenge(error: unknown): AuthChallengeError | null {
  const candidate = error as Partial<Or3AppError> | null | undefined
  const code = candidate?.authChallengeCode || (typeof candidate?.code === 'string' ? candidate.code.toUpperCase() : undefined)
  if (!code || !['SESSION_REQUIRED', 'SESSION_EXPIRED', 'PASSKEY_REQUIRED', 'STEP_UP_REQUIRED', 'AUTH_UNSUPPORTED'].includes(code)) {
    return null
  }
  return {
    code: code as AuthChallengeCode,
    message: candidate?.message || 'Authentication is required.',
    status: candidate?.status,
    retryAfterMs: candidate?.retryAfterMs,
    retryAfterSeconds: candidate?.retryAfterSeconds,
  }
}

export function useAuthSession() {
  const api = useOr3Api()
  const { activeHost, updateHost } = useActiveHost()

  function syncActiveHost(tokens: { pairedToken?: string; sessionToken?: string }, extra: Record<string, unknown> = {}) {
    if (!activeHost.value) return
    updateHost(withResolvedHostTokens({
      ...activeHost.value,
      ...extra,
      pairedToken: tokens.pairedToken ?? activeHost.value.pairedToken ?? activeHost.value.token,
      sessionToken: tokens.sessionToken,
    }))
  }

  function clearSessionToken() {
    if (!activeHost.value) return
    sessionState.value = null
    syncActiveHost({ pairedToken: activeHost.value.pairedToken ?? activeHost.value.token, sessionToken: undefined })
  }

  async function loadCapabilities(force = false) {
    if (capabilities.value && !force) return capabilities.value
    capabilities.value = await api.request<AuthCapabilities>('/internal/v1/auth/capabilities', { requireAuth: false })
    return capabilities.value
  }

  async function refreshSession() {
    if (!activeHost.value?.sessionToken) {
      sessionState.value = null
      return null
    }
    try {
      const response = await api.request<AuthSessionState>('/internal/v1/auth/session')
      sessionState.value = response
      if (activeHost.value) {
        syncActiveHost({ pairedToken: activeHost.value.pairedToken ?? activeHost.value.token, sessionToken: activeHost.value.sessionToken }, { role: response.role || activeHost.value.role })
      }
      return response
    } catch (error) {
      const challenge = asAuthChallenge(error)
      if (challenge?.code === 'SESSION_EXPIRED' || challenge?.code === 'SESSION_REQUIRED') clearSessionToken()
      throw error
    }
  }

  async function loginWithPasskey(reason = 'sign-in') {
    pending.value = true
    try {
      const begin = await api.request<WebAuthnCeremonyResponse>('/internal/v1/auth/passkeys/login/begin', {
        method: 'POST',
        body: { reason },
        requireAuth: false,
      })
      const credential = await getWebAuthnAssertion(begin.options as Record<string, unknown>)
      const result = await api.request<PasskeyLoginResult>('/internal/v1/auth/passkeys/login/finish', {
        method: 'POST',
        body: { ceremonyId: begin.ceremonyId, credential },
        requireAuth: false,
      })
      if (activeHost.value) {
        syncActiveHost({ pairedToken: activeHost.value.pairedToken ?? activeHost.value.token, sessionToken: result.sessionToken }, { role: result.role || result.session.role || activeHost.value.role })
      }
      await refreshSession()
      lastChallenge.value = null
      return result
    } catch (error) {
      throw normalizeWebAuthnError(error)
    } finally {
      pending.value = false
    }
  }

  async function logout(reason = 'logout') {
    if (!activeHost.value?.sessionToken) {
      clearSessionToken()
      return
    }
    try {
      await api.request('/internal/v1/auth/session/revoke', { method: 'POST', body: { reason } })
    } finally {
      clearSessionToken()
    }
  }

  async function runStepUp(reason = 'sensitive-action') {
    if (!activeHost.value?.sessionToken) throw { code: 'session_required', message: 'Sign in with a passkey first.' } satisfies Or3AppError
    pending.value = true
    try {
      const begin = await api.request<WebAuthnCeremonyResponse>('/internal/v1/auth/step-up/begin', {
        method: 'POST',
        body: { reason },
      })
      const credential = await getWebAuthnAssertion(begin.options as Record<string, unknown>)
      await api.request<{ session: AuthSessionState['session'] }>('/internal/v1/auth/step-up/finish', {
        method: 'POST',
        body: { ceremonyId: begin.ceremonyId, credential, reason },
      })
      await refreshSession()
      lastChallenge.value = null
    } catch (error) {
      throw normalizeWebAuthnError(error)
    } finally {
      pending.value = false
    }
  }

  async function resolveChallenge(challenge: AuthChallengeError, reason = 'sensitive-action') {
    lastChallenge.value = challenge
    if (challenge.code === 'AUTH_UNSUPPORTED') return false
    if (challenge.code === 'SESSION_REQUIRED' || challenge.code === 'SESSION_EXPIRED' || challenge.code === 'PASSKEY_REQUIRED') {
      await loginWithPasskey(reason)
      return true
    }
    if (challenge.code === 'STEP_UP_REQUIRED') {
      await runStepUp(reason)
      return true
    }
    return false
  }

  function challengeHandler(reason = 'sensitive-action') {
    return async (challenge: AuthChallengeError) => await resolveChallenge(challenge, reason)
  }

  async function retryWithAuth<T>(operation: (handler: ReturnType<typeof challengeHandler>) => Promise<T>, reason = 'sensitive-action') {
    let lastError: unknown
    for (let attempt = 0; attempt < 3; attempt += 1) {
      try {
        return await operation(challengeHandler(reason))
      } catch (error) {
        const challenge = asAuthChallenge(error)
        if (!challenge) throw error
        lastError = error
        const recovered = await resolveChallenge(challenge, reason)
        if (!recovered) throw error
      }
    }
    throw lastError
  }

  if (!initialized) {
    initialized = true
    watch(
      () => `${activeHost.value?.id || ''}:${activeHost.value?.sessionToken || ''}`,
      async () => {
        if (activeHost.value?.sessionToken) {
          await refreshSession().catch(() => undefined)
        } else {
          sessionState.value = null
        }
      },
      { immediate: true },
    )
  }

  return {
    capabilities: computed(() => capabilities.value),
    session: computed(() => sessionState.value),
    isAuthenticated: computed(() => Boolean(sessionState.value?.session?.id)),
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
  }
}
