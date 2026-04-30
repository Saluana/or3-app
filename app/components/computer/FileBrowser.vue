<template>
  <div class="space-y-4">
    <SurfaceCard class-name="space-y-4">
      <div class="flex items-start gap-3">
        <RetroIcon name="i-pixelarticons-database" />
        <div>
          <p class="font-mono text-base font-semibold text-(--or3-text)">Memories stay searchable</p>
          <p class="mt-1 text-sm leading-6 text-(--or3-text-muted)">
            Check whether OR3's memory index is healthy, re-scan when you've changed a lot of notes, and jump straight into the files it relies on.
          </p>
        </div>
      </div>

      <div class="grid gap-3 lg:grid-cols-2">
        <div class="rounded-2xl border border-(--or3-border) bg-white/70 p-4">
          <p class="or3-label text-xs font-semibold">Memory index</p>
          <p class="mt-2 font-mono text-sm font-semibold text-(--or3-text)">{{ embeddingStatusTitle }}</p>
          <p class="mt-1 text-sm leading-6 text-(--or3-text-muted)">{{ embeddingStatusDescription }}</p>
          <div class="mt-3 flex flex-wrap gap-2">
            <UButton label="Refresh" icon="i-pixelarticons-reload" color="neutral" variant="soft" :loading="memoryLoading" @click="handleRefreshMemory" />
            <UButton label="Re-scan notes" icon="i-pixelarticons-database" color="primary" :loading="memoryLoading" @click="handleRebuild('memory')" />
            <UButton label="Re-scan documents" icon="i-pixelarticons-files" color="neutral" variant="soft" :loading="memoryLoading" @click="handleRebuild('docs')" />
          </div>
        </div>

        <div class="rounded-2xl border border-(--or3-border) bg-white/70 p-4">
          <p class="or3-label text-xs font-semibold">Activity log</p>
          <p class="mt-2 font-mono text-sm font-semibold text-(--or3-text)">{{ auditStatusTitle }}</p>
          <p class="mt-1 text-sm leading-6 text-(--or3-text-muted)">{{ auditStatusDescription }}</p>
          <div class="mt-3 flex flex-wrap gap-2">
            <UButton label="Refresh" icon="i-pixelarticons-shield" color="neutral" variant="soft" :loading="memoryLoading" @click="handleRefreshAudit" />
            <UButton label="Verify log" icon="i-pixelarticons-check-double" color="primary" :loading="memoryLoading" @click="handleVerifyAudit" />
            <UButton label="Open memory tools" icon="i-pixelarticons-link" to="/memory" color="neutral" variant="ghost" />
          </div>
        </div>
      </div>

      <div v-if="memoryShortcuts.length" class="space-y-2">
        <p class="or3-label text-xs font-semibold">Memory shortcuts</p>
        <div class="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
          <button
            v-for="shortcut in memoryShortcuts"
            :key="shortcut.path"
            type="button"
            class="rounded-2xl border border-(--or3-border) bg-white/70 p-3 text-left transition hover:border-(--or3-green) hover:bg-(--or3-green-soft)"
            @click="openShortcut(shortcut)"
          >
            <p class="font-mono text-sm font-semibold text-(--or3-text)">{{ shortcut.label }}</p>
            <p class="mt-1 text-xs leading-5 text-(--or3-text-muted)">{{ shortcut.description }}</p>
          </button>
        </div>
      </div>

      <DangerCallout v-if="memoryError" tone="caution" title="Memory tools need attention">
        {{ memoryError }}
      </DangerCallout>

      <details class="rounded-2xl border border-(--or3-border) bg-white/70 p-3">
        <summary class="cursor-pointer select-none text-xs font-semibold uppercase tracking-wide text-(--or3-text-muted)">Show technical details</summary>
        <pre class="mt-2 max-h-64 overflow-auto whitespace-pre-wrap text-xs text-(--or3-text-muted)">{{ memoryDebugDetails }}</pre>
      </details>
    </SurfaceCard>

    <SurfaceCard class-name="space-y-4">
      <div class="flex items-start justify-between gap-3">
        <div>
          <p class="font-mono text-base font-semibold text-(--or3-text)">Browse your computer</p>
          <p class="mt-1 text-sm leading-6 text-(--or3-text-muted)">
            Open approved folders, preview common file types, and hand anything off to the assistant without guessing paths.
          </p>
        </div>
        <UInput ref="uploadInput" type="file" class="hidden" multiple aria-hidden="true" tabindex="-1" @change="handleUpload" />
      </div>

      <div v-if="!roots.length" class="rounded-2xl border border-dashed border-(--or3-border) bg-white/60 px-4 py-6 text-center text-sm leading-6 text-(--or3-text-muted)">
        Pair this computer and allow file access in OR3 to browse its folders here.
      </div>

      <template v-else>
        <div class="grid gap-3 lg:grid-cols-[minmax(0,15rem)_minmax(0,1fr)]">
          <UFormField label="Area" name="root" description="Only approved locations show up here.">
            <USelectMenu
              :model-value="currentRootId"
              value-key="id"
              :items="roots"
              :disabled="loadingFiles"
              @update:model-value="handleRootChange"
            >
              <template #default>
                <span>{{ activeRoot?.label || 'Select an area' }}</span>
              </template>
            </USelectMenu>
          </UFormField>

          <UFormField label="Search this area" name="search" description="Find a file by name or path.">
            <div class="flex gap-2">
              <UInput v-model="searchQuery" class="flex-1" placeholder="Search files..." @keydown.enter.prevent="runSearch" />
              <UButton label="Search" icon="i-pixelarticons-search" color="primary" :loading="searchingFiles" @click="runSearch" />
              <UButton v-if="searchQuery || searchResults.length" label="Clear" color="neutral" variant="ghost" @click="clearSearch" />
            </div>
          </UFormField>
        </div>

        <div class="flex flex-wrap gap-2">
          <UButton label="Upload files" icon="i-pixelarticons-upload" color="neutral" variant="soft" :disabled="!isWritableRoot" :loading="loadingFiles" @click="openUploadPicker" />
          <UButton label="New folder" icon="i-pixelarticons-folder-plus" color="neutral" variant="soft" :disabled="!isWritableRoot" :loading="creatingFolder" @click="newFolderOpen = true" />
          <UButton label="Refresh" icon="i-pixelarticons-reload" color="neutral" variant="ghost" :loading="loadingFiles" @click="refresh" />
          <UButton label="Open terminal here" icon="i-pixelarticons-terminal" color="neutral" variant="ghost" @click="openTerminalForCurrentFolder" />
        </div>

        <div class="rounded-2xl border border-(--or3-border) bg-white/60 px-3 py-2">
          <div class="flex flex-wrap items-center justify-between gap-2">
            <FileBreadcrumbs :path="currentPath" :root-label="activeRoot?.label || 'Root'" @navigate="navigatePath" />
            <div class="text-xs text-(--or3-text-muted)">
              <span>{{ activeRoot?.path || '' }}</span>
              <span v-if="activeRoot" class="ml-2 rounded-full border border-(--or3-border) px-2 py-0.5">
                {{ isWritableRoot ? 'Writable' : 'Read only' }}
              </span>
            </div>
          </div>
        </div>

        <DangerCallout v-if="fileError" tone="caution" title="File browser needs attention">
          {{ fileError }}
        </DangerCallout>

        <div class="grid gap-4 xl:grid-cols-[minmax(0,1.6fr)_minmax(18rem,1fr)]">
          <div class="space-y-3">
            <div v-if="showSearchPanel" class="overflow-hidden rounded-2xl border border-(--or3-border) bg-white/70">
              <div class="border-b border-(--or3-border) px-3 py-2 text-xs font-semibold uppercase tracking-wide text-(--or3-text-muted)">
                Search results
              </div>
              <div v-if="searchResults.length" class="divide-y divide-(--or3-border)">
                <button
                  v-for="item in searchResults"
                  :key="`${item.root_id}:${item.path}`"
                  type="button"
                  class="block w-full px-3 py-3 text-left transition hover:bg-(--or3-green-soft)"
                  @click="revealSearchResult(item)"
                >
                  <p class="truncate font-mono text-sm font-semibold text-(--or3-text)">{{ item.name }}</p>
                  <p class="mt-1 text-xs text-(--or3-text-muted)">{{ item.path }}</p>
                </button>
              </div>
              <div v-else class="px-4 py-6 text-sm text-(--or3-text-muted)">
                No matches in {{ activeRoot?.label || 'this area' }}.
              </div>
            </div>

            <div class="overflow-hidden rounded-2xl border border-(--or3-border) bg-white/70">
              <div class="border-b border-(--or3-border) px-3 py-2 text-xs font-semibold uppercase tracking-wide text-(--or3-text-muted)">
                {{ entriesPanelTitle }}
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
                  @open="openEntry"
                  @actions="selectEntry"
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
            </div>
          </div>

          <div class="rounded-2xl border border-(--or3-border) bg-(--or3-surface-soft) p-4">
            <template v-if="selectedEntry">
              <div class="flex items-start gap-3">
                <div class="grid size-10 place-items-center rounded-2xl bg-white text-(--or3-green)">
                  <Icon :name="selectedEntry.type === 'directory' ? 'i-pixelarticons-folder' : selectedEntryIcon" class="size-5" />
                </div>
                <div class="min-w-0 flex-1">
                  <p class="truncate font-mono text-sm font-semibold text-(--or3-text)">{{ selectedEntry.name }}</p>
                  <p class="mt-1 break-all text-xs text-(--or3-text-muted)">{{ selectedEntry.path }}</p>
                </div>
              </div>

              <div class="mt-4 grid grid-cols-2 gap-2 text-xs text-(--or3-text-muted)">
                <div class="rounded-2xl bg-white/80 p-3">
                  <p class="font-semibold text-(--or3-text)">Type</p>
                  <p class="mt-1">{{ selectedEntry.type === 'directory' ? 'Folder' : 'File' }}</p>
                </div>
                <div class="rounded-2xl bg-white/80 p-3">
                  <p class="font-semibold text-(--or3-text)">Size</p>
                  <p class="mt-1">{{ selectedEntry.type === 'directory' ? 'Folder' : formatBytes(selectedEntry.size) || 'Unknown' }}</p>
                </div>
                <div class="rounded-2xl bg-white/80 p-3">
                  <p class="font-semibold text-(--or3-text)">Updated</p>
                  <p class="mt-1">{{ formatDate(selectedEntry.modified_at) || 'Unknown' }}</p>
                </div>
                <div class="rounded-2xl bg-white/80 p-3">
                  <p class="font-semibold text-(--or3-text)">Area</p>
                  <p class="mt-1">{{ activeRoot?.label || currentRootId }}</p>
                </div>
              </div>

              <div class="mt-4 flex flex-wrap gap-2">
                <UButton label="Ask assistant" icon="i-pixelarticons-message-text" color="neutral" variant="soft" @click="askAssistant" />
                <UButton label="Copy path" icon="i-pixelarticons-copy" color="neutral" variant="soft" @click="copySelectedPath" />
                <UButton v-if="selectedEntry.type === 'file'" label="Download" icon="i-pixelarticons-file" color="primary" :loading="previewLoading" @click="downloadSelectedFile" />
                <UButton v-if="selectedEntry.type === 'file'" label="Open in browser" icon="i-pixelarticons-link" color="neutral" variant="soft" :loading="openingFile" @click="openSelectedFile" />
                <UButton v-if="selectedEntry.type === 'directory'" label="Open folder" icon="i-pixelarticons-folder" color="primary" @click="openSelectedDirectory" />
                <UButton label="Open terminal here" icon="i-pixelarticons-terminal" color="neutral" variant="ghost" @click="openTerminalHere" />
              </div>

              <div class="mt-4 rounded-2xl border border-(--or3-border) bg-white/80 p-3">
                <p class="font-mono text-xs font-semibold uppercase tracking-wide text-(--or3-text-muted)">Preview</p>

                <div v-if="selectedEntry.type === 'directory'" class="mt-3 text-sm leading-6 text-(--or3-text-muted)">
                  Open this folder to browse inside it, or launch a terminal here if you want to work in it directly.
                </div>

                <div v-else-if="previewLoading" class="mt-3 h-40 rounded-2xl bg-(--or3-surface-soft)" />

                <div v-else-if="preview.kind === 'image' && preview.url" class="mt-3 overflow-hidden rounded-2xl border border-(--or3-border)">
                  <img :src="preview.url" :alt="selectedEntry.name" class="max-h-80 w-full object-contain bg-white" />
                </div>

                <pre v-else-if="preview.kind === 'text'" class="mt-3 max-h-80 overflow-auto whitespace-pre-wrap rounded-2xl bg-(--or3-surface-soft) p-3 text-xs leading-6 text-(--or3-text)">{{ preview.text }}</pre>

                <div v-else class="mt-3 text-sm leading-6 text-(--or3-text-muted)">
                  {{ preview.message || 'Preview is not available for this file type yet.' }}
                </div>
              </div>
            </template>

            <div v-else class="flex h-full min-h-72 flex-col items-center justify-center text-center">
              <div class="grid size-12 place-items-center rounded-2xl bg-white text-(--or3-green)">
                <Icon name="i-pixelarticons-file" class="size-6" />
              </div>
              <p class="mt-4 font-mono text-sm font-semibold text-(--or3-text)">Pick a file to inspect it</p>
              <p class="mt-2 max-w-sm text-sm leading-6 text-(--or3-text-muted)">
                Tap a row to open a folder. Use the three-dot button to pin a file or folder in this side panel and work from there.
              </p>
            </div>
          </div>
        </div>
      </template>
    </SurfaceCard>

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
import { computed, onBeforeUnmount, onMounted, reactive, ref } from 'vue'
import { navigateTo, useRoute, useRouter } from '#app'
import { useToast } from '@nuxt/ui/composables'
import type { FileEntry, FileSearchItem } from '~/types/or3-api'
import { programmaticSend } from '~/composables/useChatInputBridge'
import { useComputerFiles } from '~/composables/useComputerFiles'
import { useMemoryTrust } from '~/composables/useMemoryTrust'

interface MemoryShortcut {
  label: string
  description: string
  path: string
  type: 'file' | 'directory'
  rootId: string
}

type PreviewKind = 'empty' | 'text' | 'image' | 'unavailable'

const route = useRoute()
const router = useRouter()
const toast = useToast()

const files = useComputerFiles()
const selectedEntry = ref<FileEntry | null>(null)
const uploadInput = ref<{ inputRef?: HTMLInputElement | null } | null>(null)
const searchQuery = ref('')
const searchResults = ref<FileSearchItem[]>([])
const searchTouched = ref(false)
const newFolderOpen = ref(false)
const newFolderName = ref('')
const creatingFolder = ref(false)
const createFolderError = ref<string | null>(null)
const previewLoading = ref(false)
const openingFile = ref(false)
const memoryShortcuts = ref<MemoryShortcut[]>([])
const preview = reactive<{ kind: PreviewKind; text: string; url: string; message: string }>({
  kind: 'empty',
  text: '',
  url: '',
  message: '',
})

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

const activeRoot = computed(() => roots.value.find((root) => root.id === currentRootId.value) ?? null)
const isWritableRoot = computed(() => Boolean(activeRoot.value?.writable))
const showSearchPanel = computed(() => searchTouched.value || searchQuery.value.trim().length > 0)
const entriesPanelTitle = computed(() => currentPath.value === '.' ? 'Top level' : currentPath.value)
const selectedEntryIcon = computed(() => fileIcon(selectedEntry.value))
const memoryDebugDetails = computed(() => JSON.stringify({ embeddings: embeddingsStatus.value, audit: auditStatus.value }, null, 2))

const embeddingStatusTitle = computed(() => {
  const status = String(embeddingsStatus.value?.status || '').trim().toLowerCase()
  if (status === 'ok') return 'Memory search looks healthy'
  if (status === 'mismatch') return 'Memory embeddings need a refresh'
  if (status === 'legacy-unknown') return 'Memory index is from an older setup'
  return 'Memory status is unavailable'
})

const embeddingStatusDescription = computed(() => {
  const status = String(embeddingsStatus.value?.status || '').trim().toLowerCase()
  const dims = Number(embeddingsStatus.value?.memoryVectorDims || 0)
  if (status === 'ok') {
    const docsEnabled = embeddingsStatus.value?.docIndexEnabled ? ' Document search is on.' : ''
    return dims > 0
      ? `Your saved memory vectors are ready (${dims} dimensions).${docsEnabled}`
      : `The index reports as healthy.${docsEnabled}`
  }
  if (status === 'mismatch') return 'The embedding model changed since the last build. Re-scan notes and documents so recall stays accurate.'
  if (status === 'legacy-unknown') return 'OR3 found older vectors without a matching fingerprint. A re-scan will normalize them.'
  return 'Refresh to see whether memory search and document indexing are ready.'
})

const auditStatusTitle = computed(() => {
  const status = String(auditStatus.value?.status || '').trim().toLowerCase()
  if (auditStatus.value?.verified === true) return 'Activity log verified'
  if (status === 'ok') return 'Activity log is available'
  if (status === 'disabled') return 'Activity log is turned off'
  if (status === 'unavailable') return 'Activity log is unavailable'
  return 'Activity log status is unavailable'
})

const auditStatusDescription = computed(() => {
  const eventCount = Number(auditStatus.value?.eventCount || 0)
  if (auditStatus.value?.verified === true) return `The integrity check passed across ${eventCount} recorded events.`
  if (auditStatus.value?.status === 'ok') {
    return eventCount > 0
      ? `${eventCount} events are recorded. Run Verify log if you want to confirm nothing was tampered with.`
      : 'Logging is available, but no events have been recorded yet.'
  }
  if (auditStatus.value?.status === 'disabled') return 'Turn audit logging on in OR3 if you want a tamper-checkable activity trail.'
  if (auditStatus.value?.status === 'unavailable') return 'OR3 could not reach its audit logger. Check the memory tools page for deeper diagnostics.'
  return 'Refresh to see whether OR3 can read and verify its activity trail.'
})

function fileIcon(entry?: FileEntry | null) {
  if (!entry || entry.type === 'directory') return 'i-pixelarticons-folder'
  const mimeType = entry.mime_type || ''
  if (mimeType.includes('image')) return 'i-pixelarticons-image'
  if (isTextLikeFile(entry)) return 'i-pixelarticons-file-text'
  return 'i-pixelarticons-file'
}

function formatBytes(size?: number) {
  if (!size) return ''
  if (size < 1024) return `${size} B`
  const units = ['KB', 'MB', 'GB', 'TB']
  let value = size / 1024
  let unitIndex = 0
  while (value >= 1024 && unitIndex < units.length - 1) {
    value /= 1024
    unitIndex += 1
  }
  const precision = value >= 10 ? 0 : 1
  return `${value.toFixed(precision)} ${units[unitIndex]}`
}

function formatDate(value?: string) {
  if (!value) return ''
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return date.toLocaleString()
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

function isTextLikeFile(entry: Pick<FileEntry, 'name' | 'mime_type'>) {
  const mimeType = entry.mime_type?.toLowerCase() || ''
  if (mimeType.startsWith('text/')) return true
  if (mimeType.includes('json') || mimeType.includes('xml') || mimeType.includes('javascript')) return true
  return /\.(md|txt|json|ya?ml|toml|ini|cfg|conf|env|csv|ts|tsx|js|jsx|vue|go|py|rb|php|java|kt|swift|sql|html|css|scss|sh)$/i.test(entry.name)
}

function isImageLikeFile(entry: Pick<FileEntry, 'name' | 'mime_type'>) {
  const mimeType = entry.mime_type?.toLowerCase() || ''
  return mimeType.startsWith('image/') || /\.(png|jpe?g|gif|webp|svg)$/i.test(entry.name)
}

function resetPreview() {
  if (preview.url) {
    URL.revokeObjectURL(preview.url)
  }
  preview.kind = 'empty'
  preview.text = ''
  preview.url = ''
  preview.message = ''
}

async function syncRoute(rootId = currentRootId.value, path = currentPath.value) {
  await router.replace({
    path: '/computer/files',
    query: {
      ...route.query,
      root: rootId,
      path,
    },
  })
}

async function refresh() {
  await loadRoots()
  if (!roots.value.length) return
  const rootId = roots.value.find((root) => root.id === currentRootId.value)?.id || roots.value[0]?.id
  if (!rootId) return
  const path = typeof route.query.path === 'string' && route.query.path.trim() ? route.query.path : currentPath.value || '.'
  await listDirectory(rootId, path).catch(async () => {
    await listDirectory(rootId, '.')
  })
  await syncRoute()
  await loadMemoryShortcuts()
}

async function handleRootChange(value: string | Record<string, unknown> | null) {
  const rootId = typeof value === 'string' ? value : typeof value?.id === 'string' ? value.id : ''
  if (!rootId || rootId === currentRootId.value) return
  clearSearch()
  clearSelection()
  await listDirectory(rootId, '.')
  await syncRoute(rootId, '.')
  await loadMemoryShortcuts()
}

async function navigatePath(path: string) {
  clearSelection()
  await listDirectory(currentRootId.value, path)
  await syncRoute(currentRootId.value, path)
}

async function openEntry(entry: FileEntry) {
  if (entry.type === 'directory') {
    clearSelection()
    await openDirectory(entry)
    await syncRoute(currentRootId.value, entry.path)
    return
  }
  await selectEntry(entry)
}

async function selectEntry(entry: FileEntry) {
  selectedEntry.value = entry
  if (entry.type === 'file') await loadPreview(entry)
  else resetPreview()
}

function clearSelection() {
  selectedEntry.value = null
  resetPreview()
}

async function runSearch() {
  const query = searchQuery.value.trim()
  searchTouched.value = true
  if (!query) {
    searchResults.value = []
    return
  }
  searchResults.value = await searchWorkspaceFiles(query, 20, currentRootId.value).catch(() => [])
}

function clearSearch() {
  searchQuery.value = ''
  searchResults.value = []
  searchTouched.value = false
}

async function revealFile(rootId: string, path: string, type: 'file' | 'directory') {
  if (type === 'directory') {
    clearSelection()
    await listDirectory(rootId, path)
    await syncRoute(rootId, path)
    return
  }

  const folder = parentPath(path)
  await listDirectory(rootId, folder)
  await syncRoute(rootId, folder)
  const match = entries.value.find((entry) => entry.path === path)
  if (match) await selectEntry(match)
}

async function revealSearchResult(item: FileSearchItem) {
  await revealFile(item.root_id, item.path, item.type)
}

async function loadMemoryShortcuts() {
  const workspaceRoot = roots.value.find((root) => root.id === 'workspace')
  if (!workspaceRoot) {
    memoryShortcuts.value = []
    return
  }

  const candidates = [
    { label: 'Long-term memory', description: 'The durable note OR3 keeps close at hand.', path: 'MEMORY.md' },
    { label: 'Today note', description: 'Today\'s daily memory log.', path: `memory/${todayStamp(0)}.md` },
    { label: 'Yesterday note', description: 'Yesterday\'s daily memory log.', path: `memory/${todayStamp(-1)}.md` },
    { label: 'Memory folder', description: 'All daily notes and support memory files.', path: 'memory' },
    { label: 'Identity note', description: 'The assistant identity and behavior guide.', path: 'SOUL.md' },
    { label: 'User note', description: 'The human context note OR3 reads at startup.', path: 'USER.md' },
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
  await revealFile(shortcut.rootId, shortcut.path, shortcut.type)
}

function openUploadPicker() {
  uploadInput.value?.inputRef?.click()
}

async function handleUpload(event: Event) {
  const input = event.target as HTMLInputElement
  if (!input.files?.length) return
  try {
    await uploadFiles(input.files)
    toast.add({ title: 'Upload complete', description: `${input.files.length} file${input.files.length === 1 ? '' : 's'} added to this folder.` })
  } catch {
    // Error state is already surfaced by the composable.
  } finally {
    input.value = ''
  }
}

async function loadPreview(entry: FileEntry) {
  resetPreview()
  if (entry.type !== 'file') return

  if ((entry.size || 0) > 512 * 1024 && !isImageLikeFile(entry)) {
    preview.kind = 'unavailable'
    preview.message = 'This file is larger than the inline preview limit. Download or open it in your browser instead.'
    return
  }

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
    previewLoading.value = false
  }
}

async function withDownloadedBlob(entry: FileEntry, handler: (blob: Blob) => Promise<void> | void) {
  const blob = await downloadFile(entry)
  await handler(blob)
}

async function downloadSelectedFile() {
  if (!selectedEntry.value || selectedEntry.value.type !== 'file' || !import.meta.client) return
  await withDownloadedBlob(selectedEntry.value, (blob) => {
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = selectedEntry.value?.name || 'download'
    link.click()
    setTimeout(() => URL.revokeObjectURL(url), 1000)
  }).catch(() => undefined)
}

async function openSelectedFile() {
  if (!selectedEntry.value || selectedEntry.value.type !== 'file' || !import.meta.client) return
  openingFile.value = true
  try {
    await withDownloadedBlob(selectedEntry.value, (blob) => {
      const url = URL.createObjectURL(blob)
      window.open(url, '_blank', 'noopener,noreferrer')
      setTimeout(() => URL.revokeObjectURL(url), 60_000)
    })
  } finally {
    openingFile.value = false
  }
}

async function copySelectedPath() {
  if (!selectedEntry.value) return
  const copied = await copyPath(selectedEntry.value).catch(() => false)
  toast.add({
    title: copied ? 'Path copied' : 'Could not copy path',
    description: copied ? selectedEntry.value.path : 'Clipboard access is not available here.',
  })
}

function askAssistant() {
  if (!selectedEntry.value) return
  void programmaticSend('main', `Help me understand this file on my computer: ${selectedEntry.value.path}`)
}

async function openSelectedDirectory() {
  if (!selectedEntry.value || selectedEntry.value.type !== 'directory') return
  await openEntry(selectedEntry.value)
}

function openTerminalHere() {
  const path = selectedEntry.value?.type === 'directory' ? selectedEntry.value.path : currentPath.value
  void navigateTo({ path: '/computer/terminal', query: { root: currentRootId.value, path } })
}

function openTerminalForCurrentFolder() {
  void navigateTo({ path: '/computer/terminal', query: { root: currentRootId.value, path: currentPath.value } })
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
    toast.add({ title: 'Folder created', description: `${name} is ready.` })
    closeCreateFolder()
  } catch (error: any) {
    createFolderError.value = error?.message ?? 'Could not create that folder.'
  } finally {
    creatingFolder.value = false
  }
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
    })
  } catch {
    // Error state already handled in the memory composable.
  }
}

async function handleRefreshAudit() {
  await loadAuditStatus().catch(() => undefined)
}

async function handleVerifyAudit() {
  try {
    await verifyAudit()
    toast.add({ title: 'Activity log verified', description: 'The audit chain passed its integrity check.' })
  } catch {
    // Error state already handled in the memory composable.
  }
}

onMounted(async () => {
  await refresh().catch(() => undefined)
  const rootFromQuery = typeof route.query.root === 'string' ? route.query.root : ''
  const pathFromQuery = typeof route.query.path === 'string' ? route.query.path : ''
  if (rootFromQuery && roots.value.some((root) => root.id === rootFromQuery)) {
    await listDirectory(rootFromQuery, pathFromQuery || '.').catch(() => undefined)
    await syncRoute(rootFromQuery, currentPath.value)
  }
  await Promise.allSettled([loadEmbeddingsStatus(), loadAuditStatus(), loadMemoryShortcuts()])
})

onBeforeUnmount(() => {
  resetPreview()
})
</script>
