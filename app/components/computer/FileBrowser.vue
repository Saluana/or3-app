<template>
  <div class="or3-fb-root">
    <FileToolbar
      :roots="roots"
      :active-root="activeRoot"
      :current-path="currentPath"
      :search-open="searchOpen"
      :search-query="searchQuery"
      :search-mode="searchMode"
      :searching-files="searchingFiles"
      :is-writable-root="isWritableRoot"
      @back="goUp"
      @navigate="navigatePath"
      @switch-root="handleRootChange"
      @toggle-search="toggleSearch"
      @update:search-query="(value) => (searchQuery = value)"
      @update:search-mode="(mode) => switchMode(mode)"
      @submit-search="runSearch"
      @clear-search="clearSearch"
      @upload="openUploadPicker"
      @new-folder="newFolderOpen = true"
      @refresh="refresh"
      @open-terminal="openTerminalForCurrentFolder"
      @open-memory-tools="openMemoryTools"
    />

    <UInput
      ref="uploadInput"
      type="file"
      class="hidden"
      multiple
      aria-hidden="true"
      tabindex="-1"
      @change="handleUpload"
    />

    <DangerCallout v-if="fileError" tone="caution" title="File browser needs attention">
      {{ fileError }}
    </DangerCallout>

    <!-- Pairing required state -->
    <SurfaceCard
      v-if="!roots.length"
      class-name="text-center"
    >
      <div class="grid place-items-center gap-3 py-8">
        <RetroIcon name="i-pixelarticons-device-laptop" />
        <p class="font-mono text-sm font-semibold text-(--or3-text)">No paired computer</p>
        <p class="max-w-sm text-sm leading-6 text-(--or3-text-muted)">
          Pair this computer and allow file access in OR3 to browse its folders here.
        </p>
      </div>
    </SurfaceCard>

    <template v-else>
      <!-- Search results panel (only visible when search is active and used) -->
      <SurfaceCard
        v-if="showSearchResults"
        class-name="!p-0 overflow-hidden"
      >
        <div class="flex items-center justify-between border-b border-(--or3-border) px-3 py-2">
          <p class="text-[10px] font-semibold uppercase tracking-[0.18em] text-(--or3-text-muted)">
            {{ searchMode === 'path' ? 'Path lookup' : 'Search results' }}
          </p>
          <p class="text-[10px] text-(--or3-text-muted)">
            {{ searchResults.length }} match<span v-if="searchResults.length !== 1">es</span>
          </p>
        </div>
        <div v-if="searchResults.length" class="divide-y divide-(--or3-border) max-h-80 overflow-y-auto">
          <button
            v-for="item in searchResults"
            :key="`${item.root_id}:${item.path}`"
            type="button"
            class="block w-full px-3 py-2.5 text-left transition hover:bg-(--or3-green-soft)"
            @click="revealSearchResult(item)"
          >
            <p class="truncate font-mono text-sm font-semibold text-(--or3-text)" :title="item.name">
              {{ item.name }}
            </p>
            <p class="mt-0.5 truncate text-xs text-(--or3-text-muted)" :title="item.path">{{ item.path }}</p>
          </button>
        </div>
        <div v-else class="px-4 py-6 text-center text-sm text-(--or3-text-muted)">
          {{ searchMode === 'path'
              ? `No file or folder at "${searchQuery}".`
              : `No matches in ${searchScopeLabel}.` }}
        </div>
      </SurfaceCard>

      <!-- Directory listing -->
      <SurfaceCard class-name="!p-0 overflow-hidden">
        <div class="flex items-center justify-between border-b border-(--or3-border) px-3 py-2">
          <p class="truncate text-[10px] font-semibold uppercase tracking-[0.18em] text-(--or3-text-muted)" :title="entriesPanelTitle">
            {{ entriesPanelTitle }}
          </p>
          <span class="shrink-0 rounded-full border border-(--or3-border) bg-(--or3-surface-soft) px-2 py-0.5 text-[10px] text-(--or3-text-muted)">
            {{ isWritableRoot ? 'Writable' : 'Read only' }}
          </span>
        </div>

        <div v-if="loadingFiles" class="space-y-2 p-3">
          <div v-for="index in 5" :key="index" class="h-14 rounded-2xl bg-(--or3-surface-soft)" />
        </div>

        <template v-else-if="entries.length">
          <FileRow
            v-for="entry in entries"
            :key="entry.path"
            :entry="entry"
            :selected="selectedEntry?.path === entry.path"
            :can-edit="entry.type === 'file' && canEditFile(entry)"
            @open="openEntry"
            @details="showDetails"
            @edit="editEntry"
            @copy-path="copyEntryPath"
            @download="downloadEntry"
            @open-in-browser="openEntryInBrowser"
            @open-terminal="openTerminalAt"
            @ask="askAboutEntry"
          />
        </template>

        <div v-else class="px-4 py-8 text-center">
          <p class="font-mono text-sm font-semibold text-(--or3-text)">This folder is empty</p>
          <p class="mt-2 text-sm leading-6 text-(--or3-text-muted)">
            Upload files here or create a new folder to get started.
          </p>
          <div class="mt-4 flex flex-wrap justify-center gap-2">
            <UButton label="Upload files" icon="i-pixelarticons-upload" color="primary" :disabled="!isWritableRoot" @click="openUploadPicker" />
            <UButton label="New folder" icon="i-pixelarticons-folder-plus" color="neutral" variant="soft" :disabled="!isWritableRoot" @click="newFolderOpen = true" />
          </div>
        </div>
      </SurfaceCard>
    </template>

    <!-- File details slideover (bottom on mobile, right on desktop) -->
    <FileDetailsSheet
      v-model:open="detailsOpen"
      :entry="selectedEntry"
      :preview="preview"
      :actions="detailActions"
      :area-label="activeRoot?.label || currentRootId"
    />

    <!-- Memory tools slideover (extracted from the page) -->
    <MemoryToolsSheet
      v-model:open="memoryToolsOpen"
      :embeddings-status="embeddingsStatus"
      :audit-status="auditStatus"
      :memory-loading="memoryLoading"
      :memory-error="memoryError"
      :shortcuts="memoryShortcuts"
      @refresh-memory="handleRefreshMemory"
      @rebuild="handleRebuild"
      @refresh-audit="handleRefreshAudit"
      @verify-audit="handleVerifyAudit"
      @open-shortcut="openShortcut"
    />

    <!-- New folder modal -->
    <UModal v-model:open="newFolderOpen" :ui="{ content: 'sm:max-w-md' }">
      <template #content>
        <div class="space-y-4 p-5">
          <div>
            <p class="font-mono text-base font-semibold text-(--or3-text)">Create a new folder</p>
            <p class="mt-1 text-sm leading-6 text-(--or3-text-muted)">
              This creates a folder inside {{ currentPath === '.' ? activeRoot?.label || 'the current area' : currentPath }}.
            </p>
          </div>

          <UFormField label="Folder name" name="folder-name">
            <UInput v-model="newFolderName" placeholder="New folder" @keydown.enter.prevent="confirmCreateFolder" />
          </UFormField>

          <DangerCallout v-if="createFolderError" tone="caution" title="Could not create that folder">
            {{ createFolderError }}
          </DangerCallout>

          <div class="flex justify-end gap-2">
            <UButton label="Cancel" color="neutral" variant="ghost" @click="closeCreateFolder" />
            <UButton label="Create folder" color="primary" :loading="creatingFolder" @click="confirmCreateFolder" />
          </div>
        </div>
      </template>
    </UModal>
  </div>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, reactive, ref, watch } from 'vue'
import { navigateTo, useRoute, useRouter } from '#app'
import { useToast } from '@nuxt/ui/composables'
import type { FileEntry, FileSearchItem } from '~/types/or3-api'
import type { MemoryShortcut } from './MemoryToolsSheet.vue'
import { buildComputerEditorRoute } from '~/composables/useComputerEditorRoute'
import { programmaticSend } from '~/composables/useChatInputBridge'
import { useComputerFiles } from '~/composables/useComputerFiles'
import { useComputerTextFiles } from '~/composables/useComputerTextFiles'
import { useMemoryTrust } from '~/composables/useMemoryTrust'

type SearchMode = 'folder' | 'path'
type PreviewKind = 'empty' | 'text' | 'image' | 'unavailable'

const route = useRoute()
const router = useRouter()
const toast = useToast()
const { canEditFile } = useComputerTextFiles()

const files = useComputerFiles()
const {
  roots,
  entries,
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
  openDirectory,
  copyPath,
  uploadFiles,
} = files

const {
  embeddingsStatus,
  auditStatus,
  memoryLoading,
  memoryError,
  loadEmbeddingsStatus,
  rebuildEmbeddings,
  loadAuditStatus,
  verifyAudit,
} = useMemoryTrust()

// ── Local UI state ─────────────────────────────────────────────────
const selectedEntry = ref<FileEntry | null>(null)
const detailsOpen = ref(false)
const memoryToolsOpen = ref(false)
let memoryToolsLoaded = false
async function openMemoryTools() {
  memoryToolsOpen.value = true
  if (memoryToolsLoaded) return
  memoryToolsLoaded = true
  await Promise.allSettled([loadAuditStatus().catch(() => undefined), loadMemoryShortcuts().catch(() => undefined)])
}
const uploadInput = ref<{ inputRef?: HTMLInputElement | null } | null>(null)
const searchOpen = ref(false)
const searchQuery = ref('')
const searchMode = ref<SearchMode>('folder')
const searchResults = ref<FileSearchItem[]>([])
const searchTouched = ref(false)
const newFolderOpen = ref(false)
const newFolderName = ref('')
const creatingFolder = ref(false)
const createFolderError = ref<string | null>(null)
const previewLoading = ref(false)
const openingFile = ref(false)
const memoryShortcuts = ref<MemoryShortcut[]>([])

const preview = reactive<{ kind: PreviewKind; text: string; url: string; message: string; loading: boolean }>({
  kind: 'empty',
  text: '',
  url: '',
  message: '',
  loading: false,
})

// ── Computed ────────────────────────────────────────────────────────
const activeRoot = computed(() => roots.value.find((root) => root.id === currentRootId.value) ?? null)
const isWritableRoot = computed(() => Boolean(activeRoot.value?.writable))
const showSearchResults = computed(() => searchOpen.value && searchTouched.value)
const entriesPanelTitle = computed(() =>
  currentPath.value === '.' || !currentPath.value ? `Top of ${activeRoot.value?.label || 'this area'}` : currentPath.value,
)
const searchScopeLabel = computed(() => {
  const area = activeRoot.value?.label || 'this area'
  if (searchMode.value !== 'folder' || currentPath.value === '.' || !currentPath.value) return area
  return `${area}/${currentPath.value}`
})

// Detail sheet actions are computed so labels/loading reflect entry type.
const detailActions = computed(() => {
  if (!selectedEntry.value) return []
  const entry = selectedEntry.value
  const isDir = entry.type === 'directory'
  const list: Array<{ id: string; label: string; icon: string; loading?: boolean; onSelect: () => void }> = []

  if (isDir) {
    list.push({ id: 'open', label: 'Open', icon: 'i-pixelarticons-folder', onSelect: () => openSelectedDirectory() })
  } else {
    list.push({ id: 'preview', label: 'Open', icon: 'i-pixelarticons-eye', loading: openingFile.value, onSelect: () => openEntryInBrowser(entry) })
    if (canEditFile(entry)) {
      list.push({ id: 'edit', label: 'Edit', icon: 'i-pixelarticons-edit', onSelect: () => editEntry(entry) })
    }
    list.push({ id: 'download', label: 'Download', icon: 'i-pixelarticons-download', loading: previewLoading.value, onSelect: () => downloadEntry(entry) })
  }

  list.push(
    { id: 'copy', label: 'Copy path', icon: 'i-pixelarticons-copy', onSelect: () => copyEntryPath(entry) },
    { id: 'terminal', label: 'Terminal', icon: 'i-pixelarticons-terminal', onSelect: () => openTerminalAt(entry) },
    { id: 'ask', label: 'Ask AI', icon: 'i-pixelarticons-message-text', onSelect: () => askAboutEntry(entry) },
  )

  return list
})

// ── Helpers ────────────────────────────────────────────────────────
function isTextLikeFile(entry: Pick<FileEntry, 'name' | 'mime_type'>) {
  const mime = entry.mime_type?.toLowerCase() || ''
  if (mime.startsWith('text/')) return true
  if (mime.includes('json') || mime.includes('xml') || mime.includes('javascript')) return true
  return /\.(md|txt|json|ya?ml|toml|ini|cfg|conf|env|csv|ts|tsx|js|jsx|vue|go|py|rb|php|java|kt|swift|sql|html|css|scss|sh)$/i.test(entry.name)
}

function isImageLikeFile(entry: Pick<FileEntry, 'name' | 'mime_type'>) {
  const mime = entry.mime_type?.toLowerCase() || ''
  return mime.startsWith('image/') || /\.(png|jpe?g|gif|webp|svg)$/i.test(entry.name)
}

function todayStamp(offsetDays = 0) {
  const date = new Date()
  date.setHours(12, 0, 0, 0)
  date.setDate(date.getDate() + offsetDays)
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function parentPath(path: string) {
  const parts = path.split('/').filter(Boolean)
  if (parts.length <= 1) return '.'
  parts.pop()
  return parts.join('/')
}

function resetPreview() {
  if (preview.url) URL.revokeObjectURL(preview.url)
  preview.kind = 'empty'
  preview.text = ''
  preview.url = ''
  preview.message = ''
  preview.loading = false
}

async function syncRoute(rootId = currentRootId.value, path = currentPath.value) {
  await router.replace({
    path: '/computer/files',
    query: { ...route.query, root: rootId, path },
  })
}

// ── Navigation ─────────────────────────────────────────────────────
async function refresh() {
  try {
    await loadRoots()
  } catch {
    return
  }
  if (!roots.value.length) return
  const rootId = roots.value.find((root) => root.id === currentRootId.value)?.id || roots.value[0]?.id
  if (!rootId) return
  const path = typeof route.query.path === 'string' && route.query.path.trim() ? route.query.path : currentPath.value || '.'
  await listDirectory(rootId, path).catch(async () => {
    await listDirectory(rootId, '.').catch(() => undefined)
  })
  await syncRoute()
}

async function handleRootChange(rootId: string) {
  if (!rootId || rootId === currentRootId.value) return
  clearSearch()
  selectedEntry.value = null
  resetPreview()
  await listDirectory(rootId, '.').catch(() => undefined)
  await syncRoute(rootId, '.')
  if (memoryToolsLoaded) await loadMemoryShortcuts().catch(() => undefined)
}

async function navigatePath(path: string) {
  selectedEntry.value = null
  resetPreview()
  await listDirectory(currentRootId.value, path).catch(() => undefined)
  await syncRoute(currentRootId.value, path)
}

async function goUp() {
  if (!currentPath.value || currentPath.value === '.') return
  await navigatePath(parentPath(currentPath.value))
}

// ── Entries ────────────────────────────────────────────────────────
async function openEntry(entry: FileEntry) {
  if (entry.type === 'directory') {
    selectedEntry.value = null
    resetPreview()
    await openDirectory(entry).catch(() => undefined)
    await syncRoute(currentRootId.value, entry.path)
    return
  }
  await showDetails(entry)
}

async function showDetails(entry: FileEntry) {
  selectedEntry.value = entry
  detailsOpen.value = true
  if (entry.type === 'file') await loadPreview(entry)
  else resetPreview()
}

function editEntry(entry: FileEntry) {
  if (entry.type !== 'file' || !canEditFile(entry)) return
  void navigateTo(buildComputerEditorRoute({
    rootId: currentRootId.value,
    path: entry.path,
    returnRootId: currentRootId.value,
    returnPath: currentPath.value,
  }))
}

async function copyEntryPath(entry: FileEntry) {
  const ok = await copyPath(entry).catch(() => false)
  toast.add({
    title: ok ? 'Path copied' : 'Could not copy path',
    description: ok ? entry.path : 'Clipboard access is not available here.',
    color: ok ? 'success' : 'warning',
    icon: ok ? 'i-pixelarticons-check' : 'i-pixelarticons-alert',
  })
}

async function downloadEntry(entry: FileEntry) {
  if (entry.type !== 'file' || !import.meta.client) return
  try {
    const blob = await downloadFile(entry)
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = entry.name || 'download'
    link.click()
    setTimeout(() => URL.revokeObjectURL(url), 1000)
    toast.add({ title: 'Download started', description: entry.name, color: 'success', icon: 'i-pixelarticons-download' })
  } catch (error: any) {
    toast.add({ title: 'Download failed', description: error?.message || 'Could not download that file.', color: 'error', icon: 'i-pixelarticons-alert' })
  }
}

async function openEntryInBrowser(entry: FileEntry) {
  if (entry.type !== 'file' || !import.meta.client) return
  openingFile.value = true
  try {
    const blob = await downloadFile(entry)
    const url = URL.createObjectURL(blob)
    window.open(url, '_blank', 'noopener,noreferrer')
    setTimeout(() => URL.revokeObjectURL(url), 60_000)
  } catch (error: any) {
    toast.add({ title: 'Could not open file', description: error?.message || 'Try again.', color: 'error', icon: 'i-pixelarticons-alert' })
  } finally {
    openingFile.value = false
  }
}

function openTerminalAt(entry: FileEntry) {
  const path = entry.type === 'directory' ? entry.path : parentPath(entry.path)
  void navigateTo({ path: '/computer/terminal', query: { root: currentRootId.value, path } })
}

function openTerminalForCurrentFolder() {
  void navigateTo({ path: '/computer/terminal', query: { root: currentRootId.value, path: currentPath.value } })
}

function askAboutEntry(entry: FileEntry) {
  void programmaticSend('main', `Help me understand this file on my computer: ${entry.path}`)
}

async function openSelectedDirectory() {
  if (!selectedEntry.value || selectedEntry.value.type !== 'directory') return
  detailsOpen.value = false
  await openEntry(selectedEntry.value)
}

// ── Search ─────────────────────────────────────────────────────────
function toggleSearch() {
  searchOpen.value = !searchOpen.value
  if (!searchOpen.value) clearSearch()
}

function switchMode(mode: SearchMode) {
  searchMode.value = mode
  searchResults.value = []
  searchTouched.value = false
}

function clearSearch() {
  searchQuery.value = ''
  searchResults.value = []
  searchTouched.value = false
}

async function runSearch() {
  const query = searchQuery.value.trim()
  searchTouched.value = true
  if (!query) {
    searchResults.value = []
    return
  }

  if (searchMode.value === 'path') {
    const item = await statPath(currentRootId.value, query).catch(() => null)
    searchResults.value = item
      ? [{
          root_id: currentRootId.value,
          name: item.name,
          path: item.path,
          type: item.type,
          mime_type: item.mime_type,
          size: item.size,
          modified_at: item.modified_at,
        } as FileSearchItem]
      : []
    return
  }

  // 'folder' mode: ask the server, then filter client-side to current subtree.
  const remote = await searchWorkspaceFiles(query, 50, currentRootId.value).catch(() => [] as FileSearchItem[])
  if (!currentPath.value || currentPath.value === '.') {
    searchResults.value = remote
    return
  }
  const prefix = currentPath.value.endsWith('/') ? currentPath.value : `${currentPath.value}/`
  searchResults.value = remote.filter((item) => item.path === currentPath.value || item.path.startsWith(prefix))
}

async function revealFile(rootId: string, path: string, type: 'file' | 'directory') {
  if (type === 'directory') {
    selectedEntry.value = null
    resetPreview()
    await listDirectory(rootId, path).catch(() => undefined)
    await syncRoute(rootId, path)
    return
  }
  const folder = parentPath(path)
  await listDirectory(rootId, folder).catch(() => undefined)
  await syncRoute(rootId, folder)
  const match = entries.value.find((entry) => entry.path === path)
  if (match) await showDetails(match)
}

async function revealSearchResult(item: FileSearchItem) {
  await revealFile(item.root_id, item.path, item.type)
  // Auto-collapse the search bar after a successful jump.
  searchOpen.value = false
}

// Debounced live search as the user types. Path mode is intentionally manual
// (Enter) since stat-on-keystroke would be wasteful.
let searchTimer: ReturnType<typeof setTimeout> | null = null
watch(searchQuery, (value) => {
  if (searchMode.value === 'path') return
  if (searchTimer) clearTimeout(searchTimer)
  if (!value.trim()) {
    searchResults.value = []
    searchTouched.value = false
    return
  }
  searchTimer = setTimeout(() => {
    void runSearch()
  }, 200)
})

// ── Memory tools ───────────────────────────────────────────────────
async function loadMemoryShortcuts() {
  const workspaceRoot = roots.value.find((root) => root.id === 'workspace')
  if (!workspaceRoot) {
    memoryShortcuts.value = []
    return
  }
  const candidates = [
    { label: 'Long-term memory', description: "OR3's durable note.", path: 'MEMORY.md' },
    { label: 'Today note', description: "Today's daily memory log.", path: `memory/${todayStamp(0)}.md` },
    { label: 'Yesterday note', description: "Yesterday's daily memory log.", path: `memory/${todayStamp(-1)}.md` },
    { label: 'Memory folder', description: 'All daily notes and support files.', path: 'memory' },
    { label: 'Identity note', description: 'Assistant identity and behavior guide.', path: 'SOUL.md' },
    { label: 'User note', description: 'Human context note read at startup.', path: 'USER.md' },
  ] as const

  const resolved = await Promise.all(candidates.map(async (candidate): Promise<MemoryShortcut | null> => {
    const item = await statPath('workspace', candidate.path)
    if (!item) return null
    return {
      label: candidate.label,
      description: candidate.description,
      path: candidate.path,
      type: item.type,
      rootId: 'workspace',
    } satisfies MemoryShortcut
  }))
  memoryShortcuts.value = resolved.filter((item): item is MemoryShortcut => item !== null)
}

async function openShortcut(shortcut: MemoryShortcut) {
  memoryToolsOpen.value = false
  await revealFile(shortcut.rootId, shortcut.path, shortcut.type)
}

async function handleRefreshMemory() {
  await Promise.allSettled([loadEmbeddingsStatus(), loadAuditStatus()])
}

async function handleRebuild(target: 'memory' | 'docs') {
  try {
    await rebuildEmbeddings(target)
    toast.add({
      title: target === 'memory' ? 'Notes re-scanned' : 'Documents re-scanned',
      description: target === 'memory' ? 'The memory index was rebuilt for saved notes.' : 'The document index was rebuilt for approved document roots.',
      color: 'success',
      icon: 'i-pixelarticons-check',
    })
  } catch {
    /* surfaced in composable */
  }
}

async function handleRefreshAudit() {
  await loadAuditStatus().catch(() => undefined)
}

async function handleVerifyAudit() {
  try {
    await verifyAudit()
    toast.add({ title: 'Activity log verified', description: 'The audit chain passed its integrity check.', color: 'success', icon: 'i-pixelarticons-check-double' })
  } catch {
    /* surfaced in composable */
  }
}

// ── Upload + folder creation ───────────────────────────────────────
function openUploadPicker() {
  uploadInput.value?.inputRef?.click()
}

async function handleUpload(event: Event) {
  const input = event.target as HTMLInputElement
  if (!input.files?.length) return
  try {
    const count = input.files.length
    await uploadFiles(input.files)
    toast.add({
      title: 'Upload complete',
      description: `${count} file${count === 1 ? '' : 's'} added to this folder.`,
      color: 'success',
      icon: 'i-pixelarticons-check',
    })
  } catch {
    /* surfaced via fileError */
  } finally {
    input.value = ''
  }
}

function closeCreateFolder() {
  newFolderOpen.value = false
  newFolderName.value = ''
  createFolderError.value = null
}

async function confirmCreateFolder() {
  const name = newFolderName.value.trim()
  if (!name) {
    createFolderError.value = 'Choose a folder name first.'
    return
  }
  creatingFolder.value = true
  createFolderError.value = null
  try {
    await createDirectory(name)
    toast.add({ title: 'Folder created', description: `${name} is ready.`, color: 'success', icon: 'i-pixelarticons-check' })
    closeCreateFolder()
  } catch (error: any) {
    createFolderError.value = error?.message ?? 'Could not create that folder.'
  } finally {
    creatingFolder.value = false
  }
}

// ── Preview loader ─────────────────────────────────────────────────
async function loadPreview(entry: FileEntry) {
  resetPreview()
  if (entry.type !== 'file') return
  if ((entry.size || 0) > 512 * 1024 && !isImageLikeFile(entry)) {
    preview.kind = 'unavailable'
    preview.message = 'This file is larger than the inline preview limit. Download or open it in your browser instead.'
    return
  }

  preview.loading = true
  previewLoading.value = true
  try {
    const blob = await downloadFile(entry)
    if (isImageLikeFile(entry)) {
      preview.kind = 'image'
      preview.url = URL.createObjectURL(blob)
      return
    }
    if (isTextLikeFile(entry)) {
      const text = await blob.text()
      preview.kind = 'text'
      preview.text = text.length > 12000 ? `${text.slice(0, 12000)}\n\n[Preview truncated]` : text
      return
    }
    preview.kind = 'unavailable'
    preview.message = 'Preview is not shown for this file type yet. Use Download or Open in browser.'
  } catch (error: any) {
    preview.kind = 'unavailable'
    preview.message = error?.message ?? 'Could not load a preview for this file.'
  } finally {
    preview.loading = false
    previewLoading.value = false
  }
}

// ── Lifecycle ──────────────────────────────────────────────────────
onMounted(async () => {
  await refresh().catch(() => undefined)
  const rootFromQuery = typeof route.query.root === 'string' ? route.query.root : ''
  const pathFromQuery = typeof route.query.path === 'string' ? route.query.path : ''
  if (rootFromQuery && roots.value.some((root) => root.id === rootFromQuery)) {
    await listDirectory(rootFromQuery, pathFromQuery || '.').catch(() => undefined)
    await syncRoute(rootFromQuery, currentPath.value)
  }
  await Promise.allSettled([loadEmbeddingsStatus().catch(() => undefined)])
})

onBeforeUnmount(() => {
  if (searchTimer) clearTimeout(searchTimer)
  resetPreview()
})
</script>

<style scoped>
.or3-fb-root {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
  min-width: 0;
  /* Containment so a long preview line inside a card never blows the page width. */
  overflow-x: clip;
}
</style>
