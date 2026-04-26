<template>
  <SurfaceCard interactive class-name="space-y-3">
    <div class="flex items-start justify-between gap-3">
      <div>
        <p class="font-mono text-sm font-semibold text-(--or3-text)">{{ title }}</p>
        <p class="mt-1 text-xs text-(--or3-text-muted)">{{ job.job_id }}</p>
      </div>
      <StatusPill :label="job.status" :tone="tone" />
    </div>
    <p v-if="job.final_text" class="line-clamp-3 text-sm leading-6 text-(--or3-text-muted)">{{ job.final_text }}</p>
    <p v-if="job.error" class="text-sm text-(--or3-danger)">{{ job.error }}</p>
    <div v-if="job.final_text" class="flex justify-end">
      <UButton label="Continue in chat" icon="i-lucide-message-square" color="neutral" variant="soft" class="or3-touch-target" @click.stop="$emit('continue', job)" />
    </div>
  </SurfaceCard>
</template>

<script setup lang="ts">
import type { JobSnapshot } from '~/types/or3-api'

const props = defineProps<{ job: JobSnapshot }>()
defineEmits<{ continue: [job: JobSnapshot] }>()

const title = computed(() => props.job.kind || 'Agent job')
const tone = computed(() => props.job.status === 'completed' ? 'green' : props.job.status === 'failed' ? 'danger' : 'amber')
</script>
