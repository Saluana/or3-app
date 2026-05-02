import { computed } from 'vue'
import { navigateTo } from '#app'
import type { FileEntry, FileListResponse, FileRoot } from '~/types/or3-api'
import { useActiveHost } from './useActiveHost'
import { useAuthSession } from './useAuthSession'
import { useChatSessions } from './useChatSessions'
import { useComputerTextFiles } from './useComputerTextFiles'
import { useLocalCache } from './useLocalCache'
import { useOr3Api } from './useOr3Api'

const PROMPTS_ROOT_ID = 'workspace'
const PROMPTS_DIRECTORY = '.prompts'

interface FileRootsResponse {
  items?: FileRoot[]
}

interface FileStatResponse {
  item?: FileEntry
  root_id?: string
}

export interface PromptFileSummary {
  path: string
  name: string
  title: string
  preview: string
  updatedAt?: string
  size?: number
  favorite: boolean
  isDefault: boolean
}

export interface PromptPreferences {
  favorites: string[]
  defaultPath: string | null
}

export function extractPromptTitleAndPreview(markdown: string) {
  const source = typeof markdown === 'string' ? markdown : ''
  const lines = source.split(/\r?\n/)
  const heading = lines.find((line) => /^#\s+/.test(line.trim()))?.replace(/^#\s+/, '').trim()
  const paragraphs = lines.map((line) => line.trim()).filter(Boolean)
  const firstLine = paragraphs[0] || 'Untitled prompt'
  const title = heading || firstLine.slice(0, 80)
  const previewSource = paragraphs.find((line) => line !== heading && line !== firstLine) || paragraphs[1] || ''
  const preview = previewSource ? previewSource.slice(0, 180) : 'No preview yet.'
  return {
    title: title || 'Untitled prompt',
    preview,
  }
}

export function createPromptSlug(input: string) {
  const normalized = input
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
  return normalized || 'untitled-prompt'
}

export function promptPathForSlug(slug: string) {
  return `${PROMPTS_DIRECTORY}/${createPromptSlug(slug)}.md`
}

function promptPreferencesKey(hostId: string | null | undefined) {
  return `prompts:${hostId || 'local'}`
}

export function usePromptFiles() {
  const api = useOr3Api()
  const authSession = useAuthSession()
  const cache = useLocalCache()
  const { activeHost } = useActiveHost()
  const { draft, ensureSession } = useChatSessions()
  const { readTextFile, writeTextFile } = useComputerTextFiles()

  const preferences = computed<PromptPreferences>(() => {
    const key = promptPreferencesKey(activeHost.value?.id)
    const raw = cache.state.value.preferences[key]
    if (!raw || typeof raw !== 'object') {
      return { favorites: [], defaultPath: null }
    }
    const favorites = Array.isArray((raw as PromptPreferences).favorites)
      ? (raw as PromptPreferences).favorites.filter((value): value is string => typeof value === 'string')
      : []
    const defaultPath = typeof (raw as PromptPreferences).defaultPath === 'string'
      ? (raw as PromptPreferences).defaultPath
      : null
    return { favorites, defaultPath }
  })

  function savePreferences(nextValue: PromptPreferences) {
    cache.state.value.preferences[promptPreferencesKey(activeHost.value?.id)] = nextValue
    cache.persist()
  }

  async function request<T>(path: string, init?: { method?: 'GET' | 'POST'; body?: unknown }, action = 'prompts') {
    return await authSession.retryWithAuth((onAuthChallenge) => api.request<T>(path, {
      method: init?.method,
      body: init?.body,
      onAuthChallenge,
    }), action)
  }

  async function getWorkspaceRoot() {
    const response = await request<FileRootsResponse | FileRoot[]>('/internal/v1/files/roots', undefined, 'prompts-roots')
    const items = Array.isArray(response) ? response : response.items ?? []
    const workspaceRoot = items.find((root) => root.id === PROMPTS_ROOT_ID)
    if (!workspaceRoot) {
      throw new Error('This computer does not expose a writable workspace root for prompts.')
    }
    return workspaceRoot
  }

  async function statPromptPath(path: string) {
    const params = new URLSearchParams({ root_id: PROMPTS_ROOT_ID, path })
    try {
      const response = await request<FileStatResponse>(`/internal/v1/files/stat?${params.toString()}`, undefined, 'prompts-stat')
      return response.item ?? null
    } catch {
      return null
    }
  }

  async function ensurePromptFolder() {
    const workspaceRoot = await getWorkspaceRoot()
    const existing = await statPromptPath(PROMPTS_DIRECTORY)
    if (existing?.type === 'directory') return workspaceRoot
    if (existing?.type === 'file') {
      throw new Error('A file named .prompts already exists in the workspace root.')
    }
    await request('/internal/v1/files/mkdir', {
      method: 'POST',
      body: { root_id: PROMPTS_ROOT_ID, path: '.', name: PROMPTS_DIRECTORY },
    }, 'prompts-create-folder')
    return workspaceRoot
  }

  async function listPromptFiles(search = ''): Promise<PromptFileSummary[]> {
    await ensurePromptFolder()
    const params = new URLSearchParams({ root_id: PROMPTS_ROOT_ID, path: PROMPTS_DIRECTORY })
    const response = await request<FileListResponse>(`/internal/v1/files/list?${params.toString()}`, undefined, 'prompts-list')
    const favorites = new Set(preferences.value.favorites)
    const searchQuery = search.trim().toLowerCase()

    const prompts = await Promise.all((response.entries ?? [])
      .filter((entry) => entry.type === 'file' && /\.(md|markdown|txt)$/i.test(entry.name))
      .map(async (entry) => {
        const document = await readTextFile({ rootId: PROMPTS_ROOT_ID, path: entry.path })
        const meta = extractPromptTitleAndPreview(document.content)
        return {
          path: entry.path,
          name: entry.name,
          title: meta.title,
          preview: meta.preview,
          updatedAt: entry.modified_at,
          size: entry.size,
          favorite: favorites.has(entry.path),
          isDefault: preferences.value.defaultPath === entry.path,
        } satisfies PromptFileSummary
      }))

    return prompts
      .filter((item) => {
        if (!searchQuery) return true
        return [item.title, item.preview, item.name, item.path].some((value) => value.toLowerCase().includes(searchQuery))
      })
      .sort((left, right) => {
        if (left.favorite !== right.favorite) return left.favorite ? -1 : 1
        return (right.updatedAt || '').localeCompare(left.updatedAt || '')
      })
  }

  async function readPrompt(path: string) {
    const document = await readTextFile({ rootId: PROMPTS_ROOT_ID, path })
    const meta = extractPromptTitleAndPreview(document.content)
    return {
      ...document,
      title: meta.title,
      preview: meta.preview,
    }
  }

  async function createPrompt(options?: { title?: string; content?: string }) {
    const initialTitle = options?.title?.trim() || 'Untitled prompt'
    const initialContent = options?.content?.trim() || `# ${initialTitle}\n\n`
    const existing = await listPromptFiles()
    const existingPaths = new Set(existing.map((item) => item.path))

    const baseSlug = createPromptSlug(initialTitle)
    let nextPath = promptPathForSlug(baseSlug)
    let suffix = 2
    while (existingPaths.has(nextPath)) {
      nextPath = promptPathForSlug(`${baseSlug}-${suffix}`)
      suffix += 1
    }

    await writeTextFile({
      rootId: PROMPTS_ROOT_ID,
      path: nextPath,
      content: initialContent,
      create: true,
    })

    return nextPath
  }

  async function savePrompt(path: string, content: string, expectedRevision?: string, create = false) {
    return await writeTextFile({
      rootId: PROMPTS_ROOT_ID,
      path,
      content,
      expectedRevision: create ? undefined : expectedRevision,
      create,
    })
  }

  function toggleFavorite(path: string) {
    const nextFavorites = new Set(preferences.value.favorites)
    if (nextFavorites.has(path)) nextFavorites.delete(path)
    else nextFavorites.add(path)
    savePreferences({
      ...preferences.value,
      favorites: [...nextFavorites],
    })
  }

  function setDefaultPrompt(path: string | null) {
    savePreferences({
      ...preferences.value,
      defaultPath: path,
    })
  }

  async function usePromptInChat(content: string) {
    ensureSession()
    await navigateTo('/')
    draft.value = content
  }

  return {
    promptDirectory: PROMPTS_DIRECTORY,
    preferences,
    ensurePromptFolder,
    listPromptFiles,
    readPrompt,
    createPrompt,
    savePrompt,
    toggleFavorite,
    setDefaultPrompt,
    usePromptInChat,
  }
}