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

function findField(section: string, field: string, channel?: string): ConfigureField | undefined {
    const key = refKey(section, field, channel)
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

/**
 * Detect which preset (if any) the current backend values match for a
 * preset-slider control.
 */
function detectPreset(control: SimpleSettingControl): SimpleSettingPreset | null {
    if (!control.presets) return null
    for (const preset of control.presets) {
        const matches = preset.changes.every((change) => {
            const current = findField(change.section, change.field, change.channel)?.value
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
        readPrimaryValue,
        detectPreset,
        findField,
        isControlAvailable,
        lastError,
        applyChanges: async (changes: SimpleSettingChange[]) => {
            const wire: ConfigureChange[] = changes.map(toConfigureChange)
            return configure.applyChanges(wire)
        },
    }
}
