<template>
    <AppShell>
        <AppHeader subtitle="AGENTS" />

        <div class="space-y-6">
            <AgentCommandCenter
                ref="commandCenterRef"
                :disabled="!commandReady"
                :disabled-reason="disabledReason"
                :submitting="submitting"
                :submit-error="submitError"
                @submit="createJob"
                @dismiss-error="submitError = null"
            />

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
                            v-else-if="!active.length"
                            label="all clear"
                            tone="green"
                        />
                    </template>
                </SectionHeader>

                <div v-if="active.length" class="space-y-2.5">
                    <AgentActiveJobRow
                        v-for="job in active"
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
                        <span
                            v-if="!listSupported"
                            class="font-mono text-[11px] text-(--or3-text-muted)"
                        >
                            Local view
                        </span>
                        <span
                            v-else-if="lastListError"
                            class="flex items-center gap-1 font-mono text-[11px] text-(--or3-amber)"
                        >
                            <Icon name="i-pixelarticons-alert" class="size-3" />
                            Sync paused
                        </span>
                    </template>
                </SectionHeader>

                <AgentQueueHistory
                    :pending="pending"
                    :recent="recent"
                    @open="openJobDetail"
                />
            </section>

            <AgentJobDetail
                :open="detailOpen"
                :job="selectedJob"
                :busy="
                    cancellingId === selectedJob?.job_id ||
                    retryingId === selectedJob?.job_id
                "
                @update:open="onDetailOpenChange"
                @cancel="cancelJob"
                @retry="retryJobAndClose"
                @continue="continueInChat"
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

const router = useRouter();
const toast = useToast();
const { activeHost, isConnected } = useActiveHost();
const { activeSession, ensureSession } = useChatSessions();
const {
    jobs,
    loadingJobs,
    lastListError,
    listSupported,
    queueJob,
    loadJobs,
    abortJob,
    retryJob,
    fetchArtifact,
    startActiveJobTracking,
    stopActiveJobTracking,
} = useJobs();
const { health, refreshStatus } = useComputerStatus();

const commandCenterRef = ref<{ resetForm: () => void } | null>(null);
const submitting = ref(false);
const submitError = ref<string | null>(null);
const cancellingId = ref<string | null>(null);
const retryingId = ref<string | null>(null);
const detailOpen = ref(false);
const selectedJobId = ref<string | null>(null);

const active = computed(() =>
    jobs.value.filter((j) => j.status === 'running' || j.status === 'queued'),
);
const pending = computed(() => jobs.value.filter((j) => j.status === 'queued'));
const recent = computed(() =>
    jobs.value.filter(
        (j) =>
            j.status === 'completed' ||
            j.status === 'failed' ||
            j.status === 'aborted',
    ),
);

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
    if (!subagentsAvailable.value) {
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
            return 'Your session expired. Reconnect from settings to continue.';
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

async function createJob(payload: AgentTaskPayload) {
    if (!commandReady.value || submitting.value) return;
    submitting.value = true;
    submitError.value = null;
    try {
        const session = activeSession.value ?? ensureSession();
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
        commandCenterRef.value?.resetForm();
        toast.add({
            title: 'Task handed off',
            description: 'or3-intern will work on it in the background.',
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

function onDetailOpenChange(value: boolean) {
    detailOpen.value = value;
}

function buildContinuationPrompt(
    job: JobSnapshot,
    overrideResult?: string | null,
): string | null {
    const resolvedResult =
        overrideResult && overrideResult.trim().length > 0
            ? overrideResult
            : job.final_text;
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
    lines.push(
        `I just had my **or3-intern agent** run a background task that ${statusWord}, and I want to keep working on it here in chat with full context.`,
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

onMounted(async () => {
    startActiveJobTracking();
    void refreshStatus().catch(() => {});
    try {
        await loadJobs();
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
