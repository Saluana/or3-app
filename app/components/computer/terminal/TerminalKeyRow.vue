<template>
  <div class="or3-terminal-keys">
    <div class="or3-terminal-keys__scroll">
      <button
        type="button"
        class="or3-terminal-keys__btn"
        :class="{ 'is-active': ctrlActive }"
        :disabled="disabled"
        :aria-pressed="ctrlActive"
        @click="emit('toggle-ctrl')"
      >Ctrl</button>

      <button
        type="button"
        class="or3-terminal-keys__btn"
        :disabled="disabled"
        @click="emit('key', '\t')"
      >Tab</button>

      <button
        type="button"
        class="or3-terminal-keys__btn"
        :disabled="disabled"
        @click="emit('key', '\u001b')"
      >Esc</button>

      <button
        type="button"
        class="or3-terminal-keys__btn"
        :disabled="disabled"
        @click="emit('key', '\r')"
      >Enter</button>

      <button
        type="button"
        class="or3-terminal-keys__btn or3-terminal-keys__btn--icon"
        :disabled="disabled"
        aria-label="Arrow left"
        @click="emit('key', '\u001b[D')"
      >
        <Icon name="i-pixelarticons-arrow-left" class="size-4" />
      </button>
      <button
        type="button"
        class="or3-terminal-keys__btn or3-terminal-keys__btn--icon"
        :disabled="disabled"
        aria-label="Arrow right"
        @click="emit('key', '\u001b[C')"
      >
        <Icon name="i-pixelarticons-arrow-right" class="size-4" />
      </button>
      <button
        type="button"
        class="or3-terminal-keys__btn or3-terminal-keys__btn--icon"
        :disabled="disabled"
        aria-label="Arrow up"
        @click="emit('key', '\u001b[A')"
      >
        <Icon name="i-pixelarticons-arrow-up" class="size-4" />
      </button>
      <button
        type="button"
        class="or3-terminal-keys__btn or3-terminal-keys__btn--icon"
        :disabled="disabled"
        aria-label="Arrow down"
        @click="emit('key', '\u001b[B')"
      >
        <Icon name="i-pixelarticons-arrow-down" class="size-4" />
      </button>

      <button
        type="button"
        class="or3-terminal-keys__btn"
        :disabled="disabled"
        @click="emit('key', '\u001b[5~')"
      >PgUp</button>
      <button
        type="button"
        class="or3-terminal-keys__btn"
        :disabled="disabled"
        @click="emit('key', '\u001b[6~')"
      >PgDn</button>

      <span class="or3-terminal-keys__divider" aria-hidden="true" />

      <button
        type="button"
        class="or3-terminal-keys__btn or3-terminal-keys__btn--quick"
        :class="{ 'is-active': quickActive }"
        :disabled="disabled"
        :aria-pressed="quickActive"
        :aria-expanded="quickActive"
        aria-label="Quick commands"
        @click="emit('toggle-quick')"
      >
        <Icon name="i-pixelarticons-zap" class="size-4" />
        <span class="or3-terminal-keys__btn-label">quick</span>
      </button>

      <button
        type="button"
        class="or3-terminal-keys__btn or3-terminal-keys__btn--icon"
        :disabled="disabled || fontSize <= fontSizeMin"
        aria-label="Decrease font size"
        @click="emit('zoom', -1)"
      >A−</button>
      <button
        type="button"
        class="or3-terminal-keys__btn or3-terminal-keys__btn--icon"
        :disabled="disabled || fontSize >= fontSizeMax"
        aria-label="Increase font size"
        @click="emit('zoom', 1)"
      >A+</button>
    </div>
  </div>
</template>

<script setup lang="ts">
defineProps<{
  disabled?: boolean
  ctrlActive?: boolean
  quickActive?: boolean
  fontSize: number
  fontSizeMin: number
  fontSizeMax: number
}>()

const emit = defineEmits<{
  key: [bytes: string]
  'toggle-ctrl': []
  'toggle-quick': []
  zoom: [delta: number]
}>()
</script>

<style scoped>
.or3-terminal-keys {
  padding: 4px 0 2px;
  background: transparent;
}

.or3-terminal-keys__scroll {
  display: flex;
  align-items: center;
  gap: 6px;
  overflow-x: auto;
  scrollbar-width: none;
  padding: 0 2px;
}

.or3-terminal-keys__scroll::-webkit-scrollbar { display: none; }

.or3-terminal-keys__btn {
  flex-shrink: 0;
  min-width: 40px;
  height: 34px;
  padding: 0 10px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 4px;
  border-radius: 10px;
  background: var(--or3-surface);
  border: 1px solid var(--or3-border);
  color: var(--or3-text);
  font-family: 'JetBrains Mono', 'IBM Plex Mono', ui-monospace, monospace;
  font-size: 12.5px;
  font-weight: 500;
  transition: background 120ms ease, transform 120ms ease, border-color 120ms ease;
}

.or3-terminal-keys__btn--icon {
  width: 36px;
  min-width: 36px;
  padding: 0;
}

.or3-terminal-keys__btn--quick {
  padding: 0 10px 0 8px;
  color: var(--or3-text);
}

.or3-terminal-keys__btn-label {
  font-size: 11.5px;
  letter-spacing: 0.02em;
}

.or3-terminal-keys__btn:hover:not(:disabled) {
  background: color-mix(in srgb, var(--or3-surface) 80%, var(--or3-green-soft) 20%);
}

.or3-terminal-keys__btn:active:not(:disabled) {
  transform: scale(0.96);
}

.or3-terminal-keys__btn.is-active {
  background: var(--or3-green-soft);
  border-color: color-mix(in srgb, var(--or3-green) 35%, transparent);
  color: var(--or3-green-dark);
}

.or3-terminal-keys__btn:disabled {
  opacity: 0.5;
}

.or3-terminal-keys__divider {
  width: 1px;
  height: 18px;
  background: var(--or3-border);
  margin: 0 2px;
  flex-shrink: 0;
}
</style>
