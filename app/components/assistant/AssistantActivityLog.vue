<template>
  <details v-if="normalizedItems.length" class="mt-3 overflow-hidden rounded-2xl border border-(--or3-border) bg-(--or3-surface-soft)">
    <summary class="flex cursor-pointer items-center gap-2 px-3 py-2 text-xs font-medium text-(--or3-text-muted)">
      <Icon name="i-pixelarticons-tree" class="size-3.5" />
      Activity log
    </summary>
    <ol class="space-y-2 border-t border-(--or3-border) px-3 py-2.5">
      <li v-for="item in normalizedItems" :key="item.id" class="flex gap-2 text-xs leading-5">
        <Icon :name="iconFor(item.status)" :class="['mt-0.5 size-3.5 shrink-0', item.status === 'running' && 'animate-spin', item.status === 'attention' && 'text-amber-700']" />
        <div class="min-w-0">
          <p class="font-medium text-(--or3-text)">{{ item.label }}</p>
          <p v-if="item.detail" class="whitespace-pre-wrap text-(--or3-text-muted)">{{ item.detail }}</p>
        </div>
      </li>
    </ol>
  </details>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import type { ChatActivityEntry } from '~/types/app-state'

const props = defineProps<{ items: ChatActivityEntry[] }>()

const normalizedItems = computed(() => {
  const items = props.items ?? []
  const hasCompletion = items.some((item) => item.type === 'completion' || item.label === 'Completed turn')
  const toolResults = new Map<string, ChatActivityEntry['status']>()

  for (const item of items) {
    if (item.type !== 'tool_result') continue
    const name = item.label.replace(/^Tool result:\s*/, '').trim()
    if (name) {
      toolResults.set(
        name,
        item.status === 'error'
          ? 'error'
          : item.status === 'attention'
            ? 'attention'
            : 'complete',
      )
    }
  }

  return items.map((item) => {
    if (item.status !== 'running') return item
    if (item.type === 'tool_call') {
      const name = item.label.replace(/^Tool call:\s*/, '').trim()
      const status = toolResults.get(name)
      if (status) return { ...item, status }
    }
    if (hasCompletion && (item.type === 'queued' || item.type === 'started' || item.type === 'tool_call')) {
      return { ...item, status: 'complete' as const }
    }
    return item
  })
})

function iconFor(status?: ChatActivityEntry['status']) {
  if (status === 'attention') return 'i-pixelarticons-shield'
  if (status === 'error') return 'i-pixelarticons-alert'
  if (status === 'complete') return 'i-pixelarticons-check'
  return 'i-pixelarticons-loader'
}
</script>
