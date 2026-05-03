<template>
  <div v-if="visible" class="mb-3 rounded-2xl border border-(--or3-border) bg-(--or3-surface-soft) px-3 py-2.5 text-(--or3-text)">
    <div class="flex items-start gap-2">
      <span class="mt-0.5 inline-flex size-6 shrink-0 items-center justify-center rounded-full bg-(--or3-green-soft) text-(--or3-green-dark)">
        <Icon :name="content ? 'i-pixelarticons-lightbulb' : 'i-pixelarticons-loader'" :class="content ? 'size-3.5' : 'size-3.5 animate-spin'" />
      </span>
      <div class="min-w-0 flex-1">
        <p class="font-mono text-[11px] uppercase tracking-[0.18em] text-(--or3-green-dark)">{{ heading }}</p>
        <p class="mt-1 text-sm leading-5 text-(--or3-text-muted)">{{ summary }}</p>
      </div>
    </div>

    <details v-if="content" class="mt-2 overflow-hidden rounded-xl border border-(--or3-border) bg-(--or3-surface)">
      <summary class="cursor-pointer px-3 py-2 text-sm font-medium text-(--or3-text)">Show internal notes</summary>
      <pre class="border-t border-(--or3-border) px-3 py-2 text-xs leading-5 whitespace-pre-wrap text-(--or3-text-muted)">{{ content }}</pre>
    </details>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import type { ChatToolCall } from '~/types/app-state'

const props = withDefaults(defineProps<{
  content?: string
  pending?: boolean
  toolCalls?: ChatToolCall[]
}>(), {
  content: '',
  pending: false,
  toolCalls: () => [],
})

const runningTools = computed(() => props.toolCalls.filter((tool) => tool.status === 'running'))
const visible = computed(() => props.pending || !!props.content || runningTools.value.length > 0)
const heading = computed(() => {
  if (props.content) return 'THINKING'
  if (runningTools.value.length) return 'USING TOOLS'
  return 'WORKING'
})
const summary = computed(() => {
  if (props.content) return 'The assistant has shared its working notes for this reply.'
  if (runningTools.value.length === 1) return `Running ${runningTools.value[0]?.name || 'a tool'} to gather what it needs.`
  if (runningTools.value.length > 1) return `Running ${runningTools.value.length} tools to finish this reply.`
  if (props.pending) return 'Thinking through your request before writing back.'
  return 'Working through the request.'
})
</script>
