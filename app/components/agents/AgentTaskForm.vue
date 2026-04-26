<template>
  <SurfaceCard class-name="space-y-3">
    <div class="flex items-start gap-3">
      <RetroIcon name="i-lucide-bot" />
      <div>
        <p class="font-mono text-base font-semibold text-(--or3-text)">Hand off a task</p>
        <p class="mt-1 text-sm text-(--or3-text-muted)">
          Describe what you want done. or3-intern will work on it in the background and tell you when it's ready.
        </p>
      </div>
    </div>
    <UForm :state="formState" class="space-y-3" @submit.prevent="submit">
      <UFormField
        label="What should or3-intern do?"
        name="task"
        description="Plain English works best. Example: 'Look through my Notes folder and pull out anything about the Q4 plan.'"
      >
        <UTextarea
          v-model="formState.task"
          :rows="4"
          class="w-full"
          placeholder="Look through this folder and tell me what stands out…"
          aria-label="Task for or3-intern"
        />
      </UFormField>
      <UButton
        label="Send to or3-intern"
        icon="i-lucide-send"
        type="submit"
        block
        size="lg"
        :disabled="!formState.task.trim()"
      />
    </UForm>
  </SurfaceCard>
</template>

<script setup lang="ts">
import { reactive } from 'vue'

const emit = defineEmits<{ submit: [task: string] }>()
const formState = reactive({ task: '' })

function submit() {
  const value = formState.task.trim()
  if (!value) return
  emit('submit', value)
  formState.task = ''
}
</script>
