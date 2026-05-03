import { describe, expect, it } from 'vitest'

import {
  approvalStatusLabel,
  approvalStatusTone,
  formatApprovalSubjectPreview,
} from '../../app/utils/or3/approval-display'

describe('approval display helpers', () => {
  it('shows the full exec argv and cwd', () => {
    expect(formatApprovalSubjectPreview({
      type: 'exec',
      subject: {
        executable_path: '/Users/brendon/.bun/bin/gws',
        argv: ['gws', 'tasks', '--help'],
        working_dir: '/Users/brendon/.intern',
      },
    })).toBe('gws tasks --help  (cwd: /Users/brendon/.intern)')
  })

  it('shows mixed command plus args for legacy-shaped exec subjects', () => {
    expect(formatApprovalSubjectPreview({
      type: 'exec',
      subject: {
        command: 'gws',
        args: ['tasks', '--help'],
        cwd: '/Users/brendon/.intern',
      },
    })).toBe('gws tasks --help  (cwd: /Users/brendon/.intern)')
  })

  it('shows skill script identity clearly', () => {
    expect(formatApprovalSubjectPreview({
      type: 'skill_exec',
      subject: {
        skill_id: 'gws-tasks',
        command_name: 'create-task',
      },
    })).toBe('gws-tasks: create-task')
  })

  it('labels terminal approval states explicitly', () => {
    expect(approvalStatusLabel('expired')).toBe('Expired')
    expect(approvalStatusTone('expired')).toBe('danger')
    expect(approvalStatusLabel('failed')).toBe('Failed')
    expect(approvalStatusTone('completed')).toBe('green')
  })
})
