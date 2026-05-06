/**
 * Settings health check (Phase 12).
 *
 * Runs lightweight, read-only checks against the existing intern API surface
 * (sections, capabilities, readiness) and reports a single list of findings
 * the user can act on. No backend changes required.
 */

import { computed, ref } from 'vue'
import type { CapabilitiesResponse, ReadinessResponse } from '~/types/or3-api'
import { useOr3Api } from '~/composables/useOr3Api'
import { useActiveHost } from '~/composables/useActiveHost'
import { coerceReadinessPayload, formatReadinessDetail } from '~/utils/or3/readiness'
import { useSimpleSettings } from './useSimpleSettings'

export type HealthStatus = 'ok' | 'warning' | 'error' | 'unknown'

export interface HealthFinding {
    id: string
    label: string
    status: HealthStatus
    detail: string
    fixHref?: string
    fixLabel?: string
}

export function useSettingsHealth() {
    const api = useOr3Api()
    const { activeHost } = useActiveHost()
    const simple = useSimpleSettings()

    const findings = ref<HealthFinding[]>([])
    const loading = ref(false)
    const lastRun = ref<string | null>(null)

    async function safeRequest<T>(path: string): Promise<T | null> {
        try {
            return await api.request<T>(path)
        } catch (error) {
            if (path === '/internal/v1/readiness') {
                return coerceReadinessPayload(error) as T | null
            }
            return null
        }
    }

    async function run() {
        loading.value = true
        try {
            const next: HealthFinding[] = []

            // 1. App is connected to intern.
            if (!activeHost.value?.token) {
                next.push({
                    id: 'connection',
                    label: 'Connected to your computer',
                    status: 'error',
                    detail: 'No paired computer. Pair this app to start using OR3.',
                    fixHref: '/settings/pair',
                    fixLabel: 'Pair now',
                })
            } else {
                next.push({
                    id: 'connection',
                    label: 'Connected to your computer',
                    status: 'ok',
                    detail: `Paired with ${activeHost.value.name || 'your computer'}.`,
                })
            }

            // 2. Readiness summary from intern.
            const readiness = await safeRequest<ReadinessResponse>('/internal/v1/readiness')
            if (readiness) {
                const status = String(readiness.status ?? '').toLowerCase()
                const hasWarnings = status.includes('warning')
                const detail = formatReadinessDetail(readiness)
                next.push({
                    id: 'readiness',
                    label: 'OR3 service is ready',
                    status: !readiness.ready ? 'error' : hasWarnings ? 'warning' : 'ok',
                    detail,
                    fixHref: hasWarnings || !readiness.ready ? '/computer/attention' : undefined,
                    fixLabel: hasWarnings || !readiness.ready ? 'Learn more' : undefined,
                })
            } else {
                next.push({
                    id: 'readiness',
                    label: 'OR3 service is ready',
                    status: 'unknown',
                    detail: 'Could not reach the readiness endpoint.',
                })
            }

            // 3. Capabilities snapshot.
            const caps = await safeRequest<CapabilitiesResponse>('/internal/v1/capabilities')

            // Make sure the schema's fields exist (loads provider/workspace/etc).
            await simple.ensureLoaded()
            const v = simple.valueIndex.value

            // 4. AI providers and routing configured.
            const openaiKey = v['provider.openaiApiKey']
            const openrouterKey = v['provider.openrouterApiKey']
            const legacyApiKey = v['provider.apiKey']
            const chatProvider = String(v['routing.chatProvider'] ?? v['provider.kind'] ?? '')
            const embeddingsProvider = String(v['routing.embeddingsProvider'] ?? '')
            const model = v['routing.chatModel'] ?? v['provider.model']
            const providerHasKey = (provider: string) => {
                if (provider === 'openai') return Boolean(openaiKey || legacyApiKey)
                if (provider === 'openrouter') return Boolean(openrouterKey)
                return Boolean(legacyApiKey)
            }
            if (!openaiKey && !openrouterKey && !legacyApiKey) {
                next.push({
                    id: 'ai-key',
                    label: 'AI provider key set',
                    status: 'error',
                    detail: 'No provider key. The AI cannot reply.',
                    fixHref: '/settings/section/providers?focus=provider-openai-key',
                    fixLabel: 'Add key',
                })
            } else {
                next.push({
                    id: 'ai-key',
                    label: 'AI provider key set',
                    status: 'ok',
                    detail: 'At least one provider key is present.',
                })
            }
            if (chatProvider && !providerHasKey(chatProvider)) {
                next.push({
                    id: 'chat-provider-key',
                    label: 'Chat provider key set',
                    status: 'warning',
                    detail: `${chatProvider} is selected for chat but has no key.`,
                    fixHref: '/settings/section/providers',
                    fixLabel: 'Review providers',
                })
            }
            if (embeddingsProvider && !providerHasKey(embeddingsProvider)) {
                next.push({
                    id: 'embeddings-provider-key',
                    label: 'Embeddings provider key set',
                    status: 'warning',
                    detail: `${embeddingsProvider} is selected for embeddings but has no key.`,
                    fixHref: '/settings/section/providers',
                    fixLabel: 'Review providers',
                })
            }
            if (!model) {
                next.push({
                    id: 'ai-model',
                    label: 'Chat model selected',
                    status: 'warning',
                    detail: 'No chat model picked.',
                    fixHref: '/settings/section/ai?focus=ai-model',
                    fixLabel: 'Pick a model',
                })
            }

            // 5. Workspace.
            const ws = v['workspace.workspaceDir']
            if (!ws) {
                next.push({
                    id: 'workspace',
                    label: 'Workspace folder set',
                    status: 'warning',
                    detail: 'OR3 has no workspace folder.',
                    fixHref: '/settings/section/workspace?focus=workspace-dir',
                    fixLabel: 'Choose folder',
                })
            } else {
                next.push({
                    id: 'workspace',
                    label: 'Workspace folder set',
                    status: 'ok',
                    detail: `Workspace: ${String(ws)}`,
                })
            }

            // 6. Doc index configured if enabled.
            if (v['docindex.enabled'] && !v['docindex.maxFiles']) {
                next.push({
                    id: 'docindex',
                    label: 'File search ready',
                    status: 'warning',
                    detail: 'File search is on but no size limit is set.',
                    fixHref: '/settings/section/workspace?focus=workspace-search-size',
                    fixLabel: 'Set size',
                })
            }

            // 7. Terminal access matches safety.
            const execEnabled = Boolean(v['hardening.enableExecShell'])
            const profile = String(v['runtimeProfile.value'] ?? '')
            if (execEnabled && profile.startsWith('hosted-no-exec')) {
                next.push({
                    id: 'safety-mismatch',
                    label: 'Safety mode matches terminal access',
                    status: 'warning',
                    detail: 'Terminal is allowed but the safety mode forbids exec.',
                    fixHref: '/settings/section/safety',
                    fixLabel: 'Review safety',
                })
            }

            // 8. Capabilities sanity.
            if (caps?.execAvailable === false && execEnabled) {
                next.push({
                    id: 'exec-unavailable',
                    label: 'Terminal can actually run',
                    status: 'warning',
                    detail: 'The host reports exec is unavailable even though you allow it.',
                    fixHref: '/settings/section/safety',
                    fixLabel: 'Review safety',
                })
            }

            findings.value = next
            lastRun.value = new Date().toISOString()
        } finally {
            loading.value = false
        }
    }

    const overall = computed<HealthStatus>(() => {
        if (!findings.value.length) return 'unknown'
        if (findings.value.some((f) => f.status === 'error')) return 'error'
        if (findings.value.some((f) => f.status === 'warning')) return 'warning'
        if (findings.value.every((f) => f.status === 'ok')) return 'ok'
        return 'unknown'
    })

    return { findings, loading, lastRun, run, overall }
}
