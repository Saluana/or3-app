<template>
  <div class="or3-terminal-input">
    <UTextarea
      v-model="text"
      :rows="2"
      autoresize
      color="neutral"
      variant="outline"
      :disabled="disabled"
      placeholder="Type a command, then tap Send."
      class="or3-terminal-input__textarea"
      @keydown.enter.exact.prevent="onEnter"
      @keydown.meta.enter.prevent="onSend"
      @keydown.ctrl.enter.prevent="onSend"
    />
    <div class="or3-terminal-input__row">
      <div class="or3-terminal-input__actions">
        <button
          type="button"
          class="or3-terminal-input__chip"
          :disabled="disabled"
          @click="paste"
        >
          <RetroIcon name="i-pixelarticons-clipboard" />
          <span>Paste</span>
        </button>
        <button
          type="button"
          class="or3-terminal-input__chip"
          :disabled="disabled || !text"
          @click="clear"
        >
          <RetroIcon name="i-pixelarticons-trash" />
          <span>Clear</span>
        </button>
      </div>
      <button
        type="button"
        class="or3-terminal-input__send"
        :disabled="disabled || !text.trim()"
        :aria-label="'Send command'"
        @click="onSend"
      >
        <RetroIcon name="i-pixelarticons-arrow-up" />
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'

const props = defineProps<{
  disabled?: boolean
}>()

const emit = defineEmits<{
  send: [value: string]
}>()

const text = ref('')

function onEnter(event: KeyboardEvent) {
  // Enter alone sends; Shift+Enter inserts a newline (handled by browser default).
  if (event.shiftKey) {
    text.value += '\n'
    return
  }
  onSend()
}

function onSend() {
  const value = text.value
  if (!value.trim()) return
  // Always end with a newline so the shell executes immediately.
  const payload = value.endsWith('\n') ? value : `${value}\n`
  emit('send', payload)
  text.value = ''
}

async function paste() {
  if (props.disabled) return
  try {
    const value = await navigator.clipboard.readText()
    if (value) text.value = text.value ? `${text.value}${value}` : value
  } catch {
    // Clipboard access may be denied; the user can long-press to paste.
  }
}

function clear() {
  text.value = ''
}
</script>

<style scoped>
.or3-terminal-input {
  display: flex;
  flex-direction: column;
  gap: 10px;
  padding: 12px;
  border-radius: var(--or3-radius-card);
  background: var(--or3-surface);
  border: 1px solid var(--or3-border);
  box-shadow: var(--or3-shadow-soft);
}

.or3-terminal-input__textarea :deep(textarea) {
  min-height: 56px;
  font-family: 'JetBrains Mono', 'IBM Plex Mono', ui-monospace, monospace;
}

.or3-terminal-input__row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.or3-terminal-input__actions {
  display: inline-flex;
  align-items: center;
  gap: 8px;
}

.or3-terminal-input__chip {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 8px 12px;
  border-radius: 999px;
  background: transparent;
  color: var(--or3-text);
  border: 1px solid var(--or3-border);
  font-size: 13px;
  font-weight: 500;
  transition: background 120ms ease, transform 120ms ease;
  min-height: 36px;
}

.or3-terminal-input__chip:hover:not(:disabled) {
  background: color-mix(in srgb, var(--or3-surface) 80%, var(--or3-green-soft) 20%);
}

.or3-terminal-input__chip:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.or3-terminal-input__send {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 48px;
  height: 48px;
  border-radius: 999px;
  background: var(--or3-green);
  color: #ffffff;
  border: none;
  box-shadow: 0 6px 14px color-mix(in srgb, var(--or3-green) 35%, transparent);
  transition: transform 120ms ease, background 120ms ease, box-shadow 120ms ease;
}

.or3-terminal-input__send:hover:not(:disabled) {
  background: var(--or3-green-dark);
  transform: translateY(-1px);
}

.or3-terminal-input__send:active:not(:disabled) {
  transform: translateY(0) scale(0.97);
}

.or3-terminal-input__send:disabled {
  background: color-mix(in srgb, var(--or3-green) 35%, var(--or3-surface) 65%);
  box-shadow: none;
  cursor: not-allowed;
}
</style>
