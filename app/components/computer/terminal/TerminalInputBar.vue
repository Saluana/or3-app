<template>
  <div class="or3-terminal-input" :class="{ 'is-disabled': disabled }">
    <UTextarea
      v-model="text"
      :rows="1"
      :maxrows="4"
      autoresize
      color="neutral"
      variant="none"
      :disabled="disabled"
      placeholder="Type a command, then tap Send."
      class="or3-terminal-input__textarea"
      :ui="{ base: 'or3-terminal-input__textarea-inner' }"
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
          aria-label="Paste from clipboard"
          @click="paste"
        >
          <Icon name="i-pixelarticons-clipboard" class="size-4" />
          <span>Paste</span>
        </button>
        <button
          type="button"
          class="or3-terminal-input__chip"
          :disabled="disabled || !text"
          aria-label="Clear input"
          @click="clear"
        >
          <Icon name="i-pixelarticons-trash" class="size-4" />
          <span>Clear</span>
        </button>
      </div>
      <button
        type="button"
        class="or3-terminal-input__send"
        :disabled="disabled || !text.trim()"
        aria-label="Send command"
        @click="onSend"
      >
        <Icon name="i-pixelarticons-arrow-up" class="size-4" />
      </button>
    </div>
    <p v-if="error" class="or3-terminal-input__error">{{ error }}</p>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'

const props = defineProps<{
  disabled?: boolean
  error?: string | null
}>()

const emit = defineEmits<{
  send: [value: string]
}>()

const text = ref('')

function onEnter(event: KeyboardEvent) {
  if (event.shiftKey) {
    text.value += '\n'
    return
  }
  onSend()
}

function onSend() {
  const value = text.value
  if (!value.trim()) return
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
    /* clipboard denied */
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
  gap: 4px;
  padding: 6px 8px 8px;
  border-radius: var(--or3-radius-card);
  background: var(--or3-surface);
  border: 1px solid var(--or3-border);
  box-shadow: var(--or3-shadow-soft);
}

.or3-terminal-input.is-disabled {
  opacity: 0.85;
}

.or3-terminal-input__textarea {
  width: 100%;
}

.or3-terminal-input__textarea :deep(textarea) {
  min-height: 36px;
  padding: 8px 6px 4px;
  font-family: 'JetBrains Mono', 'IBM Plex Mono', ui-monospace, monospace;
  font-size: 16px;
  line-height: 1.35;
  background: transparent;
  border: none;
  box-shadow: none;
}

.or3-terminal-input__textarea :deep(textarea:focus) {
  box-shadow: none;
  outline: none;
}

.or3-terminal-input__row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  padding: 0 2px;
}

.or3-terminal-input__actions {
  display: inline-flex;
  align-items: center;
  gap: 4px;
}

.or3-terminal-input__chip {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 4px 8px;
  border-radius: 8px;
  background: transparent;
  color: var(--or3-text-muted);
  border: none;
  font-size: 12px;
  font-weight: 500;
  transition: background 120ms ease, color 120ms ease;
  min-height: 28px;
}

.or3-terminal-input__chip:hover:not(:disabled) {
  background: color-mix(in srgb, var(--or3-surface) 70%, var(--or3-green-soft) 30%);
  color: var(--or3-text);
}

.or3-terminal-input__chip:disabled {
  opacity: 0.45;
  cursor: not-allowed;
}

.or3-terminal-input__send {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 36px;
  height: 36px;
  border-radius: 999px;
  background: var(--or3-green);
  color: #ffffff;
  border: none;
  box-shadow: 0 4px 10px color-mix(in srgb, var(--or3-green) 35%, transparent);
  transition: transform 120ms ease, background 120ms ease, box-shadow 120ms ease;
}

.or3-terminal-input__send:hover:not(:disabled) {
  background: var(--or3-green-dark);
  transform: translateY(-1px);
}

.or3-terminal-input__send:active:not(:disabled) {
  transform: translateY(0) scale(0.95);
}

.or3-terminal-input__send:disabled {
  background: color-mix(in srgb, var(--or3-green) 30%, var(--or3-surface) 70%);
  box-shadow: none;
  cursor: not-allowed;
}

.or3-terminal-input__error {
  margin: 0;
  padding: 0 2px;
  font-size: 12px;
  line-height: 1.3;
  color: var(--or3-danger);
}
</style>
