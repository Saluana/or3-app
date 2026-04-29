<template>
  <div class="or3-chat-shell">
    <div class="or3-chat-shell__header">
      <AppHeader subtitle="CHAT" />
    </div>

    <div ref="scrollEl" class="or3-chat-shell__body">
      <div class="or3-chat-shell__content">
        <!-- Empty state hero (shown only when there are no messages yet) -->
        <section v-if="!messages.length" class="or3-chat-empty">
          <div class="or3-chat-empty__avatar">
            <RetroIcon name="i-pixelarticons-sparkles" size="lg" />
          </div>
          <h1 class="or3-chat-empty__title">Hi, I'm or3-intern.</h1>
          <p class="or3-chat-empty__subtitle">
            Ask me anything about your computer, save a note, or hand off a task. Tap a quick prompt below to get started.
          </p>
          <QuickPromptChips
            class="or3-chat-empty__chips"
            @select="onPromptSelect"
          />
        </section>

        <!-- Conversation thread -->
        <ol v-else class="or3-chat-thread" role="list">
          <li v-for="m in messages" :key="m.id">
            <ChatMessage :message="m" />
          </li>
        </ol>
      </div>
    </div>

    <!-- Soft fade so messages disappear gently behind the composer -->
    <div class="or3-chat-shell__fade" aria-hidden="true" />

    <!-- Floating composer pinned just above the bottom navigation -->
    <div class="or3-chat-shell__composer">
      <div class="or3-chat-shell__composer-inner">
        <AssistantComposer
          v-model="draft"
          :streaming="isStreaming"
          @send="send"
          @stop="stop"
        />
      </div>
    </div>

    <BottomNav />
  </div>
</template>

<script setup lang="ts">
import { nextTick, onMounted, ref, watch } from 'vue'

const { messages, draft } = useChatSessions()
const { isStreaming, send, stop } = useAssistantStream()

const scrollEl = ref<HTMLElement | null>(null)

function onPromptSelect(value: string) {
  draft.value = value
}

function isNearBottom(el: HTMLElement, threshold = 120) {
  return el.scrollHeight - el.scrollTop - el.clientHeight < threshold
}

function scrollToBottom(smooth = true) {
  const el = scrollEl.value
  if (!el) return
  el.scrollTo({ top: el.scrollHeight, behavior: smooth ? 'smooth' : 'auto' })
}

// Auto-scroll on new messages and during streaming, but only nudge while the
// user is already near the bottom — never yank them up while they're reading.
watch(
  () => messages.value.length,
  async () => {
    await nextTick()
    scrollToBottom(true)
  },
)

watch(
  () => messages.value[messages.value.length - 1]?.content,
  async () => {
    const el = scrollEl.value
    if (!el) return
    if (!isNearBottom(el, 200)) return
    await nextTick()
    scrollToBottom(false)
  },
)

onMounted(() => {
  // Land at the bottom on first paint when there's existing history.
  nextTick(() => scrollToBottom(false))
})
</script>
