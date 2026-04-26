import { ref } from 'vue'
import { useOr3Api } from './useOr3Api'

const embeddingsStatus = ref<Record<string, unknown> | null>(null)
const auditStatus = ref<Record<string, unknown> | null>(null)
const scopeResult = ref<Record<string, unknown> | null>(null)
const memoryLoading = ref(false)
const memoryError = ref<string | null>(null)

export function useMemoryTrust() {
  const api = useOr3Api()

  async function loadEmbeddingsStatus() {
    memoryLoading.value = true
    memoryError.value = null
    try {
      embeddingsStatus.value = await api.request<Record<string, unknown>>('/internal/v1/embeddings/status')
      return embeddingsStatus.value
    } catch (error: any) {
      memoryError.value = error?.message ?? 'Unable to load embeddings status.'
      throw error
    } finally {
      memoryLoading.value = false
    }
  }

  async function rebuildEmbeddings(target: 'memory' | 'docs' | 'all' = 'memory') {
    memoryLoading.value = true
    memoryError.value = null
    try {
      embeddingsStatus.value = await api.request<Record<string, unknown>>('/internal/v1/embeddings/rebuild', {
        method: 'POST',
        body: { target },
      })
      return embeddingsStatus.value
    } catch (error: any) {
      memoryError.value = error?.message ?? 'Unable to rebuild embeddings.'
      throw error
    } finally {
      memoryLoading.value = false
    }
  }

  async function loadAuditStatus() {
    memoryLoading.value = true
    memoryError.value = null
    try {
      auditStatus.value = await api.request<Record<string, unknown>>('/internal/v1/audit')
      return auditStatus.value
    } catch (error: any) {
      memoryError.value = error?.message ?? 'Unable to load audit status.'
      throw error
    } finally {
      memoryLoading.value = false
    }
  }

  async function verifyAudit() {
    memoryLoading.value = true
    memoryError.value = null
    try {
      auditStatus.value = {
        ...(auditStatus.value ?? {}),
        ...(await api.request<Record<string, unknown>>('/internal/v1/audit/verify', {
          method: 'POST',
          body: {},
        })),
      }
      return auditStatus.value
    } catch (error: any) {
      memoryError.value = error?.message ?? 'Unable to verify audit chain.'
      throw error
    } finally {
      memoryLoading.value = false
    }
  }

  async function linkScope(sessionKey: string, scopeKey: string) {
    scopeResult.value = await api.request<Record<string, unknown>>('/internal/v1/scope/links', {
      method: 'POST',
      body: { session_key: sessionKey, scope_key: scopeKey },
    })
    return scopeResult.value
  }

  async function resolveScope(sessionKey: string) {
    scopeResult.value = await api.request<Record<string, unknown>>(`/internal/v1/scope/resolve?session_key=${encodeURIComponent(sessionKey)}`)
    return scopeResult.value
  }

  async function listScopeSessions(scopeKey: string) {
    scopeResult.value = await api.request<Record<string, unknown>>(`/internal/v1/scope/sessions?scope_key=${encodeURIComponent(scopeKey)}`)
    return scopeResult.value
  }

  return {
    embeddingsStatus,
    auditStatus,
    scopeResult,
    memoryLoading,
    memoryError,
    loadEmbeddingsStatus,
    rebuildEmbeddings,
    loadAuditStatus,
    verifyAudit,
    linkScope,
    resolveScope,
    listScopeSessions,
  }
}
