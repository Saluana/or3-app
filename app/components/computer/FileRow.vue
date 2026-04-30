<template>
  <div :class="['flex items-center gap-2 border-b border-(--or3-border) px-2 py-2 last:border-b-0', selected ? 'bg-(--or3-green-soft)' : 'bg-white/0']">
    <UButton color="neutral" variant="ghost" class="min-w-0 flex-1 justify-start px-0 py-1.5 text-left hover:bg-transparent active:bg-transparent" type="button" @click="emit('open', entry)">
      <RetroIcon :name="entry.type === 'directory' ? 'i-pixelarticons-folder' : icon" size="sm" />
      <div class="min-w-0 flex-1">
        <p class="truncate font-mono text-sm text-(--or3-text)">{{ entry.name }}</p>
        <p class="mt-1 text-xs text-(--or3-text-muted)">{{ meta }}</p>
      </div>
    </UButton>
    <UButton icon="i-pixelarticons-more-horizontal" color="neutral" variant="ghost" size="xs" aria-label="File actions" @click.stop="emit('actions', entry)" />
  </div>
</template>

<script setup lang="ts">
import type { FileEntry } from '~/types/or3-api'

const props = withDefaults(defineProps<{ entry: FileEntry; selected?: boolean }>(), {
  selected: false,
})
const emit = defineEmits<{ open: [entry: FileEntry]; actions: [entry: FileEntry] }>()

const icon = computed(() => props.entry.mime_type?.includes('image') ? 'i-pixelarticons-image' : props.entry.name.endsWith('.md') ? 'i-pixelarticons-file-text' : 'i-pixelarticons-file')

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
  return date.toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  })
}

const meta = computed(() => [
  props.entry.type === 'directory' ? 'Folder' : 'File',
  props.entry.type === 'file' ? formatBytes(props.entry.size) : '',
  formatDate(props.entry.modified_at),
].filter(Boolean).join(' · '))
</script>
