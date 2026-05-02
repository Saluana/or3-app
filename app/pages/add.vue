<template>
  <AppShell>
    <AppHeader subtitle="QUICK ADD" />
    <SectionHeader title="What do you want to do?" subtitle="Tap to start a new chat in the right way" />
    <div class="grid grid-cols-2 gap-3">
      <SurfaceCard
        v-for="action in actions"
        :key="action.label"
        interactive
        class-name="min-h-32 text-center"
        @click="runAction(action)"
      >
        <RetroIcon :name="action.icon" size="lg" />
        <p class="mt-3 font-mono text-sm font-semibold">{{ action.label }}</p>
        <p class="mt-1 text-xs leading-5 text-(--or3-text-muted)">{{ action.description }}</p>
      </SurfaceCard>
    </div>
  </AppShell>
</template>

<script setup lang="ts">
import { programmaticSend } from '~/composables/useChatInputBridge'

const router = useRouter()
const actions = [
  { label: 'Save a note', icon: 'i-pixelarticons-notebook', description: 'Write a quick note or3-intern can find later.', prompt: 'Save this as a note: ' },
  { label: 'Talk about a file', icon: 'i-pixelarticons-upload', description: 'Send a file and ask a question about it.', prompt: "I'd like to talk about a file. Here it is: " },
  { label: 'Quick reminder', icon: 'i-pixelarticons-bell', description: 'Tell or3-intern something to remember for you.', prompt: 'Remind me to: ' },
  { label: 'Ask a question', icon: 'i-pixelarticons-message-text', description: 'Just chat. No special formatting.', prompt: '' },
  { label: 'Hand off a task', icon: 'i-pixelarticons-robot', description: 'Send work to an agent that runs in the background.', prompt: 'Please work on this in the background: ' },
  { label: 'Scan later', icon: 'i-pixelarticons-ai-scan', description: 'Set a reminder to scan a paper document later.', prompt: 'Remind me to scan a document.' },
  { label: 'Prompt library', icon: 'i-pixelarticons-book', description: 'Open saved workspace prompts and edit them as Markdown.', route: '/prompts' },
]

async function runAction(action: { prompt?: string; route?: string }) {
  if (action.route) {
    await router.push(action.route)
    return
  }

  const prompt = action.prompt || ''
  await router.push('/')
  await nextTick()
  void programmaticSend('main', prompt)
}
</script>
