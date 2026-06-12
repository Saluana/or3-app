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
      alpha: [{ job_id: 'job-alpha', kind: 'runner:codex', status: 'queued', title: 'cli task', updated_at: '2026-01-01T00:00:00.000Z' }],
      beta: [{ job_id: 'job-beta', kind: 'runner:codex', status: 'completed', title: 'cli task', updated_at: '2026-01-02T00:00:00.000Z' }],
    }
    cache.updateHost({ id: 'alpha', name: 'Alpha', baseUrl: 'http://alpha.test', token: 'alpha-token' })
    cache.updateHost({ id: 'beta', name: 'Beta', baseUrl: 'http://beta.test', token: 'beta-token' })

    const { jobs } = useJobs()

    cache.setActiveHost('alpha')
    expect(jobs.value.map((job) => job.job_id)).toEqual(['job-alpha'])

    cache.setActiveHost('beta')
    expect(jobs.value.map((job) => job.job_id)).toEqual(['job-beta'])
  })

  it('keeps polling after the stream endpoint fails', async () => {
    vi.useFakeTimers()
    const cache = useLocalCache()
    cache.updateHost({ id: 'alpha', name: 'Alpha', baseUrl: 'http://alpha.test', token: 'alpha-token' })
    cache.setActiveHost('alpha')
    cache.state.value.recentJobs.alpha = [
      {
        job_id: 'job-1',
        kind: 'runner:codex',
        status: 'running',
        title: 'cli task',
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
          kind: 'runner:codex',
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

  it('loads agent runners when the host advertises them', async () => {
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
    expect(ids).toContain('codex')
  })

  it('treats available runners with unknown auth checks as ready', async () => {
    const cache = useLocalCache()
    cache.updateHost({ id: 'alpha', name: 'Alpha', baseUrl: 'http://alpha.test', token: 'alpha-token' })
    cache.setActiveHost('alpha')
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({
      runners: [{ id: 'gemini', display_name: 'Gemini CLI', status: 'available', auth_status: 'unknown', supports: { modelFlag: true, maxTurns: false, structuredOutput: false, streamingJson: false, permissionsMode: true, safeSandboxFlag: false, dangerousBypassFlag: false, stdinPrompt: true } }],
    }), { status: 200, headers: { 'Content-Type': 'application/json' } })))

    const { agentRunners, loadAgentRunners } = useJobs()
    await loadAgentRunners()
    const gemini = agentRunners.value.find((runner) => runner.id === 'gemini')
    expect(gemini?.auth_status).toBe('ready')
  })

  it('marks runner endpoint unsupported on 404 without adding a legacy runner', async () => {
    const cache = useLocalCache()
    cache.updateHost({ id: 'alpha', name: 'Alpha', baseUrl: 'http://alpha.test', token: 'alpha-token' })
    cache.setActiveHost('alpha')
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({ error: 'not found' }), { status: 404, headers: { 'Content-Type': 'application/json' } })))

    const { agentRunners, loadAgentRunners, runnerListSupported } = useJobs()
    await loadAgentRunners()
    expect(runnerListSupported.value).toBe(false)
    expect(agentRunners.value.map((r) => r.id)).toEqual([])
  })

  it('submits external CLI jobs to the correct endpoint', async () => {
    const cache = useLocalCache()
    cache.updateHost({ id: 'alpha', name: 'Alpha', baseUrl: 'http://alpha.test', token: 'alpha-token' })
    cache.setActiveHost('alpha')
    const fetchSpy = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = input.toString()
      if (url.endsWith('/internal/v1/runner-runs') && init?.method !== 'GET') {
        return new Response(JSON.stringify({ job_id: 'cli-job-1', status: 'queued' }), { status: 202, headers: { 'Content-Type': 'application/json' } })
      }
      if (url.endsWith('/internal/v1/jobs/cli-job-1/stream')) {
        return new Response('event: started\ndata: {}\n\n', { status: 200, headers: { 'Content-Type': 'text/event-stream' } })
      }
      throw new Error(`unexpected fetch ${url}`)
    })
    vi.stubGlobal('fetch', fetchSpy)

    const { jobs, queueRunnerRunJob } = useJobs()
    await queueRunnerRunJob(
      { parent_session_key: 'sess', runner_id: 'codex', task: 'test' },

      { runner_id: 'codex', runner_label: 'Codex', task: 'test' },
    )

    expect(jobs.value.some((j) => j.job_id === 'cli-job-1')).toBe(true)
    const cliJob = jobs.value.find((j) => j.job_id === 'cli-job-1')
    expect(cliJob?.kind).toBe('runner:codex')
    expect(cliJob?.runner_id).toBe('codex')
    expect(cliJob?.runner_label).toBe('Codex')
  })

  it('retries CLI jobs through queueRunnerRunJob', async () => {
    const cache = useLocalCache()
    cache.updateHost({ id: 'alpha', name: 'Alpha', baseUrl: 'http://alpha.test', token: 'alpha-token' })
    cache.setActiveHost('alpha')
    cache.state.value.recentJobs.alpha = [{
      job_id: 'cli-retry',
      kind: 'runner:codex',
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
      if (url.endsWith('/internal/v1/runner-runs') && init?.method !== 'GET') {
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
