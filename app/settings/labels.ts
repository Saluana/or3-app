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
    'context.historyMaxMessages': 'Recent conversation size',
    'context.memoryRetrieveLimit': 'Memories recalled per reply',
    'context.maxInputTokens': 'Conversation detail',
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
    'security.audit.enabled': 'Keep safety log',
    'security.secretStore.enabled': 'Protect saved secrets',
    'approvalModes.exec': 'Approval for terminal',
    'approvalModes.skill': 'Approval for skills',
    'security.approvals.moderator.enabled': 'Approval autopilot',
    'security.approvals.moderator.preset': 'Approval autopilot preset',
    'security.approvals.moderator.provider': 'Approval reviewer provider',
    'security.approvals.moderator.model': 'Approval reviewer model',
    'security.approvals.moderator.timeoutSeconds': 'Approval review timeout',
    'security.approvals.moderator.failureAction': 'Approval review failure action',
    'security.approvals.moderator.userPolicy': 'Custom approval rules',
    'security.approvals.moderator.actions.low': 'Low-risk approval action',
    'security.approvals.moderator.actions.medium': 'Medium-risk approval action',
    'security.approvals.moderator.actions.high': 'High-risk approval action',
    'security.approvals.moderator.actions.extreme': 'Extreme-risk approval action',

    // External Agent CLI Delegation
    'agentCLI.enabled': 'External CLI agents',
    'agentCLI.maxConcurrent': 'External agent power',
    'agentCLI.maxQueued': 'External queue size',
    'agentCLI.defaultTimeoutSeconds': 'External task timeout',
    'agentCLI.allowSandboxAuto': 'Full autonomy in sandbox',
    'agentCLI.disabledRunners': 'Disabled external runners',
}

export function labelForFieldRef(section: string, field: string): string {
    const path = `${section}.${field}`
    return FIELD_LABEL_MAP[path] ?? FIELD_LABEL_MAP[field] ?? field
}
