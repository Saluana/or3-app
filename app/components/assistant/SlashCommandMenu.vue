<template>
  <div class="overflow-hidden rounded-2xl border border-(--or3-border) bg-(--or3-surface) shadow-(--or3-shadow-soft)">
    <div class="flex items-center gap-2 border-b border-(--or3-border) px-3 py-2 text-xs text-(--or3-text-muted)">
      <Icon name="i-pixelarticons-slash" class="size-3.5 text-(--or3-green-dark)" />
      <span class="font-mono uppercase tracking-[0.16em]">Slash command</span>
    </div>
    <div v-if="items.length" class="max-h-64 overflow-y-auto p-1">
      <button
        v-for="(item, index) in items"
        :key="item.id"
        type="button"
        class="flex w-full items-start gap-3 rounded-xl px-3 py-2 text-left text-sm"
        :class="index === selectedIndex ? 'bg-(--or3-green-soft) text-(--or3-green-dark)' : 'text-(--or3-text) hover:bg-(--or3-surface-soft)'"
        @mousedown.prevent="emit('select', item)"
      >
        <Icon :name="item.icon" class="mt-0.5 size-4 shrink-0" />
        <span class="min-w-0 flex-1">
          <span class="flex items-center gap-2">
            <span class="font-medium">/{{ item.name }}</span>
            <span v-if="item.destructive" class="rounded-full border border-(--or3-border) px-1.5 py-0.5 text-[10px] uppercase tracking-wide">Careful</span>
          </span>
          <span class="mt-1 block text-xs text-(--or3-text-muted)">{{ item.description }}</span>
        </span>
      </button>
    </div>
    <p v-else class="px-3 py-3 text-sm text-(--or3-text-muted)">
      No local commands match that slash query.
    </p>
  </div>
</template>

<script setup lang="ts">
import type { ChatCommandDefinition } from '~/composables/useChatCommands'

defineProps<{
  items: ChatCommandDefinition[]
  selectedIndex: number
}>()

const emit = defineEmits<{
  select: [item: ChatCommandDefinition]
}>()
</script>