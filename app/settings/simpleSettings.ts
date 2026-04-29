/**
 * Simple Settings schema.
 *
 * The user-facing layer for the or3-app settings experience. This is NOT a
 * replacement for the backend configure API — it is a translation layer that
 * maps friendly controls to one or more raw config fields surfaced by
 * `/internal/v1/configure/sections` and `/internal/v1/configure/fields`.
 *
 * Per the cloud planning system prompt: keep extension-friendly registries,
 * stay client-only, and never assume backend fields exist. The schema is
 * filtered at runtime against the fields the connected `or3-intern` actually
 * exposes (see `useSimpleSettings.ts`).
 */

import type { ConfigureChange } from '~/types/or3-api'

export type SimpleSettingSectionKey =
    | 'ai'
    | 'memory'
    | 'workspace'
    | 'connections'
    | 'automation'
    | 'safety'

export type SimpleSettingControlKind =
    | 'preset-slider'
    | 'toggle'
    | 'choice'
    | 'secret'
    | 'text'
    | 'path'
    | 'connection-card'
    | 'summary-card'

export type SimpleSettingImpact =
    | 'higher-cost'
    | 'slower'
    | 'safer'
    | 'higher-risk'
    | 'requires-restart'
    | 'requires-reindex'
    | 'uses-storage'

export type SimpleSettingWarningLevel = 'none' | 'low' | 'medium' | 'high'

/**
 * A single field reference on the backend configure surface.
 *
 * `channel` is optional and only used by sections that expose per-channel
 * subforms (channels.telegram, channels.slack, …).
 */
export interface SimpleSettingFieldRef {
    section: string
    field: string
    channel?: string
}

export interface SimpleSettingChange {
    section: string
    field: string
    value: unknown
    channel?: string
}

export interface SimpleSettingPreset {
    id: string
    label: string
    description?: string
    /** Optional impact labels to show next to this preset. */
    impacts?: SimpleSettingImpact[]
    changes: SimpleSettingChange[]
}

export interface SimpleSettingControl {
    key: string
    label: string
    description: string
    kind: SimpleSettingControlKind
    /**
     * Raw config keys this control reads from / writes to. The control is
     * hidden if NONE of these fields are exposed by the connected backend.
     */
    fieldRefs: SimpleSettingFieldRef[]
    /** Long-form list of advanced keys to surface in "Advanced details". */
    advancedKeys?: string[]
    impacts?: SimpleSettingImpact[]
    warningLevel?: SimpleSettingWarningLevel
    /** Recommended default for new users. Used by RecommendedBadge. */
    recommended?: { value: unknown; label?: string }
    /**
     * Used by `kind: 'preset-slider'` and `kind: 'choice'` controls.
     * When values match a preset the slider snaps to it; otherwise it shows
     * "Custom".
     */
    presets?: SimpleSettingPreset[]
    /** Used by toggles and other simple controls that target one field. */
    toggle?: {
        on: SimpleSettingChange
        off: SimpleSettingChange
    }
    /** Optional connection metadata for kind: 'connection-card'. */
    connection?: {
        channelKey: string
        statusFieldRef?: SimpleSettingFieldRef
    }
}

export interface SimpleSettingSection {
    key: SimpleSettingSectionKey
    label: string
    description: string
    /** Single line plain-language summary, generated dynamically. */
    summaryTemplate: (values: Record<string, unknown>) => string
    icon: string
    controls: SimpleSettingControl[]
}

/**
 * Convert a SimpleSettingChange into the ConfigureChange wire shape.
 */
export function toConfigureChange(change: SimpleSettingChange): ConfigureChange {
    return {
        section: change.section,
        field: change.field,
        channel: change.channel,
        op: 'set',
        value: change.value,
    }
}
