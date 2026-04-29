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
    'context.historyMaxMessages': 'Max messages per session',
    'context.memoryRetrieveLimit': 'Memories recalled per reply',
    'context.maxInputTokens': 'Conversation detail',
    'context.outputReserveTokens': 'Reply space reserve',
    'context.safetyMarginTokens': 'Safety margin',
    'memory.vectorSearchK': 'Vector search depth',
    'memory.ftsSearchK': 'Keyword search depth',
    'memory.vectorScanLimit': 'Vector scan limit',
    'memory.consolidationEnabled': 'Background memory cleanup',
    'memory.consolidationCharLimit': 'Memory consolidation size',

    // Files & Workspace
    'workspace.workspaceDir': 'Workspace folder',
    'workspace.allowedDir': 'Extra allowed folder',
    'tools.restrictToWorkspace': 'Keep OR3 inside this folder',
    'docindex.enabled': 'Search workspace files',
    'docindex.maxFiles': 'File search size (files)',
    'docindex.maxFileBytes': 'File search size (per file)',
    'docindex.maxChunks': 'File search chunks',
    'docindex.retrieveLimit': 'File results per query',
    'docindex.refreshSeconds': 'File index refresh',
    'docindex.embedMaxBytes': 'Embed max bytes',

    // Devices & Connections
    'channels.telegram.enabled': 'Telegram',
    'channels.slack.enabled': 'Slack',
    'channels.discord.enabled': 'Discord',
    'channels.whatsapp.enabled': 'WhatsApp',
    'channels.email.enabled': 'Email',
    'channels.inboundPolicy': 'Who can message OR3',

    // Automations & Skills
    'subagents.enabled': 'Background agents',
    'subagents.maxConcurrent': 'Background agent power',
    'subagents.maxQueued': 'Background queue size',
    'subagents.taskTimeoutSeconds': 'Background task timeout',
    'heartbeat.enabled': 'Check in automatically',
    'heartbeat.intervalSeconds': 'Check-in frequency',
    'cron.enabled': 'Scheduled tasks',
    'cron.storePath': 'Schedule store path',
    'triggers.fileWatch.enabled': 'Watch files for changes',
    'triggers.webhook.enabled': 'Receive webhooks',
    'skills.enabled': 'Skills',
    'skills.registries': 'Skill registries',

    // Safety & Privacy
    runtimeProfile: 'Safety mode',
    'hardening.enableExecShell': 'Allow terminal commands',
    'hardening.enableNetwork': 'Allow network access',
    'security.audit.enabled': 'Keep safety log',
    'security.secretStore.enabled': 'Protect saved secrets',
    'approvalModes.exec': 'Approval for terminal',
    'approvalModes.skill': 'Approval for skills',
}

export function labelForFieldRef(section: string, field: string): string {
    const path = `${section}.${field}`
    return FIELD_LABEL_MAP[path] ?? FIELD_LABEL_MAP[field] ?? field
}
