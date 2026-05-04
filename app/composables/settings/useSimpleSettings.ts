import { computed, ref } from 'vue'
import type {
    SimpleSettingChange,
    SimpleSettingControl,
    SimpleSettingPreset,
    SimpleSettingSection,
    SimpleSettingSectionKey,
} from '~/settings/simpleSettings'
import { toConfigureChange } from '~/settings/simpleSettings'
import { SIMPLE_SETTING_SECTIONS } from '~/settings/fieldMappings'
import type { ConfigureChange, ConfigureField } from '~/types/or3-api'
import { useConfigure } from '~/composables/useConfigure'

interface BackendFieldEntry {
    section: string
    channel?: string
    field: ConfigureField
}

interface BackendFieldRef {
    section: string
    field: string
    channel?: string
}

const fieldCache = ref<BackendFieldEntry[]>([])
const loadedSections = ref<Set<string>>(new Set())
const loadingSections = ref<Set<string>>(new Set())
const lastError = ref<string | null>(null)

/**
 * Stable cache key for a (section, channel?, field) tuple.
 */
function refKey(section: string, field: string, channel?: string): string {
    return channel ? `${section}::${channel}::${field}` : `${section}::${field}`
}

const FIELD_ALIASES: Record<string, BackendFieldRef> = {
    [refKey('provider', 'kind')]: { section: 'provider', field: 'provider_preset' },
    [refKey('provider', 'apiBase')]: { section: 'provider', field: 'provider_api_base' },
    [refKey('provider', 'apiKey')]: { section: 'provider', field: 'provider_api_key' },
    [refKey('provider', 'model')]: { section: 'provider', field: 'provider_model' },
    [refKey('provider', 'embedModel')]: { section: 'provider', field: 'provider_embed' },
    [refKey('provider', 'temperature')]: { section: 'provider', field: 'provider_temperature' },
    [refKey('provider', 'enableVision')]: { section: 'provider', field: 'provider_vision' },
    [refKey('provider', 'timeoutSeconds')]: { section: 'provider', field: 'provider_timeout' },

    [refKey('context', 'historyMaxMessages')]: { section: 'runtime', field: 'runtime_history_max' },
    [refKey('context', 'memoryRetrieveLimit')]: { section: 'runtime', field: 'runtime_memory_retrieve' },
    [refKey('context', 'maxInputTokens')]: { section: 'context', field: 'context_max_input_tokens' },
    [refKey('context', 'outputReserveTokens')]: { section: 'context', field: 'context_output_reserve' },
    [refKey('context', 'safetyMarginTokens')]: { section: 'context', field: 'context_safety_margin' },
    [refKey('memory', 'vectorSearchK')]: { section: 'runtime', field: 'runtime_vector_k' },
    [refKey('memory', 'ftsSearchK')]: { section: 'runtime', field: 'runtime_fts_k' },
    [refKey('memory', 'vectorScanLimit')]: { section: 'runtime', field: 'runtime_vector_scan_limit' },
    [refKey('memory', 'consolidationEnabled')]: { section: 'runtime', field: 'runtime_consolidation_enabled' },
    [refKey('memory', 'consolidationCharLimit')]: { section: 'runtime', field: 'runtime_consolidation_max_input_chars' },

    [refKey('workspace', 'workspaceDir')]: { section: 'workspace', field: 'workspace_dir' },
    [refKey('workspace', 'allowedDir')]: { section: 'workspace', field: 'workspace_allowed_dir' },
    [refKey('tools', 'restrictToWorkspace')]: { section: 'workspace', field: 'workspace_restrict' },
    [refKey('tools', 'enableExec')]: { section: 'tools', field: 'tools_enable_exec' },
    [refKey('tools', 'execTimeoutSeconds')]: { section: 'tools', field: 'tools_exec_timeout' },
    [refKey('tools', 'pathAppend')]: { section: 'tools', field: 'tools_path_append' },
    [refKey('docindex', 'enabled')]: { section: 'docindex', field: 'docindex_enabled' },
    [refKey('docindex', 'maxFiles')]: { section: 'docindex', field: 'docindex_max_files' },
    [refKey('docindex', 'maxChunks')]: { section: 'docindex', field: 'docindex_max_chunks' },
    [refKey('docindex', 'maxFileBytes')]: { section: 'docindex', field: 'docindex_max_file_bytes' },
    [refKey('docindex', 'embedMaxBytes')]: { section: 'docindex', field: 'docindex_embed_max_bytes' },
    [refKey('docindex', 'refreshSeconds')]: { section: 'docindex', field: 'docindex_refresh_seconds' },

    [refKey('subagents', 'enabled')]: { section: 'runtime', field: 'runtime_subagents_enabled' },
    [refKey('subagents', 'maxConcurrent')]: { section: 'runtime', field: 'runtime_subagents_max_concurrent' },
    [refKey('subagents', 'maxQueued')]: { section: 'runtime', field: 'runtime_subagents_max_queued' },
    [refKey('subagents', 'taskTimeoutSeconds')]: { section: 'runtime', field: 'runtime_subagents_timeout' },
    [refKey('cron', 'enabled')]: { section: 'automation', field: 'automation_cron_enabled' },
    [refKey('cron', 'storePath')]: { section: 'automation', field: 'automation_cron_store_path' },
    [refKey('heartbeat', 'enabled')]: { section: 'automation', field: 'automation_heartbeat_enabled' },
    [refKey('heartbeat', 'intervalSeconds')]: { section: 'automation', field: 'automation_heartbeat_interval' },
    [refKey('triggers', 'fileWatch.enabled')]: { section: 'automation', field: 'automation_filewatch_enabled' },
    [refKey('triggers', 'fileWatch.debounceMs')]: { section: 'automation', field: 'automation_filewatch_debounce' },
    [refKey('triggers', 'fileWatch.pollIntervalMs')]: { section: 'automation', field: 'automation_filewatch_poll_seconds' },
    [refKey('triggers', 'webhook.enabled')]: { section: 'automation', field: 'automation_webhook_enabled' },
    [refKey('triggers', 'webhook.bind')]: { section: 'automation', field: 'automation_webhook_addr' },
    [refKey('triggers', 'webhook.secret')]: { section: 'automation', field: 'automation_webhook_secret' },

    [refKey('runtimeProfile', 'value')]: { section: 'runtime', field: 'runtime_profile' },
    [refKey('skills', 'enableExec')]: { section: 'skills', field: 'skills_enable_exec' },
    [refKey('service', 'maxCapability')]: { section: 'service', field: 'service_max_capability' },
    [refKey('hardening', 'guardedTools')]: { section: 'hardening', field: 'hardening_guarded_tools' },
    [refKey('hardening', 'privilegedTools')]: { section: 'hardening', field: 'hardening_privileged_tools' },
    [refKey('hardening', 'enableExecShell')]: { section: 'hardening', field: 'hardening_exec_shell' },
    [refKey('hardening', 'execAllowedPrograms')]: { section: 'hardening', field: 'hardening_exec_allowed_programs' },
    [refKey('hardening', 'enableNetwork')]: { section: 'hardening', field: 'hardening_sandbox_allow_network' },
    [refKey('security', 'approvals.execMode')]: { section: 'security', field: 'security_approval_exec_mode' },
    [refKey('security', 'approvals.skillMode')]: { section: 'security', field: 'security_approval_skill_mode' },
    [refKey('security', 'audit.enabled')]: { section: 'security', field: 'security_audit_enabled' },
    [refKey('security', 'audit.keyFile')]: { section: 'security', field: 'security_audit_key_file' },
    [refKey('security', 'secretStore.enabled')]: { section: 'security', field: 'security_secret_store_enabled' },
    [refKey('security', 'secretStore.keyFile')]: { section: 'security', field: 'security_secret_store_key_file' },

    [refKey('agentCLI', 'enabled')]: { section: 'agentcli', field: 'agentCLI_enabled' },
    [refKey('agentCLI', 'maxConcurrent')]: { section: 'agentcli', field: 'agentCLI_max_concurrent' },
    [refKey('agentCLI', 'maxQueued')]: { section: 'agentcli', field: 'agentCLI_max_queued' },
    [refKey('agentCLI', 'defaultTimeoutSeconds')]: { section: 'agentcli', field: 'agentCLI_default_timeout' },
    [refKey('agentCLI', 'allowSandboxAuto')]: { section: 'agentcli', field: 'agentCLI_allow_sandbox_auto' },
    [refKey('agentCLI', 'disabledRunners')]: { section: 'agentcli', field: 'agentCLI_disabled_runners' },
    [refKey('agentCLI', 'defaultMode')]: { section: 'agentcli', field: 'agentCLI_default_mode' },
    [refKey('agentCLI', 'defaultIsolation')]: { section: 'agentcli', field: 'agentCLI_default_isolation' },
}

function resolveFieldRef(section: string, field: string, channel?: string): BackendFieldRef {
    return FIELD_ALIASES[refKey(section, field, channel)] ?? { section, field, channel }
}

function findField(section: string, field: string, channel?: string): ConfigureField | undefined {
    const resolved = resolveFieldRef(section, field, channel)
    const key = refKey(resolved.section, resolved.field, resolved.channel)
    return fieldCache.value.find((entry) => refKey(entry.section, entry.field.key, entry.channel) === key)?.field
}

/**
 * The current concrete value of a control's primary field, normalised.
 *
 * Returns `undefined` when the field isn't exposed by the backend yet.
 */
function readPrimaryValue(control: SimpleSettingControl): unknown {
    const ref = control.fieldRefs[0]
    if (!ref) return undefined
    const f = findField(ref.section, ref.field, ref.channel)
    return f?.value
}

/**
 * Map of `${section}.${field}` → current value for every field referenced
 * across the schema. Used by section summary templates.
 */
function buildValueIndex(): Record<string, unknown> {
    const out: Record<string, unknown> = {}
    for (const entry of fieldCache.value) {
        const key = entry.channel
            ? `channels.${entry.channel}.${entry.field.key}`
            : `${entry.section}.${entry.field.key}`
        out[key] = entry.field.value
        // Also expose the bare `section.field` key for compatibility.
        out[`${entry.section}.${entry.field.key}`] = entry.field.value
        for (const [aliasKey, target] of Object.entries(FIELD_ALIASES)) {
            if (refKey(entry.section, entry.field.key, entry.channel) !== refKey(target.section, target.field, target.channel)) continue
            const [section, maybeChannelOrField, maybeField] = aliasKey.split('::')
            if (!section || !maybeChannelOrField) continue
            const friendlyKey = maybeField
                ? `channels.${maybeChannelOrField}.${maybeField}`
                : `${section}.${maybeChannelOrField}`
            out[friendlyKey] = entry.field.value
        }
    }
    return out
}

function valuesEqual(a: unknown, b: unknown): boolean {
    if (a === b) return true
    if (a == null || b == null) return false
    if (typeof a === 'number' || typeof b === 'number') {
        return Number(a) === Number(b)
    }
    if (typeof a === 'boolean' || typeof b === 'boolean') {
        return Boolean(a) === Boolean(b)
    }
    return String(a) === String(b)
}

function buildOverrideMap(changes: readonly SimpleSettingChange[] = []): Map<string, unknown> {
    const map = new Map<string, unknown>()
    for (const change of changes) {
        const resolved = resolveFieldRef(change.section, change.field, change.channel)
        map.set(refKey(resolved.section, resolved.field, resolved.channel), change.value)
    }
    return map
}

function readFieldValue(
    section: string,
    field: string,
    channel?: string,
    overrides: readonly SimpleSettingChange[] = [],
): unknown {
    const resolved = resolveFieldRef(section, field, channel)
    const overrideMap = buildOverrideMap(overrides)
    const key = refKey(resolved.section, resolved.field, resolved.channel)
    if (overrideMap.has(key)) return overrideMap.get(key)
    return findField(resolved.section, resolved.field, resolved.channel)?.value
}

/**
 * Detect which preset (if any) the current backend values match for a
 * preset-slider control.
 */
function detectPreset(
    control: SimpleSettingControl,
    overrides: readonly SimpleSettingChange[] = [],
): SimpleSettingPreset | null {
    if (!control.presets) return null
    for (const preset of control.presets) {
        const matches = preset.changes.every((change) => {
            const current = readFieldValue(change.section, change.field, change.channel, overrides)
            return valuesEqual(current, change.value)
        })
        if (matches) return preset
    }
    return null
}

/**
 * Determine if a control should be shown for the current backend.
 *
 * Hides controls whose underlying fields aren't available, supporting
 * version-aware behaviour (Phase 15).
 */
function isControlAvailable(control: SimpleSettingControl): boolean {
    return control.fieldRefs.some((ref) => !!findField(ref.section, ref.field, ref.channel))
}

export function useSimpleSettings() {
    const configure = useConfigure()

    /**
     * Ensure the field cache contains every backend section that this
     * SimpleSettings schema references.
     */
    async function ensureLoaded(targetSection?: SimpleSettingSectionKey) {
        const sections = targetSection
            ? SIMPLE_SETTING_SECTIONS.filter((s) => s.key === targetSection)
            : SIMPLE_SETTING_SECTIONS

        // Collect unique (section, channel?) pairs to fetch.
        const pairs = new Set<string>()
        for (const s of sections) {
            for (const c of s.controls) {
                for (const ref of c.fieldRefs) {
                    pairs.add(ref.channel ? `${ref.section}::${ref.channel}` : ref.section)
                    const resolved = resolveFieldRef(ref.section, ref.field, ref.channel)
                    pairs.add(resolved.channel ? `${resolved.section}::${resolved.channel}` : resolved.section)
                }
            }
        }

        await Promise.all(
            Array.from(pairs).map(async (key) => {
                if (loadedSections.value.has(key) || loadingSections.value.has(key)) return
                loadingSections.value.add(key)
                try {
                    const [section, channel] = key.split('::')
                    if (!section) return
                    const result = await configure.loadFields(section, channel).catch((err: any) => {
                        lastError.value = err?.message ?? null
                        return null
                    })
                    if (result?.fields) {
                        for (const f of result.fields) {
                            // Replace any prior entry under the same key.
                            const k = refKey(result.section, f.key, result.channel)
                            const idx = fieldCache.value.findIndex(
                                (e) => refKey(e.section, e.field.key, e.channel) === k,
                            )
                            const entry: BackendFieldEntry = {
                                section: result.section,
                                channel: result.channel,
                                field: f,
                            }
                            if (idx >= 0) fieldCache.value.splice(idx, 1, entry)
                            else fieldCache.value.push(entry)
                        }
                    }
                    loadedSections.value.add(key)
                } finally {
                    loadingSections.value.delete(key)
                }
            }),
        )
    }

    function reset() {
        fieldCache.value = []
        loadedSections.value = new Set()
        loadingSections.value = new Set()
        lastError.value = null
    }

    /**
     * Project a SimpleSettingSection through the backend availability filter.
     */
    function getSection(key: SimpleSettingSectionKey): SimpleSettingSection | undefined {
        const section = SIMPLE_SETTING_SECTIONS.find((s) => s.key === key)
        if (!section) return undefined
        return {
            ...section,
            controls: section.controls.filter(isControlAvailable),
        }
    }

    const availableSections = computed(() => {
        return SIMPLE_SETTING_SECTIONS.map((s) => ({
            ...s,
            controls: s.controls.filter(isControlAvailable),
        })).filter((s) => s.controls.length > 0)
    })

    const valueIndex = computed(() => buildValueIndex())

    function summaryFor(section: SimpleSettingSection): string {
        try {
            return section.summaryTemplate(valueIndex.value)
        } catch {
            return section.description
        }
    }

    return {
        ensureLoaded,
        reset,
        getSection,
        availableSections,
        valueIndex,
        summaryFor,
        readPrimaryValue: (control: SimpleSettingControl, overrides: readonly SimpleSettingChange[] = []) => {
            const ref = control.fieldRefs[0]
            if (!ref) return undefined
            return readFieldValue(ref.section, ref.field, ref.channel, overrides)
        },
        detectPreset,
        readFieldValue,
        findField,
        isControlAvailable,
        lastError,
        applyChanges: async (changes: SimpleSettingChange[]) => {
            const wire: ConfigureChange[] = changes.map((change) => {
                const resolved = resolveFieldRef(change.section, change.field, change.channel)
                return toConfigureChange({
                    ...change,
                    section: resolved.section,
                    field: resolved.field,
                    channel: resolved.channel,
                })
            })
            return configure.applyChanges(wire)
        },
    }
}
