<template>
  <details
    v-if="displayItems.length"
    class="mt-3 overflow-hidden rounded-2xl border border-(--or3-border) bg-(--or3-surface-soft)"
  >
    <summary class="flex cursor-pointer items-center gap-2 px-3 py-2 text-xs font-medium text-(--or3-text-muted)">
      <Icon :name="summaryIcon" class="size-3.5" />
      {{ summaryLabel }}
    </summary>
    <ol class="space-y-2 border-t border-(--or3-border) px-3 py-2.5">
      <li v-for="item in displayItems" :key="item.id" class="flex gap-2 text-xs leading-5">
        <Icon :name="iconFor(item.status)" :class="['mt-0.5 size-3.5 shrink-0', item.status === 'running' && 'animate-spin', item.status === 'attention' && 'text-amber-700']" />
        <div class="min-w-0">
          <p class="font-medium text-(--or3-text)">{{ item.label }}</p>
          <p v-if="item.detail && !consumerMode" class="whitespace-pre-wrap text-(--or3-text-muted)">{{ item.detail }}</p>
        </div>
      </li>
    </ol>
  </details>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import type { ChatActivityEntry } from '~/types/app-state'

const props = withDefaults(
  defineProps<{
    items: ChatActivityEntry[]
    consumerMode?: boolean
  }>(),
  {
    consumerMode: true,
  },
)

const INTERNAL_TYPES = new Set([
  'queued',
  'started',
  'completion',
  'policy_adjusted',
  'runtime_error',
  'unknown',
])

function consumerLabel(item: ChatActivityEntry) {
  if (item.type === 'approval_required') return 'Waiting for approval'
  if (item.type === 'tool_call' || item.type === 'tool_result') {
    const name = item.label
      .replace(/^Tool (call|result):\s*/i, '')
      .replace(/^Running\s+/i, '')
      .replace(/^Used\s+/i, '')
      .trim()
    if (name) {
      return item.status === 'running' ? `Using ${name}` : `Used ${name}`
    }
    return item.status === 'running' ? 'Using a tool' : 'Used a tool'
  }
  if (item.type === 'web_search') {
    return item.status === 'running' ? 'Searching the web' : 'Searched the web'
  }
  if (item.type === 'command_execution' || item.type === 'file_change') {
    return item.status === 'running' ? 'Updating your computer' : 'Updated your computer'
  }
  if (item.status === 'running') return 'Working…'
  if (item.status === 'attention') return 'Needs your attention'
  if (item.status === 'error') return 'Something went wrong'
  return item.label
}

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

const displayItems = computed(() => {
  const items = normalizedItems.value
  if (!props.consumerMode) return items

  const filtered = items.filter((item) => !INTERNAL_TYPES.has(item.type))
  const mapped = filtered.map((item) => ({
    ...item,
    label: consumerLabel(item),
    detail: undefined,
  }))

  const running = mapped.filter((item) => item.status === 'running')
  const attention = mapped.filter((item) => item.status === 'attention')
  const errors = mapped.filter((item) => item.status === 'error')
  const highlights = [...attention, ...errors, ...running].slice(0, 3)

  if (highlights.length) return highlights
  if (running.length) return running.slice(0, 1)
  return mapped.slice(-2)
})

const summaryLabel = computed(() =>
  props.consumerMode
    ? displayItems.value.some((item) => item.status === 'running')
      ? 'Working…'
      : 'What OR3 did'
    : 'Activity log',
)

const summaryIcon = computed(() =>
  props.consumerMode ? 'i-pixelarticons-loader' : 'i-pixelarticons-tree',
)

function iconFor(status?: ChatActivityEntry['status']) {
  if (status === 'attention') return 'i-pixelarticons-shield'
  if (status === 'error') return 'i-pixelarticons-alert'
  if (status === 'complete') return 'i-pixelarticons-check'
  return 'i-pixelarticons-loader'
}
</script>
