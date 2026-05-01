import { ref } from 'vue'
import type { FileRoot, TerminalSessionSnapshot } from '~/types/or3-api'
import { buildServiceRestartCommand, selectServiceRestartRoot } from '~/utils/or3/service-restart'
import { useAuthSession } from './useAuthSession'
import { useComputerFiles } from './useComputerFiles'
import { useOr3Api } from './useOr3Api'

const restartingService = ref(false)
const restartError = ref<string | null>(null)
const restartPendingApprovalId = ref<number | null>(null)

function approvalIdFromError(error: any) {
  const id = error?.request_id ?? error?.approval_id ?? error?.cause?.request_id ?? error?.cause?.approval_id
  if (typeof id === 'number') return id
  if (typeof id !== 'string' || !id.trim()) return null
  const numericId = Number(id)
  return Number.isFinite(numericId) ? numericId : null
}

function describeRestartError(error: any) {
  const approvalId = approvalIdFromError(error)
  if (error?.status === 503) {
    return 'Shell access is turned off on this computer. Turn it on in or3-intern settings first.'
  }
  if (error?.status === 409 && approvalId) {
    return `or3-intern is waiting for approval request #${approvalId} before it can run the restart script.`
  }
  return error?.message || 'Could not send the restart command to this computer.'
}

export function useServiceRestart() {
  const api = useOr3Api()
  const authSession = useAuthSession()
  const { loadRoots } = useComputerFiles()

  async function createTerminalSession(root: FileRoot) {
    return await authSession.retryWithAuth((onAuthChallenge) => api.request<TerminalSessionSnapshot>('/internal/v1/terminal/sessions', {
      method: 'POST',
      body: {
        root_id: root.id,
        path: '.',
        shell: 'sh',
        rows: 12,
        cols: 80,
      },
      onAuthChallenge,
    }), 'service-restart')
  }

  async function sendRestartCommand(sessionId: string) {
    await authSession.retryWithAuth((onAuthChallenge) => api.request(`/internal/v1/terminal/sessions/${sessionId}/input`, {
      method: 'POST',
      body: { input: `${buildServiceRestartCommand()}\n` },
      onAuthChallenge,
    }), 'service-restart')
  }

  async function restartService() {
    restartingService.value = true
    restartError.value = null
    restartPendingApprovalId.value = null

    try {
      const roots = await loadRoots()
      const root = selectServiceRestartRoot(roots)
      if (!root) {
        throw new Error('This computer did not expose a writable folder that can reach the or3-intern repo.')
      }

      const session = await createTerminalSession(root)
      await sendRestartCommand(session.session_id)
      return { root, sessionId: session.session_id }
    } catch (error: any) {
      restartPendingApprovalId.value = approvalIdFromError(error)
      restartError.value = describeRestartError(error)
      throw error
    } finally {
      restartingService.value = false
    }
  }

  return {
    restartingService,
    restartError,
    restartPendingApprovalId,
    restartService,
  }
}
