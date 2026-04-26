<template>
  <SurfaceCard interactive class-name="space-y-3">
    <div class="flex items-start justify-between gap-3">
      <div class="min-w-0">
        <p class="font-mono text-sm font-semibold text-(--or3-text)">{{ title }}</p>
        <p class="mt-1 or3-command text-[11px] truncate">job #{{ shortId }}</p>
      </div>
      <StatusPill :label="statusLabel" :tone="tone" :pulse="job.status === 'running' || job.status === 'queued'" />
    </div>
    <p v-if="job.final_text" class="line-clamp-3 text-sm leading-6 text-(--or3-text-muted)">{{ job.final_text }}</p>
    <p v-if="job.error" class="text-sm text-(--or3-danger)">Something went wrong: {{ job.error }}</p>
    <div v-if="job.final_text" class="flex justify-end">
      <UButton label="Open in chat" icon="i-lucide-message-square" color="neutral" variant="soft" size="sm" @click.stop="$emit('continue', job)" />
    </div>
  </SurfaceCard>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import type { JobSnapshot } from '~/types/or3-api'

const props = defineProps<{ job: JobSnapshot }>()
defineEmits<{ continue: [job: JobSnapshot] }>()

const title = computed(() => {
  const kind = props.job.kind
  if (!kind || kind === 'agent') return 'Agent task'
  return kind.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
})

const shortId = computed(() => {
  const id = props.job.job_id ?? ''
  return id.length > 12 ? id.slice(0, 6) + '…' + id.slice(-4) : id
})

const statusLabel = computed(() => {
  switch (props.job.status) {
    case 'queued': return 'waiting'
    case 'running': return 'working'
    case 'completed': return 'done'
    case 'failed': return 'failed'
    case 'canceled': return 'canceled'
    default: return props.job.status
  }
})

const tone = computed(() =>
  props.job.status === 'completed' ? 'green' :
  props.job.status === 'failed' ? 'danger' :
  'amber'
)
</script>
