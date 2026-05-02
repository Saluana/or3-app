<template>
  <div class="overflow-hidden rounded-2xl border border-(--or3-border) bg-(--or3-surface) shadow-(--or3-shadow-soft)">
    <div class="flex items-center gap-2 border-b border-(--or3-border) px-3 py-2 text-xs text-(--or3-text-muted)">
      <Icon name="i-pixelarticons-file" class="size-3.5 text-(--or3-green-dark)" />
      <span class="font-mono uppercase tracking-[0.16em]">Mention file</span>
      <span v-if="loading" class="ml-auto">Searching…</span>
    </div>
    <div v-if="items.length" class="max-h-56 overflow-y-auto p-1">
      <button
        v-for="(item, index) in items"
        :key="item.id"
        type="button"
        class="flex w-full items-start gap-2 rounded-xl px-3 py-2 text-left text-sm"
        :class="index === selectedIndex ? 'bg-(--or3-green-soft) text-(--or3-green-dark)' : 'text-(--or3-text) hover:bg-(--or3-surface-soft)'"
        @mousedown.prevent="emit('select', item)"
      >
        <Icon name="i-pixelarticons-file" class="mt-0.5 size-4 shrink-0" />
        <span class="min-w-0 flex-1">
          <span class="block truncate font-medium">{{ item.name }}</span>
          <span class="block truncate text-xs text-(--or3-text-muted)">{{ item.root_label }} / {{ item.path }}</span>
        </span>
      </button>
    </div>
    <p v-else class="px-3 py-3 text-sm text-(--or3-text-muted)">
      {{ error || (loading ? 'Searching workspace files…' : 'No files found. Keep typing after @ to search.') }}
    </p>
  </div>
</template>

<script setup lang="ts">
import type { FileMentionSuggestionItem } from '~/composables/useFileMentionSuggestions'

defineProps<{
  items: FileMentionSuggestionItem[]
  loading?: boolean
  error?: string | null
  selectedIndex: number
}>()

const emit = defineEmits<{
  select: [item: FileMentionSuggestionItem]
}>()
</script>