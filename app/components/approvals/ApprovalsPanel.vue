<template>
    <div class="space-y-4">
        <!-- Hero summary card -->
        <SurfaceCard padded class-name="or3-approval-hero">
            <div class="or3-approval-hero__copy">
                <span class="or3-approval-hero__eyebrow">
                    <Icon
                        name="i-pixelarticons-shield"
                        class="size-3.5"
                        aria-hidden="true"
                    />
                    Approval desk
                </span>
                <h1 class="or3-approval-hero__title">
                    {{ heroTitle }}
                </h1>
                <p class="or3-approval-hero__sub">
                    or3-intern pauses before risky actions. Review and decide
                    what happens next.
                </p>
            </div>
            <div class="or3-approval-hero__stage" aria-hidden="true">
                <span
                    class="or3-approval-hero__sparkle or3-approval-hero__sparkle--a"
                />
                <span
                    class="or3-approval-hero__sparkle or3-approval-hero__sparkle--b"
                />
                <span class="or3-approval-hero__glow" />
                <span class="or3-approval-hero__badge">
                    <Icon
                        name="i-pixelarticons-shield"
                        class="size-5 text-(--or3-green-dark)"
                    />
                </span>
                <RetroComputerMascot
                    :size="94"
                    class="or3-approval-hero__mascot"
                />
            </div>
        </SurfaceCard>

        <!-- Filter chips row -->
        <div class="-mx-1 flex items-center gap-2 overflow-x-auto px-1 pb-1">
            <button
                v-for="option in filters"
                :key="option.value"
                type="button"
                class="or3-chip or3-chip--lg"
                :aria-pressed="selectedFilter === option.value"
                @click="changeFilter(option.value)"
            >
                <Icon v-if="option.icon" :name="option.icon" class="size-4" />
                <span>{{ option.label }}</span>
                <span
                    v-if="option.value === 'pending' && pendingCount"
                    class="or3-chip__count"
                    >{{ pendingCount }}</span
                >
            </button>
        </div>

        <div
            v-if="approvalHydrationError"
            class="rounded-2xl border border-(--or3-amber)/30 bg-(--or3-amber)/10 px-4 py-3 text-sm text-(--or3-text)"
        >
            <p>
                Couldn't refresh approval requests. Open this panel again or tap
                Retry.
            </p>
            <UButton
                class="mt-2"
                size="xs"
                color="primary"
                variant="soft"
                @click="retryApprovalHydration"
            >
                Retry
            </UButton>
        </div>

        <div
            v-if="approvalsError"
            class="rounded-2xl border border-rose-200 bg-rose-50/90 px-4 py-3 text-sm text-rose-700"
        >
            {{ approvalsError }}
        </div>

        <!-- Saved rules tab -->
        <template v-if="selectedFilter === 'saved'">
            <div
                v-if="allowlistsError"
                class="rounded-2xl border border-rose-200 bg-rose-50/90 px-4 py-3 text-sm text-rose-700"
            >
                {{ allowlistsError }}
            </div>
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
                        : selectedFilter === 'expired'
                          ? 'No expired approvals'
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
                        (remember) => handleQuickApprove(approval, remember)
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
            <SurfaceCard
                v-if="!pendingCount && selectedFilter === 'pending'"
                class-name="or3-approval-allclear"
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
                    <p class="mt-1 text-sm leading-6 text-(--or3-text-muted)">
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
            </SurfaceCard>
        </template>

        <ApprovalDetailSheet
            :open="detailOpen"
            @update:open="detailOpen = $event"
            :approval="selectedApproval"
            :busy="approvalActionBusy"
            @approve="handleApprove"
            @deny="handleDeny"
            @cancel="handleCancel"
        />
    </div>
</template>

<script setup lang="ts">
import { computed, nextTick, ref, watch } from 'vue';
import { useRouter } from 'vue-router';
import { useToast } from '@nuxt/ui/composables';
import type { ApprovalRequest } from '~/types/or3-api';
import { useActiveHost } from '~/composables/useActiveHost';
import { useApprovals } from '~/composables/useApprovals';
import { useAssistantStream } from '~/composables/useAssistantStream';
import { useApprovalHydration } from '~/composables/assistant-stream/useApprovalHydration';
import { useChatRuntimeLog } from '~/composables/useChatRuntimeLog';
import { useChatSessions } from '~/composables/useChatSessions';
import { useOr3Api } from '~/composables/useOr3Api';
import { approvalActionErrorMessage } from '~/utils/assistantApproval';
import { resumeApprovalOperation } from '~/utils/or3/approval-operation-resume';
import { useServiceRestart } from '~/composables/useServiceRestart';
import { useTerminalSession } from '~/composables/useTerminalSession';

const filters = [
    { label: 'Waiting', value: 'pending', icon: '' },
    { label: 'Expired', value: 'expired', icon: '' },
    { label: 'Approved', value: 'approved', icon: '' },
    { label: 'Denied', value: 'denied', icon: '' },
    { label: 'Saved Rules', value: 'saved', icon: 'i-pixelarticons-bookmark' },
];

const props = withDefaults(
    defineProps<{
        open?: boolean;
    }>(),
    {
        open: true,
    },
);

const toast = useToast();
const router = useRouter();
const chat = useChatSessions();
const {
    markApprovalResolved,
    messages,
    updateMessage,
} = chat;
const { send, isStreaming } = useAssistantStream();
const { activeHost } = useActiveHost();
const api = useOr3Api();
const runtimeLog = useChatRuntimeLog();
const { approvalHydrationError, hydratePendingApprovalsForActiveSession } =
    useApprovalHydration({
        activeHost,
        api,
        chat,
        runtimeLog,
        isStreaming,
    });
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
    loadPendingCount,
    loadApprovals,
    loadAllowlists,
    fetchApproval,
    reloadApprovals,
    approve,
    deny,
    cancel,
    consumeIssuedApprovalToken,
    removeAllowlist,
    allowlistsError,
} = useApprovals();
const { resumePendingApproval } = useTerminalSession();
const { resumePendingRestart } = useServiceRestart();

async function retryApprovalHydration() {
    approvalHydrationError.value = null;
    await hydratePendingApprovalsForActiveSession();
    await reloadApprovals();
}

const heroTitle = computed(() => {
    if (selectedFilter.value === 'saved') return 'Saved approval rules';
    if (selectedFilter.value === 'expired') return 'Expired approval requests';
    if (selectedFilter.value === 'approved') return 'Approved requests';
    if (selectedFilter.value === 'denied') return 'Denied requests';
    if (!pendingCount.value) return "You're all caught up";
    if (pendingCount.value === 1) return '1 request needs your approval';
    return `${pendingCount.value} requests need your approval`;
});

const emptyDescription = computed(() => {
    switch (selectedFilter.value) {
        case 'pending':
            return "You're all caught up. New requests will pop up here when or3-intern needs the okay.";
        case 'expired':
            return 'Expired requests move here automatically after they time out.';
        case 'approved':
            return 'Approved requests will show up here after you allow them.';
        case 'denied':
            return 'Denied requests will show up here after you block them.';
        default:
            return 'Try a different filter above.';
    }
});

async function refreshApprovalView() {
    if (selectedFilter.value !== 'saved') {
        await reloadApprovals();
    }
    await loadPendingCount();
}

async function syncSelectedApproval() {
    if (!selectedApproval.value) return;
    try {
        await fetchApproval(selectedApproval.value.id);
    } catch {
        selectedApproval.value = null;
    }
}

async function handleApprovalActionFailure(error: unknown, fallback: string) {
    await Promise.all([refreshApprovalView(), syncSelectedApproval()]);
    const message = approvalActionErrorMessage(error, fallback);
    approvalsError.value = message;
    toast.add({
        title: 'Approval update failed',
        description: message,
        color: 'error',
        icon: 'i-pixelarticons-warning-box',
    });
}

async function followApprovalResumeJob(
    response?: {
        request_id?: number | string;
        session_key?: string;
        token?: string;
    },
    approval?: ApprovalRequest | null,
) {
    const resumedOperation = await resumeApprovalOperation({
        response,
        approval,
        consumeToken: consumeIssuedApprovalToken,
        resumeTerminal: async (approvalId, token) => {
            await resumePendingApproval(approvalId);
            if (!token) return;
        },
        resumeRestart: async (approvalId) => {
            await resumePendingRestart(approvalId);
        },
    });
    if (resumedOperation) return;
}

async function changeFilter(filter: string) {
    selectedFilter.value = filter;
    if (filter === 'saved') {
        try {
            await loadAllowlists();
        } catch {
            /* allowlistsError is set in the composable */
        }
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
    approvalsError.value = null;
    try {
        const response = await approve(
            approval.id,
            remember,
            remember
                ? 'approved and remembered from mobile'
                : 'approved from mobile',
        );
        await followApprovalResumeJob(response, approval);
    } catch (error) {
        await handleApprovalActionFailure(
            error,
            'Could not approve this request.',
        );
    } finally {
        busyId.value = null;
    }
}

async function handleQuickDeny(approval: ApprovalRequest) {
    busyId.value = approval.id;
    approvalsError.value = null;
    try {
        await deny(approval.id, 'denied from mobile');
        markApprovalResolved(
            approval.id,
            'denied',
            approval.requester_session_id,
        );
    } catch (error) {
        await handleApprovalActionFailure(
            error,
            'Could not deny this request.',
        );
    } finally {
        busyId.value = null;
    }
}

async function handleApprove(remember: boolean) {
    if (!selectedApproval.value) return;
    const approval = selectedApproval.value;
    approvalActionBusy.value = true;
    approvalsError.value = null;
    try {
        const response = await approve(
            approval.id,
            remember,
            remember
                ? 'approved and remembered from mobile'
                : 'approved from mobile',
        );
        await followApprovalResumeJob(response, approval);
        detailOpen.value = false;
    } catch (error) {
        await handleApprovalActionFailure(
            error,
            'Could not approve this request.',
        );
    } finally {
        approvalActionBusy.value = false;
    }
}

async function handleDeny() {
    if (!selectedApproval.value) return;
    approvalActionBusy.value = true;
    approvalsError.value = null;
    try {
        await deny(selectedApproval.value.id, 'denied from mobile');
        markApprovalResolved(
            selectedApproval.value.id,
            'denied',
            selectedApproval.value.requester_session_id,
        );
        detailOpen.value = false;
    } catch (error) {
        await handleApprovalActionFailure(
            error,
            'Could not deny this request.',
        );
    } finally {
        approvalActionBusy.value = false;
    }
}

async function handleCancel() {
    if (!selectedApproval.value) return;
    approvalActionBusy.value = true;
    approvalsError.value = null;
    try {
        await cancel(selectedApproval.value.id, 'canceled from mobile');
        detailOpen.value = false;
    } catch (error) {
        await handleApprovalActionFailure(
            error,
            'Could not cancel this request.',
        );
    } finally {
        approvalActionBusy.value = false;
    }
}

watch(
    () => props.open,
    (isOpen) => {
        if (!isOpen && isOpen !== undefined) return;
        void loadApprovals(selectedFilter.value);
    },
    { immediate: true },
);
</script>

<style scoped>
.or3-approval-hero {
    position: relative;
    display: grid;
    grid-template-columns: minmax(0, 1fr) auto;
    align-items: center;
    gap: 1.25rem;
    overflow: hidden;
    background:
        radial-gradient(
            110% 92% at 100% 0%,
            color-mix(in srgb, var(--or3-green) 16%, transparent) 0%,
            transparent 58%
        ),
        radial-gradient(
            90% 70% at 0% 0%,
            color-mix(in srgb, var(--or3-green) 7%, transparent) 0%,
            transparent 62%
        ),
        color-mix(in srgb, var(--or3-surface) 92%, white 8%);
}

.or3-approval-hero::before {
    content: '';
    position: absolute;
    inset: 0;
    pointer-events: none;
    background-image: radial-gradient(
        color-mix(in srgb, var(--or3-green) 18%, transparent) 1px,
        transparent 1px
    );
    background-size: 14px 14px;
    background-position: top right;
    mask-image: radial-gradient(
        72% 66% at 100% 0%,
        rgba(0, 0, 0, 0.46),
        transparent 72%
    );
    opacity: 0.5;
}

.or3-approval-hero > * {
    position: relative;
}

.or3-approval-hero__copy {
    min-width: 0;
}

.or3-approval-hero__eyebrow {
    display: inline-flex;
    align-items: center;
    gap: 0.4rem;
    font-family:
        'JetBrains Mono', ui-monospace, SFMono-Regular, Menlo, monospace;
    font-size: 0.68rem;
    font-weight: 700;
    letter-spacing: 0.16em;
    text-transform: uppercase;
    color: var(--or3-green-dark);
}

.or3-approval-hero__title {
    margin-top: 0.45rem;
    max-width: 22ch;
    overflow-wrap: anywhere;
    font-family:
        'JetBrains Mono', ui-monospace, SFMono-Regular, Menlo, monospace;
    font-size: clamp(1.15rem, 4vw, 1.45rem);
    font-weight: 700;
    line-height: 1.16;
    letter-spacing: 0;
    color: var(--or3-text);
}

.or3-approval-hero__sub {
    margin-top: 0.55rem;
    max-width: 38rem;
    font-size: 0.9rem;
    line-height: 1.6;
    color: var(--or3-text-muted);
}

.or3-approval-hero__stage {
    position: relative;
    display: grid;
    width: 8.25rem;
    height: 7.25rem;
    flex-shrink: 0;
    place-items: center;
}

.or3-approval-hero__glow {
    position: absolute;
    right: 0.2rem;
    bottom: 0.55rem;
    width: 5.5rem;
    height: 1.2rem;
    border-radius: 999px;
    background: radial-gradient(
        ellipse at center,
        color-mix(in srgb, var(--or3-green) 46%, transparent) 0%,
        transparent 72%
    );
    filter: blur(2px);
}

.or3-approval-hero__badge {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 2.9rem;
    height: 2.9rem;
    border-radius: 16px;
    background: color-mix(in srgb, white 65%, var(--or3-green-soft) 35%);
    border: 1px solid color-mix(in srgb, var(--or3-green) 30%, white 70%);
    box-shadow: var(--or3-shadow-soft);
    flex-shrink: 0;
}

.or3-approval-hero__stage .or3-approval-hero__badge {
    position: absolute;
    top: 0.25rem;
    left: 0;
}

.or3-approval-hero__mascot {
    position: relative;
    z-index: 1;
    transform: scaleX(-1);
    transform-origin: center;
}

.or3-approval-hero__sparkle {
    position: absolute;
    border-radius: 999px;
    background: var(--or3-green);
    opacity: 0.7;
    box-shadow: 0 0 8px color-mix(in srgb, var(--or3-green) 55%, transparent);
}

.or3-approval-hero__sparkle--a {
    top: 1rem;
    right: 1.15rem;
    width: 0.38rem;
    height: 0.38rem;
}

.or3-approval-hero__sparkle--b {
    right: 0.15rem;
    bottom: 2.55rem;
    width: 0.25rem;
    height: 0.25rem;
}

.or3-approval-allclear {
    display: flex;
    align-items: flex-start;
    gap: 0.85rem;
    background:
        radial-gradient(
            80% 100% at 100% 50%,
            color-mix(in srgb, var(--or3-green) 12%, transparent) 0%,
            transparent 58%
        ),
        color-mix(in srgb, var(--or3-surface) 92%, white 8%);
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

@media (max-width: 520px) {
    .or3-approval-hero {
        grid-template-columns: minmax(0, 1fr);
        gap: 0.75rem;
    }

    .or3-approval-hero__stage {
        display: none;
    }
}
</style>
