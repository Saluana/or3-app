<template>
    <AppShell>
        <AppHeader subtitle="APPROVALS" />

        <div class="space-y-4">
            <!-- Hero summary card -->
            <section class="or3-approval-hero">
                <div class="flex items-start gap-3 sm:gap-4">
                    <span class="or3-approval-hero__badge">
                        <Icon
                            name="i-pixelarticons-shield"
                            class="size-6 text-(--or3-green-dark)"
                        />
                    </span>
                    <div class="min-w-0 flex-1">
                        <p
                            class="font-mono text-[1.05rem] font-semibold leading-snug tracking-tight text-(--or3-text) sm:text-[1.15rem]"
                        >
                            {{ heroTitle }}
                        </p>
                        <p
                            class="mt-1.5 text-sm leading-6 text-(--or3-text-muted)"
                        >
                            or3-intern pauses before risky actions.
                            <br class="hidden sm:inline" />
                            Review and decide what happens next.
                        </p>
                    </div>
                    <RetroComputerMascot
                        :size="68"
                        class="or3-approval-hero__mascot hidden shrink-0 self-start sm:block"
                    />
                </div>
            </section>

            <!-- Filter chips row -->
            <div
                class="-mx-1 flex items-center gap-2 overflow-x-auto px-1 pb-1"
            >
                <button
                    v-for="option in filters"
                    :key="option.value"
                    type="button"
                    class="or3-chip or3-chip--lg"
                    :aria-pressed="selectedFilter === option.value"
                    @click="changeFilter(option.value)"
                >
                    <Icon
                        v-if="option.icon"
                        :name="option.icon"
                        class="size-4"
                    />
                    <span>{{ option.label }}</span>
                    <span
                        v-if="option.value === 'pending' && pendingCount"
                        class="or3-chip__count"
                        >{{ pendingCount }}</span
                    >
                </button>
            </div>

            <p v-if="approvalsError" class="text-sm text-rose-600">
                {{ approvalsError }}
            </p>

            <!-- Saved rules tab -->
            <template v-if="selectedFilter === 'saved'">
                <SavedApprovalsList
                    :items="allowlists"
                    show-section-header
                    @remove="removeAllowlist"
                />
            </template>

            <template v-else>
                <div
                    v-if="approvalsLoading"
                    class="rounded-2xl border border-(--or3-border) bg-white/70 p-4 text-sm text-(--or3-text-muted)"
                >
                    Loading…
                </div>

                <EmptyState
                    v-else-if="!approvals.length"
                    icon="i-pixelarticons-checkbox-on"
                    :title="
                        selectedFilter === 'pending'
                            ? 'Nothing needs you right now'
                            : 'Nothing to show here'
                    "
                    :description="emptyDescription"
                />

                <div v-else class="space-y-4">
                    <ApprovalRequestCard
                        v-for="approval in approvals"
                        :key="String(approval.id)"
                        :approval="approval"
                        :busy="busyId === approval.id"
                        @approve="
                            (remember: boolean) =>
                                handleQuickApprove(approval, remember)
                        "
                        @deny="handleQuickDeny(approval)"
                        @details="openApproval(approval.id)"
                    />
                </div>

                <SavedApprovalsList
                    v-if="allowlists.length"
                    :items="allowlists"
                    @remove="removeAllowlist"
                    @manage="changeFilter('saved')"
                />

                <!-- All clear footer card -->
                <section
                    v-if="!pendingCount && selectedFilter === 'pending'"
                    class="or3-approval-allclear"
                >
                    <span class="or3-approval-hero__badge">
                        <Icon
                            name="i-pixelarticons-shield"
                            class="size-6 text-(--or3-green-dark)"
                        />
                    </span>
                    <div class="min-w-0 flex-1">
                        <p
                            class="font-mono text-[1rem] font-semibold tracking-tight text-(--or3-text)"
                        >
                            All clear!
                        </p>
                        <p
                            class="mt-1 text-sm leading-6 text-(--or3-text-muted)"
                        >
                            No pending requests right now.
                            <br class="hidden sm:inline" />
                            You're all caught up.
                        </p>
                    </div>
                    <RetroComputerMascot
                        :size="64"
                        src="/computer-icons/waving-guy.webp"
                        sparkle
                        class="hidden shrink-0 self-start sm:block"
                    />
                </section>
            </template>

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
import { computed, onBeforeUnmount, onMounted, ref } from 'vue';
import type { ApprovalRequest } from '~/types/or3-api';
import { useApprovals } from '~/composables/useApprovals';

const filters = [
    { label: 'Waiting', value: 'pending', icon: '' },
    { label: 'Approved', value: 'approved', icon: '' },
    { label: 'Denied', value: 'denied', icon: '' },
    { label: 'Saved Rules', value: 'saved', icon: 'i-pixelarticons-bookmark' },
];

const selectedFilter = ref('pending');
const detailOpen = ref(false);
const approvalActionBusy = ref(false);
const busyId = ref<number | string | null>(null);

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
} = useApprovals();

void expirePending;

const heroTitle = computed(() => {
    if (selectedFilter.value === 'saved') return 'Saved approval rules';
    if (!pendingCount.value) return "You're all caught up";
    if (pendingCount.value === 1) return '1 request needs your approval';
    return `${pendingCount.value} requests need your approval`;
});

const emptyDescription = computed(() =>
    selectedFilter.value === 'pending'
        ? "You're all caught up. New requests will pop up here when or3-intern needs the okay."
        : 'Try a different filter above.'
);

async function changeFilter(filter: string) {
    selectedFilter.value = filter;
    if (filter === 'saved') {
        await loadAllowlists();
        return;
    }
    await loadApprovals(filter);
}

async function openApproval(id: number | string) {
    await fetchApproval(id);
    detailOpen.value = true;
}

async function handleQuickApprove(
    approval: ApprovalRequest,
    remember: boolean,
) {
    busyId.value = approval.id;
    try {
        await approve(
            approval.id,
            remember,
            remember
                ? 'approved and remembered from mobile'
                : 'approved from mobile',
        );
    } finally {
        busyId.value = null;
    }
}

async function handleQuickDeny(approval: ApprovalRequest) {
    busyId.value = approval.id;
    try {
        await deny(approval.id, 'denied from mobile');
    } finally {
        busyId.value = null;
    }
}

async function handleApprove(remember: boolean) {
    if (!selectedApproval.value) return;
    approvalActionBusy.value = true;
    try {
        await approve(
            selectedApproval.value.id,
            remember,
            remember
                ? 'approved and remembered from mobile'
                : 'approved from mobile',
        );
        detailOpen.value = false;
    } finally {
        approvalActionBusy.value = false;
    }
}

async function handleDeny() {
    if (!selectedApproval.value) return;
    approvalActionBusy.value = true;
    try {
        await deny(selectedApproval.value.id, 'denied from mobile');
        detailOpen.value = false;
    } finally {
        approvalActionBusy.value = false;
    }
}

async function handleCancel() {
    if (!selectedApproval.value) return;
    approvalActionBusy.value = true;
    try {
        await cancel(selectedApproval.value.id, 'canceled from mobile');
        detailOpen.value = false;
    } finally {
        approvalActionBusy.value = false;
    }
}

onMounted(async () => {
    await Promise.all([
        loadApprovals(selectedFilter.value),
        loadAllowlists(),
    ]);
    startPolling();
});

onBeforeUnmount(() => {
    stopPolling();
});
</script>

<style scoped>
.or3-approval-hero,
.or3-approval-allclear {
    display: flex;
    align-items: flex-start;
    gap: 0.75rem;
    padding: 1rem 1.1rem;
    background: linear-gradient(
        180deg,
        color-mix(in srgb, var(--or3-green-soft) 78%, white 22%) 0%,
        color-mix(in srgb, var(--or3-green-soft) 55%, white 45%) 100%
    );
    border: 1px solid
        color-mix(in srgb, var(--or3-green) 22%, var(--or3-border) 78%);
    border-radius: var(--or3-radius-card);
    box-shadow: var(--or3-shadow-soft);
}

.or3-approval-hero__badge {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 44px;
    height: 44px;
    border-radius: 16px;
    background: color-mix(in srgb, white 65%, var(--or3-green-soft) 35%);
    border: 1px solid color-mix(in srgb, var(--or3-green) 30%, white 70%);
    box-shadow: var(--or3-shadow-soft);
    flex-shrink: 0;
}

.or3-approval-hero__mascot {
    transform: scaleX(-1);
    transform-origin: center;
}

.or3-chip--lg {
    padding: 0.55rem 1rem;
    font-size: 0.875rem;
    border-radius: 9999px;
    min-height: 40px;
}

.or3-chip__count {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    min-width: 20px;
    height: 20px;
    padding: 0 6px;
    margin-left: 0.15rem;
    border-radius: 9999px;
    background: color-mix(in srgb, var(--or3-green) 25%, white 75%);
    color: var(--or3-green-dark);
    font-size: 0.72rem;
    font-weight: 600;
    line-height: 1;
}

.or3-chip[aria-pressed='true'] .or3-chip__count {
    background: white;
    color: var(--or3-green-dark);
}
</style>
