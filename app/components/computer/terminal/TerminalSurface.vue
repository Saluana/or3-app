<template>
  <section class="or3-terminal-stage" :data-has-session="Boolean(session)">
    <div class="or3-terminal-stage__screen">
      <TerminalConsole
        ref="consoleRef"
        :session="session"
        :chunks="chunks"
        :font-size="fontSize"
        @data="onConsoleData"
        @resize="onConsoleResize"
      />
      <slot name="screen-overlay" />
    </div>

    <footer class="or3-terminal-stage__foot">
      <div class="or3-terminal-stage__keys-wrap">
        <TerminalQuickCommands
          v-show="quickOpen"
          :commands="quickCommands"
          :disabled="!interactive || busy"
          @run="onQuickCommand"
          @close="quickOpen = false"
        />
        <TerminalCtrlPalette
          :open="ctrlOpen"
          :disabled="!interactive || busy"
          @send="onPaletteSend"
          @close="ctrlOpen = false"
        />
        <TerminalKeyRow
          :disabled="!interactive || busy"
          :ctrl-active="ctrlOpen"
          :quick-active="quickOpen"
          :font-size="fontSize"
          :font-size-min="fontSizeMin"
          :font-size-max="fontSizeMax"
          @key="onKey"
          @toggle-ctrl="onToggleCtrl"
          @toggle-quick="onToggleQuick"
          @zoom="onZoom"
        />
      </div>
      <TerminalInputBar
        :disabled="!interactive || busy"
        :error="error"
        @send="onSendText"
      />
    </footer>

    <p v-if="error" class="or3-terminal-stage__error">{{ error }}</p>
  </section>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue'
import type { TerminalSessionSnapshot } from '~/types/or3-api'

const props = defineProps<{
  session: TerminalSessionSnapshot | null
  chunks: { id: number; data: string }[]
  busy?: boolean
  streaming?: boolean
  error?: string | null
  interactive?: boolean
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
const quickOpen = ref(false)

const quickCommands = [
  'ls -la',
  'cd ..',
  'pwd',
  'git status',
  'git diff',
  'top',
  'htop',
  'docker ps',
  'clear',
]

function onConsoleData(bytes: string) {
  emit('send', bytes)
}

function onConsoleResize(rows: number, cols: number) {
  emit('resize', rows, cols)
}

function onSendText(value: string) {
  emit('send', value)
}

function shouldRefocusConsoleAfterVirtualKey() {
  if (typeof window === 'undefined') return false
  if (typeof window.matchMedia !== 'function') return true
  return window.matchMedia('(hover: hover) and (pointer: fine)').matches
}

function onKey(bytes: string) {
  emit('send', bytes)
  if (shouldRefocusConsoleAfterVirtualKey()) {
    consoleRef.value?.focus()
  }
}

function onPaletteSend(bytes: string) {
  emit('send', bytes)
}

function onQuickCommand(cmd: string) {
  emit('send', `${cmd}\n`)
  quickOpen.value = false
}

function onToggleCtrl() {
  ctrlOpen.value = !ctrlOpen.value
  if (ctrlOpen.value) quickOpen.value = false
}

function onToggleQuick() {
  quickOpen.value = !quickOpen.value
  if (quickOpen.value) ctrlOpen.value = false
}

function onZoom(delta: number) {
  emit('zoom', delta)
}

watch(
  () => props.interactive,
  (interactive) => {
    if (interactive) return
    ctrlOpen.value = false
    quickOpen.value = false
  },
)

defineExpose({
  focus() {
    consoleRef.value?.focus()
  },
  fit() {
    consoleRef.value?.fit()
  },
})
</script>

<style scoped>
.or3-terminal-stage {
  display: flex;
  flex-direction: column;
  flex: 1 1 auto;
  min-height: 0;
  gap: 8px;
}

.or3-terminal-stage__screen {
  position: relative;
  flex: 1 1 auto;
  min-height: 0;
  display: flex;
  flex-direction: column;
}

.or3-terminal-stage__screen :deep(.or3-terminal-screen-wrap) {
  flex: 1 1 auto;
  min-height: 0;
  height: 100%;
  border-radius: var(--or3-radius-card);
}

.or3-terminal-stage__foot {
  position: relative;
  display: flex;
  flex-direction: column;
  gap: 6px;
  padding: 0;
}

.or3-terminal-stage__keys-wrap {
  position: relative;
}

.or3-terminal-stage__error {
  margin: 0;
  padding: 6px 12px;
  font-size: 13px;
  color: var(--or3-danger);
}
</style>
