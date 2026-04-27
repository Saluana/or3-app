<template>
  <details v-if="items.length" class="mt-3 overflow-hidden rounded-2xl border border-(--or3-border) bg-(--or3-surface-soft)">
    <summary class="flex cursor-pointer items-center gap-2 px-3 py-2 text-xs font-medium text-(--or3-text-muted)">
      <Icon name="i-lucide-list-tree" class="size-3.5" />
      Activity log
    </summary>
    <ol class="space-y-2 border-t border-(--or3-border) px-3 py-2.5">
      <li v-for="item in items" :key="item.id" class="flex gap-2 text-xs leading-5">
        <Icon :name="iconFor(item.status)" :class="['mt-0.5 size-3.5 shrink-0', item.status === 'running' && 'animate-spin']" />
        <div class="min-w-0">
          <p class="font-medium text-(--or3-text)">{{ item.label }}</p>
          <p v-if="item.detail" class="whitespace-pre-wrap text-(--or3-text-muted)">{{ item.detail }}</p>
        </div>
      </li>
    </ol>
  </details>
</template>

<script setup lang="ts">
import type { ChatActivityEntry } from '~/types/app-state'

defineProps<{ items: ChatActivityEntry[] }>()

function iconFor(status?: ChatActivityEntry['status']) {
  if (status === 'error') return 'i-lucide-circle-alert'
  if (status === 'complete') return 'i-lucide-check'
  return 'i-lucide-loader-circle'
}
</script>
