import { mount } from '@vue/test-utils'
import { ref } from 'vue'
import { afterEach, describe, expect, it, vi } from 'vitest'

async function mountShell(isDesktop: boolean) {
  vi.resetModules()
  vi.doMock('~/composables/useViewport', () => ({
    useViewport: () => ({ matches: ref(isDesktop) }),
  }))

  const AppShell = (await import('../../app/components/app/AppShell.vue')).default

  return mount(AppShell, {
    slots: {
      default: '<div data-testid="content">Content</div>',
      sidebar: '<div data-testid="sidebar">Sidebar</div>',
    },
    global: {
      stubs: {
        BottomNav: { template: '<div data-testid="bottom-nav" />' },
        DesktopAppShell: {
          template:
            '<div data-testid="desktop-shell"><slot name="sidebar" /><slot name="header" /><slot name="header-actions" /><slot /></div>',
        },
      },
    },
  })
}

afterEach(() => {
  vi.resetModules()
  vi.clearAllMocks()
})

describe('AppShell', () => {
  it('renders the default slot only once on mobile', async () => {
    const wrapper = await mountShell(false)

    expect(wrapper.findAll('[data-testid="content"]')).toHaveLength(1)
    expect(wrapper.find('[data-testid="bottom-nav"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="desktop-shell"]').exists()).toBe(false)
  })

  it('renders the default slot only once on desktop', async () => {
    const wrapper = await mountShell(true)

    expect(wrapper.findAll('[data-testid="content"]')).toHaveLength(1)
    expect(wrapper.find('[data-testid="desktop-shell"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="bottom-nav"]').exists()).toBe(false)
  })
})
