// @vitest-environment happy-dom
import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'

import AssistantActivityLog from '../../app/components/assistant/AssistantActivityLog.vue'

describe('AssistantActivityLog', () => {
  it('shows every consumer activity item instead of truncating to two', () => {
    const wrapper = mount(AssistantActivityLog, {
      props: {
        consumerMode: true,
        items: [
          { id: '1', type: 'tool_call', label: 'Tool call: list_dir', status: 'complete', createdAt: 't1' },
          { id: '2', type: 'tool_call', label: 'Tool call: list_dir', status: 'complete', createdAt: 't2' },
          { id: '3', type: 'tool_call', label: 'Tool call: read_file', status: 'complete', createdAt: 't3' },
          { id: '4', type: 'tool_call', label: 'Tool call: read_file', status: 'complete', createdAt: 't4' },
        ],
      },
      global: {
        stubs: {
          Icon: { template: '<span />' },
        },
      },
    })

    expect(wrapper.findAll('li')).toHaveLength(4)
    expect(wrapper.text()).toContain('What OR3 did (4 steps)')
  })

  it('spins the summary icon while streaming', () => {
    const wrapper = mount(AssistantActivityLog, {
      props: {
        consumerMode: true,
        streaming: true,
        items: [
          { id: '1', type: 'tool_call', label: 'Tool call: list_dir', status: 'running', createdAt: 't1' },
        ],
      },
      global: {
        stubs: {
          Icon: {
            props: { class: String },
            template: '<span :class="$props.class" />',
          },
        },
      },
    })

    const summaryIcon = wrapper.find('summary span')
    expect(summaryIcon.classes()).toContain('animate-spin')
    expect(wrapper.text()).toContain('Working…')
  })
})
