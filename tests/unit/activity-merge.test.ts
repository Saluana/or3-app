import { describe, expect, it } from 'vitest'

import { mergeActivityWithToolParts } from '../../app/utils/assistant-stream/activity-merge'

describe('mergeActivityWithToolParts', () => {
  it('adds tool parts missing from the activity log', () => {
    const merged = mergeActivityWithToolParts(
      [
        {
          id: 'activity:tool:call_a:call',
          type: 'tool_call',
          label: 'Tool call: read_file',
          status: 'complete',
          createdAt: '2026-05-24T12:00:00.000Z',
        },
      ],
      [
        {
          id: 'tool:call_a',
          type: 'tool',
          toolCallId: 'call_a',
          name: 'read_file',
          status: 'complete',
        },
        {
          id: 'tool:call_b',
          type: 'tool',
          toolCallId: 'call_b',
          name: 'list_dir',
          status: 'complete',
        },
      ],
    )

    expect(merged).toHaveLength(2)
    expect(merged.map((item) => item.label)).toEqual([
      'Tool call: read_file',
      'Tool call: list_dir',
    ])
  })
})
