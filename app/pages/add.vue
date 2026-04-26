<template>
  <AppShell>
    <AppHeader subtitle="ADD" />
    <SectionHeader title="Quick Actions" subtitle="Create something new or send it to or3-intern." />
    <div class="grid grid-cols-2 gap-3">
      <SurfaceCard v-for="action in actions" :key="action.label" interactive class-name="min-h-32 text-center" @click="runAction(action.prompt)">
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
  { label: 'New Memory', icon: 'i-lucide-notebook-pen', description: 'Save a note', prompt: 'Save this as a memory: ' },
  { label: 'Upload File', icon: 'i-lucide-upload', description: 'Send context', prompt: 'I want to upload and discuss a file.' },
  { label: 'Take Note', icon: 'i-lucide-pencil', description: 'Draft quickly', prompt: 'Take this note: ' },
  { label: 'Ask Assistant', icon: 'i-lucide-message-square', description: 'Jump to chat', prompt: 'Help me with ' },
  { label: 'New Agent', icon: 'i-lucide-bot', description: 'Delegate work', prompt: 'Create an agent task to ' },
  { label: 'Scan Later', icon: 'i-lucide-scan-line', description: 'Document flow', prompt: 'Remind me to scan a document.' },
]

async function runAction(prompt: string) {
  await router.push('/')
  await nextTick()
  void programmaticSend('main', prompt)
}
</script>
