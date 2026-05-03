<template>
  <div
    :class="[
      'group flex items-center gap-2 border-b border-(--or3-border) px-2 py-2 last:border-b-0 transition-colors',
      selected ? 'bg-(--or3-green-soft)' : 'hover:bg-(--or3-surface-soft)/70',
    ]"
  >
    <!-- Main hit area: opens directories or selects files -->
    <button
      type="button"
      class="or3-focus-ring flex min-w-0 flex-1 items-center gap-3 rounded-xl px-2 py-1.5 text-left"
      @click="emit('open', entry)"
    >
      <RetroIcon :name="iconName" size="sm" />
      <div class="min-w-0 flex-1">
        <p class="truncate font-mono text-sm text-(--or3-text)" :title="entry.name">{{ entry.name }}</p>
        <p class="mt-0.5 truncate text-xs text-(--or3-text-muted)">{{ meta }}</p>
      </div>
    </button>

    <!-- Per-row overflow menu (now actually does things) -->
    <UDropdownMenu :items="menuItems" :content="{ align: 'end', sideOffset: 6 }">
      <UButton
        icon="i-pixelarticons-more-horizontal"
        color="neutral"
        variant="ghost"
        size="sm"
        :aria-label="`Actions for ${entry.name}`"
        class="shrink-0"
        @click.stop
      />
    </UDropdownMenu>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import type { FileEntry } from '~/types/or3-api'

const props = withDefaults(defineProps<{
  entry: FileEntry
  selected?: boolean
  canEdit?: boolean
}>(), {
  selected: false,
  canEdit: false,
})

const emit = defineEmits<{
  open: [entry: FileEntry]
  details: [entry: FileEntry]
  edit: [entry: FileEntry]
  copyPath: [entry: FileEntry]
  download: [entry: FileEntry]
  openInBrowser: [entry: FileEntry]
  openTerminal: [entry: FileEntry]
  ask: [entry: FileEntry]
}>()

const iconName = computed(() => {
  if (props.entry.type === 'directory') return 'i-pixelarticons-folder'
  const mime = props.entry.mime_type || ''
  if (mime.includes('image')) return 'i-pixelarticons-image'
  if (props.entry.name.endsWith('.md')) return 'i-pixelarticons-file-text'
  if (/\.(json|ya?ml|toml|ini|env)$/i.test(props.entry.name)) return 'i-pixelarticons-script-text'
  if (/\.(ts|tsx|js|jsx|vue|go|py|rb|php|java|kt|swift|sh|sql|html|css|scss)$/i.test(props.entry.name)) return 'i-pixelarticons-script'
  return 'i-pixelarticons-file'
})

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

// Build the dropdown items dynamically based on entry type.
const menuItems = computed(() => {
  const isDir = props.entry.type === 'directory'
  const groups: any[] = [
    [
      {
        label: isDir ? 'Open folder' : 'Open file',
        icon: isDir ? 'i-pixelarticons-folder' : 'i-pixelarticons-file',
        onSelect: () => emit('open', props.entry),
      },
      {
        label: 'View details',
        icon: 'i-pixelarticons-info-box',
        onSelect: () => emit('details', props.entry),
      },
    ],
  ]

  if (!isDir) {
    const fileActions: any[] = []
    if (props.canEdit) {
      fileActions.push({
        label: 'Edit',
        icon: 'i-pixelarticons-edit',
        onSelect: () => emit('edit', props.entry),
      })
    }
    fileActions.push(
      {
        label: 'Download',
        icon: 'i-pixelarticons-download',
        onSelect: () => emit('download', props.entry),
      },
      {
        label: 'Open in browser',
        icon: 'i-pixelarticons-open',
        onSelect: () => emit('openInBrowser', props.entry),
      },
    )
    groups.push(fileActions)
  }

  groups.push([
    {
      label: 'Copy path',
      icon: 'i-pixelarticons-copy',
      onSelect: () => emit('copyPath', props.entry),
    },
    {
      label: 'Open terminal here',
      icon: 'i-pixelarticons-terminal',
      onSelect: () => emit('openTerminal', props.entry),
    },
    {
      label: 'Ask assistant',
      icon: 'i-pixelarticons-message-text',
      onSelect: () => emit('ask', props.entry),
    },
  ])

  return groups
})
</script>
