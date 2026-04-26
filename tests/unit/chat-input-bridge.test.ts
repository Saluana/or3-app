import { describe, expect, it } from 'vitest'
import { hasPane, programmaticSend, registerPaneInput, unregisterPaneInput } from '../../app/composables/useChatInputBridge'

describe('chat input bridge', () => {
  it('routes text through registered input api', async () => {
    let text = ''
    let sent = false

    registerPaneInput('test', {
      setText: (value) => { text = value },
      triggerSend: () => { sent = true },
    })

    expect(hasPane('test')).toBe(true)
    expect(await programmaticSend('test', 'hello')).toBe(true)
    expect(text).toBe('hello')
    expect(sent).toBe(true)

    unregisterPaneInput('test')
    expect(hasPane('test')).toBe(false)
  })
})
