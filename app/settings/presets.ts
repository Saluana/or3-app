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

/** File search size: docindex.maxFiles + maxChunks. */
export const FILE_SEARCH_SIZE_PRESETS: SimpleSettingPreset[] = [
    {
        id: 'low',
        label: 'Low',
        description: 'Index a small workspace.',
        changes: [
            { section: 'docindex', field: 'maxFiles', value: 200 },
            { section: 'docindex', field: 'maxChunks', value: 1000 },
        ],
    },
    {
        id: 'standard',
        label: 'Standard',
        description: 'Default for most projects.',
        impacts: ['uses-storage'],
        changes: [
            { section: 'docindex', field: 'maxFiles', value: 1000 },
            { section: 'docindex', field: 'maxChunks', value: 5000 },
        ],
    },
    {
        id: 'high',
        label: 'High',
        description: 'Large workspaces, more storage used.',
        impacts: ['uses-storage', 'slower'],
        changes: [
            { section: 'docindex', field: 'maxFiles', value: 5000 },
            { section: 'docindex', field: 'maxChunks', value: 25000 },
        ],
    },
    {
        id: 'max',
        label: 'Max',
        description: 'Index nearly everything.',
        impacts: ['uses-storage', 'slower', 'requires-reindex'],
        changes: [
            { section: 'docindex', field: 'maxFiles', value: 25000 },
            { section: 'docindex', field: 'maxChunks', value: 100000 },
        ],
    },
]

/** Background agent power: subagents.maxConcurrent + maxQueued. */
export const SUBAGENT_POWER_PRESETS: SimpleSettingPreset[] = [
    {
        id: 'low',
        label: 'Low',
        description: 'One thing at a time.',
        impacts: ['safer'],
        changes: [
            { section: 'subagents', field: 'maxConcurrent', value: 1 },
            { section: 'subagents', field: 'maxQueued', value: 4 },
        ],
    },
    {
        id: 'standard',
        label: 'Standard',
        description: 'A few background tasks at once.',
        changes: [
            { section: 'subagents', field: 'maxConcurrent', value: 3 },
            { section: 'subagents', field: 'maxQueued', value: 16 },
        ],
    },
    {
        id: 'high',
        label: 'High',
        description: 'Lots of background work.',
        impacts: ['higher-cost'],
        changes: [
            { section: 'subagents', field: 'maxConcurrent', value: 8 },
            { section: 'subagents', field: 'maxQueued', value: 64 },
        ],
    },
    {
        id: 'max',
        label: 'Max',
        description: 'Use as much capacity as available.',
        impacts: ['higher-cost', 'slower'],
        changes: [
            { section: 'subagents', field: 'maxConcurrent', value: 16 },
            { section: 'subagents', field: 'maxQueued', value: 256 },
        ],
    },
]

/** Safety mode: runtimeProfile. (choice control, but exposed as a "level".) */
export const SAFETY_MODE_PRESETS: SimpleSettingPreset[] = [
    {
        id: 'hosted-no-exec',
        label: 'Strictest',
        description: 'No terminal, no shell. Best for shared or hosted setups.',
        impacts: ['safer'],
        changes: [{ section: 'runtimeProfile', field: 'value', value: 'hosted-no-exec' }],
    },
    {
        id: 'hosted-remote-sandbox-only',
        label: 'High',
        description: 'Terminal only inside a sandbox.',
        impacts: ['safer'],
        changes: [{ section: 'runtimeProfile', field: 'value', value: 'hosted-remote-sandbox-only' }],
    },
    {
        id: 'single-user-hardened',
        label: 'Standard',
        description: 'Recommended for one-person desktops.',
        changes: [{ section: 'runtimeProfile', field: 'value', value: 'single-user-hardened' }],
    },
    {
        id: 'local-dev',
        label: 'Permissive',
        description: 'Local development. Fewer guard rails.',
        impacts: ['higher-risk'],
        changes: [{ section: 'runtimeProfile', field: 'value', value: 'local-dev' }],
    },
]
