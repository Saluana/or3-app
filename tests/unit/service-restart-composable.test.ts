import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useLocalCache } from '../../app/composables/useLocalCache'

const retryWithAuthMock = vi.fn()
const loadRootsMock = vi.fn()

vi.mock('../../app/composables/useAuthSession', () => ({
  useAuthSession: () => ({
    retryWithAuth: retryWithAuthMock,
  }),
}))

vi.mock('../../app/composables/useComputerFiles', () => ({
  useComputerFiles: () => ({
    loadRoots: loadRootsMock,
  }),
}))

import { useServiceRestart } from '../../app/composables/useServiceRestart'

describe('useServiceRestart', () => {
  beforeEach(() => {
    retryWithAuthMock.mockReset()
    retryWithAuthMock.mockImplementation(async (operation: (handler: (challenge: unknown) => Promise<boolean>) => Promise<unknown>) => {
      return await operation(async () => true)
    })
    loadRootsMock.mockReset()

    const cache = useLocalCache()
    cache.clearAll()
    cache.updateHost({ id: 'alpha', name: 'Alpha', baseUrl: 'http://alpha.test', token: 'alpha-token' })
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('uses the restart action endpoint when the host supports it', async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = input.toString()
      if (url.endsWith('/internal/v1/actions/restart-service')) {
        return new Response(JSON.stringify({
          action_id: 'restart-service',
          status: 'accepted',
        }), {
          status: 202,
          headers: { 'Content-Type': 'application/json' },
        })
      }
      throw new Error(`unexpected fetch ${url}`)
    })
    vi.stubGlobal('fetch', fetchMock)

    const restart = useServiceRestart()
    await expect(restart.restartService()).resolves.toEqual({
      mode: 'action',
      actionId: 'restart-service',
    })
    expect(loadRootsMock).not.toHaveBeenCalled()
  })

  it('falls back to the terminal path when the action endpoint is unavailable', async () => {
    loadRootsMock.mockResolvedValue([
      { id: 'workspace', label: 'Workspace', path: '/Users/me/or3', writable: true },
    ])
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = input.toString()
      if (url.endsWith('/internal/v1/actions/restart-service')) {
        return new Response(JSON.stringify({ error: 'not found' }), {
          status: 404,
          headers: { 'Content-Type': 'application/json' },
        })
      }
      if (url.endsWith('/internal/v1/terminal/sessions')) {
        return new Response(JSON.stringify({
          session_id: 'term-1',
          root_id: 'workspace',
          path: '.',
          cwd: '/Users/me/or3',
          shell: 'sh',
          created_at: '2026-01-01T00:00:00.000Z',
          expires_at: '2026-01-01T00:10:00.000Z',
          last_active_at: '2026-01-01T00:00:00.000Z',
          status: 'running',
          rows: 12,
          cols: 80,
        }), {
          status: 201,
          headers: { 'Content-Type': 'application/json' },
        })
      }
      if (url.endsWith('/internal/v1/terminal/sessions/term-1/input')) {
        return new Response(JSON.stringify({ ok: true }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        })
      }
      throw new Error(`unexpected fetch ${url}`)
    })
    vi.stubGlobal('fetch', fetchMock)

    const restart = useServiceRestart()
    await expect(restart.restartService()).resolves.toMatchObject({
      mode: 'terminal',
      sessionId: 'term-1',
      root: { id: 'workspace' },
    })
    expect(loadRootsMock).toHaveBeenCalledTimes(1)
  })

  it('surfaces approval-required responses from the action endpoint', async () => {
    const fetchMock = vi.fn(async () => {
      return new Response(JSON.stringify({
        error: 'restart service requires approval',
        approval_id: 42,
      }), {
        status: 409,
        headers: { 'Content-Type': 'application/json' },
      })
    })
    vi.stubGlobal('fetch', fetchMock)

    const restart = useServiceRestart()
    await expect(restart.restartService()).rejects.toMatchObject({
      status: 409,
      approval_id: 42,
    })
    expect(restart.restartPendingApprovalId.value).toBe(42)
    expect(restart.restartError.value).toContain('#42')
    expect(loadRootsMock).not.toHaveBeenCalled()
  })
})
