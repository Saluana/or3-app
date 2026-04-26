import { ref } from 'vue'
import type { ConfigureChange, ConfigureField, ConfigureFieldsResponse, ConfigureSectionSummary } from '~/types/or3-api'
import { useOr3Api } from './useOr3Api'

const sections = ref<ConfigureSectionSummary[]>([])
const fields = ref<ConfigureField[]>([])
const configureLoading = ref(false)
const configureSaving = ref(false)
const configureError = ref<string | null>(null)

export function useConfigure() {
  const api = useOr3Api()

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
      return await api.request<{ ok: boolean; config_path?: string }>('/internal/v1/configure/apply', {
        method: 'POST',
        body: { changes },
      })
    } catch (error: any) {
      configureError.value = error?.message ?? 'Unable to save settings.'
      throw error
    } finally {
      configureSaving.value = false
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
  }
}
