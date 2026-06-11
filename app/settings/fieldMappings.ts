/**
 * Six-section registry for Simple Settings.
 *
 * The shape comes from `simpleSettings.ts`. Controls reference raw config
 * fields by `(section, field)` so that we can:
 *   - hide controls when the connected backend doesn't expose the field
 *   - read current values from the configure API
 *   - emit ConfigureChange[] back via the existing apply endpoint
 */

import { MEMORY_SEARCH_PRESETS } from './presets';
import type { SimpleSettingSection } from './simpleSettings';

function get<T>(values: Record<string, unknown>, key: string, fallback: T): T {
    const value = values[key];
    return value === undefined || value === null ? fallback : (value as T);
}

export const SIMPLE_SETTING_SECTIONS: SimpleSettingSection[] = [
    {
        key: 'providers',
        label: 'AI Controls',
        description: 'Choose AI services, models, and favorite model shortcuts.',
        icon: 'i-pixelarticons-server',
        summaryTemplate: (v) => {
            const openai = get(v, 'provider.openaiApiKey', '');
            const openrouter = get(v, 'provider.openrouterApiKey', '');
            const selectedProvider = get(v, 'provider.kind', '');
            const names = [
                openai ? 'OpenAI' : '',
                openrouter ? 'OpenRouter' : '',
            ].filter(Boolean);
            return names.length
                ? `${names.join(' and ')} configured.`
                : selectedProvider
                    ? `${selectedProvider} selected. Add more providers after restarting or3-intern.`
                    : 'No provider keys configured yet.';
        },
        controls: [
            {
                key: 'provider-kind',
                label: 'Main provider',
                description: 'The default AI service OR3 uses when a newer role setting is not available yet.',
                kind: 'choice',
                fieldRefs: [{ section: 'provider', field: 'kind' }],
                advancedKeys: ['provider.kind', 'provider.apiBase'],
            },
            {
                key: 'provider-manager',
                label: 'Providers',
                description: 'Add OpenAI-compatible providers and check which ones have keys.',
                kind: 'provider-manager',
                fieldRefs: [{ section: 'provider', field: 'kind' }],
                advancedKeys: ['providers', 'provider.apiBase', 'provider.apiKey'],
            },
        ],
    },
    {
        key: 'ai',
        label: 'Model Roles',
        description: 'Choose which provider and model handles each kind of work.',
        icon: 'i-pixelarticons-cpu',
        summaryTemplate: (v) => {
            const provider = get(v, 'provider.kind', 'OpenAI');
            const embedProvider = get(v, 'routing.embeddingsProvider', provider);
            const embedModel = get(v, 'routing.embeddingsModel', get(v, 'provider.embedModel', 'default embedding model'));
            return `Runners handle chat; embeddings use ${embedProvider}/${embedModel}.`;
        },
        controls: [
            {
                key: 'summarization-provider',
                label: 'Summarization provider',
                description: 'Provider used for memory consolidation and summaries.',
                kind: 'choice',
                group: 'summarization',
                groupLabel: 'Summarization',
                groupDescription: 'Memory consolidation and compact summaries.',
                fieldRefs: [{ section: 'routing', field: 'summarizationProvider' }],
                advancedKeys: ['routing.summarizationProvider'],
            },
            {
                key: 'summarization-model',
                label: 'Summarization model',
                description: 'Model used for memory consolidation and summaries.',
                kind: 'model-picker',
                group: 'summarization',
                groupLabel: 'Summarization',
                groupDescription: 'Memory consolidation and compact summaries.',
                modelRole: 'summarization',
                modelKind: 'chat',
                fieldRefs: [{ section: 'routing', field: 'summarizationModel' }],
                advancedKeys: ['routing.summarizationProvider', 'routing.summarizationModel'],
            },
            {
                key: 'summarization-fallbacks',
                label: 'Summarization fallbacks',
                description: 'Fallback provider/model entries for summary failures.',
                kind: 'model-picker',
                group: 'summarization',
                groupLabel: 'Summarization',
                groupDescription: 'Memory consolidation and compact summaries.',
                modelRole: 'summarization',
                modelKind: 'chat',
                fieldRefs: [{ section: 'routing', field: 'summarizationFallbacks' }],
                advancedKeys: ['routing.summarizationFallbacks'],
            },
            {
                key: 'embeddings-provider',
                label: 'Embeddings provider',
                description: 'Provider used for memory and document search embeddings.',
                kind: 'choice',
                group: 'embeddings',
                groupLabel: 'Embeddings',
                groupDescription: 'Memory and document search vectors. Changing these can require a rebuild.',
                fieldRefs: [
                    { section: 'routing', field: 'embeddingsProvider' },
                    { section: 'provider', field: 'kind' },
                ],
                impacts: ['requires-reindex'],
                advancedKeys: ['routing.embeddingsProvider', 'provider.kind'],
            },
            {
                key: 'embeddings-model',
                label: 'Embeddings model',
                description: 'Model used for memory and document search embeddings.',
                kind: 'model-picker',
                group: 'embeddings',
                groupLabel: 'Embeddings',
                groupDescription: 'Memory and document search vectors. Changing these can require a rebuild.',
                modelRole: 'embeddings',
                modelKind: 'embeddings',
                fieldRefs: [
                    { section: 'routing', field: 'embeddingsModel' },
                    { section: 'provider', field: 'embedModel' },
                ],
                impacts: ['requires-reindex'],
                advancedKeys: ['routing.embeddingsModel', 'routing.embeddingsDimensions', 'provider.embedModel'],
            },
            {
                key: 'embeddings-dimensions',
                label: 'Embedding dimensions',
                description: 'Vector size used by the embedding model, if the provider supports choosing it.',
                kind: 'text',
                group: 'embeddings',
                groupLabel: 'Embeddings',
                groupDescription: 'Memory and document search vectors. Changing these can require a rebuild.',
                fieldRefs: [
                    { section: 'routing', field: 'embeddingsDimensions' },
                    { section: 'provider', field: 'embedDimensions' },
                ],
                impacts: ['requires-reindex'],
                advancedKeys: ['routing.embeddingsDimensions', 'provider.embedDimensions'],
            },
        ],
    },
    {
        key: 'memory',
        label: 'Memory & Chat',
        description: 'Control how much OR3 remembers and how hard it searches.',
        icon: 'i-pixelarticons-card-stack',
        summaryTemplate: (v) => {
            const history = Number(get(v, 'context.historyMaxMessages', 40));
            const recall = Number(get(v, 'context.memoryRetrieveLimit', 8));
            return `Memory cleanup scans about ${history} recent messages and may recall up to ${recall} saved memories per reply.`;
        },
        controls: [
            {
                key: 'memory-history',
                label: 'Memory cleanup window',
                description: 'How many recent messages memory cleanup and recall can inspect.',
                kind: 'text',
                fieldRefs: [
                    { section: 'context', field: 'historyMaxMessages' },
                ],
                advancedKeys: ['context.historyMaxMessages'],
            },
            {
                key: 'memory-retrieve',
                label: 'Memories recalled per reply',
                description: 'How many saved memories OR3 may bring back.',
                kind: 'text',
                fieldRefs: [
                    { section: 'context', field: 'memoryRetrieveLimit' },
                ],
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
                advancedKeys: [
                    'memory.vectorSearchK',
                    'memory.ftsSearchK',
                    'memory.vectorScanLimit',
                ],
            },
            {
                key: 'memory-cleanup',
                label: 'Background memory cleanup',
                description:
                    'Quietly summarise old memories to keep things tidy.',
                kind: 'toggle',
                fieldRefs: [
                    { section: 'memory', field: 'consolidationEnabled' },
                ],
                advancedKeys: [
                    'memory.consolidationEnabled',
                    'memory.consolidationCharLimit',
                ],
                recommended: { value: true, label: 'On' },
                toggle: {
                    on: {
                        section: 'memory',
                        field: 'consolidationEnabled',
                        value: true,
                    },
                    off: {
                        section: 'memory',
                        field: 'consolidationEnabled',
                        value: false,
                    },
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
            const dir = String(
                get(v, 'workspace.workspaceDir', 'your workspace folder'),
            );
            const restrict = Boolean(get(v, 'tools.restrictToWorkspace', true));
            return restrict
                ? `OR3 can work inside ${dir} and cannot access files outside it.`
                : `OR3 can work inside ${dir} and may also access other allowed folders.`;
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
                description:
                    'Stop OR3 from reading files outside the workspace.',
                kind: 'toggle',
                fieldRefs: [{ section: 'tools', field: 'restrictToWorkspace' }],
                impacts: ['safer'],
                recommended: { value: true, label: 'On' },
                advancedKeys: ['tools.restrictToWorkspace'],
                toggle: {
                    on: {
                        section: 'tools',
                        field: 'restrictToWorkspace',
                        value: true,
                    },
                    off: {
                        section: 'tools',
                        field: 'restrictToWorkspace',
                        value: false,
                    },
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
        ],
    },
    {
        key: 'connections',
        label: 'Connected Apps',
        description: 'Manage messaging apps and paired devices.',
        icon: 'i-pixelarticons-message-text',
        summaryTemplate: (v) => {
            const enabled: string[] = [];
            for (const ch of [
                'telegram',
                'slack',
                'discord',
                'whatsapp',
                'email',
            ]) {
                if (get(v, `channels.${ch}.enabled`, false)) enabled.push(ch);
            }
            return enabled.length
                ? `Connected apps: ${enabled.join(', ')}.`
                : 'No messaging apps are connected.';
        },
        controls: [
            {
                key: 'channel-telegram',
                label: 'Telegram',
                description: 'Talk to OR3 from a Telegram chat.',
                kind: 'connection-card',
                fieldRefs: [
                    {
                        section: 'channels',
                        field: 'enabled',
                        channel: 'telegram',
                    },
                ],
                connection: { channelKey: 'telegram' },
                advancedKeys: [
                    'channels.telegram.botToken',
                    'channels.telegram.allowedChats',
                ],
            },
            {
                key: 'channel-slack',
                label: 'Slack',
                description: 'Talk to OR3 in a Slack workspace.',
                kind: 'connection-card',
                fieldRefs: [
                    { section: 'channels', field: 'enabled', channel: 'slack' },
                ],
                connection: { channelKey: 'slack' },
                advancedKeys: [
                    'channels.slack.botToken',
                    'channels.slack.appToken',
                    'channels.slack.signingSecret',
                ],
            },
            {
                key: 'channel-discord',
                label: 'Discord',
                description: 'Talk to OR3 in a Discord server.',
                kind: 'connection-card',
                fieldRefs: [
                    {
                        section: 'channels',
                        field: 'enabled',
                        channel: 'discord',
                    },
                ],
                connection: { channelKey: 'discord' },
                advancedKeys: ['channels.discord.botToken'],
            },
            {
                key: 'channel-whatsapp',
                label: 'WhatsApp',
                description: 'Talk to OR3 from WhatsApp.',
                kind: 'connection-card',
                fieldRefs: [
                    {
                        section: 'channels',
                        field: 'enabled',
                        channel: 'whatsapp',
                    },
                ],
                connection: { channelKey: 'whatsapp' },
                advancedKeys: ['channels.whatsapp.token'],
            },
            {
                key: 'channel-email',
                label: 'Email',
                description: 'Get OR3 replies in your inbox.',
                kind: 'connection-card',
                fieldRefs: [
                    { section: 'channels', field: 'enabled', channel: 'email' },
                ],
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
            const cron = Boolean(get(v, 'cron.enabled', false));
            return cron
                ? 'Scheduled tasks and runner jobs are available.'
                : 'Runner jobs are available; schedules are off.';
        },
        controls: [
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
                advancedKeys: [
                    'heartbeat.enabled',
                    'heartbeat.intervalSeconds',
                ],
                toggle: {
                    on: { section: 'heartbeat', field: 'enabled', value: true },
                    off: {
                        section: 'heartbeat',
                        field: 'enabled',
                        value: false,
                    },
                },
            },
            {
                key: 'auto-filewatch',
                label: 'Watch files for changes',
                description: 'Trigger work when watched files change.',
                kind: 'toggle',
                fieldRefs: [
                    { section: 'triggers', field: 'fileWatch.enabled' },
                ],
                advancedKeys: [
                    'triggers.fileWatch.enabled',
                    'triggers.fileWatch.debounceMs',
                    'triggers.fileWatch.pollIntervalMs',
                ],
                toggle: {
                    on: {
                        section: 'triggers',
                        field: 'fileWatch.enabled',
                        value: true,
                    },
                    off: {
                        section: 'triggers',
                        field: 'fileWatch.enabled',
                        value: false,
                    },
                },
            },
            {
                key: 'auto-webhooks',
                label: 'Receive webhooks',
                description: 'Allow other tools to ping OR3.',
                kind: 'toggle',
                fieldRefs: [{ section: 'triggers', field: 'webhook.enabled' }],
                impacts: ['higher-risk'],
                advancedKeys: [
                    'triggers.webhook.enabled',
                    'triggers.webhook.bind',
                    'triggers.webhook.secret',
                ],
                toggle: {
                    on: {
                        section: 'triggers',
                        field: 'webhook.enabled',
                        value: true,
                    },
                    off: {
                        section: 'triggers',
                        field: 'webhook.enabled',
                        value: false,
                    },
                },
            },
        ],
    },
    {
        key: 'safety',
        label: 'Safety & Privacy',
        description: 'Logging and secret storage for your OR3 service.',
        icon: 'i-pixelarticons-shield',
        summaryTemplate: (v) => {
            const audit = Boolean(get(v, 'security.audit.enabled', true));
            const secrets = Boolean(
                get(v, 'security.secretStore.enabled', true),
            );
            const parts = [
                audit ? 'safety log on' : 'safety log off',
                secrets ? 'secrets encrypted' : 'secrets not encrypted',
            ];
            return `${parts.join(', ')}. Runners manage their own permissions.`;
        },
        controls: [
            {
                key: 'safety-audit',
                label: 'Keep safety log',
                description: 'Record approvals, runs, and key events.',
                kind: 'toggle',
                fieldRefs: [{ section: 'security', field: 'audit.enabled' }],
                impacts: ['safer'],
                recommended: { value: true, label: 'On' },
                advancedKeys: [
                    'security.audit.enabled',
                    'security.audit.keyFile',
                ],
                toggle: {
                    on: {
                        section: 'security',
                        field: 'audit.enabled',
                        value: true,
                    },
                    off: {
                        section: 'security',
                        field: 'audit.enabled',
                        value: false,
                    },
                },
            },
            {
                key: 'safety-secrets',
                label: 'Protect saved secrets',
                description: 'Encrypt secret values at rest.',
                kind: 'toggle',
                fieldRefs: [
                    { section: 'security', field: 'secretStore.enabled' },
                ],
                impacts: ['safer'],
                recommended: { value: true, label: 'On' },
                advancedKeys: [
                    'security.secretStore.enabled',
                    'security.secretStore.keyFile',
                ],
                toggle: {
                    on: {
                        section: 'security',
                        field: 'secretStore.enabled',
                        value: true,
                    },
                    off: {
                        section: 'security',
                        field: 'secretStore.enabled',
                        value: false,
                    },
                },
            },
        ],
    },
];
