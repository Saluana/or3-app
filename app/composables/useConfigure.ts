import { ref } from 'vue'
import type { ConfigureChange, ConfigureField, ConfigureFieldsResponse, ConfigureSectionSummary } from '~/types/or3-api'
import { useAuthSession } from './useAuthSession'
import { useOr3Api } from './useOr3Api'

const sections = ref<ConfigureSectionSummary[]>([])
const fields = ref<ConfigureField[]>([])
const configureLoading = ref(false)
const configureSaving = ref(false)
const configureError = ref<string | null>(null)

// Cache of fields by section for global ("settings search") use. We keep the
// raw field arrays so the advanced settings page can search by label,
// description, or the underlying field key (its JSON/code identifier).
const fieldsBySection = ref<Record<string, ConfigureField[]>>({})
const allFieldsLoading = ref(false)
const allFieldsLoaded = ref(false)

export function useConfigure() {
  const api = useOr3Api()
  const authSession = useAuthSession()

  async function loadSections() {
    configureLoading.value = true
    configureError.value = null
    try {
      const response = await api.request<{ items: ConfigureSectionSummary[] }>('/internal/v1/configure/sections')
      sections.value = response.items ?? []
    } catch (error: any) {
      configureError.value = error?.message ?? 'Unable to load settings sections.'
    } finally {
      configureLoading.value = false
    }
  }

  async function loadFields(section: string, channel?: string) {
    configureLoading.value = true
    configureError.value = null
    try {
      const params = new URLSearchParams({ section })
      if (channel) params.set('channel', channel)
      const response = await api.request<ConfigureFieldsResponse>(`/internal/v1/configure/fields?${params.toString()}`)
      fields.value = response.fields ?? []
      return response
    } catch (error: any) {
      configureError.value = error?.message ?? 'Unable to load section fields.'
      throw error
    } finally {
      configureLoading.value = false
    }
  }

  async function applyChanges(changes: ConfigureChange[]) {
    configureSaving.value = true
    configureError.value = null
    try {
      return await authSession.retryWithAuth(
        (onAuthChallenge) => api.request<{ ok: boolean; config_path?: string }>('/internal/v1/configure/apply', {
          method: 'POST',
          body: { changes },
          onAuthChallenge,
        }),
        'settings-change',
      )
    } catch (error: any) {
      configureError.value = error?.message ?? 'Unable to save settings.'
      throw error
    } finally {
      configureSaving.value = false
    }
  }

  // Loads fields for every known section once and caches them in
  // `fieldsBySection`. Used by the advanced settings page so that the global
  // settings search can match by field label, description, or key.
  async function loadAllFields(options: { force?: boolean } = {}) {
    if (allFieldsLoading.value) return fieldsBySection.value
    if (allFieldsLoaded.value && !options.force) return fieldsBySection.value
    if (!sections.value.length) {
      await loadSections()
    }
    allFieldsLoading.value = true
    try {
      const next: Record<string, ConfigureField[]> = { ...fieldsBySection.value }
      await Promise.all(
        sections.value.map(async (section) => {
          if (next[section.key] && !options.force) return
          try {
            const params = new URLSearchParams({ section: section.key })
            const response = await api.request<ConfigureFieldsResponse>(
              `/internal/v1/configure/fields?${params.toString()}`,
            )
            next[section.key] = response.fields ?? []
          } catch {
            // Best-effort: a single section failing should not break search.
            next[section.key] = next[section.key] ?? []
          }
        }),
      )
      fieldsBySection.value = next
      allFieldsLoaded.value = true
      return fieldsBySection.value
    } finally {
      allFieldsLoading.value = false
    }
  }

  return {
    sections,
    fields,
    configureLoading,
    configureSaving,
    configureError,
    loadSections,
    loadFields,
    applyChanges,
    fieldsBySection,
    allFieldsLoading,
    allFieldsLoaded,
    loadAllFields,
  }
}
