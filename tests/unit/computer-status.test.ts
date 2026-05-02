import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useComputerStatus } from '../../app/composables/useComputerStatus'
import { useLocalCache } from '../../app/composables/useLocalCache'

describe('useComputerStatus', () => {
  beforeEach(() => {
    const cache = useLocalCache()
    cache.clearAll()
    cache.updateHost({ id: 'alpha', name: 'Alpha', baseUrl: 'http://alpha.test', token: 'alpha-token' })
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('prefers the bootstrap endpoint when the host supports it', async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = input.toString()
      if (url.endsWith('/internal/v1/app/bootstrap')) {
        return new Response(JSON.stringify({
          status: {
            health: { status: 'healthy', runtimeAvailable: true },
            readiness: { status: 'ok', ready: true },
            capabilities: { runtimeProfile: 'local-dev', shellModeAvailable: true },
          },
          actions: [{ id: 'restart-service', title: 'Restart service', available: true }],
        }), { status: 200, headers: { 'Content-Type': 'application/json' } })
      }
      throw new Error(`unexpected fetch ${url}`)
    })
    vi.stubGlobal('fetch', fetchMock)

    const status = useComputerStatus()
    await status.refreshStatus()

    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(status.health.value?.status).toBe('healthy')
    expect(status.capabilities.value?.runtimeProfile).toBe('local-dev')
    expect(status.restartAction.value?.available).toBe(true)
  })

  it('falls back to health, readiness, and capabilities when bootstrap is unavailable', async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = input.toString()
      if (url.endsWith('/internal/v1/app/bootstrap')) {
        return new Response(JSON.stringify({ error: 'not found' }), {
          status: 404,
          headers: { 'Content-Type': 'application/json' },
        })
      }
      if (url.endsWith('/internal/v1/health')) {
        return new Response(JSON.stringify({ status: 'ok', runtimeAvailable: true }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        })
      }
      if (url.endsWith('/internal/v1/readiness')) {
        return new Response(JSON.stringify({ status: 'ok', ready: true }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        })
      }
      if (url.endsWith('/internal/v1/capabilities')) {
        return new Response(JSON.stringify({ runtimeProfile: 'fallback', shellModeAvailable: false }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        })
      }
      throw new Error(`unexpected fetch ${url}`)
    })
    vi.stubGlobal('fetch', fetchMock)

    const status = useComputerStatus()
    await status.refreshStatus()

    expect(fetchMock).toHaveBeenCalledTimes(4)
    expect(status.bootstrap.value).toBeNull()
    expect(status.health.value?.status).toBe('ok')
    expect(status.capabilities.value?.runtimeProfile).toBe('fallback')
    expect(status.restartAction.value).toBeNull()
  })
})
