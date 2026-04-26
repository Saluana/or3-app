<template>
  <article :class="['flex gap-3', message.role === 'user' && 'justify-end']">
    <div v-if="message.role !== 'user'" class="mt-1 grid size-8 shrink-0 place-items-center rounded-xl bg-(--or3-green-soft) text-(--or3-green)">
      <Icon name="i-lucide-bot" class="size-4" />
    </div>
    <div :class="['max-w-[86%] rounded-[20px] border px-4 py-3 shadow-sm', message.role === 'user' ? 'border-(--or3-green) bg-(--or3-green-soft)' : 'border-(--or3-border) bg-(--or3-surface)']">
      <template v-if="message.role !== 'user'">
        <AssistantReasoningPanel
          :content="message.reasoningText"
          :pending="message.status === 'streaming' && !message.content"
          :tool-calls="message.toolCalls || []"
        />
        <AssistantToolCallList v-if="message.toolCalls?.length" :tool-calls="message.toolCalls" />
        <StreamingMarkdown v-if="message.content" :content="message.content" />
        <p v-else-if="message.status === 'streaming'" class="text-sm leading-6 text-(--or3-text-muted)">Thinking…</p>
      </template>
      <template v-else>
        <p v-if="message.content" class="whitespace-pre-wrap text-sm leading-6 text-(--or3-text)">{{ message.content }}</p>
        <div v-if="message.attachments?.length" class="mt-3 flex flex-wrap gap-2">
          <span
            v-for="attachment in message.attachments"
            :key="attachment.id"
            class="inline-flex max-w-full items-center gap-2 rounded-full border border-(--or3-border) bg-white/65 px-3 py-1.5 text-xs text-(--or3-text)"
          >
            <Icon :name="attachment.kind === 'text' ? 'i-lucide-notebook-text' : 'i-lucide-paperclip'" class="size-3.5 shrink-0" />
            <span class="truncate">{{ attachment.preview || attachment.name }}</span>
          </span>
        </div>
      </template>
      <p v-if="message.status === 'failed'" class="mt-2 text-xs text-(--or3-danger)">{{ message.error || 'Message failed' }}</p>
    </div>
  </article>
</template>

<script setup lang="ts">
import type { ChatMessage } from '~/types/app-state'

defineProps<{ message: ChatMessage }>()
</script>
