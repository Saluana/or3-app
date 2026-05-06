import { describe, expect, it } from 'vitest'
import type { CronJob } from '../../app/types/or3-api'

describe('cron payload types', () => {
  it('accepts scheduled external agent run payloads', () => {
    const job = {
      name: 'Codex review',
      enabled: true,
      schedule: { kind: 'cron', expr: '0 9 * * 1' },
      payload: {
        kind: 'agent_cli_run',
        session_key: 'cron:agents',
        agent_run: {
          runner_id: 'codex',
          task: 'review the repository',
          mode: 'review',
          isolation: 'host_readonly',
          timeout_seconds: 600,
          max_turns: 4,
        },
      },
    } satisfies Partial<CronJob>

    expect(job.payload.agent_run.runner_id).toBe('codex')
    expect(job.payload.agent_run.mode).toBe('review')
  })
})
