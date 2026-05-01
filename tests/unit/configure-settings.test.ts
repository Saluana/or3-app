import { afterEach, describe, expect, it, vi } from 'vitest'
import { useConfigure } from '../../app/composables/useConfigure'
import { useLocalCache } from '../../app/composables/useLocalCache'
import { useSimpleSettings } from '../../app/composables/settings/useSimpleSettings'
import { useSkills } from '../../app/composables/useSkills'

describe('settings configure mappings', () => {
  afterEach(() => {
    useSimpleSettings().reset()
    useSkills().resetSkills()
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

  it('maps simple settings aliases to raw configure fields', async () => {
    useLocalCache().updateHost({ id: 'host-1', name: 'Host', baseUrl: 'http://127.0.0.1:9100', token: 'paired-token', pairedToken: 'paired-token' })
    const fetchMock = vi.fn(async (_url: string | URL | Request, init?: RequestInit) => {
      const url = String(_url)
      if (url.includes('/internal/v1/configure/fields?section=provider')) {
        return new Response(JSON.stringify({
          section: 'provider',
          fields: [
            { key: 'provider_api_key', kind: 'secret', value: 'configured' },
            { key: 'provider_model', kind: 'text', value: 'openai/gpt-4.1-mini' },
            { key: 'provider_temperature', kind: 'text', value: '0.7' },
          ],
        }), { status: 200, headers: { 'Content-Type': 'application/json' } })
      }
      if (url.includes('/internal/v1/configure/fields?section=runtime')) {
        return new Response(JSON.stringify({ section: 'runtime', fields: [] }), { status: 200, headers: { 'Content-Type': 'application/json' } })
      }
      if (url.endsWith('/internal/v1/configure/apply')) {
        expect(init?.method).toBe('POST')
        expect(JSON.parse(init?.body as string)).toEqual({
          changes: [{ section: 'provider', field: 'provider_model', op: 'set', value: 'openai/gpt-4.1' }],
        })
        return new Response(JSON.stringify({ ok: true }), { status: 200, headers: { 'Content-Type': 'application/json' } })
      }
      return new Response(JSON.stringify({ section: 'empty', fields: [] }), { status: 200, headers: { 'Content-Type': 'application/json' } })
    })
    vi.stubGlobal('fetch', fetchMock)

    const simple = useSimpleSettings()
    await simple.ensureLoaded('ai')

    expect(simple.valueIndex.value['provider.apiKey']).toBe('configured')
    expect(simple.valueIndex.value['provider.model']).toBe('openai/gpt-4.1-mini')
    expect(simple.findField('provider', 'apiKey')?.key).toBe('provider_api_key')

    await expect(simple.applyChanges([{ section: 'provider', field: 'model', value: 'openai/gpt-4.1' }])).resolves.toMatchObject({ ok: true })
  })

  it('loads and updates agent skills through the skills API', async () => {
    useLocalCache().updateHost({ id: 'host-1', name: 'Host', baseUrl: 'http://127.0.0.1:9100', token: 'paired-token', pairedToken: 'paired-token' })
    const fetchMock = vi.fn(async (_url: string | URL | Request, init?: RequestInit) => {
      const url = String(_url)
      if (url.endsWith('/internal/v1/skills') && init?.method === 'GET') {
        return new Response(JSON.stringify({
          global_dir: '/Users/brendon/.agents/skills',
          global_skills_enabled: true,
          items: [{ name: 'demo', key: 'demo', source: 'global', location: '/Users/brendon/.agents/skills/demo', eligible: true, disabled: false, hidden: false, status: 'eligible', permission_state: 'approved', user_invocable: true }],
        }), { status: 200, headers: { 'Content-Type': 'application/json' } })
      }
      if (url.endsWith('/internal/v1/skills/demo/settings')) {
        expect(init?.method).toBe('POST')
        expect(JSON.parse(init?.body as string)).toEqual({ enabled: false, apiKey: 'secret' })
        return new Response(JSON.stringify({
          ok: true,
          skill: { name: 'demo', key: 'demo', source: 'global', location: '/Users/brendon/.agents/skills/demo', eligible: false, disabled: true, hidden: false, status: 'disabled', permission_state: 'approved', user_invocable: true },
        }), { status: 200, headers: { 'Content-Type': 'application/json' } })
      }
      return new Response('{}', { status: 404, headers: { 'Content-Type': 'application/json' } })
    })
    vi.stubGlobal('fetch', fetchMock)

    const skillApi = useSkills()
    await skillApi.loadSkills()

    expect(skillApi.globalSkillsDir.value).toBe('/Users/brendon/.agents/skills')
    expect(skillApi.skills.value[0]?.source).toBe('global')

    await expect(skillApi.updateSkill('demo', { enabled: false, apiKey: 'secret' })).resolves.toMatchObject({ ok: true })
    expect(skillApi.skills.value[0]?.disabled).toBe(true)
  })
})
