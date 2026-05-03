<template>
  <Transition name="or3-terminal-palette">
    <div v-if="open" class="or3-terminal-palette" role="dialog" aria-label="Control key combinations">
      <div class="or3-terminal-palette__head">
        <div>
          <p class="or3-terminal-palette__title">Control combos</p>
          <p class="or3-terminal-palette__hint">Tap a chip to send the chord. Auto-closes after one press.</p>
        </div>
        <button type="button" class="or3-terminal-palette__close" aria-label="Close" @click="emit('close')">
          <Icon name="i-pixelarticons-close" class="size-4" />
        </button>
      </div>
      <div class="or3-terminal-palette__row">
        <button
          v-for="key in ctrlKeys"
          :key="key"
          type="button"
          class="or3-terminal-palette__chip"
          :disabled="disabled"
          @click="send(key)"
        >
          Ctrl+{{ key }}
        </button>
      </div>
      <div class="or3-terminal-palette__row or3-terminal-palette__row--secondary">
        <button
          v-for="combo in shiftCombos"
          :key="`shift-${combo.label}`"
          type="button"
          class="or3-terminal-palette__chip or3-terminal-palette__chip--ghost"
          :disabled="disabled"
          @click="sendRaw(combo.bytes)"
        >
          Ctrl+Shift+{{ combo.label }}
        </button>
      </div>
    </div>
  </Transition>
</template>

<script setup lang="ts">
defineProps<{
  open: boolean
  disabled?: boolean
}>()

const emit = defineEmits<{
  send: [bytes: string]
  close: []
}>()

const ctrlKeys = ['A','B','C','D','E','F','G','H','I','J','K','L','M','N','O','P','Q','R','S','T','U','V','W','X','Y','Z','[',']','\\','/','Space']

// Ctrl+Shift+X is hard to do generically through a TTY (most terminals don't
// distinguish), but a handful of common chords have well-known sequences that
// modern shells/editors recognise. We send xterm-style modifier sequences.
const shiftCombos = [
  { label: 'P', bytes: '\u001b[80;6u' },     // Command palette in many TUIs
  { label: 'T', bytes: '\u001b[84;6u' },     // New tab in tmux/etc.
  { label: 'R', bytes: '\u001b[82;6u' },     // Reload-style binding
]

function ctrlByte(key: string): string {
  if (key === 'Space') return '\u0000'
  if (key === '[') return '\u001b'
  if (key === ']') return '\u001d'
  if (key === '\\') return '\u001c'
  if (key === '/') return '\u001f'
  const code = key.toUpperCase().charCodeAt(0)
  if (code >= 64 && code <= 95) return String.fromCharCode(code & 0x1f)
  return key
}

function send(key: string) {
  emit('send', ctrlByte(key))
  emit('close')
}

function sendRaw(bytes: string) {
  emit('send', bytes)
  emit('close')
}
</script>

<style scoped>
.or3-terminal-palette {
  position: absolute;
  left: 0;
  right: 0;
  bottom: 100%;
  margin-bottom: 8px;
  padding: 14px;
  background: var(--or3-surface);
  border: 1px solid var(--or3-border);
  border-radius: var(--or3-radius-card);
  box-shadow: 0 18px 40px rgba(42, 35, 25, 0.18);
  display: flex;
  flex-direction: column;
  gap: 10px;
  z-index: 5;
}

.or3-terminal-palette__head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
}

.or3-terminal-palette__title {
  font-size: 14px;
  font-weight: 600;
  color: var(--or3-text);
  margin: 0;
}

.or3-terminal-palette__hint {
  margin: 2px 0 0;
  font-size: 12px;
  color: var(--or3-text-muted);
}

.or3-terminal-palette__close {
  width: 36px;
  height: 36px;
  border-radius: 12px;
  background: transparent;
  border: 1px solid var(--or3-border);
  color: var(--or3-text-muted);
  display: inline-flex;
  align-items: center;
  justify-content: center;
}

.or3-terminal-palette__row {
  display: flex;
  align-items: center;
  gap: 6px;
  overflow-x: auto;
  padding-bottom: 4px;
  scrollbar-width: none;
}

.or3-terminal-palette__row::-webkit-scrollbar { display: none; }

.or3-terminal-palette__row--secondary {
  border-top: 1px dashed var(--or3-border);
  padding-top: 8px;
}

.or3-terminal-palette__chip {
  flex-shrink: 0;
  min-width: 64px;
  height: 38px;
  padding: 0 10px;
  border-radius: 12px;
  background: var(--or3-green-soft);
  color: var(--or3-green-dark);
  border: 1px solid color-mix(in srgb, var(--or3-green) 25%, transparent);
  font-family: 'JetBrains Mono', 'IBM Plex Mono', ui-monospace, monospace;
  font-size: 12.5px;
  font-weight: 600;
  transition: transform 120ms ease, background 120ms ease;
}

.or3-terminal-palette__chip--ghost {
  background: var(--or3-surface);
  color: var(--or3-text);
  border-color: var(--or3-border);
}

.or3-terminal-palette__chip:active {
  transform: scale(0.96);
}

.or3-terminal-palette__chip:disabled {
  opacity: 0.45;
  cursor: not-allowed;
}

.or3-terminal-palette-enter-from,
.or3-terminal-palette-leave-to {
  opacity: 0;
  transform: translateY(8px);
}

.or3-terminal-palette-enter-active,
.or3-terminal-palette-leave-active {
  transition: opacity 160ms ease, transform 160ms ease;
}
</style>
