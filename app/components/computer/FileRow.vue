<template>
  <div class="flex items-center gap-2 border-b border-(--or3-border) px-2 py-2 last:border-b-0">
    <UButton color="neutral" variant="ghost" class="min-w-0 flex-1 justify-start px-0 py-1.5 text-left active:bg-(--or3-green-soft)" type="button" @click="emit('open', entry)">
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

const props = defineProps<{ entry: FileEntry }>()
const emit = defineEmits<{ open: [entry: FileEntry]; actions: [entry: FileEntry] }>()

const icon = computed(() => props.entry.mime_type?.includes('image') ? 'i-pixelarticons-image' : props.entry.name.endsWith('.md') ? 'i-pixelarticons-file-text' : 'i-pixelarticons-file')
const meta = computed(() => [props.entry.type, props.entry.size ? `${Math.round(props.entry.size / 1024)} KB` : '', props.entry.modified_at].filter(Boolean).join(' · '))
</script>
