import { afterEach, describe, expect, it, vi } from 'vitest'
import { useConfigure } from '../../app/composables/useConfigure'
import { useLocalCache } from '../../app/composables/useLocalCache'

describe('settings configure mappings', () => {
  afterEach(() => {
    useLocalCache().clearAll()
    sessionStorage.clear()
    localStorage.clear()
    vi.unstubAllGlobals()
  })

  it('loads advanced configure sections and applies field changes through the existing configure API', async () => {
    useLocalCache().updateHost({ id: 'host-1', name: 'Host', baseUrl: 'http://127.0.0.1:9100', token: 'paired-token', pairedToken: 'paired-token' })
    const fetchMock = vi.fn(async (_url: string | URL | Request, init?: RequestInit) => {
      const url = String(_url)
      if (url.endsWith('/internal/v1/configure/sections')) {
        return new Response(JSON.stringify({ items: [{ key: 'security', label: 'Security' }, { key: 'service', label: 'Service' }] }), { status: 200, headers: { 'Content-Type': 'application/json' } })
      }
      if (url.includes('/internal/v1/configure/fields?section=security')) {
        return new Response(JSON.stringify({ fields: [{ key: 'security_approval_exec', value: 'ask' }] }), { status: 200, headers: { 'Content-Type': 'application/json' } })
      }
      if (url.endsWith('/internal/v1/configure/apply')) {
        expect(init?.method).toBe('POST')
        expect(JSON.parse(init?.body as string)).toEqual({
          changes: [
            { key: 'security_approval_exec', value: 'ask' },
            { key: 'auth_enforcement_mode', value: 'warn' },
          ],
        })
        return new Response(JSON.stringify({ ok: true, config_path: '/tmp/config.json' }), { status: 200, headers: { 'Content-Type': 'application/json' } })
      }
      return new Response('{}', { status: 404, headers: { 'Content-Type': 'application/json' } })
    })
    vi.stubGlobal('fetch', fetchMock)

    const configure = useConfigure()
    await configure.loadSections()
    await configure.loadFields('security')
    await expect(configure.applyChanges([
      { key: 'security_approval_exec', value: 'ask' },
      { key: 'auth_enforcement_mode', value: 'warn' },
    ])).resolves.toMatchObject({ ok: true })

    expect(configure.sections.value.map((section) => section.key)).toEqual(['security', 'service'])
    expect(configure.fields.value[0]).toMatchObject({ key: 'security_approval_exec' })
  })
})
