<template>
  <article :class="['or3-msg', message.role === 'user' ? 'or3-msg--user' : 'or3-msg--assistant']">
    <div v-if="message.role !== 'user'" class="or3-msg__avatar" aria-hidden="true">
      <Icon name="i-pixelarticons-robot" class="size-4" />
    </div>

    <div class="or3-msg__body">
      <div :class="['or3-msg__bubble', message.role === 'user' ? 'or3-msg__bubble--user' : 'or3-msg__bubble--assistant']">
        <template v-if="message.role !== 'user'">
          <AssistantReasoningPanel
            :content="message.reasoningText"
            :pending="message.status === 'streaming' && !message.content"
            :tool-calls="message.toolCalls || []"
          />
          <AssistantToolCallList v-if="message.toolCalls?.length" :tool-calls="message.toolCalls" />
          <AssistantActivityLog v-if="message.activityLog?.length" :items="message.activityLog" />
          <StreamingMarkdown v-if="message.content" :content="message.content" />
          <p v-else-if="message.status === 'streaming'" class="or3-msg__thinking">
            <span class="or3-msg__dot" />
            <span class="or3-msg__dot" />
            <span class="or3-msg__dot" />
          </p>
        </template>
        <template v-else>
          <p v-if="message.content" class="whitespace-pre-wrap text-[0.9375rem] leading-6 text-(--or3-text)">{{ message.content }}</p>
          <div v-if="message.attachments?.length" class="mt-2 flex flex-wrap gap-1.5">
            <span
              v-for="attachment in message.attachments"
              :key="attachment.id"
              class="inline-flex max-w-full items-center gap-1.5 rounded-full border border-(--or3-border) bg-white/65 px-2.5 py-1 text-[11px] text-(--or3-text)"
            >
              <Icon :name="attachment.kind === 'text' ? 'i-pixelarticons-notebook' : 'i-pixelarticons-paperclip'" class="size-3 shrink-0" />
              <span class="truncate">{{ attachment.preview || attachment.name }}</span>
            </span>
          </div>
        </template>
        <p v-if="message.status === 'failed'" class="mt-2 text-xs text-(--or3-danger)">{{ message.error || 'Message failed' }}</p>
      </div>
      <div v-if="timestamp" class="or3-msg__meta">{{ timestamp }}</div>
    </div>
  </article>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import type { ChatMessage } from '~/types/app-state'

const props = defineProps<{ message: ChatMessage }>()

const timestamp = computed(() => {
  if (!props.message.createdAt) return ''
  try {
    const d = new Date(props.message.createdAt)
    if (Number.isNaN(d.getTime())) return ''
    return d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })
  } catch {
    return ''
  }
})
</script>

<style scoped>
.or3-msg {
  display: flex;
  gap: 0.75rem;
  width: 100%;
}

.or3-msg--user {
  justify-content: flex-end;
}

.or3-msg__avatar {
  flex-shrink: 0;
  margin-top: 0.125rem;
  width: 2rem;
  height: 2rem;
  display: grid;
  place-items: center;
  border-radius: 0.875rem;
  background: var(--or3-green-soft);
  color: var(--or3-green-dark);
  border: 1px solid color-mix(in srgb, var(--or3-green) 18%, transparent);
}

.or3-msg__body {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
  min-width: 0;
  max-width: 100%;
}

.or3-msg--user .or3-msg__body {
  align-items: flex-end;
  max-width: 86%;
}

.or3-msg--assistant .or3-msg__body {
  align-items: stretch;
  flex: 1 1 auto;
  min-width: 0;
}

.or3-msg__bubble {
  border-radius: 1.25rem;
  padding: 0.75rem 1rem;
  border: 1px solid var(--or3-border);
  box-shadow: var(--or3-shadow-soft);
  word-wrap: break-word;
  overflow-wrap: anywhere;
}

.or3-msg__bubble--assistant {
  background: var(--or3-surface);
  border-color: var(--or3-border);
  width: 100%;
}

.or3-msg__bubble--user {
  background: var(--or3-green-soft);
  border-color: color-mix(in srgb, var(--or3-green) 28%, white 72%);
  color: var(--or3-text);
  border-top-right-radius: 0.5rem;
}

.or3-msg__meta {
  font-size: 0.6875rem;
  letter-spacing: 0.04em;
  color: var(--or3-text-muted);
  padding: 0 0.25rem;
  opacity: 0;
  transition: opacity 0.18s ease;
}

.or3-msg:hover .or3-msg__meta,
.or3-msg:focus-within .or3-msg__meta {
  opacity: 0.7;
}

.or3-msg__thinking {
  display: inline-flex;
  align-items: center;
  gap: 0.3rem;
  padding: 0.125rem 0;
}

.or3-msg__dot {
  width: 0.4rem;
  height: 0.4rem;
  border-radius: 9999px;
  background: var(--or3-text-muted);
  opacity: 0.45;
  animation: or3-msg-dot 1.2s ease-in-out infinite;
}

.or3-msg__dot:nth-child(2) { animation-delay: 0.15s; }
.or3-msg__dot:nth-child(3) { animation-delay: 0.3s; }

@keyframes or3-msg-dot {
  0%, 80%, 100% { transform: scale(0.7); opacity: 0.35; }
  40% { transform: scale(1); opacity: 0.85; }
}

@media (prefers-reduced-motion: reduce) {
  .or3-msg__dot { animation: none; opacity: 0.6; }
  .or3-msg__meta { transition: none; }
}
</style>
