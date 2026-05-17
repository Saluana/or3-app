import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import ChatSessionsSidebar from '../../app/components/desktop/sidebars/ChatSessionsSidebar.vue'
import type { ChatSessionMeta } from '../../app/types/or3-api'

const session: ChatSessionMeta = {
  session_key: 'session-1',
  title: 'Desktop conversation',
  message_count: 2,
  archived: false,
  updated_at: Date.now(),
  last_message_at: Date.now(),
  last_message_preview: 'Recent message',
}

function mountSidebar() {
  return mount(ChatSessionsSidebar, {
    props: {
      sessions: [session],
      activeSessionKey: 'session-1',
    },
    global: {
      stubs: {
        DesktopSecondarySidebar: {
          props: ['searchValue', 'searchPlaceholder', 'footerText', 'onRefresh'],
          emits: ['update:searchValue'],
          template:
            '<aside><slot name="filters" /><slot /><slot name="footer" /></aside>',
        },
        Icon: { template: '<span />' },
        UButton: {
          props: ['ariaLabel', 'icon'],
          emits: ['click'],
          template:
            '<button :aria-label="ariaLabel" type="button" @click="$emit(\'click\', $event)"><slot /></button>',
        },
        EditNameModal: {
          props: ['open', 'initialValue'],
          emits: ['submit', 'update:open'],
          template:
            '<div data-testid="rename-modal" :data-open="String(open)" :data-initial-value="initialValue" />',
        },
      },
    },
  })
}

describe('ChatSessionsSidebar', () => {
  it('exposes desktop archive and rename actions', async () => {
    const wrapper = mountSidebar()

    await wrapper.get('[aria-label="Archive conversation"]').trigger('click')

    expect(wrapper.emitted('archive')?.[0]).toEqual([session, true])

    await wrapper.get('[aria-label="Rename conversation"]').trigger('click')

    const modal = wrapper.get('[data-testid="rename-modal"]')
    expect(modal.attributes('data-open')).toBe('true')
    expect(modal.attributes('data-initial-value')).toBe('Desktop conversation')
  })

  it('requests archived sessions when the desktop archived filter is selected', async () => {
    const wrapper = mountSidebar()
    const archivedFilter = wrapper.findAll('button').find((button) => button.text().includes('Archived'))

    expect(archivedFilter).toBeTruthy()
    await archivedFilter!.trigger('click')

    const refreshEvents = wrapper.emitted('refresh') || []
    expect(refreshEvents.at(-1)).toEqual([{ includeArchived: true, q: undefined }])
  })
})
