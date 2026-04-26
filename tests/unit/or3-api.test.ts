import { describe, expect, it, vi } from 'vitest'
import { useLocalCache } from '../../app/composables/useLocalCache'
import { useOr3Api } from '../../app/composables/useOr3Api'

describe('useOr3Api', () => {
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
})
