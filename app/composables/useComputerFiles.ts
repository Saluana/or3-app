import { computed, ref } from 'vue'
import type { FileEntry, FileListResponse, FileRoot, FileSearchItem, FileSearchResponse } from '~/types/or3-api'
import { useOr3Api } from './useOr3Api'
import { useActiveHost } from './useActiveHost'

const roots = ref<FileRoot[]>([])
const entries = ref<FileEntry[]>([])
const currentRootId = ref<string>('home')
const currentPath = ref<string>('.')
const loadingFiles = ref(false)
const searchingFiles = ref(false)
const fileError = ref<string | null>(null)

const fallbackRoots: FileRoot[] = [
  { id: 'home', label: 'Home Folder', path: '~', writable: true },
  { id: 'workspace', label: 'Workspace', path: 'current project', writable: true },
]

const fallbackEntries: FileEntry[] = [
  { name: 'or3-intern', path: 'or3-intern', type: 'directory', modified_at: 'Today' },
  { name: 'Memory_Model.pdf', path: 'Memory_Model.pdf', type: 'file', size: 1240000, modified_at: 'Yesterday', mime_type: 'application/pdf' },
  { name: 'or3-intern-spec.md', path: 'or3-intern-spec.md', type: 'file', size: 42000, modified_at: 'May 20', mime_type: 'text/markdown' },
]

export function useComputerFiles() {
  const api = useOr3Api()
  const directories = computed(() => entries.value.filter((entry) => entry.type === 'directory'))
  const files = computed(() => entries.value.filter((entry) => entry.type === 'file'))

  async function loadRoots() {
    fileError.value = null
    try {
      const response = await api.request<{ items?: FileRoot[] } | FileRoot[]>('/internal/v1/files/roots')
      roots.value = Array.isArray(response) ? response : response.items ?? []
      currentRootId.value = roots.value[0]?.id ?? 'home'
    } catch {
      roots.value = fallbackRoots
      fileError.value = 'File API is not available yet. Showing a safe demo browser until the or3-intern file extension is enabled.'
    }
  }

  async function listDirectory(rootId = currentRootId.value, path = currentPath.value) {
    loadingFiles.value = true
    fileError.value = null
    currentRootId.value = rootId
    currentPath.value = path
    try {
      const params = new URLSearchParams({ root_id: rootId, path })
      const response = await api.request<FileListResponse>(`/internal/v1/files/list?${params.toString()}`)
      entries.value = response.entries
    } catch {
      entries.value = fallbackEntries
      fileError.value = 'File browsing is using demo data until the or3-intern file API extension is running.'
    } finally {
      loadingFiles.value = false
    }
  }

  async function searchWorkspaceFiles(query: string, limit = 12) {
    searchingFiles.value = true
    fileError.value = null
    try {
      const params = new URLSearchParams({ q: query.trim(), limit: String(limit) })
      const response = await api.request<FileSearchResponse>(`/internal/v1/files/search?${params.toString()}`)
      return response.items ?? []
    } catch {
      const lowerQuery = query.trim().toLowerCase()
      fileError.value = 'File search is using local demo results until the or3-intern file API is running.'
      return fallbackEntries
        .filter((entry): entry is FileEntry & { type: 'file' } => entry.type === 'file')
        .filter((entry) => !lowerQuery || entry.name.toLowerCase().includes(lowerQuery) || entry.path.toLowerCase().includes(lowerQuery))
        .slice(0, limit)
        .map((entry): FileSearchItem => ({ ...entry, root_id: 'workspace', root_label: 'Workspace' }))
    } finally {
      searchingFiles.value = false
    }
  }

  async function uploadFiles(filesToUpload: FileList | File[]) {
    if (!filesToUpload.length) return
    loadingFiles.value = true
    fileError.value = null

    try {
      const selectedFiles = Array.from(filesToUpload)
      for (const file of selectedFiles) {
        const formData = new FormData()
        formData.set('root_id', currentRootId.value)
        formData.set('path', currentPath.value)
        formData.set('file', file)

        const headers: Record<string, string> = { Accept: 'application/json' }
        const token = useActiveHost().activeHost.value?.token
        if (token) headers.Authorization = `Bearer ${token}`

        const response = await fetch(api.buildUrl('/internal/v1/files/upload'), {
          method: 'POST',
          headers,
          body: formData,
        })

        if (!response.ok) {
          const payload = await response.text().catch(() => '')
          throw new Error(payload || 'Upload failed')
        }
      }

      await listDirectory(currentRootId.value, currentPath.value)
    } catch (error) {
      fileError.value = error instanceof Error ? error.message : 'Upload failed.'
    } finally {
      loadingFiles.value = false
    }
  }

  function openDirectory(entry: FileEntry) {
    if (entry.type !== 'directory') return
    void listDirectory(currentRootId.value, entry.path)
  }

  function copyPath(entry: FileEntry) {
    if (import.meta.client) void navigator.clipboard?.writeText(entry.path)
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
    uploadFiles,
    openDirectory,
    copyPath,
  }
}
