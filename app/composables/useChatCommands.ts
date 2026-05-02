import { computed } from 'vue'
import { useActiveHost } from './useActiveHost'
import { useChatSessions } from './useChatSessions'
import { useComputerStatus } from './useComputerStatus'

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

export function useChatCommands() {
  const { activeHost } = useActiveHost()
  const chat = useChatSessions()
  const status = useComputerStatus()

  const commands = computed<ChatCommandDefinition[]>(() => [
    { id: 'help', name: 'help', aliases: ['commands'], description: 'Show the available local chat commands.', icon: 'i-pixelarticons-info-box' },
    { id: 'clear', name: 'clear', aliases: ['cls'], description: 'Clear only the visible local messages in this chat.', icon: 'i-pixelarticons-trash', destructive: true },
    { id: 'new', name: 'new', aliases: ['session'], description: 'Start a fresh local chat session on this host.', icon: 'i-pixelarticons-plus' },
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
        const helpText = commands.value
          .map((item) => `/${item.name}${item.aliases?.length ? ` (${item.aliases.map((alias) => `/${alias}`).join(', ')})` : ''} — ${item.description}`)
          .join('\n')
        chat.appendSystemMessage(`Available local commands:\n${helpText}`, session.id)
        return { handled: true }
      }
      case 'clear': {
        if (import.meta.client && !window.confirm('Clear the visible local chat messages from this session?')) {
          return { handled: false, cancelled: true }
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
        chat.appendSystemMessage(
          [
            `Session: ${session.title}`,
            `Host: ${hostName}`,
            `Session key: ${session.sessionKey}`,
            `Messages: ${chat.messageCount(session.id)}`,
            `Created: ${new Date(session.createdAt).toLocaleString()}`,
          ].join('\n'),
          session.id,
        )
        return { handled: true }
      }
      case 'status': {
        await status.refreshStatus()
        const health = status.health.value?.status || 'unknown'
        const ready = status.readiness.value?.status || 'unknown'
        const capabilities = status.capabilities.value
        const parts = [
          `Health: ${health}`,
          `Readiness: ${ready}`,
          `Exec available: ${capabilities?.execAvailable === true ? 'yes' : 'no'}`,
          `Shell mode: ${capabilities?.shellModeAvailable === true ? 'yes' : 'no'}`,
          `Sandbox: ${capabilities?.sandboxAvailable === true ? 'yes' : 'no'}`,
        ]
        chat.appendSystemMessage(parts.join('\n'), session.id)
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