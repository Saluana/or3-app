<template>
  <SurfaceCard class-name="space-y-4">
    <div class="flex items-start justify-between gap-3">
      <div>
        <SectionHeader title="Terminal" subtitle="Secure shell session" />
        <p class="mt-1 text-sm text-(--or3-text-muted)">
          {{ session ? `Running in ${session.cwd}` : 'Start a bounded shell session on the connected computer.' }}
        </p>
      </div>
      <StatusPill :label="statusLabel" :tone="statusTone" />
    </div>

    <div class="rounded-3xl border border-stone-800 bg-stone-950 p-4 shadow-sm">
      <pre class="max-h-[48dvh] min-h-64 overflow-y-auto whitespace-pre-wrap wrap-break-word font-mono text-sm leading-6 text-green-200">{{ transcriptDisplay }}</pre>
    </div>

    <div class="grid gap-3 sm:grid-cols-[1fr_auto]">
      <UTextarea
        v-model="command"
        autoresize
        :rows="3"
        color="neutral"
        variant="outline"
        placeholder="Type a command, then tap Send"
        class="w-full"
      />
      <div class="flex items-stretch gap-2 sm:flex-col">
        <UButton
          label="Send"
          icon="i-lucide-arrow-up"
          color="primary"
          class="or3-touch-target justify-center"
          :loading="busy"
          :disabled="!session || !command.trim() || busy"
          @click="emitSend"
        />
        <UButton
          label="Close"
          icon="i-lucide-square"
          color="neutral"
          variant="soft"
          class="or3-touch-target justify-center"
          :disabled="!session || busy"
          @click="$emit('close')"
        />
      </div>
    </div>

    <div class="flex flex-wrap items-center gap-2 text-xs text-(--or3-text-muted)">
      <span class="or3-command">or3://computer/terminal</span>
      <span v-if="session">{{ session.shell }}</span>
      <span v-if="session">{{ session.rows }}×{{ session.cols }}</span>
      <span v-if="streaming">Live stream attached</span>
    </div>

    <p v-if="error" class="text-sm text-rose-600">{{ error }}</p>
  </SurfaceCard>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import type { TerminalSessionSnapshot } from '~/types/or3-api'

const props = defineProps<{
  session: TerminalSessionSnapshot | null
  transcript: string
  busy?: boolean
  streaming?: boolean
  error?: string | null
}>()

const emit = defineEmits<{
  send: [value: string]
  close: []
}>()

const command = ref('')

const transcriptDisplay = computed(() => props.transcript || '$ Awaiting session...\n')
const statusLabel = computed(() => props.session?.status ?? 'idle')
const statusTone = computed(() => {
  switch (props.session?.status) {
    case 'running':
      return 'green'
    case 'failed':
      return 'danger'
    case 'closed':
    case 'expired':
      return 'amber'
    default:
      return 'neutral'
  }
})

function emitSend() {
  const value = command.value.trim()
  if (!value) return
  emit('send', `${value}\n`)
  command.value = ''
}
</script>
