import { computed, ref } from 'vue'
import type { CreateTerminalSessionRequest, TerminalSessionSnapshot } from '~/types/or3-api'
import { useOr3Api } from './useOr3Api'

const session = ref<TerminalSessionSnapshot | null>(null)
const terminalLines = ref<string[]>([])
const terminalError = ref<string | null>(null)
const terminalBusy = ref(false)
const terminalStreaming = ref(false)
const terminalUnavailable = ref(false)
const pendingApprovalId = ref<number | null>(null)
let streamAbortController: AbortController | null = null

function appendTerminalLine(line: string) {
  terminalLines.value = [...terminalLines.value, line].slice(-600)
}

function approvalIdFromError(error: any) {
  const id = error?.request_id ?? error?.approval_id ?? error?.cause?.request_id ?? error?.cause?.approval_id
  if (typeof id === 'number') return id
  if (typeof id !== 'string' || !id.trim()) return null
  const numericId = Number(id)
  return Number.isFinite(numericId) ? numericId : null
}

export function useTerminalSession() {
  const api = useOr3Api()

  const transcript = computed(() => terminalLines.value.join(''))
  const status = computed(() => session.value?.status ?? 'idle')

  async function start(payload: CreateTerminalSessionRequest) {
    terminalBusy.value = true
    terminalError.value = null
    terminalUnavailable.value = false
    pendingApprovalId.value = null

    try {
      const created = await api.request<TerminalSessionSnapshot>('/internal/v1/terminal/sessions', {
        method: 'POST',
        body: payload,
      })
      session.value = created
      terminalLines.value = [`$ Connected to ${created.cwd}\n`]
      await attach(created.session_id)
    } catch (error: any) {
      terminalError.value = error?.message ?? 'Unable to start a terminal session.'
      terminalUnavailable.value = error?.status === 503
      pendingApprovalId.value = approvalIdFromError(error)
      throw error
    } finally {
      terminalBusy.value = false
    }
  }

  async function refresh(sessionId = session.value?.session_id) {
    if (!sessionId) return
    session.value = await api.request<TerminalSessionSnapshot>(`/internal/v1/terminal/sessions/${sessionId}`)
  }

  async function attach(sessionId = session.value?.session_id) {
    if (!sessionId) return
    streamAbortController?.abort()
    streamAbortController = new AbortController()
    terminalStreaming.value = true

    try {
      for await (const event of api.stream(`/internal/v1/terminal/sessions/${sessionId}/stream`, {
        method: 'GET',
        signal: streamAbortController.signal,
      })) {
        const payload = event.json as Record<string, any> | undefined
        switch (event.event) {
          case 'snapshot':
            if (payload) session.value = payload as TerminalSessionSnapshot
            break
          case 'output':
            appendTerminalLine(String(payload?.chunk ?? ''))
            break
          case 'error':
            if (payload?.error) appendTerminalLine(`\n[error] ${String(payload.error)}\n`)
            break
          case 'status':
            if (session.value && payload?.status) session.value = { ...session.value, status: String(payload.status) }
            break
          case 'resize':
            if (session.value) {
              session.value = {
                ...session.value,
                rows: Number(payload?.rows ?? session.value.rows),
                cols: Number(payload?.cols ?? session.value.cols),
              }
            }
            break
        }
      }
    } catch (error: any) {
      if (streamAbortController?.signal.aborted) return
      terminalError.value = error?.message ?? 'Terminal stream ended unexpectedly.'
    } finally {
      terminalStreaming.value = false
    }
  }

  async function sendInput(input: string) {
    if (!session.value || !input) return
    await api.request(`/internal/v1/terminal/sessions/${session.value.session_id}/input`, {
      method: 'POST',
      body: { input },
    })
  }

  async function resize(rows: number, cols: number) {
    if (!session.value) return
    await api.request(`/internal/v1/terminal/sessions/${session.value.session_id}/resize`, {
      method: 'POST',
      body: { rows, cols },
    })
    if (session.value) session.value = { ...session.value, rows, cols }
  }

  async function close() {
    if (!session.value) return
    const sessionId = session.value.session_id
    streamAbortController?.abort()
    await api.request(`/internal/v1/terminal/sessions/${sessionId}/close`, { method: 'POST' })
    if (session.value) session.value = { ...session.value, status: 'closed' }
  }

  function reset() {
    streamAbortController?.abort()
    session.value = null
    terminalLines.value = []
    terminalError.value = null
    terminalBusy.value = false
    terminalStreaming.value = false
    terminalUnavailable.value = false
    pendingApprovalId.value = null
  }

  return {
    session,
    transcript,
    terminalLines,
    terminalError,
    terminalBusy,
    terminalStreaming,
    terminalUnavailable,
    pendingApprovalId,
    status,
    start,
    refresh,
    attach,
    sendInput,
    resize,
    close,
    reset,
  }
}
