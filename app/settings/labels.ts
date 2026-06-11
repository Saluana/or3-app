/**
 * Field mappings: friendly labels for raw or3-intern config keys.
 *
 * Used by SettingAdvancedDetails and PermissionsReceipt to translate raw
 * field paths (e.g. `provider.temperature`) into plain-language labels
 * (e.g. "Creativity").
 */

export const FIELD_LABEL_MAP: Record<string, string> = {
    // AI Model
    'provider.kind': 'AI provider',
    'provider.apiKey': 'API key',
    'provider.apiBase': 'API base URL',
    'provider.model': 'Chat model',
    'provider.embedModel': 'Embedding model',
    'provider.embedDimensions': 'Embedding dimensions',
    'provider.temperature': 'Creativity',
    'provider.timeoutSeconds': 'Wait time for AI',
    'provider.enableVision': 'Image understanding',

    // Memory & Chat
    'context.historyMaxMessages': 'Memory cleanup window',
    'context.memoryRetrieveLimit': 'Memories recalled per reply',
    'context.maxInputTokens': 'Legacy conversation detail',
    'context.outputReserveTokens': 'Reply space reserve',
    'context.safetyMarginTokens': 'Safety margin',
    'memory.vectorSearchK': 'Vector search depth',
    'memory.ftsSearchK': 'Keyword search depth',
    'memory.vectorScanLimit': 'Vector scan limit',
    'memory.consolidationEnabled': 'Background memory cleanup',
    'memory.consolidationCharLimit': 'Memory consolidation size',
    'context.taskCard.enforcePlan': 'Require plan before writes',
    'context.taskCard.enabled': 'Task card',

    // Files & Workspace
    'workspace.workspaceDir': 'Workspace folder',
    'workspace.allowedDir': 'Extra allowed folder',
    'tools.restrictToWorkspace': 'Keep OR3 inside this folder',

    // Devices & Connections
    'channels.telegram.enabled': 'Telegram',
    'channels.slack.enabled': 'Slack',
    'channels.discord.enabled': 'Discord',
    'channels.whatsapp.enabled': 'WhatsApp',
    'channels.email.enabled': 'Email',
    'channels.inboundPolicy': 'Who can message OR3',

    // Automations & Skills
    'heartbeat.enabled': 'Check in automatically',
    'heartbeat.intervalSeconds': 'Check-in frequency',
    'cron.enabled': 'Scheduled tasks',
    'cron.storePath': 'Schedule store path',
    'triggers.fileWatch.enabled': 'Watch files for changes',
    'triggers.webhook.enabled': 'Receive webhooks',
    'skills.enabled': 'Skills',
    'skills.registries': 'Skill registries',

    // Safety & Privacy
    'security.audit.enabled': 'Keep safety log',
    'security.secretStore.enabled': 'Protect saved secrets',
}

export function labelForFieldRef(section: string, field: string): string {
    const path = `${section}.${field}`
    return FIELD_LABEL_MAP[path] ?? FIELD_LABEL_MAP[field] ?? field
}
