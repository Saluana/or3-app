<template>
  <AppShell>
    <AppHeader subtitle="CHAT" />

    <div class="space-y-4">
      <SurfaceCard class-name="flex items-start gap-4">
        <RetroIcon name="i-pixelarticons-sparkles" size="lg" />
        <div class="min-w-0 flex-1">
          <h2 class="font-mono text-lg font-semibold text-(--or3-text)">Hi, I'm or3-intern.</h2>
          <p class="mt-1 text-sm leading-6 text-(--or3-text-muted)">
            Ask me anything about your computer, save a note, or hand off a task. Tap a quick prompt below to get started.
          </p>
        </div>
      </SurfaceCard>

      <QuickPromptChips @select="draft = $event" />
      <ChatMessageList :messages="messages" />
      <AssistantComposer v-model="draft" :streaming="isStreaming" @send="send" @stop="stop" />
    </div>
  </AppShell>
</template>

<script setup lang="ts">
const { messages, draft } = useChatSessions()
const { isStreaming, send, stop } = useAssistantStream()
</script>
