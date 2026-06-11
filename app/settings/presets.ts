/**
 * Reusable preset bundles for `kind: 'preset-slider'` simple controls.
 *
 * Each preset describes a coordinated change across one or more raw config
 * fields. When the current backend values match all `changes` of a preset,
 * the slider snaps to that preset; otherwise it falls back to "Custom".
 */

import type { SimpleSettingPreset } from './simpleSettings'

/** Memory search strength: vectorSearchK + ftsSearchK + vectorScanLimit. */
export const MEMORY_SEARCH_PRESETS: SimpleSettingPreset[] = [
    {
        id: 'low',
        label: 'Low',
        description: 'Faster replies, fewer recalled memories.',
        impacts: ['safer'],
        changes: [
            { section: 'memory', field: 'vectorSearchK', value: 4 },
            { section: 'memory', field: 'ftsSearchK', value: 4 },
            { section: 'memory', field: 'vectorScanLimit', value: 200 },
        ],
    },
    {
        id: 'standard',
        label: 'Standard',
        description: 'Balanced recall for most chats.',
        changes: [
            { section: 'memory', field: 'vectorSearchK', value: 8 },
            { section: 'memory', field: 'ftsSearchK', value: 8 },
            { section: 'memory', field: 'vectorScanLimit', value: 500 },
        ],
    },
    {
        id: 'high',
        label: 'High',
        description: 'Deeper recall; slightly slower.',
        impacts: ['slower'],
        changes: [
            { section: 'memory', field: 'vectorSearchK', value: 16 },
            { section: 'memory', field: 'ftsSearchK', value: 16 },
            { section: 'memory', field: 'vectorScanLimit', value: 1000 },
        ],
    },
    {
        id: 'max',
        label: 'Max',
        description: 'Searches as much as possible.',
        impacts: ['slower', 'higher-cost'],
        changes: [
            { section: 'memory', field: 'vectorSearchK', value: 32 },
            { section: 'memory', field: 'ftsSearchK', value: 32 },
            { section: 'memory', field: 'vectorScanLimit', value: 2000 },
        ],
    },
]

/** Conversation detail: context.maxInputTokens. */
export const CONVERSATION_DETAIL_PRESETS: SimpleSettingPreset[] = [
    {
        id: 'low',
        label: 'Low',
        description: 'Short context — cheapest, quickest.',
        changes: [{ section: 'context', field: 'maxInputTokens', value: 4000 }],
    },
    {
        id: 'standard',
        label: 'Standard',
        description: 'Good for most conversations.',
        changes: [{ section: 'context', field: 'maxInputTokens', value: 12000 }],
    },
    {
        id: 'high',
        label: 'High',
        description: 'Lots of detail per reply.',
        impacts: ['higher-cost', 'slower'],
        changes: [{ section: 'context', field: 'maxInputTokens', value: 32000 }],
    },
    {
        id: 'max',
        label: 'Max',
        description: 'Use as much context as the model allows.',
        impacts: ['higher-cost', 'slower'],
        changes: [{ section: 'context', field: 'maxInputTokens', value: 128000 }],
    },
]

/** Creativity: provider.temperature. */
export const CREATIVITY_PRESETS: SimpleSettingPreset[] = [
    { id: 'low', label: 'Low', description: 'Predictable and focused.', changes: [{ section: 'provider', field: 'temperature', value: 0.2 }] },
    { id: 'standard', label: 'Standard', description: 'Balanced default.', changes: [{ section: 'provider', field: 'temperature', value: 0.7 }] },
    { id: 'high', label: 'High', description: 'More varied and creative.', changes: [{ section: 'provider', field: 'temperature', value: 1.0 }] },
    { id: 'max', label: 'Max', description: 'Most random; can ramble.', changes: [{ section: 'provider', field: 'temperature', value: 1.5 }] },
]
