<template>
  <article :class="['flex gap-3', message.role === 'user' && 'justify-end']">
    <div v-if="message.role !== 'user'" class="mt-1 grid size-8 shrink-0 place-items-center rounded-xl bg-(--or3-green-soft) text-(--or3-green)">
      <Icon name="i-lucide-bot" class="size-4" />
    </div>
    <div :class="['max-w-[86%] rounded-[20px] border px-4 py-3 shadow-sm', message.role === 'user' ? 'border-(--or3-green) bg-(--or3-green-soft)' : 'border-(--or3-border) bg-(--or3-surface)']">
      <StreamingMarkdown v-if="message.role !== 'user'" :content="message.content || (message.status === 'streaming' ? 'Thinking…' : '')" />
      <p v-else class="whitespace-pre-wrap text-sm leading-6 text-(--or3-text)">{{ message.content }}</p>
      <p v-if="message.status === 'failed'" class="mt-2 text-xs text-(--or3-danger)">{{ message.error || 'Message failed' }}</p>
    </div>
  </article>
</template>

<script setup lang="ts">
import type { ChatMessage } from '~/types/app-state'

defineProps<{ message: ChatMessage }>()
</script>
