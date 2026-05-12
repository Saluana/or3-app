import { flushPromises, mount } from '@vue/test-utils'
import { afterEach, describe, expect, it, vi } from 'vitest'
import AddonsPage from '../../app/pages/settings/addons.vue'
import { useLocalCache } from '../../app/composables/useLocalCache'
import { useMCP } from '../../app/composables/useMCP'

describe('settings add-ons page', () => {
  afterEach(() => {
    useLocalCache().clearAll()
    useMCP().resetMCPServers()
    vi.unstubAllGlobals()
  })

  it('renders configured MCP servers from the service API', async () => {
    useLocalCache().updateHost({
      id: 'host-1',
      name: 'Host',
      baseUrl: 'http://127.0.0.1:9100',
      token: 'paired-token',
      pairedToken: 'paired-token',
    })
    vi.stubGlobal(
      'fetch',
      vi.fn(async () =>
        new Response(
          JSON.stringify({
            servers: [
              {
                name: 'files',
                config: { enabled: true, transport: 'stdio', command: 'mcp-files' },
                status: {
                  connected: true,
                  toolCount: 2,
                  tools: ['mcp_files_read', 'mcp_files_write'],
                },
              },
            ],
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } },
        ),
      ),
    )

    const wrapper = mount(AddonsPage, {
      global: {
        mocks: { $router: { push: vi.fn() } },
        stubs: {
          AppShell: { template: '<main><slot /></main>' },
          AppHeader: { template: '<header />' },
          SurfaceCard: { template: '<section><slot /></section>' },
          RetroIcon: { template: '<span />' },
          Icon: { template: '<span />' },
          StatusPill: { props: ['label'], template: '<span>{{ label }}</span>' },
          EmptyState: { props: ['title'], template: '<div>{{ title }}</div>' },
          UButton: { props: ['label'], template: '<button>{{ label }}</button>' },
          UInput: { props: ['modelValue'], template: '<input :value="modelValue" />' },
          USwitch: { props: ['modelValue'], template: '<input type="checkbox" :checked="modelValue" />' },
          UTextarea: { props: ['modelValue'], template: '<textarea>{{ modelValue }}</textarea>' },
        },
      },
    })
    await flushPromises()

    expect(wrapper.text()).toContain('files')
    expect(wrapper.text()).toContain('2 tools')
  })
})
