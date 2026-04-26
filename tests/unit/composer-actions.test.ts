import { describe, expect, it } from 'vitest'
import { listRegisteredComposerActionIds, registerComposerAction, unregisterComposerAction, useComposerActions } from '../../app/composables/useComposerActions'

describe('composer actions', () => {
  it('registers, orders, and unregisters actions', () => {
    registerComposerAction({ id: 'test:first', icon: 'i-lucide-a', order: 1, handler: () => undefined })
    registerComposerAction({ id: 'test:last', icon: 'i-lucide-b', order: 999, handler: () => undefined })

    const actions = useComposerActions()
    const ids = actions.value.map((entry) => entry.action.id)

    expect(ids.indexOf('test:first')).toBeLessThan(ids.indexOf('test:last'))
    expect(listRegisteredComposerActionIds()).toContain('test:first')

    unregisterComposerAction('test:first')
    unregisterComposerAction('test:last')
    expect(listRegisteredComposerActionIds()).not.toContain('test:first')
  })
})
