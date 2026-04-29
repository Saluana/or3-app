import { ref } from 'vue'
import type { JobSnapshot, TurnResponse } from '~/types/or3-api'
import type { AssistantSendPayload, ChatActivityEntry, ChatToolCall } from '~/types/app-state'
import { useChatSessions } from './useChatSessions'
import { useOr3Api } from './useOr3Api'

const isStreaming = ref(false)
const activeJobId = ref<string | null>(null)
let controller: AbortController | null = null

function describeRequestError(error: unknown) {
  if (error instanceof Error && error.message.trim()) return error.message
  if (error && typeof error === 'object' && 'message' in error) {
    const message = String((error as { message?: unknown }).message ?? '').trim()
    if (message) return message
  }
  return 'Request failed'
}

function now() {
  return new Date().toISOString()
}

function createToolCall(name: string, args?: string): ChatToolCall {
  return {
    id: `tool_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`,
    name,
    status: 'running',
    arguments: args,
    startedAt: now(),
  }
}

function createActivity(type: string, label: string, detail?: string, status: ChatActivityEntry['status'] = 'running'): ChatActivityEntry {
  return {
    id: `activity_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`,
    type,
    label,
    detail,
    status,
    createdAt: now(),
  }
}

function normalizePayload(input: string | AssistantSendPayload): AssistantSendPayload {
  if (typeof input === 'string') return { text: input.trim(), transportText: input.trim(), attachments: [] }
  return {
    text: input.text.trim(),
    transportText: (input.transportText || input.text).trim(),
    attachments: input.attachments ?? [],
  }
}

function sanitizeAssistantText(text: string) {
  if (!text) return ''

  return text
    .replace(/<tool_call>[\s\S]*?<\/tool_call>/gi, '')
    .replace(/<tool_call[\s\S]*$/i, '')
    .replace(/<\/tool_call>/gi, '')
    .replace(/<function=[^>]*>/gi, '')
    .replace(/<parameter=[^>]*>/gi, '')
    .replace(/<function=[\s\S]*$/i, '')
    .replace(/<parameter=[\s\S]*$/i, '')
    .trim()
}

function truncateLogDetail(value: string, limit = 500) {
  return value.length > limit ? `${value.slice(0, limit)}\n...` : value
}

export function useAssistantStream() {
  const api = useOr3Api()
  const chat = useChatSessions()

  async function send(message: string | AssistantSendPayload) {
    const payload = normalizePayload(message)
    const text = payload.transportText || payload.text
    if (!text || isStreaming.value) return

    const session = chat.ensureSession()
    chat.addMessage({
      sessionId: session.id,
      role: 'user',
      content: payload.text,
      attachments: payload.attachments,
      status: 'complete',
    })
    const assistant = chat.addMessage({
      sessionId: session.id,
      role: 'assistant',
      content: '',
      status: 'streaming',
      reasoningText: '',
      toolCalls: [],
      activityLog: [],
    })
    isStreaming.value = true
    const activeController = new AbortController()
    controller = activeController
    let rawAssistantContent = ''

    const readAssistant = () => chat.messages.value.find((item) => item.id === assistant.id)
    const updateAssistant = (patch: Parameters<typeof chat.updateMessage>[1]) => chat.updateMessage(assistant.id, patch)
    const appendAssistantContent = (value: string) => {
      rawAssistantContent += value
      updateAssistant({ content: sanitizeAssistantText(rawAssistantContent) })
    }
    const replaceAssistantContent = (value: string) => {
      rawAssistantContent = value
      updateAssistant({ content: sanitizeAssistantText(rawAssistantContent) })
    }
    const setToolCalls = (toolCalls: ChatToolCall[]) => updateAssistant({ toolCalls })
    const addActivity = (entry: ChatActivityEntry) => {
      const current = readAssistant()
      updateAssistant({ activityLog: [...(current?.activityLog ?? []), entry].slice(-30) })
    }
    const updateActivity = (predicate: (entry: ChatActivityEntry) => boolean, patch: Partial<ChatActivityEntry>) => {
      const current = readAssistant()
      const activityLog = current?.activityLog
      if (!activityLog?.length) return
      updateAssistant({
        activityLog: activityLog.map((entry) => predicate(entry) ? { ...entry, ...patch } : entry),
      })
    }
    const completeRunningActivity = (types: string[]) => {
      updateActivity((entry) => types.includes(entry.type) && entry.status === 'running', { status: 'complete' })
    }
    const addToolCall = (name: string, args?: string) => {
      const current = readAssistant()
      const toolCalls = [...(current?.toolCalls ?? []), createToolCall(name, args)]
      setToolCalls(toolCalls)
      addActivity(createActivity('tool_call', `Tool call: ${name}`, args ? truncateLogDetail(args) : undefined, 'running'))
    }
    const resolveToolCall = (name: string, result?: string, error?: string) => {
      const current = readAssistant()
      const toolCalls = [...(current?.toolCalls ?? [])]
      const targetIndex = [...toolCalls].reverse().findIndex((call) => call.name === name && call.status === 'running')
      const resolvedIndex = targetIndex === -1 ? -1 : toolCalls.length - 1 - targetIndex
      if (resolvedIndex === -1) {
        toolCalls.push({
          ...createToolCall(name),
          status: error ? 'error' : 'complete',
          result,
          error,
          completedAt: now(),
        })
      } else {
        const call = toolCalls[resolvedIndex]
        if (call) {
          toolCalls[resolvedIndex] = {
            ...call,
            status: error ? 'error' : 'complete',
            result: result ?? call.result,
            error: error ?? call.error,
            completedAt: now(),
          }
        }
      }
      setToolCalls(toolCalls)
      updateActivity(
        (entry) => entry.type === 'tool_call' && entry.status === 'running' && entry.label === `Tool call: ${name}`,
        { status: error ? 'error' : 'complete' },
      )
      addActivity(createActivity('tool_result', `Tool result: ${name}`, error || (result ? truncateLogDetail(result) : undefined), error ? 'error' : 'complete'))
    }

    try {
      let sawStreamEvent = false
      let sawVisibleOutput = false
      let streamEndedWithFailure = false
      let streamedJobId: string | null = null

      for await (const event of api.stream('/internal/v1/turns', {
        body: { session_key: session.sessionKey, message: text },
        signal: activeController.signal,
      })) {
        sawStreamEvent = true
        const payload = event.json as Record<string, unknown> | undefined
        const eventType = String(event.event || payload?.type || '')
        const delta = String(payload?.delta ?? payload?.text ?? payload?.content ?? '')
        if (eventType === 'queued' || eventType === 'started') {
          addActivity(createActivity(eventType, eventType === 'queued' ? 'Queued turn' : 'Started turn'))
        }
        if (eventType === 'text_delta' && delta) {
          appendAssistantContent(delta)
          sawVisibleOutput = sawVisibleOutput || !!sanitizeAssistantText(rawAssistantContent)
        }
        const finalText = payload?.final_text
        const assistantContent = typeof payload?.content === 'string' ? payload.content : ''
        const assistantText = typeof finalText === 'string' && finalText.trim()
          ? finalText
          : eventType === 'assistant'
            ? assistantContent
            : ''
        if (assistantText.trim()) {
          replaceAssistantContent(assistantText)
          sawVisibleOutput = sawVisibleOutput || !!sanitizeAssistantText(assistantText)
        }
        if (eventType === 'tool_call') {
          addToolCall(String(payload?.name || 'tool'), typeof payload?.arguments === 'string' ? payload.arguments : undefined)
        }
        if (eventType === 'tool_result') {
          resolveToolCall(
            String(payload?.name || 'tool'),
            typeof payload?.result === 'string' ? payload.result : undefined,
            typeof payload?.error === 'string' ? payload.error : undefined,
          )
        }
        if (eventType === 'reasoning_delta' && typeof payload?.content === 'string') {
          updateAssistant({ reasoningText: `${readAssistant()?.reasoningText || ''}${payload.content}` })
        }
        if (eventType === 'runtime_error') {
          addActivity(createActivity('runtime_error', 'Runtime error', String(payload?.message || 'Unknown runtime error'), 'error'))
        }
        if (typeof payload?.job_id === 'string') {
          streamedJobId = payload.job_id
          activeJobId.value = payload.job_id
        }

        const streamError = String(payload?.error ?? payload?.message ?? '').trim()
        const streamStatus = String(payload?.status ?? '').trim()
        if (streamError || streamStatus === 'failed' || streamStatus === 'aborted') {
          streamEndedWithFailure = true
          const failureText = streamError || sanitizeAssistantText(rawAssistantContent) || readAssistant()?.content || 'or3-intern could not finish this request.'
          updateAssistant({
            content: failureText,
            status: 'failed',
            error: streamError || `Turn ${streamStatus || 'failed'}`,
            jobId: streamedJobId ?? undefined,
          })
        }

        if (streamStatus === 'completed') {
          completeRunningActivity(['queued', 'started', 'tool_call'])
          addActivity(createActivity('completion', 'Completed turn', typeof payload?.final_text === 'string' && payload.final_text.trim() ? undefined : 'No final text was included in the completion event.', 'complete'))
          updateAssistant({ status: 'complete' })
        }
      }

      if (streamEndedWithFailure) return

      if (!sawVisibleOutput && streamedJobId) {
        try {
          const snapshot = await api.request<JobSnapshot>(`/internal/v1/jobs/${encodeURIComponent(streamedJobId)}`, {
            signal: activeController.signal,
          })
          const snapshotText = snapshot.final_text?.trim() || snapshot.error?.trim() || ''
          if (snapshotText) {
            replaceAssistantContent(snapshotText)
            updateAssistant({
              status: snapshot.error || snapshot.status === 'failed' || snapshot.status === 'aborted' ? 'failed' : 'complete',
              error: snapshot.error,
              jobId: snapshot.job_id,
            })
            sawVisibleOutput = sawVisibleOutput || !!sanitizeAssistantText(snapshotText)
          }
        } catch {
          // Fall through to the visible empty-result message below.
        }
      }

      if (!sawVisibleOutput) {
        updateAssistant({
          content: sawStreamEvent
            ? 'or3-intern finished thinking, but did not return any visible text.'
            : 'No streaming content was returned.',
          status: 'complete',
          jobId: streamedJobId ?? undefined,
        })
      }

      const finalMessage = chat.messages.value.find((item) => item.id === assistant.id)
      if (finalMessage?.status !== 'failed') updateAssistant({ status: 'complete' })
    } catch {
      if (activeController.signal.aborted) {
        completeRunningActivity(['queued', 'started', 'tool_call'])
        updateAssistant({
          content: readAssistant()?.content || 'Stopped.',
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
        replaceAssistantContent(response.final_text || response.error || 'The turn completed without text.')
        updateAssistant({
          status: response.error ? 'failed' : 'complete',
          error: response.error,
          jobId: response.job_id,
        })
        completeRunningActivity(['queued', 'started', 'tool_call'])
      } catch (error) {
        updateActivity((entry) => entry.status === 'running', { status: 'error' })
        updateAssistant({
          content: 'I could not reach or3-intern. Check the selected computer and try again.',
          status: 'failed',
          error: describeRequestError(error),
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
