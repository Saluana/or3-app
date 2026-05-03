<template>
  <div v-if="toolCalls.length" class="space-y-2">
    <details
      v-for="call in toolCalls"
      :key="call.id"
      class="overflow-hidden rounded-2xl border border-(--or3-border) bg-(--or3-surface-soft)"
    >
        <summary class="flex cursor-pointer items-start gap-2 px-3 py-2.5 text-sm text-(--or3-text)">
          <span class="mt-0.5 inline-flex size-5 shrink-0 items-center justify-center rounded-full"
          :class="call.status === 'running' ? 'bg-(--or3-green-soft) text-(--or3-green-dark)' : call.status === 'error' ? 'bg-(--or3-danger-soft) text-(--or3-danger)' : call.status === 'attention' ? 'bg-amber-100 text-amber-700' : 'bg-(--or3-surface) text-(--or3-green)'">
          <Icon :name="iconFor(call.status)" :class="call.status === 'running' ? 'size-3 animate-spin' : 'size-3'" />
        </span>
        <div class="min-w-0 flex-1">
          <div class="flex flex-wrap items-center gap-x-2 gap-y-1">
            <span class="font-medium">{{ call.name }}</span>
            <span class="font-mono text-[11px] uppercase tracking-[0.14em] text-(--or3-text-muted)">{{ labelFor(call.status) }}</span>
          </div>
          <p class="mt-0.5 text-xs leading-5 text-(--or3-text-muted)">{{ subtitleFor(call) }}</p>
        </div>
      </summary>

      <div class="space-y-2 border-t border-(--or3-border) px-3 py-2.5 text-xs leading-5 text-(--or3-text-muted)">
        <div v-if="call.arguments">
          <p class="mb-1 font-mono uppercase tracking-[0.14em] text-(--or3-green-dark)">Arguments</p>
          <pre class="overflow-x-auto rounded-xl bg-(--or3-surface) px-3 py-2 whitespace-pre-wrap text-(--or3-text-muted)">{{ pretty(call.arguments) }}</pre>
        </div>
        <div v-if="call.result">
          <p class="mb-1 font-mono uppercase tracking-[0.14em] text-(--or3-green-dark)">Result</p>
          <pre class="overflow-x-auto rounded-xl bg-(--or3-surface) px-3 py-2 whitespace-pre-wrap text-(--or3-text-muted)">{{ truncate(pretty(call.result), 800) }}</pre>
        </div>
        <div v-if="call.error">
          <p class="mb-1 font-mono uppercase tracking-[0.14em]" :class="call.status === 'attention' ? 'text-amber-700' : 'text-(--or3-danger)'">{{ call.status === 'attention' ? 'Approval' : 'Error' }}</p>
          <pre class="overflow-x-auto rounded-xl bg-(--or3-surface) px-3 py-2 whitespace-pre-wrap" :class="call.status === 'attention' ? 'text-amber-700' : 'text-(--or3-danger)'">{{ call.error }}</pre>
        </div>
      </div>
    </details>
  </div>
</template>

<script setup lang="ts">
import type { ChatToolCall } from '~/types/app-state'

defineProps<{ toolCalls: ChatToolCall[] }>()

function iconFor(status: ChatToolCall['status']) {
  if (status === 'running') return 'i-pixelarticons-loader'
  if (status === 'attention') return 'i-pixelarticons-shield'
  if (status === 'error') return 'i-pixelarticons-alert'
  return 'i-pixelarticons-check'
}

function labelFor(status: ChatToolCall['status']) {
  if (status === 'running') return 'RUNNING'
  if (status === 'attention') return 'WAITING'
  if (status === 'error') return 'FAILED'
  return 'DONE'
}

function subtitleFor(call: ChatToolCall) {
  if (call.status === 'running') return 'or3-intern is using this tool right now.'
  if (call.status === 'attention') return 'This tool call is waiting for your approval.'
  if (call.status === 'error') return 'This tool call ended with an error.'
  return 'This tool call finished successfully.'
}

function pretty(value: string) {
  try {
    return JSON.stringify(JSON.parse(value), null, 2)
  } catch {
    return value
  }
}

function truncate(value: string, limit: number) {
  return value.length > limit ? `${value.slice(0, limit)}\n…` : value
}
</script>
