<template>
  <AppShell>
    <AppHeader subtitle="APPROVALS" />
    <div class="space-y-4">
      <SurfaceCard class-name="space-y-4">
        <div class="flex items-start justify-between gap-3">
          <div class="flex items-start gap-3">
            <RetroIcon name="i-lucide-shield-check" />
            <div>
              <p class="font-mono text-lg font-semibold">Things waiting for you</p>
              <p class="mt-1 text-sm leading-6 text-(--or3-text-muted)">
                or3-intern asks before doing anything risky. Tap a request to see what it wants to do.
              </p>
            </div>
          </div>
          <StatusPill
            :label="pendingCount ? `${pendingCount} waiting` : 'all clear'"
            :tone="pendingCount ? 'amber' : 'green'"
            :pulse="Boolean(pendingCount)"
          />
        </div>

        <div class="-mx-1 flex flex-wrap gap-2 px-1">
          <button
            v-for="option in filters"
            :key="option.value"
            type="button"
            class="or3-chip"
            :aria-pressed="selectedFilter === option.value"
            @click="changeFilter(option.value)"
          >
            {{ option.label }}
          </button>
          <UButton
            label="Clear out old ones"
            icon="i-lucide-timer-off"
            color="neutral"
            variant="ghost"
            size="sm"
            class="or3-touch-target ml-auto"
            @click="expirePending"
          />
        </div>

        <p v-if="approvalsError" class="text-sm text-rose-600">{{ approvalsError }}</p>

        <div v-if="approvalsLoading" class="rounded-2xl border border-(--or3-border) bg-white/70 p-4 text-sm text-(--or3-text-muted)">
          Loading…
        </div>

        <EmptyState
          v-else-if="!approvals.length"
          icon="i-lucide-check-circle-2"
          :title="selectedFilter === 'pending' ? 'Nothing needs you right now' : 'Nothing to show here'"
          :description="emptyDescription"
        />

        <div v-else class="space-y-3">
          <button
            v-for="approval in approvals"
            :key="String(approval.id)"
            type="button"
            class="flex w-full items-start justify-between gap-3 rounded-2xl border border-(--or3-border) bg-white/70 p-4 text-left transition or3-pressable"
            @click="openApproval(approval.id)"
          >
            <div class="min-w-0">
              <p class="font-mono text-sm font-semibold">{{ friendlyKind(approval) }}</p>
              <p class="mt-1 text-sm text-(--or3-text-muted)">{{ approvalSummary(approval) }}</p>
              <p class="mt-1 or3-command text-[11px]">request #{{ approval.id }}</p>
            </div>
            <StatusPill
              :label="friendlyStatus(approval.status)"
              :tone="approval.status === 'pending' ? 'amber' : approval.status === 'approved' ? 'green' : 'neutral'"
            />
          </button>
        </div>
      </SurfaceCard>

      <SurfaceCard class-name="space-y-4">
        <SectionHeader title="Saved approvals" subtitle="Things you've already said yes to" />
        <p class="text-sm leading-6 text-(--or3-text-muted)">
          or3-intern won't ask again for actions you've already remembered. Remove a rule to start being asked again.
        </p>
        <EmptyState
          v-if="!allowlists.length"
          icon="i-lucide-bookmark"
          title="Nothing saved yet"
          description="When you tap 'Approve & remember' on a request, it'll show up here."
        />
        <div v-else class="space-y-3">
          <div v-for="item in allowlists" :key="String(item.id)" class="flex items-start justify-between gap-3 rounded-2xl border border-(--or3-border) bg-white/70 p-4">
            <div class="min-w-0">
              <p class="font-mono text-sm font-semibold">{{ item.domain || 'Saved approval' }}</p>
              <p class="mt-1 text-xs text-(--or3-text-muted)">{{ describeMatcher(item) }}</p>
            </div>
            <UButton label="Remove" color="error" variant="soft" size="sm" @click="removeAllowlist(item.id)" />
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
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import type { ApprovalRequest } from '~/types/or3-api'
import { useApprovals } from '~/composables/useApprovals'

const filters = [
  { label: 'Waiting', value: 'pending' },
  { label: 'Approved', value: 'approved' },
  { label: 'Denied', value: 'denied' },
  { label: 'All', value: '' },
]

const selectedFilter = ref('pending')
const detailOpen = ref(false)
const approvalActionBusy = ref(false)

const emptyDescription = computed(() =>
  selectedFilter.value === 'pending'
    ? "You're all caught up. New requests will pop up here when or3-intern needs the okay."
    : 'Try a different filter above.'
)

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

function friendlyKind(approval: ApprovalRequest) {
  const t = approval.type || approval.domain
  if (!t) return 'Approval request'
  if (t === 'exec') return 'Run a command'
  if (t === 'file_write') return 'Change a file'
  if (t === 'network') return 'Reach the internet'
  return t.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
}

function friendlyStatus(status: string) {
  if (status === 'pending') return 'Waiting'
  if (status === 'approved') return 'Approved'
  if (status === 'denied') return 'Denied'
  if (status === 'canceled') return 'Canceled'
  return status
}

function approvalSummary(approval: ApprovalRequest) {
  if (typeof approval.subject === 'string') return approval.subject
  if (approval.type === 'exec') return 'or3-intern wants to run a command on your computer.'
  if (approval.type === 'file_write') return 'or3-intern wants to change a file.'
  return 'Tap to see exactly what or3-intern wants to do.'
}

function describeMatcher(item: { matcher?: unknown; scope?: unknown }) {
  const target = item.matcher ?? item.scope
  if (!target) return 'Matches future requests of this kind.'
  if (typeof target === 'string') return target
  try {
    return JSON.stringify(target)
  } catch {
    return 'Matches future requests of this kind.'
  }
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
