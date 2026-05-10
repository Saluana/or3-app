import { computed } from 'vue'
import { useActiveHost } from './useActiveHost'
import { useChatSessions } from './useChatSessions'
import { useComputerStatus } from './useComputerStatus'
import { useJobs } from './useJobs'

export interface ChatCommandDefinition {
  id: string
  name: string
  aliases?: string[]
  description: string
  icon: string
  destructive?: boolean
}

function recentConversationSummary(entries: Array<{ role: string; content: string }>) {
  return entries
    .filter((entry) => entry.content.trim())
    .slice(-8)
    .map((entry) => `${entry.role}: ${entry.content.trim().replace(/\s+/g, ' ').slice(0, 180)}`)
    .join('\n')
}

function titleCase(value: string) {
  return value
    .split(/[-_\s]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ')
}

function formatBooleanAvailability(value: boolean | undefined, positive: string, negative = 'No') {
  return value ? positive : negative
}

function formatHelpMarkdown(commands: ChatCommandDefinition[]) {
  const lines = ['## Available local commands', '']

  for (const command of commands) {
    const aliases = command.aliases?.length
      ? ` · aliases: ${command.aliases.map((alias) => `\`/${alias}\``).join(', ')}`
      : ''
    lines.push(`- **\`/${command.name}\`**${aliases}`)
    lines.push(`  - ${command.description}`)
  }

  return lines.join('\n')
}

function formatSessionMarkdown(input: {
  title: string
  hostName: string
  sessionKey: string
  messageCount: number
  activeJobState: string
  createdAt: string
}) {
  return [
    '## Session details',
    '',
    `- **Session:** ${input.title}`,
    `- **Host:** ${input.hostName}`,
    `- **Session key:** \`${input.sessionKey}\``,
    `- **Messages:** ${input.messageCount}`,
    `- **Active job:** ${input.activeJobState}`,
    `- **Created:** ${input.createdAt}`,
  ].join('\n')
}

function formatStatusMarkdown(input: {
  health: string
  readiness: string
  execAvailable?: boolean
  shellModeAvailable?: boolean
  sandboxAvailable?: boolean
}) {
  return [
    '## Local status',
    '',
    `- **Health:** ${titleCase(input.health || 'unknown')}`,
    `- **Readiness:** ${titleCase(input.readiness || 'unknown')}`,
    '',
    '### Capabilities',
    '',
    `- **Exec available:** ${formatBooleanAvailability(input.execAvailable, 'Yes', 'No')}`,
    `- **Shell mode:** ${formatBooleanAvailability(input.shellModeAvailable, 'Yes', 'No')}`,
    `- **Sandbox:** ${formatBooleanAvailability(input.sandboxAvailable, 'Yes', 'No')}`,
  ].join('\n')
}

export function useChatCommands() {
  const { activeHost } = useActiveHost()
  const chat = useChatSessions()
  const status = useComputerStatus()
  const jobs = useJobs()

  const commands = computed<ChatCommandDefinition[]>(() => [
    { id: 'help', name: 'help', aliases: ['commands'], description: 'Show the available local chat commands.', icon: 'i-pixelarticons-info-box' },
    { id: 'clear', name: 'clear', aliases: ['cls'], description: 'Clear only the visible local messages in this chat.', icon: 'i-pixelarticons-trash', destructive: true },
    { id: 'new', name: 'new', aliases: ['fresh'], description: 'Start a fresh local chat session on this host.', icon: 'i-pixelarticons-plus' },
    { id: 'session', name: 'session', description: 'Show session details for the current local chat.', icon: 'i-pixelarticons-notebook' },
    { id: 'status', name: 'status', description: 'Fetch a concise health, readiness, and capability summary.', icon: 'i-pixelarticons-monitor' },
    { id: 'compact', name: 'compact', description: 'Append a compact summary of the recent conversation.', icon: 'i-pixelarticons-collapse' },
    { id: 'prune', name: 'prune', description: 'Create a compact working summary without deleting history.', icon: 'i-pixelarticons-cut' },
  ])

  function filterCommands(query: string) {
    const normalized = query.trim().toLowerCase()
    if (!normalized) return commands.value
    return commands.value.filter((command) => {
      const haystack = [command.name, command.description, ...(command.aliases ?? [])]
      return haystack.some((value) => value.toLowerCase().includes(normalized))
    })
  }

  function findCommand(idOrAlias: string) {
    const normalized = idOrAlias.trim().toLowerCase()
    return commands.value.find((command) => {
      return command.name === normalized || command.id === normalized || (command.aliases ?? []).includes(normalized)
    })
  }

  async function runCommand(command: ChatCommandDefinition) {
    const session = chat.ensureSession()
    switch (command.id) {
      case 'help': {
        chat.appendSystemMessage(formatHelpMarkdown(commands.value), session.id)
        return { handled: true }
      }
      case 'clear': {
        const count = chat.messageCount(session.id)
        if (count > 0 && typeof window !== 'undefined' && !window.confirm('Clear the visible local chat messages from this session?')) {
          return { handled: true, cancelled: true }
        }
        const removed = chat.clearSessionMessages(session.id)
        chat.appendSystemMessage(`Cleared ${removed} visible message${removed === 1 ? '' : 's'} from this session.`, session.id)
        return { handled: true }
      }
      case 'new': {
        chat.newSession('New conversation')
        chat.draft.value = ''
        return { handled: true }
      }
      case 'session': {
        const hostName = activeHost.value?.name || 'Current host'
        const activeJob = jobs.activeJobs.value[0]
        const activeJobState = activeJob
          ? `${activeJob.status}: ${activeJob.title || activeJob.task || activeJob.job_id}`
          : 'none'
        chat.appendSystemMessage(
          formatSessionMarkdown({
            title: session.title,
            hostName,
            sessionKey: session.sessionKey,
            messageCount: chat.messageCount(session.id),
            activeJobState,
            createdAt: new Date(session.createdAt).toLocaleString(),
          }),
          session.id,
        )
        return { handled: true }
      }
      case 'status': {
        await status.refreshStatus()
        const health = status.health.value?.status || 'unknown'
        const ready = status.readiness.value?.status || 'unknown'
        const capabilities = status.capabilities.value
        chat.appendSystemMessage(
          formatStatusMarkdown({
            health,
            readiness: ready,
            execAvailable: capabilities?.execAvailable,
            shellModeAvailable: capabilities?.shellModeAvailable,
            sandboxAvailable: capabilities?.sandboxAvailable,
          }),
          session.id,
        )
        return { handled: true }
      }
      case 'compact':
      case 'prune': {
        const summary = recentConversationSummary(
          chat.messages.value.map((message) => ({ role: message.role, content: message.content })),
        )
        chat.appendSystemMessage(
          summary
            ? `Compact working summary:\n${summary}`
            : 'There is not enough conversation yet to compact.',
          session.id,
        )
        return { handled: true }
      }
      default:
        return { handled: false }
    }
  }

  return {
    commands,
    filterCommands,
    findCommand,
    runCommand,
  }
}
