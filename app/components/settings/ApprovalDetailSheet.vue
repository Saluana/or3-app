<template>
  <USlideover v-model:open="open">
    <template #content>
      <div class="flex h-full flex-col bg-(--or3-surface) p-4">
        <div class="flex items-start justify-between gap-3 border-b border-(--or3-border) pb-4">
          <div>
            <p class="or3-label text-sm font-semibold">Approval detail</p>
            <h2 class="mt-1 font-mono text-lg font-semibold">#{{ approval?.id }}</h2>
            <p class="mt-1 text-sm text-(--or3-text-muted)">{{ approval?.status }} · {{ approval?.type || approval?.domain || 'request' }}</p>
          </div>
          <UButton icon="i-lucide-x" color="neutral" variant="ghost" aria-label="Close approval detail" @click="open = false" />
        </div>

        <div class="mt-4 flex-1 space-y-4 overflow-y-auto">
          <SurfaceCard class-name="space-y-3">
            <p class="font-mono text-sm font-semibold">Summary</p>
            <p class="text-sm leading-6 text-(--or3-text-muted)">{{ summary }}</p>
          </SurfaceCard>

          <SurfaceCard class-name="space-y-3">
            <p class="font-mono text-sm font-semibold">Raw payload</p>
            <pre class="max-h-72 overflow-auto rounded-2xl bg-stone-950 p-3 text-xs leading-5 text-green-200">{{ rawJson }}</pre>
          </SurfaceCard>
        </div>

        <div class="mt-4 grid grid-cols-2 gap-2 border-t border-(--or3-border) pt-4">
          <UButton label="Approve once" color="primary" class="or3-touch-target justify-center" :loading="busy" @click="$emit('approve', false)" />
          <UButton label="Approve & remember" color="neutral" variant="soft" class="or3-touch-target justify-center" :loading="busy" @click="$emit('approve', true)" />
          <UButton label="Deny" color="error" variant="soft" class="or3-touch-target justify-center" :loading="busy" @click="$emit('deny')" />
          <UButton label="Cancel" color="neutral" variant="ghost" class="or3-touch-target justify-center" :loading="busy" @click="$emit('cancel')" />
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
const summary = computed(() => {
  if (!props.approval) return 'Select an approval to review the request payload and actions.'
  if (typeof props.approval.subject === 'string') return props.approval.subject
  if (props.approval.type === 'exec') return 'A privileged execution request needs operator review.'
  return 'Review the request payload before allowing or denying this action.'
})
</script>
