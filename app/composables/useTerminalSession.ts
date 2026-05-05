import { computed, ref } from 'vue'
import type { CreateTerminalSessionRequest, TerminalSessionSnapshot } from '~/types/or3-api'
import { useOr3Api } from './useOr3Api'

const terminalSessionStorageKey = 'or3:terminal-session'

const session = ref<TerminalSessionSnapshot | null>(null)
const terminalLines = ref<string[]>([])
const terminalChunks = ref<{ id: number; data: string }[]>([])
let chunkSeq = 0
const terminalError = ref<string | null>(null)
const terminalBusy = ref(false)
const terminalStreaming = ref(false)
const terminalUnavailable = ref(false)
const pendingApprovalId = ref<number | null>(null)
const lastLaunchPayload = ref<CreateTerminalSessionRequest | null>(null)
const activeSessions = ref<TerminalSessionSnapshot[]>([])
const sessionListingUnsupported = ref(false)
let streamAbortController: AbortController | null = null
let terminalSocket: WebSocket | null = null
let terminalSocketSessionId: string | null = null
let terminalSocketConnecting: Promise<boolean> | null = null
let terminalWebSocketUnsupported = false

const terminalWebSocketProtocol = 'or3.terminal.v1'
const terminalWebSocketTicketPrefix = 'or3.ticket.'

type TerminalWebSocketTicketResponse = {
  ticket: string
  expires_at?: string
}

type TerminalWebSocketEvent = {
  type?: string
  data?: Record<string, any>
}

type PersistedTerminalSession = {
  sessionId: string
  payload: CreateTerminalSessionRequest
}

function appendTerminalLine(line: string) {
  terminalLines.value = [...terminalLines.value, line].slice(-600)
}

function appendTerminalChunk(chunk: string) {
  if (!chunk) return
  chunkSeq += 1
  terminalChunks.value = [...terminalChunks.value, { id: chunkSeq, data: chunk }].slice(-2000)
}

function approvalIdFromError(error: any) {
  const id = error?.request_id ?? error?.approval_id ?? error?.cause?.request_id ?? error?.cause?.approval_id
  if (typeof id === 'number') return id
  if (typeof id !== 'string' || !id.trim()) return null
  const numericId = Number(id)
  return Number.isFinite(numericId) ? numericId : null
}

function isTerminalSessionMissing(error: any) {
  return error?.status === 404
}

function isTerminalSessionConflict(error: any) {
  return error?.status === 409
}

function isMethodNotAllowed(error: any) {
  return error?.status === 405
}

function storageAvailable() {
  return process.client && typeof window !== 'undefined' && !!window.localStorage
}

function readPersistedTerminalSession(): PersistedTerminalSession | null {
  if (!storageAvailable()) return null
  const raw = window.localStorage.getItem(terminalSessionStorageKey)
  if (!raw) return null
  try {
    const parsed = JSON.parse(raw) as PersistedTerminalSession | null
    if (!parsed?.sessionId || !parsed?.payload?.root_id) return null
    return parsed
  } catch {
    return null
  }
}

function writePersistedTerminalSession(nextSession: TerminalSessionSnapshot | null, payload = lastLaunchPayload.value) {
  if (!storageAvailable()) return
  if (!nextSession || !payload?.root_id) {
    window.localStorage.removeItem(terminalSessionStorageKey)
    return
  }
  window.localStorage.setItem(terminalSessionStorageKey, JSON.stringify({
    sessionId: nextSession.session_id,
    payload: {
      root_id: payload.root_id,
      path: payload.path,
      shell: payload.shell,
      rows: nextSession.rows || payload.rows,
      cols: nextSession.cols || payload.cols,
      approval_token: payload.approval_token,
    },
  } satisfies PersistedTerminalSession))
}

function rememberLaunchPayload(payload: CreateTerminalSessionRequest | null) {
  lastLaunchPayload.value = payload
}

function applySession(nextSession: TerminalSessionSnapshot | null) {
  session.value = nextSession
  writePersistedTerminalSession(nextSession)
}

function handleMissingSession(error: any, fallbackMessage: string) {
  if (!isTerminalSessionMissing(error)) return false
  resetTerminalState()
  terminalError.value = fallbackMessage
  return true
}

function resetTerminalState() {
  streamAbortController?.abort()
  closeTerminalSocket()
  chunkSeq = 0
  session.value = null
  terminalLines.value = []
  terminalChunks.value = []
  terminalBusy.value = false
  terminalStreaming.value = false
  writePersistedTerminalSession(null)
}

function closeTerminalSocket() {
  const socket = terminalSocket
  terminalSocket = null
  terminalSocketSessionId = null
  terminalSocketConnecting = null
  if (!socket) return
  try {
    socket.onopen = null
    socket.onmessage = null
    socket.onerror = null
    socket.onclose = null
    socket.close()
  } catch {
    // Best effort cleanup only.
  }
}

function terminalSocketReady(sessionId = session.value?.session_id) {
  return Boolean(
    sessionId &&
      terminalSocket &&
      terminalSocketSessionId === sessionId &&
      terminalSocket.readyState === WebSocket.OPEN,
  )
}

export function useTerminalSession() {
  const api = useOr3Api()

  const transcript = computed(() => terminalLines.value.join(''))
  const status = computed(() => session.value?.status ?? 'idle')
  const isInteractive = computed(() => session.value?.status === 'running')

  async function listSessions() {
    if (sessionListingUnsupported.value) {
      activeSessions.value = []
      return activeSessions.value
    }
    try {
      const response = await api.request<{ items?: TerminalSessionSnapshot[] }>(`/internal/v1/terminal/sessions`)
      sessionListingUnsupported.value = false
      activeSessions.value = (response.items ?? []).filter((item) => item.status === 'running')
    } catch (error: any) {
      if (isMethodNotAllowed(error)) {
        sessionListingUnsupported.value = true
        activeSessions.value = []
        console.warn('[terminal] active session listing is unavailable on this or3-intern build')
        return activeSessions.value
      }
      throw error
    }
    return activeSessions.value
  }

  async function attachExistingSession(sessionId: string) {
    terminalBusy.value = true
    terminalError.value = null
    try {
      const existing = await refresh(sessionId)
      if (!existing) return null
      rememberLaunchPayload({
        root_id: existing.root_id,
        path: existing.path || '.',
        shell: existing.shell,
        rows: existing.rows,
        cols: existing.cols,
      })
      terminalLines.value = [`$ Reconnected to ${existing.cwd}\n`]
      terminalChunks.value = []
      chunkSeq = 0
      void attach(existing.session_id)
      return existing
    } catch (error: any) {
      if (handleMissingSession(error, 'That terminal is no longer active.')) {
        await listSessions().catch(() => {})
        return null
      }
      throw error
    } finally {
      terminalBusy.value = false
    }
  }

  async function handleSessionConflict(error: any, fallbackMessage: string) {
    if (!isTerminalSessionConflict(error)) return false
    try {
      await refresh()
    } catch (refreshError: any) {
      if (handleMissingSession(refreshError, 'Terminal session expired or was closed. Open a new terminal to continue.')) {
        return true
      }
    }
    terminalError.value = fallbackMessage
    return true
  }

  function buildReconnectPayload(): CreateTerminalSessionRequest | null {
    if (lastLaunchPayload.value?.root_id) {
      return { ...lastLaunchPayload.value }
    }
    const persisted = readPersistedTerminalSession()
    if (persisted?.payload?.root_id) {
      return { ...persisted.payload }
    }
    if (!session.value?.root_id) return null
    return {
      root_id: session.value.root_id,
      path: session.value.path || '.',
      shell: session.value.shell,
      rows: session.value.rows,
      cols: session.value.cols,
    }
  }

  async function start(payload: CreateTerminalSessionRequest) {
    terminalBusy.value = true
    terminalError.value = null
    terminalUnavailable.value = false
    pendingApprovalId.value = null
    rememberLaunchPayload({ ...payload })
    streamAbortController?.abort()

    try {
      const created = await api.request<TerminalSessionSnapshot>('/internal/v1/terminal/sessions', {
        method: 'POST',
        body: payload,
      })
      chunkSeq = 0
      terminalChunks.value = []
      applySession(created)
      terminalLines.value = [`$ Connected to ${created.cwd}\n`]
      await listSessions().catch(() => {})
      void attach(created.session_id)
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
    const nextSession = await api.request<TerminalSessionSnapshot>(`/internal/v1/terminal/sessions/${sessionId}`)
    applySession(nextSession)
    return nextSession
  }

  async function restoreSession() {
    const persisted = readPersistedTerminalSession()
    if (!persisted) return null
    rememberLaunchPayload({ ...persisted.payload })
    terminalError.value = null
    try {
      const restored = await refresh(persisted.sessionId)
      if (!restored) return null
      await listSessions().catch(() => {})
      void attach(restored.session_id)
      return restored
    } catch (error: any) {
      if (handleMissingSession(error, 'Previous terminal session expired. Open a new session to continue.')) {
        terminalError.value = null
        return null
      }
      throw error
    }
  }

  async function reconnect() {
    const payload = buildReconnectPayload()
    if (!payload?.root_id) {
      terminalError.value = 'Pick an area before reconnecting the terminal.'
      return
    }
    resetTerminalState()
    terminalError.value = null
    await start(payload)
  }

  async function attach(sessionId = session.value?.session_id) {
    if (!sessionId) return
    streamAbortController?.abort()
    closeTerminalSocket()
    streamAbortController = new AbortController()
    terminalStreaming.value = true

    if (await attachWebSocket(sessionId)) return

    try {
      for await (const event of api.stream(`/internal/v1/terminal/sessions/${sessionId}/stream`, {
        method: 'GET',
        signal: streamAbortController.signal,
      })) {
        applyTerminalEvent(event.event, event.json as Record<string, any> | undefined)
      }
    } catch (error: any) {
      if (streamAbortController?.signal.aborted) return
      if (handleMissingSession(error, 'Terminal session expired or was cleared. Start a new session.')) return
      terminalError.value = error?.message ?? 'Terminal stream ended unexpectedly.'
    } finally {
      terminalStreaming.value = false
    }
  }

  function applyTerminalEvent(eventType?: string, payload?: Record<string, any>) {
    switch (eventType) {
      case 'snapshot':
        if (payload) applySession(payload as TerminalSessionSnapshot)
        break
      case 'output':
        {
          const chunk = String(payload?.chunk ?? '')
          appendTerminalChunk(chunk)
          // Keep a stripped, ANSI-free preview for legacy consumers (no xterm).
          const stripped = chunk.replace(/\x1b\[[0-9;?]*[ -\/]*[@-~]/g, '')
          if (stripped) appendTerminalLine(stripped)
        }
        break
      case 'input':
        break
      case 'error':
        if (payload?.error) appendTerminalLine(`\n[error] ${String(payload.error)}\n`)
        break
      case 'status':
        if (session.value && payload?.status) {
          applySession({ ...session.value, status: String(payload.status) })
        }
        break
      case 'resize':
        if (session.value) {
          applySession({
            ...session.value,
            rows: Number(payload?.rows ?? session.value.rows),
            cols: Number(payload?.cols ?? session.value.cols),
          })
        }
        break
    }
  }

  async function attachWebSocket(sessionId: string) {
    if (terminalWebSocketUnsupported) return false
    if (!process.client || typeof WebSocket === 'undefined') return false
    terminalSocketConnecting = connectTerminalWebSocket(sessionId)
    return await terminalSocketConnecting
  }

  async function connectTerminalWebSocket(sessionId: string) {
    let ticketResponse: TerminalWebSocketTicketResponse
    try {
      ticketResponse = await api.request<TerminalWebSocketTicketResponse>(`/internal/v1/terminal/sessions/${sessionId}/ws-ticket`, {
        method: 'POST',
      })
    } catch (error: any) {
      if (isTerminalSessionMissing(error) || isMethodNotAllowed(error) || error?.status === 400) {
        terminalWebSocketUnsupported = true
        return false
      }
      if (handleMissingSession(error, 'Terminal session expired or was cleared. Start a new session.')) return true
      terminalError.value = error?.message ?? 'Terminal WebSocket ticket request failed.'
      return false
    }
    const ticket = ticketResponse?.ticket?.trim()
    if (!ticket) return false

    return await new Promise<boolean>((resolve) => {
      let settled = false
      const wsUrl = api.buildUrl(`/internal/v1/terminal/sessions/${sessionId}/ws`)
        .replace(/^http:/i, 'ws:')
        .replace(/^https:/i, 'wss:')
      const socket = new WebSocket(wsUrl, [
        terminalWebSocketProtocol,
        `${terminalWebSocketTicketPrefix}${ticket}`,
      ])
      terminalSocket = socket
      terminalSocketSessionId = sessionId

      const settle = (value: boolean) => {
        if (settled) return
        settled = true
        resolve(value)
      }

      socket.onopen = () => {
        streamAbortController?.abort()
        terminalStreaming.value = true
        settle(true)
      }
      socket.onmessage = (message) => {
        try {
          const event = JSON.parse(String(message.data)) as TerminalWebSocketEvent
          applyTerminalEvent(event.type, event.data)
        } catch {
          appendTerminalLine('\n[error] Invalid terminal WebSocket event.\n')
        }
      }
      socket.onerror = () => {
        if (!settled) {
          closeTerminalSocket()
          settle(false)
        }
      }
      socket.onclose = () => {
        if (terminalSocket === socket) {
          terminalSocket = null
          terminalSocketSessionId = null
        }
        terminalStreaming.value = false
        settle(false)
      }
    })
  }

  async function sendInput(input: string) {
    if (!session.value || !input || session.value.status !== 'running') return
    if (terminalSocketReady()) {
      terminalSocket?.send(JSON.stringify({ type: 'input', input }))
      return
    }
    try {
      await api.request(`/internal/v1/terminal/sessions/${session.value.session_id}/input`, {
        method: 'POST',
        body: { input },
      })
    } catch (error: any) {
      if (handleMissingSession(error, 'Terminal session expired or was closed. Open a new terminal to continue.')) return
      if (await handleSessionConflict(error, 'This terminal is no longer writable. Reconnect to start a fresh shell.')) return
      terminalError.value = error?.message ?? 'Could not send input to the terminal.'
      appendTerminalLine(`\n[error] ${terminalError.value}\n`)
      throw error
    }
  }

  // sendKeys writes raw bytes (no implicit newline) and is used by the on-screen
  // key row + Ctrl chord palette + xterm.onData. We deliberately reuse the same
  // /input endpoint: server-side it already proxies to PTY stdin verbatim.
  async function sendKeys(bytes: string) {
    if (!session.value || !bytes || session.value.status !== 'running') return
    if (terminalSocketReady()) {
      terminalSocket?.send(JSON.stringify({ type: 'input', input: bytes }))
      return
    }
    try {
      await api.request(`/internal/v1/terminal/sessions/${session.value.session_id}/input`, {
        method: 'POST',
        body: { input: bytes },
      })
    } catch (error: any) {
      if (handleMissingSession(error, 'Terminal session expired or was closed. Open a new terminal to continue.')) return
      if (await handleSessionConflict(error, 'This terminal is no longer writable. Reconnect to start a fresh shell.')) return
      terminalError.value = error?.message ?? 'Could not send input to the terminal.'
      appendTerminalLine(`\n[error] ${terminalError.value}\n`)
      throw error
    }
  }

  async function resize(rows: number, cols: number) {
    if (!session.value || session.value.status !== 'running') return
    if (terminalSocketReady()) {
      terminalSocket?.send(JSON.stringify({ type: 'resize', rows, cols }))
      if (session.value) applySession({ ...session.value, rows, cols })
      return
    }
    try {
      await api.request(`/internal/v1/terminal/sessions/${session.value.session_id}/resize`, {
        method: 'POST',
        body: { rows, cols },
      })
    } catch (error: any) {
      if (handleMissingSession(error, 'Terminal session expired or was closed. Open a new terminal to continue.')) return
      if (await handleSessionConflict(error, 'This terminal is no longer resizable. Reconnect to continue.')) return
      terminalError.value = error?.message ?? 'Could not resize the terminal.'
      throw error
    }
    if (session.value) applySession({ ...session.value, rows, cols })
  }

  async function close() {
    if (!session.value) return
    const sessionId = session.value.session_id
    streamAbortController?.abort()
    if (terminalSocketReady(sessionId)) {
      terminalSocket?.send(JSON.stringify({ type: 'close' }))
      closeTerminalSocket()
    } else {
      await api.request(`/internal/v1/terminal/sessions/${sessionId}/close`, { method: 'POST' })
    }
    if (session.value) applySession({ ...session.value, status: 'closed' })
    writePersistedTerminalSession(null)
    await listSessions().catch(() => {})
  }

  function reset() {
    resetTerminalState()
    terminalError.value = null
    terminalUnavailable.value = false
    pendingApprovalId.value = null
    sessionListingUnsupported.value = false
    terminalWebSocketUnsupported = false
  }

  return {
    session,
    activeSessions,
    transcript,
    terminalLines,
    terminalChunks,
    terminalError,
    terminalBusy,
    terminalStreaming,
    terminalUnavailable,
    pendingApprovalId,
    status,
    isInteractive,
    sessionListingUnsupported,
    listSessions,
    attachExistingSession,
    start,
    refresh,
    attach,
    restoreSession,
    reconnect,
    sendInput,
    sendKeys,
    resize,
    close,
    reset,
  }
}
