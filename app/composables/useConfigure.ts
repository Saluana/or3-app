import { ref } from 'vue'
import type {
  ConfigureChange,
  ConfigureField,
  ConfigureFieldsResponse,
  ConfigureSectionSummary,
  DoctorConfigFieldMetadata,
  DoctorConfigMetadataResponse,
  DoctorPlanApplyResponse,
  DoctorPlanResponse,
  DoctorSettingsChangePlan,
} from '~/types/or3-api'
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
const metadata = ref<DoctorConfigFieldMetadata[]>([])
const metadataLoaded = ref(false)

const CONFIG_METADATA_PATH_ALIASES: Record<string, string> = {
  'provider.provider_api_base': 'provider.apiBase',
  'provider.provider_api_key': 'provider.apiKey',
  'provider.provider_model': 'provider.model',
  'provider.provider_openai_api_key': 'providers.profiles.openai.apiKey',
  'provider.provider_openrouter_api_key': 'providers.profiles.openrouter.apiKey',
  'provider.provider_custom_api_key': 'providers.profiles.custom.apiKey',
  'tools.tools_enable_exec': 'tools.enableExec',
  'tools.tools_exec_allowed_programs': 'tools.execAllowedPrograms',
  'workspace.workspace_restrict': 'tools.restrictToWorkspace',
  'hardening.hardening_guarded_tools': 'hardening.guardedTools',
  'hardening.hardening_privileged_tools': 'hardening.privilegedTools',
  'skills.skills_global_disabled': 'skills.load.disableGlobalDir',
  'skills.skills_trust_policy': 'skills.trustPolicy',
  'service.service_enabled': 'service.enabled',
  'service.service_listen': 'service.listen',
  'service.service_secret': 'service.secret',
  'agentcli.agentCLI_enabled': 'agentCLI.enabled',
  'agentcli.agentCLI_disabled_runners': 'agentCLI.disabledRunners',
}

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

  async function loadMetadata(options: { force?: boolean } = {}) {
    if (metadataLoaded.value && !options.force) return metadata.value
    configureLoading.value = true
    configureError.value = null
    try {
      const response = await api.request<DoctorConfigMetadataResponse>('/internal/v1/doctor/config-metadata')
      metadata.value = response.fields ?? []
      metadataLoaded.value = true
      return metadata.value
    } catch (error: any) {
      configureError.value = error?.message ?? 'Unable to load settings metadata.'
      throw error
    } finally {
      configureLoading.value = false
    }
  }

  function metadataFor(section: string, field: string) {
    const sectionKey = section.trim()
    const fieldKey = field.trim()
    const pathCandidates = new Set<string>()
    if (sectionKey && fieldKey) pathCandidates.add(`${sectionKey}.${fieldKey}`)
    if (fieldKey.includes('.')) pathCandidates.add(fieldKey)
    const aliasPath = CONFIG_METADATA_PATH_ALIASES[`${sectionKey}.${fieldKey}`]
    if (aliasPath) pathCandidates.add(aliasPath)

    return metadata.value.find((item) => {
      if (item.section === sectionKey && item.key === fieldKey) return true
      if (item.section === sectionKey && pathCandidates.has(item.path)) return true
      if (aliasPath && item.path === aliasPath) return true
      if (!sectionKey && pathCandidates.has(item.path)) return true
      return false
    })
  }

  async function previewPlan(plan: DoctorSettingsChangePlan) {
    configureSaving.value = true
    configureError.value = null
    try {
      return await api.request<DoctorPlanResponse>('/internal/v1/doctor/plans', {
        method: 'POST',
        body: {
          conversation_id: 'settings-ui',
          accepted_card_id: '',
          plan,
        },
      })
    } catch (error: any) {
      configureError.value = error?.message ?? 'Unable to preview settings plan.'
      throw error
    } finally {
      configureSaving.value = false
    }
  }

  async function applyPlan(planID: string, rememberForMinutes = 0) {
    configureSaving.value = true
    configureError.value = null
    try {
      return await authSession.retryWithAuth(
        (onAuthChallenge) => api.request<DoctorPlanApplyResponse>(`/internal/v1/doctor/plans/${encodeURIComponent(planID)}/apply`, {
          method: 'POST',
          body: {
            approval: {
              plan_id: planID,
              approved: true,
              approved_at: Date.now(),
              remember_for_minutes: rememberForMinutes,
            },
          },
          onAuthChallenge,
        }),
        'settings-plan-apply',
      )
    } catch (error: any) {
      configureError.value = error?.message ?? 'Unable to apply settings plan.'
      throw error
    } finally {
      configureSaving.value = false
    }
  }

  async function rollbackPlan(planID: string) {
    configureSaving.value = true
    configureError.value = null
    try {
      return await authSession.retryWithAuth(
        (onAuthChallenge) => api.request<DoctorPlanApplyResponse>(`/internal/v1/doctor/plans/${encodeURIComponent(planID)}/rollback`, {
          method: 'POST',
          body: {
            approval: {
              plan_id: planID,
              approved: true,
              approved_at: Date.now(),
            },
          },
          onAuthChallenge,
        }),
        'settings-plan-rollback',
      )
    } catch (error: any) {
      configureError.value = error?.message ?? 'Unable to roll back settings plan.'
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
    metadata,
    metadataLoaded,
    loadMetadata,
    metadataFor,
    previewPlan,
    applyPlan,
    rollbackPlan,
    fieldsBySection,
    allFieldsLoading,
    allFieldsLoaded,
    loadAllFields,
  }
}
