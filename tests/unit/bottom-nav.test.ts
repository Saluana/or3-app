import { mount } from '@vue/test-utils'
import { reactive, ref } from 'vue'
import { afterEach, describe, expect, it, vi } from 'vitest'

async function mountBottomNav(path = '/', fullPath = path) {
  vi.resetModules()
  const route = reactive({ path, fullPath })
  vi.doMock('vue-router', () => ({
    useRoute: () => route,
  }))
  vi.doMock('../../app/composables/useKeyboardOpen', () => ({
    useKeyboardOpen: () => ({ isKeyboardOpen: ref(false) }),
  }))

  const BottomNav = (await import('../../app/components/app/BottomNav.vue')).default
  const wrapper = mount(BottomNav, {
    global: {
      stubs: {
        Icon: { template: '<span />' },
        NuxtLink: {
          props: ['to'],
          template: '<a :href="to"><slot /></a>',
        },
      },
    },
  })

  return { wrapper, route }
}

afterEach(() => {
  vi.resetModules()
  vi.clearAllMocks()
  window.localStorage.clear()
  ;(process as NodeJS.Process & { client?: boolean }).client = undefined
})

describe('BottomNav', () => {
  it('returns top-level tabs to their last visited sub-route', async () => {
    ;(process as NodeJS.Process & { client?: boolean }).client = true
    window.localStorage.setItem(
      'or3:bottom-nav-routes',
      JSON.stringify({ '/computer': '/computer/terminal?root=workspace' }),
    )

    const { wrapper } = await mountBottomNav('/')
    const links = wrapper.findAll('a')

    expect(links[3].attributes('href')).toBe('/computer/terminal?root=workspace')
  })

  it('remembers the current sub-route for its active tab', async () => {
    ;(process as NodeJS.Process & { client?: boolean }).client = true

    await mountBottomNav('/settings/passkeys', '/settings/passkeys?tab=keys')

    expect(JSON.parse(window.localStorage.getItem('or3:bottom-nav-routes') || '{}')).toMatchObject({
      '/settings': '/settings/passkeys?tab=keys',
    })
  })
})
