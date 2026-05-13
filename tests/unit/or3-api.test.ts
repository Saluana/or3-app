import { describe, expect, it, vi } from 'vitest'
import { useLocalCache } from '../../app/composables/useLocalCache'
import { useOr3Api } from '../../app/composables/useOr3Api'
import { extractErrorCode } from '../../app/utils/assistant-stream/errors'

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

  it('does not attach auth headers when stored tokens are bound to a different origin', async () => {
    const cache = useLocalCache()
    cache.clearAll()
    cache.updateHost({
      id: 'test',
      name: 'Test Mac',
      baseUrl: 'http://evil.example',
      pairedToken: 'paired-token',
      sessionToken: 'session-token',
      token: 'session-token',
      tokenOrigin: 'http://127.0.0.1:9100',
    })

    const fetchMock = vi.fn(async (_url: string | URL | Request, init?: RequestInit) => {
      expect(String(_url)).toBe('http://evil.example/internal/v1/health')
      expect(init?.headers).not.toMatchObject({
        Authorization: expect.any(String),
        'X-Or3-Session': expect.any(String),
      })
      return new Response(JSON.stringify({ status: 'ok' }), { status: 200, headers: { 'Content-Type': 'application/json' } })
    })
    vi.stubGlobal('fetch', fetchMock)

    const api = useOr3Api()
    await expect(api.request('/internal/v1/health', { requireAuth: false })).resolves.toEqual({ status: 'ok' })
  })

  it('keeps app request payloads snake_case', async () => {
    const cache = useLocalCache()
    cache.clearAll()
    cache.updateHost({ id: 'test', name: 'Test Mac', baseUrl: 'http://127.0.0.1:9100/', token: 'secret' })

    const fetchMock = vi.fn(async (_url: string | URL | Request, init?: RequestInit) => {
      expect(String(_url)).toBe('http://127.0.0.1:9100/internal/v1/subagents')
      expect(JSON.parse(String(init?.body))).toEqual({
        parent_session_key: 'main',
        task: 'summarize',
        timeout_seconds: 30,
        tool_policy: { mode: 'allow', allowed_tools: ['files.read'] },
      })
      expect(String(init?.body)).not.toContain('parentSessionKey')
      expect(String(init?.body)).not.toContain('timeoutSeconds')
      expect(String(init?.body)).not.toContain('toolPolicy')
      return new Response(JSON.stringify({ job_id: 'job_1' }), { status: 200, headers: { 'Content-Type': 'application/json' } })
    })
    vi.stubGlobal('fetch', fetchMock)

    const api = useOr3Api()
    await expect(api.request('/internal/v1/subagents', {
      method: 'POST',
      body: {
        parent_session_key: 'main',
        task: 'summarize',
        timeout_seconds: 30,
        tool_policy: { mode: 'allow', allowed_tools: ['files.read'] },
      },
    })).resolves.toEqual({ job_id: 'job_1' })
  })

  it('passes structured service error codes through', async () => {
    const cache = useLocalCache()
    cache.clearAll()
    cache.updateHost({ id: 'test', name: 'Test Mac', baseUrl: 'http://127.0.0.1:9100/', token: 'secret' })

    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({
      error: 'token missing',
      code: 'missing_token',
      request_id: 'req_1',
    }), { status: 401, headers: { 'Content-Type': 'application/json' } })))

    const api = useOr3Api()
    await expect(api.request('/internal/v1/health')).rejects.toMatchObject({
      code: 'missing_token',
      request_id: 'req_1',
      status: 401,
    })
  })

  it('recognizes lower-case auth service error codes centrally', () => {
    for (const code of ['missing_token', 'invalid_token', 'token_replay', 'auth_rate_limited']) {
      expect(extractErrorCode({ code })).toBe(code)
    }
  })
})
