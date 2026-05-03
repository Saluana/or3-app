<template>
  <div class="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1">
    <button
      v-for="prompt in prompts"
      :key="prompt.text"
      type="button"
      class="or3-chip shrink-0"
      @click="emit('select', prompt.text)"
    >
      <Icon :name="prompt.icon" class="size-3.5" />
      <span>{{ prompt.label }}</span>
    </button>
  </div>
</template>

<script setup lang="ts">
const prompts = [
  { label: 'Summarize my computer', text: 'Give me a quick summary of what is on my computer right now.', icon: 'i-pixelarticons-monitor' },
  { label: 'Find recent notes', text: 'Find my recent project notes and pull out anything important.', icon: 'i-pixelarticons-search' },
  { label: 'Plan a task', text: 'Help me plan a task for or3-intern to work on in the background.', icon: 'i-pixelarticons-checklist' },
  { label: 'Check approvals', text: 'Check what is waiting for my approval.', icon: 'i-pixelarticons-shield' },
]

const emit = defineEmits<{ select: [value: string] }>()
</script>
