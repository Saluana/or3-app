import { describe, expect, it } from 'vitest'

import {
  approvalKindDescription,
  approvalKindLabel,
  approvalRiskPresentation,
  approvalStatusLabel,
  approvalStatusTone,
  formatApprovalInlineCopy,
  formatApprovalSubjectPreview,
  resolveApprovalRiskLevel,
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
      type: 'skill_execution',
      subject: {
        skill_id: 'gws-tasks',
        command_name: 'create-task',
      },
    })).toBe('gws-tasks: create-task')
  })

  it('shows tool quota approvals clearly', () => {
    expect(formatApprovalSubjectPreview({
      type: 'tool_quota',
      subject: {
        scope: 'message',
        limit_name: 'max_tool_calls',
        current: 17,
        limit: 16,
      },
    })).toBe('message max_tool_calls (17/16)')
  })

  it('shows runner permission identity clearly', () => {
    expect(formatApprovalSubjectPreview({
      type: 'runner_permission',
      subject: {
        runner_id: 'opencode',
        access: 'write',
        target_path: '/Users/brendon/project',
      },
    })).toBe('opencode write /Users/brendon/project')
  })

  it('formats inline approval copy for tool quota', () => {
    expect(formatApprovalInlineCopy({
      type: 'tool_quota',
      subject: {
        scope: 'message',
        limit_name: 'max_tool_calls',
        current: 17,
        limit: 16,
      },
    })).toEqual({
      type: 'tool_quota',
      title: 'Tool call limit reached',
      description: 'This turn used more tool calls than the current limit allows. Approve to let or3-intern continue with more tool calls.',
      icon: 'i-pixelarticons-alert',
      preview: 'message max_tool_calls (17/16)',
    })
  })

  it('labels approval kinds for chat cards', () => {
    expect(approvalKindLabel('tool_quota')).toBe('Tool call limit reached')
    expect(approvalKindDescription('exec')).toContain('shell command')
  })

  it('labels terminal approval states explicitly', () => {
    expect(approvalStatusLabel('expired')).toBe('Expired')
    expect(approvalStatusTone('expired')).toBe('danger')
    expect(approvalStatusLabel('failed')).toBe('Failed')
    expect(approvalStatusTone('completed')).toBe('green')
  })

  it('maps extreme moderator risk to an extreme risk pill', () => {
    expect(resolveApprovalRiskLevel({ explicitRisk: 'extreme' })).toBe('extreme')
    expect(approvalRiskPresentation('extreme')).toEqual({
      label: 'Extreme risk',
      tone: 'danger',
      icon: 'i-pixelarticons-shield-off',
    })
  })
})
