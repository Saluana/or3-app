<template>
  <Transition name="or3-terminal-quick">
    <div class="or3-terminal-quick" role="dialog" aria-label="Quick commands">
      <div class="or3-terminal-quick__head">
        <span class="or3-terminal-quick__label">
          <RetroIcon name="i-pixelarticons-zap" />
          <span>Quick commands</span>
        </span>
        <button
          type="button"
          class="or3-terminal-quick__close"
          aria-label="Close quick commands"
          @click="emit('close')"
        >
          <Icon name="i-pixelarticons-close" class="size-4" />
        </button>
      </div>
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
  </Transition>
</template>

<script setup lang="ts">
defineProps<{
  commands: string[]
  disabled?: boolean
}>()

const emit = defineEmits<{
  run: [command: string]
  close: []
}>()
</script>

<style scoped>
.or3-terminal-quick {
  position: absolute;
  left: 0;
  right: 0;
  bottom: 100%;
  margin-bottom: 8px;
  padding: 10px 12px;
  border-radius: var(--or3-radius-card);
  background: var(--or3-surface);
  border: 1px solid var(--or3-border);
  box-shadow: 0 14px 30px rgba(42, 35, 25, 0.14);
  display: flex;
  flex-direction: column;
  gap: 8px;
  z-index: 5;
}

.or3-terminal-quick__head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
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

.or3-terminal-quick__close {
  width: 38px;
  height: 38px;
  border-radius: 12px;
  background: transparent;
  border: 1px solid var(--or3-border);
  color: var(--or3-text-muted);
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.or3-terminal-quick__scroll {
  display: flex;
  align-items: center;
  gap: 6px;
  overflow-x: auto;
  padding: 2px 0 4px;
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

.or3-terminal-quick-enter-from,
.or3-terminal-quick-leave-to {
  opacity: 0;
  transform: translateY(6px);
}

.or3-terminal-quick-enter-active,
.or3-terminal-quick-leave-active {
  transition: opacity 140ms ease, transform 140ms ease;
}
</style>
