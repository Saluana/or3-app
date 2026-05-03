import { computed, ref } from 'vue'
import type { FileEntry, FileListResponse, FileRoot, FileSearchItem, FileSearchResponse } from '~/types/or3-api'
import { useOr3Api } from './useOr3Api'
import { useActiveHost } from './useActiveHost'
import { resolveHostAuthTokens } from './useSecureHostTokens'
import { useAuthSession } from './useAuthSession'

interface FileStatResponse {
  item?: FileEntry
  root_id?: string
}

interface FileActionResponse {
  path?: string
  root_id?: string
  status?: string
}

interface FileErrorPayload {
  code?: string
  error?: string
  message?: string
}

const roots = ref<FileRoot[]>([])
const entries = ref<FileEntry[]>([])
const currentRootId = ref<string>('')
const currentPath = ref<string>('.')
const loadingFiles = ref(false)
const searchingFiles = ref(false)
const fileError = ref<string | null>(null)

function sortEntries(items: FileEntry[]) {
  return [...items].sort((left, right) => {
    if (left.type !== right.type) return left.type === 'directory' ? -1 : 1
    return left.name.localeCompare(right.name, undefined, { numeric: true, sensitivity: 'base' })
  })
}

async function readManualFetchError(response: Response) {
  const text = await response.text().catch(() => '')
  if (!text) {
    return {
      code: response.status === 401 ? 'SESSION_REQUIRED' : undefined,
      message: `Request failed with status ${response.status}`,
      status: response.status,
    }
  }

  try {
    const payload = JSON.parse(text) as FileErrorPayload
    return {
      code: payload.code,
      message: payload.message || payload.error || `Request failed with status ${response.status}`,
      status: response.status,
    }
  } catch {
    return {
      code: response.status === 401 ? 'SESSION_REQUIRED' : undefined,
      message: text,
      status: response.status,
    }
  }
}

export function useComputerFiles() {
  const api = useOr3Api()
  const authSession = useAuthSession()
  const { activeHost } = useActiveHost()
  const directories = computed(() => entries.value.filter((entry) => entry.type === 'directory'))
  const files = computed(() => entries.value.filter((entry) => entry.type === 'file'))

  function activeRequestHeaders(extra: Record<string, string> = {}) {
    const headers: Record<string, string> = { ...extra }
    const { authToken, sessionToken } = resolveHostAuthTokens(activeHost.value)
    if (authToken) headers.Authorization = `Bearer ${authToken}`
    if (sessionToken) headers['X-Or3-Session'] = sessionToken
    return headers
  }

  async function loadRoots() {
    fileError.value = null
    try {
      const response = await authSession.retryWithAuth((onAuthChallenge) => api.request<{ items?: FileRoot[] } | FileRoot[]>('/internal/v1/files/roots', {
        onAuthChallenge,
      }), 'files-browse')
      const nextRoots = Array.isArray(response) ? response : response.items ?? []
      roots.value = nextRoots
      if (!nextRoots.some((root) => root.id === currentRootId.value)) {
        currentRootId.value = nextRoots[0]?.id ?? ''
      }
      return nextRoots
    } catch (error: any) {
      roots.value = []
      fileError.value = error?.message ?? 'Could not load the approved areas on this computer.'
      throw error
    }
  }

  async function resolveSearchRoot(preferredRootId = currentRootId.value) {
    let rootId = preferredRootId
    if (!rootId || !roots.value.some((root) => root.id === rootId)) {
      const nextRoots = await loadRoots()
      rootId = nextRoots.find((root) => root.id === preferredRootId)?.id || currentRootId.value || nextRoots[0]?.id || ''
    }
    return rootId
  }

  async function listDirectory(rootId = currentRootId.value, path = currentPath.value) {
    loadingFiles.value = true
    fileError.value = null
    currentRootId.value = rootId
    currentPath.value = path
    try {
      const params = new URLSearchParams({ root_id: rootId, path })
      const response = await authSession.retryWithAuth((onAuthChallenge) => api.request<FileListResponse>(`/internal/v1/files/list?${params.toString()}`, {
        onAuthChallenge,
      }), 'files-browse')
      entries.value = sortEntries(response.entries ?? [])
      currentPath.value = response.path || path
      return response
    } catch (error: any) {
      entries.value = []
      fileError.value = error?.message ?? 'Could not open that folder.'
      throw error
    } finally {
      loadingFiles.value = false
    }
  }

  async function searchWorkspaceFiles(query: string, limit = 12, rootId = currentRootId.value) {
    searchingFiles.value = true
    fileError.value = null
    try {
      const resolvedRootId = await resolveSearchRoot(rootId)
      const params = new URLSearchParams({ q: query.trim(), limit: String(limit) })
      if (resolvedRootId) params.set('root_id', resolvedRootId)
      const response = await authSession.retryWithAuth((onAuthChallenge) => api.request<FileSearchResponse>(`/internal/v1/files/search?${params.toString()}`, {
        onAuthChallenge,
      }), 'files-search')
      return response.items ?? []
    } catch (error: any) {
      fileError.value = error?.message ?? 'Could not search this area.'
      throw error
    } finally {
      searchingFiles.value = false
    }
  }

  async function statPath(rootId = currentRootId.value, path = currentPath.value) {
    const params = new URLSearchParams({ root_id: rootId, path })
    try {
      const response = await authSession.retryWithAuth((onAuthChallenge) => api.request<FileStatResponse>(`/internal/v1/files/stat?${params.toString()}`, {
        onAuthChallenge,
      }), 'files-browse')
      return response.item ?? null
    } catch {
      return null
    }
  }

  async function createDirectory(name: string, rootId = currentRootId.value, path = currentPath.value) {
    fileError.value = null
    const response = await authSession.retryWithAuth((onAuthChallenge) => api.request<FileActionResponse>('/internal/v1/files/mkdir', {
      method: 'POST',
      body: { root_id: rootId, path, name },
      onAuthChallenge,
    }), 'files-create-folder')
    await listDirectory(rootId, path)
    return response
  }

  async function downloadFile(entry: Pick<FileEntry, 'path'>, rootId = currentRootId.value) {
    fileError.value = null
    const params = new URLSearchParams({ root_id: rootId, path: entry.path })
    try {
      return await authSession.retryWithAuth(async () => {
        const response = await fetch(api.buildUrl(`/internal/v1/files/download?${params.toString()}`), {
          method: 'GET',
          headers: activeRequestHeaders(),
        })

        if (!response.ok) throw await readManualFetchError(response)
        return await response.blob()
      }, 'files-download')
    } catch (error: any) {
      fileError.value = error?.message ?? 'Could not download that file.'
      throw error
    }
  }

  async function uploadFiles(filesToUpload: FileList | File[]) {
    if (!filesToUpload.length) return
    loadingFiles.value = true
    fileError.value = null

    try {
      const selectedFiles = Array.from(filesToUpload)
      for (const file of selectedFiles) {
        await authSession.retryWithAuth(async () => {
          const formData = new FormData()
          formData.set('root_id', currentRootId.value)
          formData.set('path', currentPath.value)
          formData.set('file', file)

          const response = await fetch(api.buildUrl('/internal/v1/files/upload'), {
            method: 'POST',
            headers: activeRequestHeaders({ Accept: 'application/json' }),
            body: formData,
          })

          if (!response.ok) throw await readManualFetchError(response)
        }, 'files-upload')
      }

      await listDirectory(currentRootId.value, currentPath.value)
    } catch (error: any) {
      fileError.value = error?.message ?? 'Upload failed.'
      throw error
    } finally {
      loadingFiles.value = false
    }
  }

  async function openDirectory(entry: FileEntry) {
    if (entry.type !== 'directory') return
    await listDirectory(currentRootId.value, entry.path)
  }

  async function copyPath(entry: FileEntry) {
    if (!import.meta.client) return false
    await navigator.clipboard?.writeText(entry.path)
    return true
  }

  return {
    roots,
    entries,
    directories,
    files,
    currentRootId,
    currentPath,
    loadingFiles,
    searchingFiles,
    fileError,
    loadRoots,
    listDirectory,
    searchWorkspaceFiles,
    statPath,
    createDirectory,
    downloadFile,
    uploadFiles,
    openDirectory,
    copyPath,
  }
}
