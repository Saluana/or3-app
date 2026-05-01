/**
 * Six-section registry for Simple Settings.
 *
 * The shape comes from `simpleSettings.ts`. Controls reference raw config
 * fields by `(section, field)` so that we can:
 *   - hide controls when the connected backend doesn't expose the field
 *   - read current values from the configure API
 *   - emit ConfigureChange[] back via the existing apply endpoint
 */

import {
    CONVERSATION_DETAIL_PRESETS,
    FILE_SEARCH_SIZE_PRESETS,
    MEMORY_SEARCH_PRESETS,
    SAFETY_MODE_PRESETS,
    SUBAGENT_POWER_PRESETS,
} from './presets'
import type { SimpleSettingSection } from './simpleSettings'

function get<T>(values: Record<string, unknown>, key: string, fallback: T): T {
    const value = values[key]
    return value === undefined || value === null ? fallback : (value as T)
}

export const SIMPLE_SETTING_SECTIONS: SimpleSettingSection[] = [
    {
        key: 'ai',
        label: 'AI Model',
        description: 'Choose the AI service, model, and response style.',
        icon: 'i-pixelarticons-cpu',
        summaryTemplate: (v) => {
            const provider = get(v, 'provider.kind', 'OpenRouter')
            const model = get(v, 'provider.model', 'default model')
            return `${provider}, ${model}.`
        },
        controls: [
            {
                key: 'ai-provider',
                label: 'AI provider',
                description: 'Which service answers your messages.',
                kind: 'choice',
                fieldRefs: [{ section: 'provider', field: 'kind' }],
                advancedKeys: ['provider.kind', 'provider.apiBase'],
            },
            {
                key: 'ai-key',
                label: 'API key',
                description: 'Your private key for the chosen provider.',
                kind: 'secret',
                fieldRefs: [{ section: 'provider', field: 'apiKey' }],
                warningLevel: 'medium',
                advancedKeys: ['provider.apiKey'],
            },
            {
                key: 'ai-model',
                label: 'Chat model',
                description: 'The model used for replies.',
                kind: 'choice',
                fieldRefs: [{ section: 'provider', field: 'model' }],
                advancedKeys: ['provider.model'],
            },
            {
                key: 'ai-vision',
                label: 'Image understanding',
                description: 'Let the AI look at images you attach.',
                kind: 'toggle',
                fieldRefs: [{ section: 'provider', field: 'enableVision' }],
                impacts: ['higher-cost'],
                advancedKeys: ['provider.enableVision'],
                toggle: {
                    on: { section: 'provider', field: 'enableVision', value: true },
                    off: { section: 'provider', field: 'enableVision', value: false },
                },
            },
            {
                key: 'ai-timeout',
                label: 'Wait time for AI',
                description: 'How long to wait before giving up on a reply.',
                kind: 'text',
                fieldRefs: [{ section: 'provider', field: 'timeoutSeconds' }],
                advancedKeys: ['provider.timeoutSeconds'],
            },
        ],
    },
    {
        key: 'memory',
        label: 'Memory & Chat',
        description: 'Control how much OR3 remembers and how hard it searches.',
        icon: 'i-pixelarticons-card-stack',
        summaryTemplate: (v) => {
            const history = Number(get(v, 'context.historyMaxMessages', 40))
            const recall = Number(get(v, 'context.memoryRetrieveLimit', 8))
            return `OR3 keeps about ${history} recent messages in mind and may recall up to ${recall} saved memories per reply.`
        },
        controls: [
            {
                key: 'memory-history',
                label: 'Max messages per session',
                description: 'How many recent messages stay in the AI’s mind.',
                kind: 'text',
                fieldRefs: [{ section: 'context', field: 'historyMaxMessages' }],
                advancedKeys: ['context.historyMaxMessages'],
            },
            {
                key: 'memory-retrieve',
                label: 'Memories recalled per reply',
                description: 'How many saved memories OR3 may bring back.',
                kind: 'text',
                fieldRefs: [{ section: 'context', field: 'memoryRetrieveLimit' }],
                advancedKeys: ['context.memoryRetrieveLimit'],
            },
            {
                key: 'memory-search-strength',
                label: 'Memory search strength',
                description: 'How hard OR3 searches your past memories.',
                kind: 'preset-slider',
                fieldRefs: [
                    { section: 'memory', field: 'vectorSearchK' },
                    { section: 'memory', field: 'ftsSearchK' },
                    { section: 'memory', field: 'vectorScanLimit' },
                ],
                presets: MEMORY_SEARCH_PRESETS,
                advancedKeys: ['memory.vectorSearchK', 'memory.ftsSearchK', 'memory.vectorScanLimit'],
            },
            {
                key: 'memory-detail',
                label: 'Conversation detail',
                description: 'How much context OR3 sends to the AI per reply.',
                kind: 'preset-slider',
                fieldRefs: [{ section: 'context', field: 'maxInputTokens' }],
                presets: CONVERSATION_DETAIL_PRESETS,
                impacts: ['higher-cost', 'slower'],
                advancedKeys: ['context.maxInputTokens', 'context.outputReserveTokens', 'context.safetyMarginTokens'],
            },
            {
                key: 'memory-cleanup',
                label: 'Background memory cleanup',
                description: 'Quietly summarise old memories to keep things tidy.',
                kind: 'toggle',
                fieldRefs: [{ section: 'memory', field: 'consolidationEnabled' }],
                advancedKeys: ['memory.consolidationEnabled', 'memory.consolidationCharLimit'],
                recommended: { value: true, label: 'On' },
                toggle: {
                    on: { section: 'memory', field: 'consolidationEnabled', value: true },
                    off: { section: 'memory', field: 'consolidationEnabled', value: false },
                },
            },
        ],
    },
    {
        key: 'workspace',
        label: 'Files & Workspace',
        description: 'Choose what folders OR3 can use.',
        icon: 'i-pixelarticons-folder',
        summaryTemplate: (v) => {
            const dir = String(get(v, 'workspace.workspaceDir', 'your workspace folder'))
            const restrict = Boolean(get(v, 'tools.restrictToWorkspace', true))
            return restrict
                ? `OR3 can work inside ${dir} and cannot access files outside it.`
                : `OR3 can work inside ${dir} and may also access other allowed folders.`
        },
        controls: [
            {
                key: 'workspace-dir',
                label: 'Workspace folder',
                description: 'The main folder OR3 works in.',
                kind: 'path',
                fieldRefs: [{ section: 'workspace', field: 'workspaceDir' }],
                advancedKeys: ['workspace.workspaceDir'],
            },
            {
                key: 'workspace-restrict',
                label: 'Keep OR3 inside this folder',
                description: 'Stop OR3 from reading files outside the workspace.',
                kind: 'toggle',
                fieldRefs: [{ section: 'tools', field: 'restrictToWorkspace' }],
                impacts: ['safer'],
                recommended: { value: true, label: 'On' },
                advancedKeys: ['tools.restrictToWorkspace'],
                toggle: {
                    on: { section: 'tools', field: 'restrictToWorkspace', value: true },
                    off: { section: 'tools', field: 'restrictToWorkspace', value: false },
                },
            },
            {
                key: 'workspace-allowed',
                label: 'Extra allowed folder',
                description: 'A second folder OR3 may read and write.',
                kind: 'path',
                fieldRefs: [{ section: 'workspace', field: 'allowedDir' }],
                advancedKeys: ['workspace.allowedDir'],
            },
            {
                key: 'workspace-search',
                label: 'Search workspace files',
                description: 'Let OR3 search the workspace by content.',
                kind: 'toggle',
                fieldRefs: [{ section: 'docindex', field: 'enabled' }],
                impacts: ['uses-storage'],
                advancedKeys: ['docindex.enabled'],
                toggle: {
                    on: { section: 'docindex', field: 'enabled', value: true },
                    off: { section: 'docindex', field: 'enabled', value: false },
                },
            },
            {
                key: 'workspace-search-size',
                label: 'File search size',
                description: 'How much of the workspace OR3 will index.',
                kind: 'preset-slider',
                fieldRefs: [
                    { section: 'docindex', field: 'maxFiles' },
                    { section: 'docindex', field: 'maxChunks' },
                ],
                presets: FILE_SEARCH_SIZE_PRESETS,
                impacts: ['uses-storage', 'slower'],
                advancedKeys: ['docindex.maxFiles', 'docindex.maxChunks', 'docindex.maxFileBytes', 'docindex.embedMaxBytes', 'docindex.refreshSeconds'],
            },
        ],
    },
    {
        key: 'connections',
        label: 'Devices & Connections',
        description: 'Manage paired devices and message apps.',
        icon: 'i-pixelarticons-message-text',
        summaryTemplate: (v) => {
            const enabled: string[] = []
            for (const ch of ['telegram', 'slack', 'discord', 'whatsapp', 'email']) {
                if (get(v, `channels.${ch}.enabled`, false)) enabled.push(ch)
            }
            return enabled.length ? `Connected channels: ${enabled.join(', ')}.` : 'No external channels are connected.'
        },
        controls: [
            {
                key: 'channel-telegram',
                label: 'Telegram',
                description: 'Talk to OR3 from a Telegram chat.',
                kind: 'connection-card',
                fieldRefs: [{ section: 'channels', field: 'enabled', channel: 'telegram' }],
                connection: { channelKey: 'telegram' },
                advancedKeys: ['channels.telegram.botToken', 'channels.telegram.allowedChats'],
            },
            {
                key: 'channel-slack',
                label: 'Slack',
                description: 'Talk to OR3 in a Slack workspace.',
                kind: 'connection-card',
                fieldRefs: [{ section: 'channels', field: 'enabled', channel: 'slack' }],
                connection: { channelKey: 'slack' },
                advancedKeys: ['channels.slack.botToken', 'channels.slack.appToken', 'channels.slack.signingSecret'],
            },
            {
                key: 'channel-discord',
                label: 'Discord',
                description: 'Talk to OR3 in a Discord server.',
                kind: 'connection-card',
                fieldRefs: [{ section: 'channels', field: 'enabled', channel: 'discord' }],
                connection: { channelKey: 'discord' },
                advancedKeys: ['channels.discord.botToken'],
            },
            {
                key: 'channel-whatsapp',
                label: 'WhatsApp',
                description: 'Talk to OR3 from WhatsApp.',
                kind: 'connection-card',
                fieldRefs: [{ section: 'channels', field: 'enabled', channel: 'whatsapp' }],
                connection: { channelKey: 'whatsapp' },
                advancedKeys: ['channels.whatsapp.token'],
            },
            {
                key: 'channel-email',
                label: 'Email',
                description: 'Get OR3 replies in your inbox.',
                kind: 'connection-card',
                fieldRefs: [{ section: 'channels', field: 'enabled', channel: 'email' }],
                connection: { channelKey: 'email' },
                advancedKeys: ['channels.email.smtp', 'channels.email.imap'],
            },
        ],
    },
    {
        key: 'automation',
        label: 'Automations & Skills',
        description: 'Control background work, schedules, and skills.',
        icon: 'i-pixelarticons-zap',
        summaryTemplate: (v) => {
            const sub = Boolean(get(v, 'subagents.enabled', false))
            const cron = Boolean(get(v, 'cron.enabled', false))
            if (sub && cron) return 'Background agents and scheduled tasks are on.'
            if (sub) return 'Background agents are on; schedules are off.'
            if (cron) return 'Scheduled tasks are on; background agents are off.'
            return 'Background work is limited.'
        },
        controls: [
            {
                key: 'auto-subagents',
                label: 'Background agents',
                description: 'Let OR3 run helper agents in the background.',
                kind: 'toggle',
                fieldRefs: [{ section: 'subagents', field: 'enabled' }],
                advancedKeys: ['subagents.enabled'],
                toggle: {
                    on: { section: 'subagents', field: 'enabled', value: true },
                    off: { section: 'subagents', field: 'enabled', value: false },
                },
            },
            {
                key: 'auto-subagent-power',
                label: 'Background agent power',
                description: 'How many helper agents may run at once.',
                kind: 'preset-slider',
                fieldRefs: [
                    { section: 'subagents', field: 'maxConcurrent' },
                    { section: 'subagents', field: 'maxQueued' },
                ],
                presets: SUBAGENT_POWER_PRESETS,
                impacts: ['higher-cost'],
                advancedKeys: ['subagents.maxConcurrent', 'subagents.maxQueued', 'subagents.taskTimeoutSeconds'],
            },
            {
                key: 'auto-cron',
                label: 'Scheduled tasks',
                description: 'Run things on a schedule.',
                kind: 'toggle',
                fieldRefs: [{ section: 'cron', field: 'enabled' }],
                advancedKeys: ['cron.enabled', 'cron.storePath'],
                toggle: {
                    on: { section: 'cron', field: 'enabled', value: true },
                    off: { section: 'cron', field: 'enabled', value: false },
                },
            },
            {
                key: 'auto-heartbeat',
                label: 'Check in automatically',
                description: 'Let OR3 check in on its own from time to time.',
                kind: 'toggle',
                fieldRefs: [{ section: 'heartbeat', field: 'enabled' }],
                advancedKeys: ['heartbeat.enabled', 'heartbeat.intervalSeconds'],
                toggle: {
                    on: { section: 'heartbeat', field: 'enabled', value: true },
                    off: { section: 'heartbeat', field: 'enabled', value: false },
                },
            },
            {
                key: 'auto-filewatch',
                label: 'Watch files for changes',
                description: 'Trigger work when watched files change.',
                kind: 'toggle',
                fieldRefs: [{ section: 'triggers', field: 'fileWatch.enabled' }],
                advancedKeys: ['triggers.fileWatch.enabled', 'triggers.fileWatch.debounceMs', 'triggers.fileWatch.pollIntervalMs'],
                toggle: {
                    on: { section: 'triggers', field: 'fileWatch.enabled', value: true },
                    off: { section: 'triggers', field: 'fileWatch.enabled', value: false },
                },
            },
            {
                key: 'auto-webhooks',
                label: 'Receive webhooks',
                description: 'Allow other tools to ping OR3.',
                kind: 'toggle',
                fieldRefs: [{ section: 'triggers', field: 'webhook.enabled' }],
                impacts: ['higher-risk'],
                advancedKeys: ['triggers.webhook.enabled', 'triggers.webhook.bind', 'triggers.webhook.secret'],
                toggle: {
                    on: { section: 'triggers', field: 'webhook.enabled', value: true },
                    off: { section: 'triggers', field: 'webhook.enabled', value: false },
                },
            },
        ],
    },
    {
        key: 'safety',
        label: 'Safety & Privacy',
        description: 'Control approvals, terminal access, network access, and logs.',
        icon: 'i-pixelarticons-shield',
        summaryTemplate: (v) => {
            const profile = String(get(v, 'runtimeProfile', 'single-user-hardened'))
            const exec = Boolean(get(v, 'hardening.enableExecShell', false))
            return exec
                ? `Safety mode: ${profile}. Terminal commands are allowed.`
                : `Safety mode: ${profile}. Terminal commands are off.`
        },
        controls: [
            {
                key: 'safety-mode',
                label: 'Safety mode',
                description: 'Pick a balance between power and protection.',
                kind: 'preset-slider',
                fieldRefs: [{ section: 'runtimeProfile', field: 'value' }],
                presets: SAFETY_MODE_PRESETS,
                warningLevel: 'medium',
                advancedKeys: ['runtimeProfile'],
            },
            {
                key: 'safety-exec',
                label: 'Allow terminal commands',
                description: 'Let OR3 run shell commands when approved.',
                kind: 'toggle',
                fieldRefs: [{ section: 'hardening', field: 'enableExecShell' }],
                impacts: ['higher-risk'],
                warningLevel: 'high',
                recommended: { value: false, label: 'Off for beginners' },
                advancedKeys: ['hardening.enableExecShell', 'hardening.execAllowedPrograms'],
                toggle: {
                    on: { section: 'hardening', field: 'enableExecShell', value: true },
                    off: { section: 'hardening', field: 'enableExecShell', value: false },
                },
            },
            {
                key: 'safety-network',
                label: 'Allow network access',
                description: 'Let OR3 reach the internet for web tools.',
                kind: 'toggle',
                fieldRefs: [{ section: 'hardening', field: 'enableNetwork' }],
                impacts: ['higher-risk'],
                advancedKeys: ['hardening.enableNetwork'],
                toggle: {
                    on: { section: 'hardening', field: 'enableNetwork', value: true },
                    off: { section: 'hardening', field: 'enableNetwork', value: false },
                },
            },
            {
                key: 'safety-audit',
                label: 'Keep safety log',
                description: 'Record approvals, runs, and key events.',
                kind: 'toggle',
                fieldRefs: [{ section: 'security', field: 'audit.enabled' }],
                impacts: ['safer'],
                recommended: { value: true, label: 'On' },
                advancedKeys: ['security.audit.enabled', 'security.audit.keyFile'],
                toggle: {
                    on: { section: 'security', field: 'audit.enabled', value: true },
                    off: { section: 'security', field: 'audit.enabled', value: false },
                },
            },
            {
                key: 'safety-secrets',
                label: 'Protect saved secrets',
                description: 'Encrypt secret values at rest.',
                kind: 'toggle',
                fieldRefs: [{ section: 'security', field: 'secretStore.enabled' }],
                impacts: ['safer'],
                recommended: { value: true, label: 'On' },
                advancedKeys: ['security.secretStore.enabled', 'security.secretStore.keyFile'],
                toggle: {
                    on: { section: 'security', field: 'secretStore.enabled', value: true },
                    off: { section: 'security', field: 'secretStore.enabled', value: false },
                },
            },
        ],
    },
]
