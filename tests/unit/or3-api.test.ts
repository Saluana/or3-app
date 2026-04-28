import { describe, expect, it, vi } from 'vitest'
import { useLocalCache } from '../../app/composables/useLocalCache'
import { useOr3Api } from '../../app/composables/useOr3Api'

describe('useOr3Api', () => {
	afterEach(() => {
		vi.unstubAllGlobals()
	})

  it('normalizes auth requests and maps JSON responses', async () => {
    const cache = useLocalCache()
    cache.clearAll()
    cache.updateHost({ id: 'test', name: 'Test Mac', baseUrl: 'http://127.0.0.1:9100/', token: 'secret' })

    const fetchMock = vi.fn(async (_url: string | URL | Request, init?: RequestInit) => {
      expect(String(_url)).toBe('http://127.0.0.1:9100/internal/v1/health')
      expect(init?.headers).toMatchObject({ Authorization: 'Bearer secret' })
      return new Response(JSON.stringify({ status: 'ok' }), { status: 200, headers: { 'Content-Type': 'application/json' } })
    })
    vi.stubGlobal('fetch', fetchMock)

    const api = useOr3Api()
    await expect(api.request('/internal/v1/health')).resolves.toEqual({ status: 'ok' })
  })

  it('prefers session tokens and includes the session header when available', async () => {
    const cache = useLocalCache()
    cache.clearAll()
    cache.updateHost({
      id: 'test',
      name: 'Test Mac',
      baseUrl: 'http://127.0.0.1:9100/',
      token: 'session-token',
      pairedToken: 'paired-token',
      sessionToken: 'session-token',
    })

    const fetchMock = vi.fn(async (_url: string | URL | Request, init?: RequestInit) => {
      expect(String(_url)).toBe('http://127.0.0.1:9100/internal/v1/auth/session')
      expect(init?.headers).toMatchObject({
        Authorization: 'Bearer session-token',
        'X-Or3-Session': 'session-token',
      })
      return new Response(JSON.stringify({ session: { id: 's1' }, user: { id: 'owner' }, role: 'operator' }), { status: 200, headers: { 'Content-Type': 'application/json' } })
    })
    vi.stubGlobal('fetch', fetchMock)

    const api = useOr3Api()
    await expect(api.request('/internal/v1/auth/session')).resolves.toMatchObject({ role: 'operator' })
  })

  it('retries once after an auth challenge handler resolves the challenge', async () => {
    const cache = useLocalCache()
    cache.clearAll()
    cache.updateHost({ id: 'test', name: 'Test Mac', baseUrl: 'http://127.0.0.1:9100/', token: 'paired-token', pairedToken: 'paired-token' })

    const fetchMock = vi.fn(async () => {
      if (fetchMock.mock.calls.length === 1) {
        return new Response(JSON.stringify({ code: 'SESSION_REQUIRED', message: 'session required', retry_after_seconds: 5 }), {
          status: 401,
          headers: { 'Content-Type': 'application/json' },
        })
      }
      return new Response(JSON.stringify({ status: 'ok' }), { status: 200, headers: { 'Content-Type': 'application/json' } })
    })
    vi.stubGlobal('fetch', fetchMock)

    const api = useOr3Api()
    const onAuthChallenge = vi.fn(async () => true)

    await expect(api.request('/internal/v1/health', { onAuthChallenge })).resolves.toEqual({ status: 'ok' })
    expect(onAuthChallenge).toHaveBeenCalledWith(expect.objectContaining({ code: 'SESSION_REQUIRED', retryAfterSeconds: 5 }))
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })
})
