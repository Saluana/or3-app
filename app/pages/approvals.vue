<template>
  <AppShell>
    <AppHeader subtitle="APPROVALS" />
    <div class="space-y-4">
      <SurfaceCard class-name="space-y-4">
        <div class="flex items-start justify-between gap-3">
          <div class="flex items-start gap-3">
            <RetroIcon name="i-lucide-shield-check" />
            <div>
              <p class="font-mono text-lg font-semibold">Approvals inbox</p>
              <p class="mt-1 text-sm leading-6 text-(--or3-text-muted)">Review sensitive actions, approve once, or store safe allowlist rules.</p>
            </div>
          </div>
          <StatusPill :label="`${pendingCount} pending`" :tone="pendingCount ? 'amber' : 'green'" />
        </div>

        <div class="flex flex-wrap gap-2">
          <UButton v-for="option in filters" :key="option.value" :label="option.label" :color="selectedFilter === option.value ? 'primary' : 'neutral'" :variant="selectedFilter === option.value ? 'solid' : 'soft'" class="or3-touch-target" @click="changeFilter(option.value)" />
          <UButton label="Expire stale" icon="i-lucide-timer-off" color="neutral" variant="ghost" class="or3-touch-target" @click="expirePending" />
        </div>

        <p v-if="approvalsError" class="text-sm text-rose-600">{{ approvalsError }}</p>

        <div v-if="approvalsLoading" class="rounded-2xl border border-(--or3-border) bg-white/70 p-4 text-sm text-(--or3-text-muted)">
          Loading approvals…
        </div>

        <div v-else-if="!approvals.length" class="rounded-2xl border border-(--or3-border) bg-white/70 p-4 text-sm text-(--or3-text-muted)">
          No approvals match the current filter.
        </div>

        <div v-else class="space-y-3">
          <button v-for="approval in approvals" :key="String(approval.id)" type="button" class="w-full rounded-2xl border border-(--or3-border) bg-white/70 p-4 text-left" @click="openApproval(approval.id)">
            <div class="flex items-start justify-between gap-3">
              <div>
                <p class="font-mono text-sm font-semibold">#{{ approval.id }} · {{ approval.type || approval.domain || 'request' }}</p>
                <p class="mt-1 text-sm text-(--or3-text-muted)">{{ approvalSummary(approval) }}</p>
              </div>
              <StatusPill :label="approval.status" :tone="approval.status === 'pending' ? 'amber' : approval.status === 'approved' ? 'green' : 'neutral'" />
            </div>
          </button>
        </div>
      </SurfaceCard>

      <SurfaceCard class-name="space-y-4">
        <SectionHeader title="Allowlists" subtitle="Remembered approvals" />
        <div v-if="!allowlists.length" class="rounded-2xl border border-dashed border-(--or3-border) px-4 py-5 text-sm text-(--or3-text-muted)">
          No allowlists stored yet.
        </div>
        <div v-else class="space-y-3">
          <div v-for="item in allowlists" :key="String(item.id)" class="flex items-start justify-between gap-3 rounded-2xl border border-(--or3-border) bg-white/70 p-4">
            <div>
              <p class="font-mono text-sm font-semibold">{{ item.domain || 'approval' }} · #{{ item.id }}</p>
              <p class="mt-1 text-xs text-(--or3-text-muted)">{{ JSON.stringify(item.matcher || item.scope || {}, null, 0) }}</p>
            </div>
            <UButton label="Remove" color="neutral" variant="soft" class="or3-touch-target" @click="removeAllowlist(item.id)" />
          </div>
        </div>
      </SurfaceCard>

      <ApprovalDetailSheet
        v-model:open="detailOpen"
        :approval="selectedApproval"
        :busy="approvalActionBusy"
        @approve="handleApprove"
        @deny="handleDeny"
        @cancel="handleCancel"
      />
    </div>
  </AppShell>
</template>

<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref } from 'vue'
import type { ApprovalRequest } from '~/types/or3-api'
import { useApprovals } from '~/composables/useApprovals'

const filters = [
  { label: 'Pending', value: 'pending' },
  { label: 'Resolved', value: 'approved' },
  { label: 'Denied', value: 'denied' },
  { label: 'All', value: '' },
]

const selectedFilter = ref('pending')
const detailOpen = ref(false)
const approvalActionBusy = ref(false)

const {
  approvals,
  allowlists,
  selectedApproval,
  approvalsLoading,
  approvalsError,
  pendingCount,
  loadApprovals,
  loadAllowlists,
  fetchApproval,
  approve,
  deny,
  cancel,
  expirePending,
  removeAllowlist,
  startPolling,
  stopPolling,
} = useApprovals()

function approvalSummary(approval: ApprovalRequest) {
  if (typeof approval.subject === 'string') return approval.subject
  if (approval.type === 'exec') return 'Privileged execution request waiting for review.'
  return 'Review request details and choose how to proceed.'
}

async function changeFilter(filter: string) {
  selectedFilter.value = filter
  await loadApprovals(filter)
}

async function openApproval(id: number | string) {
  await fetchApproval(id)
  detailOpen.value = true
}

async function handleApprove(remember: boolean) {
  if (!selectedApproval.value) return
  approvalActionBusy.value = true
  try {
    await approve(selectedApproval.value.id, remember, remember ? 'approved and remembered from mobile' : 'approved from mobile')
    detailOpen.value = false
  } finally {
    approvalActionBusy.value = false
  }
}

async function handleDeny() {
  if (!selectedApproval.value) return
  approvalActionBusy.value = true
  try {
    await deny(selectedApproval.value.id, 'denied from mobile')
    detailOpen.value = false
  } finally {
    approvalActionBusy.value = false
  }
}

async function handleCancel() {
  if (!selectedApproval.value) return
  approvalActionBusy.value = true
  try {
    await cancel(selectedApproval.value.id, 'canceled from mobile')
    detailOpen.value = false
  } finally {
    approvalActionBusy.value = false
  }
}

onMounted(async () => {
  await Promise.all([loadApprovals(selectedFilter.value), loadAllowlists()])
  startPolling()
})

onBeforeUnmount(() => {
  stopPolling()
})
</script>
