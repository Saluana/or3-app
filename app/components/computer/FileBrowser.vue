<template>
  <SurfaceCard class-name="space-y-4">
    <div class="flex items-center justify-between gap-3">
      <div>
        <p class="or3-label text-sm font-semibold">Memory & Files</p>
        <p class="mt-1 text-sm text-(--or3-text-muted)">Browse your trusted computer like a personal drive.</p>
      </div>
      <div class="flex items-center gap-2">
        <input ref="uploadInput" type="file" class="hidden" multiple @change="handleUpload" />
        <UButton icon="i-lucide-upload" color="neutral" variant="ghost" aria-label="Upload files" @click="openUploadPicker" />
        <UButton icon="i-lucide-refresh-cw" color="neutral" variant="ghost" aria-label="Refresh files" @click="refresh" />
      </div>
    </div>

    <div class="rounded-2xl border border-(--or3-border) bg-white/60 px-3 py-2">
      <FileBreadcrumbs :path="currentPath" :root-label="activeRoot?.label || 'Root'" @navigate="navigatePath" />
    </div>

    <p v-if="fileError" class="rounded-2xl bg-amber-50 p-3 text-sm leading-6 text-amber-900">{{ fileError }}</p>

    <div class="overflow-hidden rounded-2xl border border-(--or3-border) bg-white/60">
      <FileRow v-for="entry in entries" :key="entry.path" :entry="entry" @open="openEntry" @actions="selectEntry" />
    </div>

    <div v-if="selectedEntry" class="rounded-2xl border border-(--or3-border) bg-(--or3-surface-soft) p-3">
      <p class="font-mono text-sm font-semibold">{{ selectedEntry.name }}</p>
      <p class="mt-1 text-xs text-(--or3-text-muted)">{{ selectedEntry.path }}</p>
      <div class="mt-3 grid grid-cols-2 gap-2">
        <UButton label="Ask assistant" icon="i-lucide-message-square" color="neutral" variant="soft" @click="askAssistant" />
        <UButton label="Copy path" icon="i-lucide-copy" color="neutral" variant="soft" @click="copyPath(selectedEntry)" />
        <UButton label="Upload here" icon="i-lucide-folder-up" color="neutral" variant="soft" @click="openUploadPicker" />
        <UButton label="Open terminal here" icon="i-lucide-terminal-square" color="neutral" variant="soft" @click="openTerminalHere" />
      </div>
    </div>
  </SurfaceCard>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import type { FileEntry } from '~/types/or3-api'
import { navigateTo } from '#app'
import { programmaticSend } from '~/composables/useChatInputBridge'
import { useComputerFiles } from '~/composables/useComputerFiles'

const files = useComputerFiles()
const selectedEntry = ref<FileEntry | null>(null)
const uploadInput = ref<HTMLInputElement | null>(null)
const { roots, entries, currentRootId, currentPath, fileError, loadRoots, listDirectory, openDirectory, copyPath, uploadFiles } = files
const activeRoot = computed(() => roots.value.find((root) => root.id === currentRootId.value))

async function refresh() {
  await loadRoots()
  await listDirectory()
}

function openEntry(entry: FileEntry) {
  if (entry.type === 'directory') openDirectory(entry)
  else selectedEntry.value = entry
}

function selectEntry(entry: FileEntry) {
  selectedEntry.value = entry
}

function navigatePath(path: string) {
  void listDirectory(currentRootId.value, path)
}

function askAssistant() {
  if (!selectedEntry.value) return
  void programmaticSend('main', `Help me understand this file on my computer: ${selectedEntry.value.path}`)
}

function openUploadPicker() {
  uploadInput.value?.click()
}

async function handleUpload(event: Event) {
  const input = event.target as HTMLInputElement
  if (!input.files?.length) return
  await uploadFiles(input.files)
  input.value = ''
}

function openTerminalHere() {
  const path = selectedEntry.value?.type === 'directory'
    ? selectedEntry.value.path
    : currentPath.value
  void navigateTo({ path: '/computer/terminal', query: { root: currentRootId.value, path } })
}

onMounted(refresh)
</script>
