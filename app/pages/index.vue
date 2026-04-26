<template>
  <AppShell>
    <AppHeader subtitle="CHAT" />

    <div class="space-y-4">
      <SurfaceCard class-name="flex items-center gap-4">
        <RetroIcon name="i-lucide-monitor" size="lg" />
        <div class="min-w-0 flex-1">
          <h2 class="font-mono text-lg font-semibold text-(--or3-text)">Welcome back.</h2>
          <p class="mt-1 text-sm leading-6 text-(--or3-text-muted)">Chat with your intern, launch agents, and control your trusted computer.</p>
        </div>
      </SurfaceCard>

      <QuickPromptChips @select="draft = $event" />
      <ChatMessageList :messages="messages" />
      <AssistantComposer v-model="draft" :streaming="isStreaming" @send="send" @stop="stop" @files="handleFiles" />
    </div>
  </AppShell>
</template>

<script setup lang="ts">
const { messages, draft } = useChatSessions()
const { isStreaming, send, stop } = useAssistantStream()

function handleFiles(files: File[]) {
  if (!files.length) return
  draft.value = `Use these files as context: ${files.map((file) => file.name).join(', ')}`
}
</script>
