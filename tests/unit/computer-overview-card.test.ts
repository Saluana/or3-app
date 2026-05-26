import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import ComputerOverviewCard from '../../app/components/computer/ComputerOverviewCard.vue'

describe('ComputerOverviewCard', () => {
  it('renders an MCP summary when capabilities include MCP servers', () => {
    const wrapper = mount(ComputerOverviewCard, {
      props: {
        connected: true,
        health: { status: 'ok' },
        capabilities: {
          mcpServers: [
            { name: 'files', transport: 'stdio', toolCount: 2, connected: true },
            { name: 'remote', transport: 'streamable-http', toolCount: 0, connected: false },
          ],
          enabledMcpServers: [
            { name: 'files', transport: 'stdio', toolCount: 2, connected: true },
            { name: 'remote', transport: 'streamable-http', toolCount: 0, connected: false },
          ],
        },
      },
      global: {
        stubs: {
          NuxtLink: { template: '<a><slot /></a>' },
          SurfaceCard: { template: '<section><slot /></section>' },
          RetroComputerMascot: { template: '<div />' },
          Icon: { template: '<span />' },
        },
      },
    })

    expect(wrapper.text()).toContain('2 MCP tools from 1/2 servers')
  })

  it('shows connecting when paired but not yet connected', () => {
    const wrapper = mount(ComputerOverviewCard, {
      props: {
        paired: true,
        connected: false,
        hostName: 'or3-app',
      },
      global: {
        stubs: {
          NuxtLink: { template: '<a><slot /></a>' },
          SurfaceCard: { template: '<section><slot /></section>' },
          RetroComputerMascot: { template: '<div />' },
          Icon: { template: '<span />' },
        },
      },
    })

    expect(wrapper.text()).toContain('connecting')
    expect(wrapper.text()).not.toContain('not paired')
  })
})
