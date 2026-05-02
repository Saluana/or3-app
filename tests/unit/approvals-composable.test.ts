import { afterEach, describe, expect, it, vi } from 'vitest'

import { useApprovals } from '../../app/composables/useApprovals'
import { useLocalCache } from '../../app/composables/useLocalCache'

describe('useApprovals', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
    useLocalCache().clearAll()
  })

  it('blocks duplicate approval actions while one is in flight', async () => {
    useLocalCache().updateHost({
      id: 'test',
      name: 'Test Mac',
      baseUrl: 'http://127.0.0.1:9100/',
      token: 'secret',
    })

    let releaseApprove: (() => void) | undefined
    const approveStarted = new Promise<void>((resolve) => {
      releaseApprove = resolve
    })
    let approveRequests = 0
    const fetchMock = vi.fn(async (url: string | URL | Request) => {
      const path = String(url)
      if (path.endsWith('/internal/v1/approvals/42/approve')) {
        approveRequests += 1
        await approveStarted
        return new Response(JSON.stringify({ request_id: 42, token: 'tok' }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        })
      }
      if (path.includes('/internal/v1/approvals/allowlists')) {
        return new Response(JSON.stringify({ items: [] }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        })
      }
      if (path.includes('/internal/v1/approvals')) {
        return new Response(JSON.stringify({ items: [] }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        })
      }
      throw new Error(`unexpected request: ${path}`)
    })
    vi.stubGlobal('fetch', fetchMock)

    const { approve } = useApprovals()
    const first = approve(42)
    await expect(approve(42)).rejects.toThrow('already in progress')
    releaseApprove?.()
    await expect(first).resolves.toMatchObject({ request_id: 42 })
    expect(approveRequests).toBe(1)
  })
})
