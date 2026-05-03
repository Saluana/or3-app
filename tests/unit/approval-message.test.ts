import { describe, expect, it } from 'vitest'

import { describeApprovalRequest } from '../../app/composables/useAssistantStream'

describe('describeApprovalRequest', () => {
  it('describes exec requests in plain language', () => {
    const message = describeApprovalRequest(
      'exec',
      JSON.stringify({
        program: 'gws',
        args: ['drive', 'files', 'list', '--help'],
        cwd: '/Users/brendon/.intern',
      }),
    )

    expect(message).toContain('**Tool:** `exec`')
    expect(message).toContain('Run the local command `gws drive files list --help`')
    expect(message).toContain('**Working directory:** `/Users/brendon/.intern`')
    expect(message).toContain('Approve if this is the command you expected.')
  })

  it('includes args when exec uses command plus args', () => {
    const message = describeApprovalRequest(
      'exec',
      JSON.stringify({
        command: 'gws',
        args: ['tasks', '--help'],
      }),
    )

    expect(message).toContain('Run the local command `gws tasks --help`')
  })

  it('falls back to a generic explanation for unknown tools', () => {
    const message = describeApprovalRequest(
      'send_message',
      JSON.stringify({ path: 'alerts/general' }),
    )

    expect(message).toContain('**Tool:** `send_message`')
    expect(message).toContain('Approve if this matches what you asked for.')
  })
})
