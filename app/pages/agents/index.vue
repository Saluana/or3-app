<template>
    <AppShell
        desktop-title="Agents"
        desktop-subtitle="Delegate work to your agents and monitor their jobs."
    >
        <template #sidebar>
            <AgentsSidebar
                :jobs="jobs"
                :on-refresh="loadJobs"
                @open-job="openJobDetailById"
            />
        </template>
        <AppHeader subtitle="AGENTS" />

        <div class="space-y-6">
            <div class="or3-sched-tabs">
                <button
                    v-for="tab in pageTabs"
                    :key="tab.value"
                    type="button"
                    class="or3-sched-tab"
                    :aria-pressed="activePageTab === tab.value"
                    @click="activePageTab = tab.value"
                >
                    <Icon :name="tab.icon" class="or3-sched-tab__icon" />
                    <span class="or3-sched-tab__label">{{ tab.label }}</span>
                </button>
            </div>

            <AgentCommandCenter
                ref="commandCenterRef"
                :disabled="!commandReady"
                :disabled-reason="disabledReason"
                :submitting="submitting"
                :submit-error="submitError"
                :runner-options="agentRunners"
                :loading-runners="loadingRunners"
                :runner-list-supported="runnerListSupported"
                @submit="createJob"
                @dismiss-error="submitError = null"
            />

            <template v-if="activePageTab === 'overview'">
                <div
                    v-if="lastListError"
                    class="flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-(--or3-amber)/40 bg-(--or3-amber)/10 px-4 py-3"
                >
                    <p class="font-mono text-sm text-(--or3-text)">
                        Couldn’t refresh jobs. Showing cached activity.
                    </p>
                    <button
                        type="button"
                        class="or3-focus-ring rounded-xl border border-(--or3-border) bg-(--or3-surface) px-3 py-1.5 font-mono text-sm font-semibold"
                        @click="retryLoadJobs"
                    >
                        Retry
                    </button>
                </div>

                <section v-if="needsAttention.length">
                    <SectionHeader title="Needs attention" />
                    <div class="space-y-2.5">
                        <AgentActiveJobRow
                            v-for="job in needsAttention"
                            :key="`attention-${job.job_id}`"
                            :job="job"
                            :cancelling="cancellingId === job.job_id"
                            @open="openJobDetail"
                            @cancel="cancelJob"
                        />
                    </div>
                </section>

                <section>
                    <SectionHeader title="Active jobs">
                        <template #action>
                            <span
                                v-if="loadingJobs"
                                class="flex items-center gap-1 font-mono text-[11px] text-(--or3-text-muted)"
                            >
                                <Icon
                                    name="i-pixelarticons-loader"
                                    class="size-3 animate-spin"
                                />
                                Refreshing
                            </span>
                            <StatusPill
                                v-else-if="!runningJobs.length && !queuedJobs.length"
                                label="all clear"
                                tone="green"
                            />
                        </template>
                    </SectionHeader>

                    <div
                        v-if="runningJobs.length || queuedJobs.length"
                        class="space-y-2.5"
                    >
                        <AgentActiveJobRow
                            v-for="job in runningJobs"
                            :key="job.job_id"
                            :job="job"
                            :cancelling="cancellingId === job.job_id"
                            @open="openJobDetail"
                            @cancel="cancelJob"
                        />
                        <AgentActiveJobRow
                            v-for="job in queuedJobs"
                            :key="job.job_id"
                            :job="job"
                            :cancelling="cancellingId === job.job_id"
                            @open="openJobDetail"
                            @cancel="cancelJob"
                        />
                    </div>
                    <EmptyState
                        v-else
                        icon="i-pixelarticons-robot"
                        title="Nothing running yet"
                        :description="emptyActiveDescription"
                    />
                </section>

                <section>
                    <SectionHeader title="Queue & history">
                        <template #action>
                            <button
                                type="button"
                                class="or3-focus-ring font-mono text-[11px] font-semibold text-(--or3-green-dark)"
                                @click="activePageTab = 'activity'"
                            >
                                View all activity
                            </button>
                        </template>
                    </SectionHeader>

                    <AgentQueueHistory
                        :pending="pendingPreview"
                        :recent="recentPreview"
                        @open="openJobDetail"
                    />
                </section>
            </template>

            <section v-else>
                <SectionHeader title="Activity" />
                <AgentActivityList
                    :groups="groupedActivityJobs"
                    :result-jobs="resultHighlightJobs"
                    :show-results-section="showResultsSection"
                    :loading="loadingJobs"
                    :error="listErrorMessage"
                    :selected-status="activityStatus"
                    :selected-runner="activityRunner"
                    :runner-options="runnerFilterOptions"
                    :query="activityQuery"
                    :hide-reviewed="hideReviewed"
                    :is-reviewed="isReviewed"
                    :has-any-jobs="jobs.length > 0"
                    @open="openJobDetail"
                    @change-status="activityStatus = $event"
                    @change-runner="activityRunner = $event"
                    @search="activityQuery = $event"
                    @change-hide-reviewed="hideReviewed = $event"
                    @retry="retryLoadJobs"
                />
            </section>

            <AgentJobDetail
                :open="detailOpen"
                :job="selectedJob"
                :reviewed="
                    selectedJob ? isReviewed(selectedJob.job_id) : false
                "
                :busy="
                    cancellingId === selectedJob?.job_id ||
                    retryingId === selectedJob?.job_id
                "
                @update:open="onDetailOpenChange"
                @cancel="cancelJob"
                @retry="retryJobAndClose"
                @continue="continueInChat"
                @prefill="prefillFromJob"
                @mark-reviewed="markJobReviewed"
            />
        </div>
    </AppShell>
</template>

<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref } from 'vue';
import type { JobSnapshot } from '~/types/or3-api';
import type {
    AgentCommandDisabledReason,
    AgentTaskPayload,
} from '~/components/agents/AgentCommandCenter.vue';
import type { Or3AppError } from '~/types/app-state';
import { programmaticSend } from '~/composables/useChatInputBridge';
import { normalizeResultDisplayText } from '~/utils/or3/result-display';
import { isActiveStatus, normalizeStatus } from '~/utils/or3/jobs';
import {
    buildRunnerFilterOptions,
    filterJobsByRunner,
    filterJobsByStatus,
    filterUnreviewedJobs,
    groupJobsByDate,
    isAttentionStatus,
    jobMatchesSearch,
    jobToCommandDraft,
    sortJobsByUpdated,
    type ActivityStatusFilter,
} from '~/utils/or3/agent-jobs';
import { useReviewedJobs } from '~/composables/useReviewedJobs';

const router = useRouter();
const route = useRoute();
const toast = useToast();
const { activeHost, isConnected } = useActiveHost();
const { activeSession, ensureSession } = useChatSessions();
const {
    jobs,
    loadingJobs,
    lastListError,
    listSupported,
    queueJob,
    queueAgentCliJob,
    loadJobs,
    loadAgentRunners,
    abortJob,
    retryJob,
    fetchArtifact,
    startActiveJobTracking,
    stopActiveJobTracking,
    agentRunners,
    loadingRunners,
    runnerListSupported,
} = useJobs();
const { health, refreshStatus } = useComputerStatus();
const { isReviewed, markReviewed, reviewedIds } = useReviewedJobs();

const commandCenterRef = ref<{
    resetForm: () => void;
    setDraft: (draft: ReturnType<typeof jobToCommandDraft>) => void;
} | null>(null);
const submitting = ref(false);
const submitError = ref<string | null>(null);
const cancellingId = ref<string | null>(null);
const retryingId = ref<string | null>(null);
const detailOpen = ref(false);
const selectedJobId = ref<string | null>(null);

const activePageTab = ref<'overview' | 'activity'>('overview');
const activityStatus = ref<ActivityStatusFilter>('all');
const activityRunner = ref('all');
const activityQuery = ref('');
const hideReviewed = ref(false);

const pageTabs = [
    { value: 'overview' as const, label: 'Overview', icon: 'i-pixelarticons-home' },
    {
        value: 'activity' as const,
        label: 'Activity',
        icon: 'i-pixelarticons-list',
    },
];

const allJobsSorted = computed(() => sortJobsByUpdated(jobs.value));

const needsAttention = computed(() =>
    allJobsSorted.value.filter(
        (job) => isActiveStatus(job.status) && isAttentionStatus(job),
    ),
);

const attentionIds = computed(
    () => new Set(needsAttention.value.map((j) => j.job_id)),
);

const runningJobs = computed(() =>
    allJobsSorted.value.filter(
        (j) => j.status === 'running' && !attentionIds.value.has(j.job_id),
    ),
);

const queuedJobs = computed(() =>
    allJobsSorted.value.filter(
        (j) => j.status === 'queued' && !attentionIds.value.has(j.job_id),
    ),
);

const pendingPreview = computed(() =>
    allJobsSorted.value.filter((j) => j.status === 'queued').slice(0, 4),
);

const recentPreview = computed(() =>
    allJobsSorted.value
        .filter((j) =>
            ['completed', 'failed', 'aborted'].includes(
                normalizeStatus(j.status),
            ),
        )
        .slice(0, 4),
);

const runnerFilterOptions = computed(() =>
    buildRunnerFilterOptions(jobs.value),
);

const activityFilteredJobs = computed(() => {
    let list = allJobsSorted.value;
    list = filterJobsByStatus(list, activityStatus.value);
    list = filterJobsByRunner(list, activityRunner.value);
    list = filterUnreviewedJobs(list, reviewedIds.value, hideReviewed.value);
    list = list.filter((job) => jobMatchesSearch(job, activityQuery.value));
    return list;
});

const showResultsSection = computed(
    () =>
        !activityQuery.value.trim() &&
        (activityStatus.value === 'all' ||
            activityStatus.value === 'completed' ||
            activityStatus.value === 'failed'),
);

const resultHighlightJobs = computed(() => {
    if (!showResultsSection.value) return [];
    return activityFilteredJobs.value
        .filter((job) => {
            const status = normalizeStatus(job.status);
            return status === 'completed' || status === 'failed';
        })
        .slice(0, 8);
});

const groupedActivityJobs = computed(() => {
    const highlightIds = new Set(
        resultHighlightJobs.value.map((j) => j.job_id),
    );
    const list =
        showResultsSection.value && highlightIds.size
            ? activityFilteredJobs.value.filter(
                  (j) => !highlightIds.has(j.job_id),
              )
            : activityFilteredJobs.value;
    return groupJobsByDate(list);
});

const selectedJob = computed<JobSnapshot | null>(() => {
    const id = selectedJobId.value;
    if (!id) return null;
    return jobs.value.find((j) => j.job_id === id) ?? null;
});

const subagentsAvailable = computed(() => {
    const flag = health.value?.subagentManagerEnabled;
    return flag === undefined ? true : flag === true;
});

const disabledReason = computed<AgentCommandDisabledReason | null>(() => {
    if (!activeHost.value) {
        return {
            title: 'Connect a computer first',
            description:
                'Pair your or3-intern computer in Settings to start delegating work.',
            actionTo: '/settings',
            actionLabel: 'Open settings',
        };
    }
    if (!isConnected.value) {
        return {
            title: 'Finish pairing your computer',
            description:
                'Your computer is set up but not authorized yet. Finish pairing to enable agent tasks.',
            actionTo: '/settings',
            actionLabel: 'Resume pairing',
        };
    }
    if (loadingRunners.value) {
        return null;
    }
    const hasExternalRunners =
        agentRunners.value?.some((r) => r.id !== 'or3-intern') ?? false;
    if (!subagentsAvailable.value && !hasExternalRunners) {
        return {
            title: 'Agents are turned off on this computer',
            description:
                'Enable subagents in or3-intern\u2019s configuration, then reload this page.',
            actionTo: '/settings',
            actionLabel: 'Open settings',
        };
    }
    return null;
});

const commandReady = computed(() => disabledReason.value === null);

const listErrorMessage = computed(() => {
    if (!lastListError.value) return null;
    return (
        lastListError.value.message ||
        describeError(lastListError.value, 'Couldn\u2019t refresh jobs.')
    );
});

const emptyActiveDescription = computed(() => {
    if (!commandReady.value) {
        return 'Once your computer is connected, tasks you delegate will appear here.';
    }
    return 'Hand off a task above and it\u2019ll appear here. You can keep using the app while or3-intern works.';
});

function describeError(error: unknown, fallback: string): string {
    const err = error as Or3AppError | undefined;
    if (!err) return fallback;
    switch (err.code) {
        case 'host_unreachable':
            return 'Couldn\u2019t reach your computer. Check that or3-intern is running.';
        case 'auth_required':
        case 'session_required':
        case 'session_expired':
            return 'Your connection expired. Reconnect from settings to continue.';
        case 'forbidden':
            return 'Your computer rejected this request. Check pairing role.';
        case 'rate_limited':
            return 'Too many requests at once. Try again in a few seconds.';
        case 'capability_unavailable':
            return 'Subagents aren\u2019t available on this computer right now.';
        case 'validation_failed':
            return err.message || 'That request looks malformed.';
        default:
            return err.message || fallback;
    }
}

async function retryLoadJobs() {
    try {
        await loadJobs();
    } catch (error) {
        toast.add({
            title: 'Couldn\u2019t refresh jobs',
            description: describeError(error, 'Try again in a moment.'),
            icon: 'i-pixelarticons-alert',
            color: 'warning',
        });
    }
}

function scrollToCommandCenter() {
    if (!import.meta.client) return;
    const el = document.getElementById('agent-command-center');
    el?.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function prefillFromJob(job: JobSnapshot) {
    const draft = jobToCommandDraft(job);
    commandCenterRef.value?.setDraft(draft);
    activePageTab.value = 'overview';
    detailOpen.value = false;
    nextTick(() => {
        scrollToCommandCenter();
    });
    toast.add({
        title: 'Task loaded in command center',
        description: 'Edit the task, then hand it off when ready.',
        icon: 'i-pixelarticons-edit',
        color: 'neutral',
    });
}

function markJobReviewed(job: JobSnapshot) {
    markReviewed(job.job_id);
    toast.add({
        title: 'Marked as reviewed',
        icon: 'i-pixelarticons-check',
        color: 'neutral',
    });
}

async function createJob(payload: AgentTaskPayload) {
    if (!commandReady.value || submitting.value) return;
    submitting.value = true;
    submitError.value = null;
    try {
        const session = activeSession.value ?? ensureSession();
        const isExternal = payload.runnerId !== 'or3-intern';
        if (isExternal) {
            await queueAgentCliJob(
                {
                    parent_session_key: session.sessionKey,
                    runner_id: payload.runnerId as Exclude<
                        string,
                        'or3-intern'
                    >,
                    task: payload.transportTask,
                    timeout_seconds:
                        payload.priority === 'high'
                            ? 1800
                            : payload.priority === 'low'
                              ? 600
                              : 900,
                    mode: payload.mode as
                        | 'review'
                        | 'safe_edit'
                        | 'sandbox_auto'
                        | undefined,
                    isolation: payload.isolation as
                        | 'host_readonly'
                        | 'host_workspace_write'
                        | 'sandbox_workspace_write'
                        | 'sandbox_dangerous'
                        | undefined,
                    model: payload.model,
                    max_turns: payload.maxTurns,
                    cwd: payload.cwd,
                    meta: {
                        category: payload.category,
                        priority: payload.priority,
                        notify: payload.notify,
                        auto_approve_safe: payload.autoApprove,
                        attachments: payload.attachments,
                    },
                },
                {
                    task: payload.task,
                    category: payload.category,
                    priority: payload.priority,
                    notify: payload.notify,
                    autoApprove: payload.autoApprove,
                    parent_session_key: session.sessionKey,
                    runner_id: payload.runnerId,
                    runner_label: payload.runnerLabel,
                    mode: payload.mode,
                    isolation: payload.isolation,
                    model: payload.model,
                    cwd: payload.cwd,
                    max_turns: payload.maxTurns,
                },
            );
        } else {
            await queueJob(
                {
                    parent_session_key: session.sessionKey,
                    task: payload.transportTask,
                    timeout_seconds:
                        payload.priority === 'high'
                            ? 1800
                            : payload.priority === 'low'
                              ? 600
                              : 900,
                    meta: {
                        category: payload.category,
                        priority: payload.priority,
                        notify: payload.notify,
                        auto_approve_safe: payload.autoApprove,
                        attachments: payload.attachments,
                    },
                },
                {
                    task: payload.task,
                    category: payload.category,
                    priority: payload.priority,
                    notify: payload.notify,
                    autoApprove: payload.autoApprove,
                    parent_session_key: session.sessionKey,
                },
            );
        }
        commandCenterRef.value?.resetForm();
        const runnerName = payload.runnerLabel || 'or3-intern';
        toast.add({
            title: `Task handed off to ${runnerName}`,
            description: `${runnerName} will work on it in the background.`,
            icon: 'i-pixelarticons-check',
            color: 'success',
        });
    } catch (error) {
        submitError.value = describeError(
            error,
            'Couldn\u2019t hand off that task. Try again in a moment.',
        );
    } finally {
        submitting.value = false;
    }
}

async function cancelJob(job: JobSnapshot) {
    if (cancellingId.value) return;
    cancellingId.value = job.job_id;
    try {
        await abortJob(job.job_id);
        toast.add({
            title: 'Task stopped',
            icon: 'i-pixelarticons-close',
            color: 'neutral',
        });
    } catch (error) {
        toast.add({
            title: 'Couldn\u2019t stop that task',
            description: describeError(error, 'It may have already finished.'),
            icon: 'i-pixelarticons-alert',
            color: 'warning',
        });
    } finally {
        cancellingId.value = null;
    }
}

async function retryJobAndClose(job: JobSnapshot) {
    if (retryingId.value) return;
    retryingId.value = job.job_id;
    try {
        const result = await retryJob(job.job_id);
        if (!result) {
            toast.add({
                title: 'Not enough info to retry',
                description:
                    'Try delegating the task again from the command center.',
                icon: 'i-pixelarticons-alert',
                color: 'warning',
            });
            return;
        }
        detailOpen.value = false;
        toast.add({
            title: 'Retrying task',
            icon: 'i-pixelarticons-redo',
            color: 'success',
        });
    } catch (error) {
        toast.add({
            title: 'Retry failed',
            description: describeError(
                error,
                'Couldn\u2019t requeue that task right now.',
            ),
            icon: 'i-pixelarticons-alert',
            color: 'error',
        });
    } finally {
        retryingId.value = null;
    }
}

function openJobDetail(job: JobSnapshot) {
    selectedJobId.value = job.job_id;
    detailOpen.value = true;
}

function openJobDetailById(jobId: string) {
    selectedJobId.value = jobId;
    detailOpen.value = true;
}

function onDetailOpenChange(value: boolean) {
    detailOpen.value = value;
}

function buildContinuationPrompt(
    job: JobSnapshot,
    overrideResult?: string | null,
): string | null {
    const rawResult =
        overrideResult && overrideResult.trim().length > 0
            ? overrideResult
            : job.final_text;
    const resolvedResult = normalizeResultDisplayText(
        rawResult,
        job.runner_id,
    ).trim();
    const hasResult = !!resolvedResult;
    const hasError = !!job.error;
    const hasTask = !!job.task;
    if (!hasResult && !hasError && !hasTask) return null;

    const lines: string[] = [];
    const statusWord =
        job.status === 'completed'
            ? 'finished'
            : job.status === 'failed'
              ? 'failed'
              : job.status === 'aborted'
                ? 'was cancelled'
                : 'is in progress';
    const agentName =
        job.runner_label || job.runner_id
            ? `${job.runner_label || job.runner_id} (via or3-intern)`
            : 'or3-intern';
    lines.push(
        `I just had my **${agentName}** run a background task that ${statusWord}, and I want to keep working on it here in chat with full context.`,
    );
    lines.push('');
    if (hasTask) {
        lines.push('**Original task I gave the agent:**');
        lines.push('> ' + (job.task ?? '').replace(/\n/g, '\n> '));
        lines.push('');
    }
    const meta: string[] = [`Status: \`${job.status}\``];
    if (job.category) meta.push(`Category: \`${job.category}\``);
    if (job.priority) meta.push(`Priority: \`${job.priority}\``);
    if (job.job_id) meta.push(`Job: \`${job.job_id}\``);
    lines.push(meta.join(' · '));
    lines.push('');
    if (hasResult) {
        lines.push("**Agent's result:**");
        lines.push('');
        lines.push(resolvedResult!.trim());
        lines.push('');
        lines.push(
            'Please pick up from here — answer follow-up questions, refine or expand the result, or help me decide the next step. Treat the result above as ground truth from the agent run; ask me before re-running the whole task.',
        );
    } else if (hasError) {
        lines.push("**Agent's error:**");
        lines.push('```');
        lines.push(job.error!.trim());
        lines.push('```');
        lines.push('');
        lines.push(
            'Help me understand what went wrong and what to try next. You don\u2019t need to re-run the task yourself — just talk it through with me.',
        );
    } else {
        lines.push(
            'The task ran but didn\u2019t return any text output. Help me figure out what to try next.',
        );
    }
    return lines.join('\n');
}

async function continueInChat(job: JobSnapshot) {
    let fullResult: string | null = null;
    if (job.artifact_id) {
        const sessionKey =
            job.child_session_key || job.parent_session_key || '';
        if (sessionKey) {
            try {
                const artifact = await fetchArtifact(
                    job.artifact_id,
                    sessionKey,
                    { maxBytes: 1_000_000 },
                );
                if (artifact?.content) {
                    fullResult = artifact.content;
                }
            } catch {
                // Fall back to the inline preview already on the job.
            }
        }
    }
    const prompt = buildContinuationPrompt(job, fullResult);
    if (!prompt) {
        toast.add({
            title: 'Nothing to continue from',
            description:
                'This task didn\u2019t leave enough context to seed a chat. Try delegating a follow-up task instead.',
            icon: 'i-pixelarticons-alert',
            color: 'warning',
        });
        return;
    }
    try {
        await router.push('/');
        await nextTick();
        const sent = await programmaticSend('main', prompt);
        if (!sent) {
            throw new Error('Chat input is not ready.');
        }
        detailOpen.value = false;
    } catch (error) {
        toast.add({
            title: 'Couldn\u2019t open chat',
            description:
                error instanceof Error && error.message
                    ? error.message
                    : 'The app could not load the chat view. Check that the dev server is still running, then try again.',
            icon: 'i-pixelarticons-alert',
            color: 'warning',
        });
    }
}

function applyPrefillFromRoute() {
    const raw = route.query.prefill;
    const jobId = typeof raw === 'string' ? raw : null;
    if (!jobId) return;
    const job = jobs.value.find((j) => j.job_id === jobId);
    if (job) {
        prefillFromJob(job);
        void router.replace({ query: { ...route.query, prefill: undefined } });
    }
}

onMounted(async () => {
    startActiveJobTracking();
    void refreshStatus().catch(() => {});
    void loadAgentRunners().catch(() => {});
    try {
        await loadJobs();
        applyPrefillFromRoute();
    } catch (error) {
        const err = error as Or3AppError;
        if (
            err?.code !== 'auth_required' &&
            err?.code !== 'capability_unavailable'
        ) {
            toast.add({
                title: 'Couldn\u2019t load history',
                description: describeError(
                    error,
                    'We\u2019ll keep showing local cached tasks.',
                ),
                icon: 'i-pixelarticons-alert',
                color: 'warning',
            });
        }
    }
});

onBeforeUnmount(() => {
    stopActiveJobTracking();
});
</script>

<style scoped>
.or3-sched-tabs {
    display: flex;
    align-items: stretch;
    gap: 0.25rem;
    border-bottom: 1px solid var(--or3-border);
    padding: 0 0.25rem;
    overflow-x: auto;
    scrollbar-width: none;
}

.or3-sched-tabs::-webkit-scrollbar {
    display: none;
}

.or3-sched-tab {
    position: relative;
    display: inline-flex;
    align-items: center;
    gap: 0.55rem;
    flex-shrink: 0;
    padding: 0.85rem 0.95rem;
    margin-bottom: -1px;
    border-bottom: 2px solid transparent;
    font-size: 0.9rem;
    font-weight: 500;
    color: var(--or3-text-muted);
    background: transparent;
    transition:
        color 140ms ease,
        border-color 140ms ease;
    white-space: nowrap;
}

.or3-sched-tab:hover {
    color: var(--or3-text);
}

.or3-sched-tab[aria-pressed='true'] {
    color: var(--or3-green-dark);
    border-bottom-color: var(--or3-green);
    font-weight: 600;
}

.or3-sched-tab__icon {
    width: 1rem;
    height: 1rem;
}
</style>
