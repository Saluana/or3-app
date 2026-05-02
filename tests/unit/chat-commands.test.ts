import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ref } from 'vue'

const appendSystemMessage = vi.fn()
const clearSessionMessages = vi.fn(() => 3)
const ensureSession = vi.fn(() => ({
  id: 'session-1',
  title: 'New conversation',
  sessionKey: 'or3-app:host-1:abc123',
  createdAt: '2025-01-01T00:00:00.000Z',
}))
const newSession = vi.fn(() => ({ id: 'session-2' }))
const refreshStatus = vi.fn(async () => undefined)

const messages = ref([
  { role: 'user', content: 'Hello there' },
  { role: 'assistant', content: 'Hi, how can I help?' },
])
const draft = ref('')
const health = ref<{ status: string } | null>({ status: 'ok' })
const readiness = ref<{ status: string } | null>({ status: 'needs_attention' })
const capabilities = ref({
  execAvailable: true,
  shellModeAvailable: false,
  sandboxAvailable: true,
})

vi.mock('../../app/composables/useActiveHost', () => ({
  useActiveHost: () => ({
    activeHost: ref({ id: 'host-1', name: 'Dev Host' }),
  }),
}))

vi.mock('../../app/composables/useChatSessions', () => ({
  useChatSessions: () => ({
    ensureSession,
    appendSystemMessage,
    clearSessionMessages,
    newSession,
    messageCount: () => 2,
    messages,
    draft,
  }),
}))

vi.mock('../../app/composables/useComputerStatus', () => ({
  useComputerStatus: () => ({
    refreshStatus,
    health,
    readiness,
    capabilities,
  }),
}))

import { useChatCommands } from '../../app/composables/useChatCommands'

describe('useChatCommands', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    draft.value = ''
    health.value = { status: 'ok' }
    readiness.value = { status: 'needs_attention' }
    capabilities.value = {
      execAvailable: true,
      shellModeAvailable: false,
      sandboxAvailable: true,
    }
  })

  it('filters commands by name, alias, and description', () => {
    const { filterCommands } = useChatCommands()

    expect(filterCommands('stat').map((item) => item.name)).toContain('status')
    expect(filterCommands('commands').map((item) => item.name)).toContain('help')
    expect(filterCommands('fresh local chat').map((item) => item.name)).toContain('new')
  })

  it('runs the status command and appends a concise summary', async () => {
    const { findCommand, runCommand } = useChatCommands()
    const command = findCommand('status')

    expect(command).toBeTruthy()
    await runCommand(command!)

    expect(refreshStatus).toHaveBeenCalledTimes(1)
    expect(appendSystemMessage).toHaveBeenCalledWith(
      expect.stringContaining('Health: ok'),
      'session-1',
    )
    expect(appendSystemMessage).toHaveBeenCalledWith(
      expect.stringContaining('Readiness: needs_attention'),
      'session-1',
    )
  })

  it('supports command aliases and local session resets', async () => {
    const { findCommand, runCommand } = useChatCommands()
    const command = findCommand('commands')

    expect(command?.id).toBe('help')
    await runCommand(findCommand('new')!)

    expect(newSession).toHaveBeenCalledTimes(1)
    expect(draft.value).toBe('')
  })
})
