<template>
  <USlideover v-model:open="open">
    <template #content>
      <div class="flex h-full flex-col bg-(--or3-background) p-4">
        <div class="flex items-start justify-between gap-3 border-b border-(--or3-border) pb-4">
          <div class="min-w-0">
            <p class="or3-command text-[11px]">request #{{ approval?.id }}</p>
            <h2 class="mt-1 font-mono text-lg font-semibold truncate">{{ friendlyKind }}</h2>
            <StatusPill class="mt-2" :label="friendlyStatus" :tone="statusTone" />
          </div>
          <UButton icon="i-pixelarticons-close" color="neutral" variant="ghost" aria-label="Close" @click="open = false" />
        </div>

        <div class="mt-4 flex-1 space-y-4 overflow-y-auto">
          <SurfaceCard class-name="space-y-2">
            <p class="or3-command text-[11px]">What or3-intern wants to do</p>
            <p class="text-sm leading-6 text-(--or3-text)">{{ summary }}</p>
          </SurfaceCard>

          <DangerCallout tone="caution" title="Only approve if you trust this">
            Once approved, this action runs on your real computer. If you're not sure what it does, deny it.
          </DangerCallout>

          <details class="rounded-2xl border border-(--or3-border) bg-white/70 p-3">
            <summary class="cursor-pointer select-none text-xs font-semibold uppercase tracking-wide text-(--or3-text-muted)">
              Show technical details
            </summary>
            <pre class="mt-2 max-h-72 overflow-auto rounded-xl bg-stone-950 p-3 text-xs leading-5 text-green-200">{{ rawJson }}</pre>
          </details>
        </div>

        <div class="mt-4 space-y-2 border-t border-(--or3-border) pt-4">
          <UButton label="Approve once" icon="i-pixelarticons-check" color="primary" block size="lg" :loading="busy" @click="$emit('approve', false)" />
          <UButton label="Approve & always allow this" icon="i-pixelarticons-check-double" color="neutral" variant="soft" block :loading="busy" @click="$emit('approve', true)" />
          <UButton label="Deny" icon="i-pixelarticons-close" color="error" variant="soft" block :loading="busy" @click="$emit('deny')" />
          <UButton label="Cancel request" color="neutral" variant="ghost" block :loading="busy" @click="$emit('cancel')" />
        </div>
      </div>
    </template>
  </USlideover>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import type { ApprovalRequest } from '~/types/or3-api'

const open = defineModel<boolean>('open', { default: false })

const props = defineProps<{
  approval: ApprovalRequest | null
  busy?: boolean
}>()

defineEmits<{
  approve: [remember: boolean]
  deny: []
  cancel: []
}>()

const rawJson = computed(() => JSON.stringify(props.approval?.subject ?? props.approval ?? {}, null, 2))

const friendlyKind = computed(() => {
  const t = props.approval?.type || props.approval?.domain
  if (!t) return 'Approval request'
  if (t === 'exec') return 'Run a command'
  if (t === 'file_write') return 'Change a file'
  if (t === 'network') return 'Reach the internet'
  return t.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
})

const friendlyStatus = computed(() => {
  switch (props.approval?.status) {
    case 'pending': return 'Waiting for you'
    case 'approved': return 'Approved'
    case 'denied': return 'Denied'
    case 'canceled': return 'Canceled'
    default: return props.approval?.status ?? 'unknown'
  }
})

const statusTone = computed(() => {
  if (props.approval?.status === 'approved') return 'green' as const
  if (props.approval?.status === 'pending') return 'amber' as const
  if (props.approval?.status === 'denied') return 'danger' as const
  return 'neutral' as const
})

const summary = computed(() => {
  if (!props.approval) return 'Pick an approval to see what it wants to do.'
  if (typeof props.approval.subject === 'string') return props.approval.subject
  if (props.approval.type === 'exec') return 'or3-intern wants to run a command on your computer. Open the technical details below to see exactly what it will run.'
  if (props.approval.type === 'file_write') return 'or3-intern wants to write to a file on your computer. The technical details show which file and what content.'
  return 'Take a look at the request details below before allowing it.'
})
</script>
