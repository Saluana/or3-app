import { computed, ref } from 'vue'
import type { AuthPasskey, WebAuthnCeremonyResponse } from '~/types/auth'
import { createWebAuthnCredential, normalizeWebAuthnError } from '~/utils/auth/webauthn'
import { useAuthSession } from './useAuthSession'
import { useOr3Api } from './useOr3Api'

const passkeys = ref<AuthPasskey[]>([])
const pending = ref(false)
const errorMessage = ref<string | null>(null)

export function usePasskeys() {
  const api = useOr3Api()
  const authSession = useAuthSession()

  async function listPasskeys(force = false) {
    if (passkeys.value.length && !force) return passkeys.value
    const response = await authSession.retryWithAuth((onAuthChallenge) => api.request<{ items?: AuthPasskey[] }>('/internal/v1/auth/passkeys', {
      onAuthChallenge,
    }), 'manage-passkeys')
    passkeys.value = response.items ?? []
    return passkeys.value
  }

  async function registerPasskey(input: { nickname?: string; displayName?: string; reason?: string } = {}) {
    pending.value = true
    errorMessage.value = null
    try {
      const begin = await authSession.retryWithAuth((onAuthChallenge) => api.request<WebAuthnCeremonyResponse>('/internal/v1/auth/passkeys/registration/begin', {
        method: 'POST',
        body: { displayName: input.displayName, reason: input.reason || 'register-passkey' },
        onAuthChallenge,
      }), 'register-passkey')
      const credential = await createWebAuthnCredential(begin.options as Record<string, unknown>)
      const response = await authSession.retryWithAuth((onAuthChallenge) => api.request<{ passkey: AuthPasskey }>('/internal/v1/auth/passkeys/registration/finish', {
        method: 'POST',
        body: { ceremonyId: begin.ceremonyId, credential, nickname: input.nickname },
        onAuthChallenge,
      }), 'register-passkey')
      await listPasskeys(true)
      return response.passkey
    } catch (error) {
      const normalized = normalizeWebAuthnError(error)
      errorMessage.value = normalized instanceof Error ? normalized.message : normalized.message
      throw normalized
    } finally {
      pending.value = false
    }
  }

  async function renamePasskey(passkeyId: string, nickname: string) {
    pending.value = true
    errorMessage.value = null
    try {
      await authSession.retryWithAuth((onAuthChallenge) => api.request(`/internal/v1/auth/passkeys/${encodeURIComponent(passkeyId)}`, {
        method: 'PATCH',
        body: { nickname },
        onAuthChallenge,
      }), 'rename-passkey')
      passkeys.value = passkeys.value.map((passkey) => passkey.id === passkeyId ? { ...passkey, nickname } : passkey)
    } finally {
      pending.value = false
    }
  }

  async function revokePasskey(passkeyId: string, reason = 'user-revoked') {
    pending.value = true
    errorMessage.value = null
    try {
      await authSession.retryWithAuth((onAuthChallenge) => api.request(`/internal/v1/auth/passkeys/${encodeURIComponent(passkeyId)}/revoke`, {
        method: 'POST',
        body: { reason },
        onAuthChallenge,
      }), 'revoke-passkey')
      passkeys.value = passkeys.value.filter((passkey) => passkey.id !== passkeyId)
    } finally {
      pending.value = false
    }
  }

  return {
    passkeys: computed(() => passkeys.value),
    isPending: computed(() => pending.value),
    errorMessage: computed(() => errorMessage.value),
    listPasskeys,
    registerPasskey,
    renamePasskey,
    revokePasskey,
  }
}
