<template>
  <div class="or3-terminal-quick">
    <span class="or3-terminal-quick__label">
      <RetroIcon name="i-pixelarticons-zap" />
      <span>Quick commands</span>
    </span>
    <div class="or3-terminal-quick__scroll">
      <button
        v-for="cmd in commands"
        :key="cmd"
        type="button"
        class="or3-terminal-quick__chip"
        :disabled="disabled"
        @click="emit('run', cmd)"
      >
        {{ cmd }}
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
defineProps<{
  commands: string[]
  disabled?: boolean
}>()

const emit = defineEmits<{
  run: [command: string]
}>()
</script>

<style scoped>
.or3-terminal-quick {
  display: flex;
  flex-direction: column;
  gap: 6px;
  padding: 10px 12px 8px;
  border-top: 1px solid var(--or3-border);
}

.or3-terminal-quick__label {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  color: var(--or3-text-muted);
  font-size: 12px;
  font-weight: 500;
  letter-spacing: 0.02em;
}

.or3-terminal-quick__scroll {
  display: flex;
  align-items: center;
  gap: 8px;
  overflow-x: auto;
  padding: 4px 0 6px;
  scrollbar-width: none;
}

.or3-terminal-quick__scroll::-webkit-scrollbar { display: none; }

.or3-terminal-quick__chip {
  flex-shrink: 0;
  padding: 6px 12px;
  border-radius: 999px;
  background: var(--or3-surface);
  border: 1px solid var(--or3-border);
  color: var(--or3-text);
  font-family: 'JetBrains Mono', 'IBM Plex Mono', ui-monospace, monospace;
  font-size: 12.5px;
  white-space: nowrap;
  transition: background 120ms ease, transform 120ms ease;
}

.or3-terminal-quick__chip:hover:not(:disabled) {
  background: color-mix(in srgb, var(--or3-surface) 80%, var(--or3-green-soft) 20%);
}

.or3-terminal-quick__chip:active:not(:disabled) {
  transform: scale(0.97);
}

.or3-terminal-quick__chip:disabled {
  opacity: 0.5;
}
</style>
