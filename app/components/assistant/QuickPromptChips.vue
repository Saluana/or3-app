<template>
  <div class="flex gap-2 overflow-x-auto pb-2">
    <UButton v-for="prompt in prompts" :key="prompt" :label="prompt" color="neutral" variant="soft" size="sm" class="shrink-0" @click="emit('select', prompt)" />
  </div>
</template>

<script setup lang="ts">
const prompts = [
  'Summarize this computer',
  'Find recent project notes',
  'Create an agent task',
  'Check pending approvals',
]

const emit = defineEmits<{ select: [value: string] }>()
</script>
