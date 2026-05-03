<template>
  <SurfaceCard class-name="or3-terminal-card !p-0 overflow-hidden">
    <header class="or3-terminal-card__head">
      <div class="or3-terminal-card__heading">
        <SectionHeader title="Terminal session" subtitle="Live PTY shell on your computer" />
        <p class="or3-terminal-card__sub">
          {{ session ? `Working in ${session.cwd}` : "Pick an area above and tap 'Open terminal' to start." }}
        </p>
      </div>
      <StatusPill :label="statusLabel" :tone="statusTone" :pulse="session?.status === 'running'" />
    </header>

    <div class="or3-terminal-card__body">
      <TerminalConsole
        ref="consoleRef"
        :session="session"
        :chunks="chunks"
        :font-size="fontSize"
        @data="onConsoleData"
        @resize="onConsoleResize"
      />
    </div>

    <footer class="or3-terminal-card__foot">
      <TerminalQuickCommands
        :commands="quickCommands"
        :disabled="!session || busy"
        @run="onQuickCommand"
      />
      <div class="or3-terminal-card__keys-wrap">
        <TerminalCtrlPalette
          :open="ctrlOpen"
          @send="onPaletteSend"
          @close="ctrlOpen = false"
        />
        <TerminalKeyRow
          :disabled="!session || busy"
          :ctrl-active="ctrlOpen"
          :font-size="fontSize"
          :font-size-min="fontSizeMin"
          :font-size-max="fontSizeMax"
          @key="onKey"
          @toggle-ctrl="ctrlOpen = !ctrlOpen"
          @zoom="onZoom"
        />
      </div>
      <TerminalInputBar
        :disabled="!session || busy"
        @send="onSendText"
      />
    </footer>

    <div v-if="session" class="or3-terminal-card__meta">
      <span class="or3-command">or3://computer/terminal</span>
      <span>{{ session.shell }}</span>
      <span>{{ session.rows }}×{{ session.cols }}</span>
      <span v-if="streaming" class="or3-terminal-card__live"><span class="or3-live-dot" />Live</span>
      <UButton
        size="xs"
        variant="ghost"
        color="neutral"
        label="Close session"
        icon="i-pixelarticons-close"
        :disabled="busy"
        @click="emit('close')"
      />
    </div>

    <p v-if="error" class="or3-terminal-card__error">{{ error }}</p>
  </SurfaceCard>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import type { TerminalSessionSnapshot } from '~/types/or3-api'

const props = defineProps<{
  session: TerminalSessionSnapshot | null
  chunks: { id: number; data: string }[]
  busy?: boolean
  streaming?: boolean
  error?: string | null
  fontSize: number
  fontSizeMin: number
  fontSizeMax: number
}>()

const emit = defineEmits<{
  send: [bytes: string]
  resize: [rows: number, cols: number]
  close: []
  zoom: [delta: number]
}>()

const consoleRef = ref<{ focus: () => void; fit: () => void } | null>(null)
const ctrlOpen = ref(false)

const quickCommands = ['ls -la', 'cd ..', 'pwd', 'git status', 'top', 'htop', 'docker ps', 'clear']

const statusLabel = computed(() => props.session?.status ?? 'idle')
const statusTone = computed(() => {
  switch (props.session?.status) {
    case 'running': return 'green'
    case 'failed': return 'danger'
    case 'closed':
    case 'expired': return 'amber'
    default: return 'neutral'
  }
})

function onConsoleData(bytes: string) {
  // Forward keystrokes typed inside the xterm canvas (e.g. desktop users).
  emit('send', bytes)
}

function onConsoleResize(rows: number, cols: number) {
  emit('resize', rows, cols)
}

function onSendText(value: string) {
  emit('send', value)
}

function onKey(bytes: string) {
  emit('send', bytes)
  consoleRef.value?.focus()
}

function onPaletteSend(bytes: string) {
  emit('send', bytes)
}

function onQuickCommand(cmd: string) {
  emit('send', `${cmd}\n`)
}

function onZoom(delta: number) {
  emit('zoom', delta)
}
</script>

<style scoped>
.or3-terminal-card__head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
  padding: 16px 18px 8px;
}

.or3-terminal-card__sub {
  margin-top: 4px;
  font-size: 13px;
  color: var(--or3-text-muted);
}

.or3-terminal-card__body {
  padding: 0 12px;
  display: flex;
  flex-direction: column;
}

.or3-terminal-card__body :deep(.or3-terminal-screen-wrap) {
  height: 56dvh;
  min-height: 280px;
  max-height: 640px;
}

.or3-terminal-card__foot {
  position: relative;
  padding: 8px 12px 12px;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.or3-terminal-card__keys-wrap {
  position: relative;
}

.or3-terminal-card__meta {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 10px;
  padding: 4px 18px 14px;
  font-size: 12px;
  color: var(--or3-text-muted);
}

.or3-terminal-card__live {
  display: inline-flex;
  align-items: center;
  gap: 4px;
}

.or3-terminal-card__error {
  padding: 0 18px 14px;
  font-size: 13px;
  color: var(--or3-danger);
}
</style>
