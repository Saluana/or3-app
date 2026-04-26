import { ref } from 'vue'
import type { TurnResponse } from '~/types/or3-api'
import { useChatSessions } from './useChatSessions'
import { useOr3Api } from './useOr3Api'

const isStreaming = ref(false)
const activeJobId = ref<string | null>(null)
let controller: AbortController | null = null

export function useAssistantStream() {
  const api = useOr3Api()
  const chat = useChatSessions()

  async function send(message: string) {
    const text = message.trim()
    if (!text || isStreaming.value) return

    const session = chat.ensureSession()
    chat.addMessage({ sessionId: session.id, role: 'user', content: text, status: 'complete' })
    const assistant = chat.addMessage({ sessionId: session.id, role: 'assistant', content: '', status: 'streaming' })
    isStreaming.value = true
    const activeController = new AbortController()
    controller = activeController

    try {
      let streamed = false
      for await (const event of api.stream('/internal/v1/turns', {
        body: { session_key: session.sessionKey, message: text },
        signal: activeController.signal,
      })) {
        streamed = true
        const payload = event.json as Record<string, unknown> | undefined
        const delta = String(payload?.delta ?? payload?.text ?? payload?.content ?? '')
        if (delta) chat.updateMessage(assistant.id, { content: assistant.content + delta })
        const finalText = payload?.final_text
        if (typeof finalText === 'string') chat.updateMessage(assistant.id, { content: finalText })
        if (typeof payload?.job_id === 'string') activeJobId.value = payload.job_id
        if (payload?.status === 'completed') chat.updateMessage(assistant.id, { status: 'complete' })
      }

      if (!streamed) chat.updateMessage(assistant.id, { content: 'No streaming content was returned.', status: 'complete' })
      chat.updateMessage(assistant.id, { status: 'complete' })
    } catch {
      if (activeController.signal.aborted) {
        chat.updateMessage(assistant.id, {
          content: assistant.content || 'Stopped.',
          status: 'complete',
        })
        return
      }

      try {
        const response = await api.request<TurnResponse>('/internal/v1/turns', {
          body: { session_key: session.sessionKey, message: text },
          signal: activeController.signal,
        })
        activeJobId.value = response.job_id
        chat.updateMessage(assistant.id, {
          content: response.final_text || response.error || 'The turn completed without text.',
          status: response.error ? 'failed' : 'complete',
          error: response.error,
          jobId: response.job_id,
        })
      } catch (error) {
        chat.updateMessage(assistant.id, {
          content: 'I could not reach or3-intern. Check the selected computer and try again.',
          status: 'failed',
          error: error instanceof Error ? error.message : 'Request failed',
        })
      }
    } finally {
      isStreaming.value = false
      if (controller === activeController) controller = null
    }
  }

  function stop() {
    controller?.abort()
    isStreaming.value = false
  }

  return { isStreaming, activeJobId, send, stop }
}
