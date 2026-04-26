<template>
  <SurfaceCard class-name="space-y-3">
    <div>
      <p class="or3-label text-sm font-semibold">New Agent Task</p>
      <p class="mt-1 text-sm text-(--or3-text-muted)">Delegate work to or3-intern and monitor it from your phone.</p>
    </div>
    <textarea v-model="task" rows="4" class="w-full rounded-2xl border border-(--or3-border) bg-white/70 p-3 text-sm outline-none focus:border-(--or3-green)" placeholder="Research this folder and propose next steps…" aria-label="Agent task" />
    <UButton label="Queue agent" icon="i-lucide-bot" class="w-full justify-center bg-(--or3-green) text-white" :disabled="!task.trim()" @click="submit" />
  </SurfaceCard>
</template>

<script setup lang="ts">
import { ref } from 'vue'

const emit = defineEmits<{ submit: [task: string] }>()
const task = ref('')

function submit() {
  const value = task.value.trim()
  if (!value) return
  emit('submit', value)
  task.value = ''
}
</script>
