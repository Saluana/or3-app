import { computed, ref } from 'vue'
import { useOr3Api } from './useOr3Api'

const embeddingsStatus = ref<Record<string, unknown> | null>(null)
const lastRebuildResult = ref<Record<string, unknown> | null>(null)
const auditStatus = ref<Record<string, unknown> | null>(null)
const scopeResult = ref<Record<string, unknown> | null>(null)
const statusLoading = ref(false)
const auditLoading = ref(false)
const rebuildLoading = ref(false)
const scopeLoading = ref(false)
const memoryError = ref<string | null>(null)
const scopeError = ref<string | null>(null)

export function useMemoryTrust() {
  const api = useOr3Api()

  const memoryLoading = computed(
    () => statusLoading.value || auditLoading.value || rebuildLoading.value || scopeLoading.value,
  )

  async function loadEmbeddingsStatus() {
    statusLoading.value = true
    memoryError.value = null
    try {
      embeddingsStatus.value = await api.request<Record<string, unknown>>('/internal/v1/embeddings/status')
      return embeddingsStatus.value
    } catch (error: any) {
      memoryError.value = error?.message ?? 'Unable to load embeddings status.'
      throw error
    } finally {
      statusLoading.value = false
    }
  }

  async function rebuildEmbeddings(target: 'memory' | 'docs' | 'all' = 'memory') {
    rebuildLoading.value = true
    memoryError.value = null
    try {
      lastRebuildResult.value = await api.request<Record<string, unknown>>('/internal/v1/embeddings/rebuild', {
        method: 'POST',
        body: { target },
      })
      await loadEmbeddingsStatus()
      return lastRebuildResult.value
    } catch (error: any) {
      memoryError.value = error?.message ?? 'Unable to rebuild embeddings.'
      throw error
    } finally {
      rebuildLoading.value = false
    }
  }

  async function loadAuditStatus() {
    auditLoading.value = true
    memoryError.value = null
    try {
      auditStatus.value = await api.request<Record<string, unknown>>('/internal/v1/audit')
      return auditStatus.value
    } catch (error: any) {
      memoryError.value = error?.message ?? 'Unable to load audit status.'
      throw error
    } finally {
      auditLoading.value = false
    }
  }

  async function verifyAudit() {
    auditLoading.value = true
    memoryError.value = null
    try {
      const verified = await api.request<Record<string, unknown>>('/internal/v1/audit/verify', {
        method: 'POST',
        body: {},
      })
      auditStatus.value = {
        ...(auditStatus.value ?? {}),
        ...verified,
        verified: true,
      }
      return auditStatus.value
    } catch (error: any) {
      memoryError.value = error?.message ?? 'Unable to verify audit chain.'
      throw error
    } finally {
      auditLoading.value = false
    }
  }

  async function linkScope(sessionKey: string, scopeKey: string, meta?: Record<string, unknown>) {
    scopeLoading.value = true
    scopeError.value = null
    try {
      scopeResult.value = await api.request<Record<string, unknown>>('/internal/v1/scope/links', {
        method: 'POST',
        body: { session_key: sessionKey, scope_key: scopeKey, meta: meta ?? {} },
      })
      return scopeResult.value
    } catch (error: any) {
      scopeError.value = error?.message ?? 'Unable to link session scope.'
      throw error
    } finally {
      scopeLoading.value = false
    }
  }

  async function resolveScope(sessionKey: string) {
    scopeLoading.value = true
    scopeError.value = null
    try {
      scopeResult.value = await api.request<Record<string, unknown>>(`/internal/v1/scope/resolve?session_key=${encodeURIComponent(sessionKey)}`)
      return scopeResult.value
    } catch (error: any) {
      scopeError.value = error?.message ?? 'Unable to resolve session scope.'
      throw error
    } finally {
      scopeLoading.value = false
    }
  }

  async function listScopeSessions(scopeKey: string) {
    scopeLoading.value = true
    scopeError.value = null
    try {
      scopeResult.value = await api.request<Record<string, unknown>>(`/internal/v1/scope/sessions?scope_key=${encodeURIComponent(scopeKey)}`)
      return scopeResult.value
    } catch (error: any) {
      scopeError.value = error?.message ?? 'Unable to list scope sessions.'
      throw error
    } finally {
      scopeLoading.value = false
    }
  }

  return {
    embeddingsStatus,
    lastRebuildResult,
    auditStatus,
    scopeResult,
    statusLoading,
    auditLoading,
    rebuildLoading,
    scopeLoading,
    memoryLoading,
    memoryError,
    scopeError,
    loadEmbeddingsStatus,
    rebuildEmbeddings,
    loadAuditStatus,
    verifyAudit,
    linkScope,
    resolveScope,
    listScopeSessions,
  }
}
