<template>
  <div class="grid grid-cols-2 gap-3">
    <SurfaceCard class-name="space-y-3">
      <div class="flex items-center justify-between gap-2">
        <p class="flex items-center gap-1.5 font-mono text-sm font-semibold text-(--or3-text)">
          <Icon name="i-lucide-hourglass" class="size-4 text-(--or3-text-muted)" />
          Pending
        </p>
        <span class="rounded-full bg-stone-100 px-2 py-0.5 text-xs font-semibold text-(--or3-text-muted)">
          {{ pending.length }}
        </span>
      </div>
      <ul v-if="pending.length" class="space-y-2">
        <li
          v-for="job in pending.slice(0, 3)"
          :key="job.job_id"
          class="flex items-center justify-between gap-2 text-xs"
        >
          <span class="min-w-0 truncate text-(--or3-text)">{{ titleFor(job) }}</span>
          <span class="flex shrink-0 items-center gap-1 text-(--or3-text-muted)">
            <span class="size-1.5 rounded-full bg-(--or3-amber)" />
            Queued
          </span>
        </li>
      </ul>
      <p v-else class="text-xs text-(--or3-text-muted)">Nothing waiting in line.</p>
    </SurfaceCard>

    <SurfaceCard class-name="space-y-3">
      <div class="flex items-center justify-between gap-2">
        <p class="flex items-center gap-1.5 font-mono text-sm font-semibold text-(--or3-text)">
          <Icon name="i-lucide-check-circle-2" class="size-4 text-(--or3-green)" />
          Completed
        </p>
        <span class="rounded-full bg-(--or3-green-soft) px-2 py-0.5 text-xs font-semibold text-(--or3-green-dark)">
          {{ completed.length }}
        </span>
      </div>
      <ul v-if="completed.length" class="space-y-2">
        <li
          v-for="job in completed.slice(0, 3)"
          :key="job.job_id"
          class="flex items-center justify-between gap-2 text-xs"
        >
          <span class="min-w-0 truncate text-(--or3-text)">{{ titleFor(job) }}</span>
          <span class="flex shrink-0 items-center gap-1 text-(--or3-green-dark)">
            <Icon name="i-lucide-check" class="size-3" />
            Done
          </span>
        </li>
      </ul>
      <p v-else class="text-xs text-(--or3-text-muted)">Finished jobs show up here.</p>
    </SurfaceCard>
  </div>
</template>

<script setup lang="ts">
import type { JobSnapshot } from '~/types/or3-api'

defineProps<{
  pending: JobSnapshot[]
  completed: JobSnapshot[]
}>()

function titleFor(job: JobSnapshot) {
  const kind = job.kind
  if (!kind || kind === 'agent' || kind === 'subagent') return 'Agent task'
  return kind.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
}
</script>
