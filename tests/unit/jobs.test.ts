import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useJobs } from '../../app/composables/useJobs'
import { useLocalCache } from '../../app/composables/useLocalCache'

describe('useJobs', () => {
  beforeEach(() => {
    useLocalCache().clearAll()
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.unstubAllGlobals()
  })

  it('returns persisted jobs for the active host only', () => {
    const cache = useLocalCache()
    cache.state.value.recentJobs = {
      alpha: [{ job_id: 'job-alpha', kind: 'subagent', status: 'queued', title: 'subagent', updated_at: '2026-01-01T00:00:00.000Z' }],
      beta: [{ job_id: 'job-beta', kind: 'subagent', status: 'completed', title: 'subagent', updated_at: '2026-01-02T00:00:00.000Z' }],
    }
    cache.updateHost({ id: 'alpha', name: 'Alpha', baseUrl: 'http://alpha.test', token: 'alpha-token' })
    cache.updateHost({ id: 'beta', name: 'Beta', baseUrl: 'http://beta.test', token: 'beta-token' })

    const { jobs } = useJobs()

    cache.setActiveHost('alpha')
    expect(jobs.value.map((job) => job.job_id)).toEqual(['job-alpha'])

    cache.setActiveHost('beta')
    expect(jobs.value.map((job) => job.job_id)).toEqual(['job-beta'])
  })

  it('queues jobs under the active host', async () => {
    const cache = useLocalCache()
    cache.updateHost({ id: 'alpha', name: 'Alpha', baseUrl: 'http://alpha.test', token: 'alpha-token' })
    cache.updateHost({ id: 'beta', name: 'Beta', baseUrl: 'http://beta.test', token: 'beta-token' })
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({
      job_id: 'job-beta-new',
      child_session_key: 'child',
      status: 'queued',
    }), { status: 202, headers: { 'Content-Type': 'application/json' } })))

    cache.setActiveHost('beta')
    const { jobs, queueJob } = useJobs()
    await queueJob({ parent_session_key: 'parent', task: 'do work' })

    expect(jobs.value.map((job) => job.job_id)).toEqual(['job-beta-new'])
    expect(cache.state.value.recentJobs.beta?.map((job) => job.job_id)).toEqual(['job-beta-new'])
    expect(cache.state.value.recentJobs.alpha).toBeUndefined()
  })

  it('keeps polling after the stream endpoint fails', async () => {
    vi.useFakeTimers()
    const cache = useLocalCache()
    cache.updateHost({ id: 'alpha', name: 'Alpha', baseUrl: 'http://alpha.test', token: 'alpha-token' })
    cache.setActiveHost('alpha')
    cache.state.value.recentJobs.alpha = [
      {
        job_id: 'job-1',
        kind: 'subagent',
        status: 'running',
        title: 'subagent',
        updated_at: '2026-01-01T00:00:00.000Z',
      },
    ]

    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = input.toString()
      if (url.endsWith('/internal/v1/jobs/job-1/stream')) {
        return new Response(JSON.stringify({ error: 'stream failed' }), {
          status: 500,
          headers: { 'Content-Type': 'application/json' },
        })
      }
      if (url.endsWith('/internal/v1/jobs/job-1')) {
        return new Response(JSON.stringify({
          job_id: 'job-1',
          kind: 'subagent',
          status: 'completed',
          created_at: '2026-01-01T00:00:00.000Z',
          updated_at: '2026-01-01T00:00:06.000Z',
          final_text: 'done',
        }), { status: 200, headers: { 'Content-Type': 'application/json' } })
      }
      throw new Error(`unexpected fetch ${url}`)
    })
    vi.stubGlobal('fetch', fetchMock)

    const { jobs, subscribeJob } = useJobs()
    await subscribeJob('job-1')
    await vi.advanceTimersByTimeAsync(6_000)

    expect(fetchMock).toHaveBeenCalledTimes(2)
    expect(jobs.value[0]?.status).toBe('completed')
    expect(jobs.value[0]?.final_text).toBe('done')
  })

  it('loads agent runners and synthesizes or3-intern when omitted', async () => {
    const cache = useLocalCache()
    cache.updateHost({ id: 'alpha', name: 'Alpha', baseUrl: 'http://alpha.test', token: 'alpha-token' })
    cache.setActiveHost('alpha')
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({
      runners: [{ id: 'codex', display_name: 'Codex', status: 'available', auth_status: 'ready', supports: { modelFlag: true, maxTurns: false, structuredOutput: false, streamingJson: false, permissionsMode: true, safeSandboxFlag: false, dangerousBypassFlag: false, stdinPrompt: false } }],
    }), { status: 200, headers: { 'Content-Type': 'application/json' } })))

    const { agentRunners, loadAgentRunners, runnerListSupported } = useJobs()
    await loadAgentRunners()
    expect(runnerListSupported.value).toBe(true)
    const ids = agentRunners.value.map((r) => r.id)
    expect(ids).toContain('or3-intern')
    expect(ids).toContain('codex')
  })

  it('falls back to or3-intern only on runner endpoint 404', async () => {
    const cache = useLocalCache()
    cache.updateHost({ id: 'alpha', name: 'Alpha', baseUrl: 'http://alpha.test', token: 'alpha-token' })
    cache.setActiveHost('alpha')
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({ error: 'not found' }), { status: 404, headers: { 'Content-Type': 'application/json' } })))

    const { agentRunners, loadAgentRunners, runnerListSupported } = useJobs()
    await loadAgentRunners()
    expect(runnerListSupported.value).toBe(false)
    expect(agentRunners.value.map((r) => r.id)).toEqual(['or3-intern'])
  })

  it('submits external CLI jobs to the correct endpoint', async () => {
    const cache = useLocalCache()
    cache.updateHost({ id: 'alpha', name: 'Alpha', baseUrl: 'http://alpha.test', token: 'alpha-token' })
    cache.setActiveHost('alpha')
    const fetchSpy = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = input.toString()
      if (url.endsWith('/internal/v1/agent-runs') && init?.method !== 'GET') {
        return new Response(JSON.stringify({ job_id: 'cli-job-1', status: 'queued' }), { status: 202, headers: { 'Content-Type': 'application/json' } })
      }
      if (url.endsWith('/internal/v1/jobs/cli-job-1/stream')) {
        return new Response('event: started\ndata: {}\n\n', { status: 200, headers: { 'Content-Type': 'text/event-stream' } })
      }
      throw new Error(`unexpected fetch ${url}`)
    })
    vi.stubGlobal('fetch', fetchSpy)

    const { jobs, queueAgentCliJob } = useJobs()
    await queueAgentCliJob(
      { parent_session_key: 'sess', runner_id: 'codex', task: 'test' },

      { runner_id: 'codex', runner_label: 'Codex', task: 'test' },
    )

    expect(jobs.value.some((j) => j.job_id === 'cli-job-1')).toBe(true)
    const cliJob = jobs.value.find((j) => j.job_id === 'cli-job-1')
    expect(cliJob?.kind).toBe('agent_cli:codex')
    expect(cliJob?.runner_id).toBe('codex')
    expect(cliJob?.runner_label).toBe('Codex')
  })

  it('retries CLI jobs through queueAgentCliJob', async () => {
    const cache = useLocalCache()
    cache.updateHost({ id: 'alpha', name: 'Alpha', baseUrl: 'http://alpha.test', token: 'alpha-token' })
    cache.setActiveHost('alpha')
    cache.state.value.recentJobs.alpha = [{
      job_id: 'cli-retry',
      kind: 'agent_cli:codex',
      status: 'failed',
      title: 'Codex task',
      task: 'fix a bug',
      parent_session_key: 'sess',
      runner_id: 'codex',
      runner_label: 'Codex',
      mode: 'safe_edit',
      isolation: 'host_workspace_write',
      model: 'gpt-5',
      updated_at: '2026-01-01T00:00:00.000Z',
    }]
    vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = input.toString()
      if (url.endsWith('/internal/v1/agent-runs') && init?.method !== 'GET') {
        return new Response(JSON.stringify({ job_id: 'cli-retry-2', status: 'queued' }), { status: 202, headers: { 'Content-Type': 'application/json' } })
      }
      if (url.endsWith('/internal/v1/jobs/cli-retry-2/stream')) {
        return new Response('event: started\ndata: {}\n\n', { status: 200, headers: { 'Content-Type': 'text/event-stream' } })
      }
      throw new Error(`unexpected fetch ${url}`)
    }))

    const { retryJob, jobs } = useJobs()
    const result = await retryJob('cli-retry')
    expect(result).toBeTruthy()
    expect(jobs.value.some((j) => j.job_id === 'cli-retry-2')).toBe(true)
  })
})
