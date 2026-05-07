<template>
    <AppShell>
        <AppHeader subtitle="RECENT ACTIVITY" />

        <div class="min-w-0 max-w-full space-y-4 pb-28">
            <SurfaceCard padded class-name="or3-activity-hero">
                <div class="flex-col w-full h-full">
                    <div class="flex w-full h-full justify-between">
                        <div class="flex flex-col gap-1.5 min-w-1/2">
                            <div class="flex-1">
                                <span class="or3-activity-eyebrow">
                                    <Icon name="i-pixelarticons-timeline" class="size-4" />
                                    Computer history
                                </span>
                                <h1
                                    class="mt-2 wrap-break-word font-mono text-lg font-semibold leading-snug tracking-tight text-(--or3-text) sm:text-xl">
                                    See what or3-intern has been doing.
                                </h1>
                                <p class="mt-1.5 max-w-2xl text-sm leading-6 text-(--or3-text-muted)">
                                    Agent runs, approvals, and scheduled task activity from the connected computer.
                                </p>
                            </div>
                        </div>
                        <div class="min-w-4/12 flex items-center justify-center">
                            <img src="/computer-icons/timeline-guy.webp" alt="Activity timeline illustration"
                                class="w-full max-h-[168px] object-contain" />
                        </div>
                    </div>
                    <UButton color="neutral" variant="soft" icon="i-pixelarticons-reload" :loading="refreshing"
                        class="shrink-0 self-start mt-6 md:mt-0" @click="refreshAll">
                        Refresh
                    </UButton>
                </div>
            </SurfaceCard>

            <SurfaceCard class-name="!p-0 overflow-hidden">
                <div class="flex overflow-hidden">
                    <div v-for="metric in metrics" :key="metric.label"
                        class="min-w-0 flex-1 border-(--or3-border) px-2.5 py-3 text-center not-last:border-r">
                        <Icon :name="metric.icon"
                            :class="['mx-auto size-4', metric.value > 0 ? 'text-(--or3-green-dark)' : 'text-(--or3-text-muted)']" />
                        <p
                            class="mt-1.5 font-mono text-[10px] font-light uppercase tracking-[0.16em] text-(--or3-text-muted)">
                            {{ metric.label }}
                        </p>
                        <p :class="[
                            'mt-1 font-mono text-lg font-semibold leading-none',
                            metric.value > 0 ? 'text-(--or3-green-dark)' : 'text-(--or3-text)',
                        ]">
                            {{ metric.value }}
                        </p>
                        <p class="mt-1 truncate text-[10px] leading-4 text-(--or3-text-muted)" :title="metric.detail">
                            {{ metric.detail }}
                        </p>
                    </div>
                </div>
            </SurfaceCard>

            <section>
                <SectionHeader title="Timeline" :subtitle="timelineSubtitle">
                    <template #action>
                        <StatusPill :label="refreshing ? 'refreshing' : `${filteredEntries.length} shown`"
                            :tone="errorMessage ? 'amber' : 'green'" :pulse="refreshing" />
                    </template>
                </SectionHeader>

                <div class="-mx-1 mb-3 flex gap-2 overflow-x-auto px-1 pb-1">
                    <button v-for="filter in filters" :key="filter.value" type="button"
                        class="or3-chip whitespace-nowrap" :aria-pressed="activeFilter === filter.value"
                        @click="activeFilter = filter.value">
                        <Icon :name="filter.icon" class="size-4" />
                        <span>{{ filter.label }}</span>
                        <span class="or3-chip__count">{{ filter.count }}</span>
                    </button>
                </div>

                <SurfaceCard v-if="errorMessage" tone="caution" class-name="mb-3 flex items-start gap-3">
                    <Icon name="i-pixelarticons-warning-box" class="mt-0.5 size-5 shrink-0 text-(--or3-amber)" />
                    <p class="text-sm leading-6 text-amber-900">
                        {{ errorMessage }} Showing any cached activity that is still available.
                    </p>
                </SurfaceCard>

                <div v-if="filteredEntries.length" class="space-y-2.5">
                    <button v-for="entry in filteredEntries" :key="entry.id" type="button"
                        class="or3-history-row or3-focus-ring text-left" @click="openEntry(entry)">
                        <span class="or3-history-row__icon" :data-tone="entry.tone">
                            <Icon :name="entry.icon" class="size-5" />
                        </span>
                        <span class="min-w-0 flex-1 overflow-hidden">
                            <span class="flex min-w-0 items-start gap-2">
                                <span
                                    class="min-w-0 flex-1 wrap-break-word font-mono text-sm font-semibold leading-snug text-(--or3-text) line-clamp-2">
                                    {{ entry.title }}
                                </span>
                                <StatusPill :label="entry.status" :tone="entry.tone" class="shrink-0" />
                            </span>
                            <span
                                class="mt-1.5 block wrap-break-word line-clamp-2 text-[13px] leading-5 text-(--or3-text-muted)">
                                {{ entry.detail }}
                            </span>
                            <span
                                class="mt-2 flex min-w-0 flex-wrap items-center gap-x-2 gap-y-0.5 font-mono text-[11px] text-(--or3-text-muted)">
                                <span class="truncate">{{ entry.source }}</span>
                                <span aria-hidden="true">•</span>
                                <span>{{ formatRelative(entry.timestamp) }}</span>
                            </span>
                        </span>
                        <Icon name="i-pixelarticons-chevron-right"
                            class="size-4 shrink-0 self-center text-(--or3-text-muted)" />
                    </button>
                </div>

                <EmptyState v-else icon="i-pixelarticons-timeline" title="No activity yet"
                    description="Agent runs, approvals, and scheduled task updates will appear here after your computer starts doing work.">
                    <UButton to="/agents" color="primary" variant="soft" icon="i-pixelarticons-robot">
                        Start an agent run
                    </UButton>
                    <UButton to="/scheduled" color="neutral" variant="soft" icon="i-pixelarticons-clock">
                        Open scheduled tasks
                    </UButton>
                </EmptyState>
            </section>
        </div>

        <AgentJobDetail :open="jobDetailOpen" :job="selectedJob" :busy="jobActionBusy"
            @update:open="jobDetailOpen = $event" @cancel="cancelSelectedJob" @retry="retrySelectedJob"
            @continue="continueJobInAgents" />

        <ApprovalDetailSheet v-model:open="approvalDetailOpen" :approval="selectedApproval" :busy="approvalActionBusy"
            @approve="approveSelectedApproval" @deny="denySelectedApproval" @cancel="cancelSelectedApproval" />

        <USlideover :open="cronDetailOpen" side="right" :ui="{ content: 'bg-(--or3-surface) sm:max-w-lg' }"
            @update:open="cronDetailOpen = $event">
            <template #content>
                <div v-if="selectedCronJob" class="flex h-full flex-col bg-(--or3-surface)">
                    <div class="border-b border-(--or3-border) px-5 pb-5 pt-5">
                        <div class="flex items-start gap-3">
                            <span
                                class="grid size-11 shrink-0 place-items-center rounded-2xl bg-(--or3-green-soft) text-(--or3-green-dark)">
                                <Icon
                                    :name="selectedCronJob.enabled ? 'i-pixelarticons-clock' : 'i-pixelarticons-pause'"
                                    class="size-5" />
                            </span>
                            <div class="min-w-0 flex-1 overflow-hidden">
                                <p
                                    class="or3-label text-[11px] font-semibold tracking-[0.18em] text-(--or3-text-muted)">
                                    SCHEDULED TASK
                                </p>
                                <h2 class="mt-1 wrap-break-word font-mono text-base font-semibold leading-snug text-(--or3-text)"
                                    style="overflow-wrap: anywhere;">
                                    {{ selectedCronJob.name || selectedCronJob.id }}
                                </h2>
                            </div>
                            <UButton color="neutral" variant="ghost" icon="i-pixelarticons-close"
                                aria-label="Close scheduled task details" @click="cronDetailOpen = false" />
                        </div>
                        <div class="mt-4 flex flex-wrap gap-2">
                            <StatusPill :label="cronStatusLabel(selectedCronJob)"
                                :tone="cronStatusTone(selectedCronJob)" />
                            <StatusPill :label="selectedCronJob.payload?.kind || 'task'" tone="neutral" />
                        </div>
                    </div>

                    <div class="flex-1 space-y-5 overflow-y-auto overflow-x-hidden px-5 py-5">
                        <section class="grid grid-cols-2 gap-2">
                            <div v-for="stat in cronStats(selectedCronJob)" :key="stat.label"
                                class="min-w-0 rounded-2xl border border-(--or3-border) bg-(--or3-surface-soft) px-3 py-2.5">
                                <p class="or3-command text-[10px] uppercase tracking-[0.16em] text-(--or3-text-muted)">
                                    {{ stat.label }}
                                </p>
                                <p class="mt-1 wrap-break-word font-mono text-sm font-semibold text-(--or3-text)"
                                    style="overflow-wrap: anywhere;">
                                    {{ stat.value }}
                                </p>
                            </div>
                        </section>

                        <section>
                            <p class="or3-label text-[11px] font-semibold tracking-[0.18em] text-(--or3-text-muted)">
                                SCHEDULE
                            </p>
                            <p
                                class="mt-2 rounded-2xl border border-(--or3-border) bg-(--or3-surface-soft) px-3 py-2.5 font-mono text-[12px] leading-5 text-(--or3-text)">
                                {{ describeSchedule(selectedCronJob) }}
                            </p>
                        </section>

                        <section>
                            <p class="or3-label text-[11px] font-semibold tracking-[0.18em] text-(--or3-text-muted)">
                                TASK
                            </p>
                            <p
                                class="mt-2 wrap-break-word rounded-2xl border border-(--or3-border) bg-(--or3-surface-soft) px-3 py-2.5 text-sm leading-6 text-(--or3-text)">
                                {{ cronPrompt(selectedCronJob) || 'No task prompt is configured.' }}
                            </p>
                        </section>

                        <section v-if="selectedCronJob.payload?.kind === 'agent_cli_run'">
                            <p class="or3-label text-[11px] font-semibold tracking-[0.18em] text-(--or3-text-muted)">
                                RUNNER
                            </p>
                            <div class="mt-2 grid gap-2 rounded-2xl border border-(--or3-border) bg-(--or3-surface-soft) p-3 text-sm text-(--or3-text)"
                                style="overflow-wrap: anywhere;">
                                <span><strong>Runner:</strong> {{ selectedCronJob.payload.agent_run?.runner_id ||
                                    'Unknown' }}</span>
                                <span><strong>Mode:</strong> {{ selectedCronJob.payload.agent_run?.mode || 'review'
                                    }}</span>
                                <span><strong>Isolation:</strong> {{ selectedCronJob.payload.agent_run?.isolation ||
                                    'host_readonly' }}</span>
                                <span v-if="selectedCronJob.payload.agent_run?.cwd"><strong>CWD:</strong> {{
                                    selectedCronJob.payload.agent_run.cwd }}</span>
                            </div>
                        </section>

                        <section v-if="selectedCronJob.state?.last_error">
                            <p class="or3-label text-[11px] font-semibold tracking-[0.18em] text-(--or3-text-muted)">
                                LAST ERROR
                            </p>
                            <p
                                class="mt-2 rounded-2xl border border-rose-200 bg-rose-50 px-3 py-2.5 text-sm leading-6 text-rose-800">
                                {{ selectedCronJob.state.last_error }}
                            </p>
                        </section>
                    </div>

                    <div class="space-y-2 border-t border-(--or3-border) p-5">
                        <UButton block color="primary" variant="solid" icon="i-pixelarticons-play"
                            :loading="cronActionBusy" @click="runSelectedCronJob">
                            Run now
                        </UButton>
                        <UButton to="/scheduled" block color="neutral" variant="soft" icon="i-pixelarticons-clock">
                            Open scheduled tasks
                        </UButton>
                    </div>
                </div>
            </template>
        </USlideover>
    </AppShell>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import type { ApprovalRequest, CronJob, JobSnapshot } from '~/types/or3-api';
import type { Or3AppError } from '~/types/app-state';

type ActivityCategory = 'all' | 'jobs' | 'approvals' | 'scheduled';
type ActivityTone = 'green' | 'amber' | 'danger' | 'neutral';

interface ActivityEntry {
    id: string;
    category: Exclude<ActivityCategory, 'all'>;
    title: string;
    detail: string;
    source: string;
    status: string;
    icon: string;
    tone: ActivityTone;
    timestamp: number;
    sourceId: string;
}

const toast = useToast();
const { jobs, loadJobs, loadAgentRunners, abortJob, retryJob } = useJobs();
const { approvals, loadApprovals, approve, deny, cancel } = useApprovals();
const { cronJobs, cronStatus, loadJobs: loadCronJobs, runJob: runCronJob } = useCronJobs();

const refreshing = ref(false);
const errorMessage = ref('');
const activeFilter = ref<ActivityCategory>('all');
const selectedEntry = ref<ActivityEntry | null>(null);
const jobDetailOpen = ref(false);
const approvalDetailOpen = ref(false);
const cronDetailOpen = ref(false);
const jobActionBusy = ref(false);
const approvalActionBusy = ref(false);
const cronActionBusy = ref(false);

const selectedJob = computed(() => {
    const entry = selectedEntry.value;
    if (!entry || entry.category !== 'jobs') return null;
    return jobs.value.find((job) => job.job_id === entry.sourceId) ?? null;
});

const selectedApproval = computed(() => {
    const entry = selectedEntry.value;
    if (!entry || entry.category !== 'approvals') return null;
    return approvals.value.find((approval) => String(approval.id) === entry.sourceId) ?? null;
});

const selectedCronJob = computed(() => {
    const entry = selectedEntry.value;
    if (!entry || entry.category !== 'scheduled') return null;
    return cronJobs.value.find((job) => job.id === entry.sourceId) ?? null;
});

const entries = computed<ActivityEntry[]>(() =>
    [
        ...jobs.value.map(jobToEntry),
        ...approvals.value.map(approvalToEntry),
        ...cronJobs.value.flatMap(cronToEntries),
    ]
        .filter((entry): entry is ActivityEntry => Boolean(entry))
        .sort((a, b) => b.timestamp - a.timestamp)
        .slice(0, 120),
);

const filteredEntries = computed(() => {
    if (activeFilter.value === 'all') return entries.value;
    return entries.value.filter((entry) => entry.category === activeFilter.value);
});

const filters = computed(() => [
    {
        label: 'All',
        value: 'all' as const,
        icon: 'i-pixelarticons-timeline',
        count: entries.value.length,
    },
    {
        label: 'Agent runs',
        value: 'jobs' as const,
        icon: 'i-pixelarticons-robot',
        count: entries.value.filter((entry) => entry.category === 'jobs').length,
    },
    {
        label: 'Approvals',
        value: 'approvals' as const,
        icon: 'i-pixelarticons-shield',
        count: entries.value.filter((entry) => entry.category === 'approvals').length,
    },
    {
        label: 'Scheduled',
        value: 'scheduled' as const,
        icon: 'i-pixelarticons-clock',
        count: entries.value.filter((entry) => entry.category === 'scheduled').length,
    },
]);

const metrics = computed(() => {
    const activeJobs = jobs.value.filter((job) => job.status === 'queued' || job.status === 'running').length;
    const pendingApprovals = approvals.value.filter((approval) => approval.status === 'pending').length;
    const activeCron = cronJobs.value.filter((job) => job.enabled).length;
    return [
        {
            label: 'Activity',
            value: entries.value.length,
            detail: 'Timeline items',
            icon: 'i-pixelarticons-timeline',
        },
        {
            label: 'Running',
            value: activeJobs,
            detail: 'Active agent work',
            icon: 'i-pixelarticons-briefcase',
        },
        {
            label: 'Approvals',
            value: pendingApprovals,
            detail: 'Awaiting review',
            icon: 'i-pixelarticons-shield',
        },
        {
            label: 'Scheduled',
            value: activeCron,
            detail: cronStatus.value?.enabled === false ? 'Scheduler off' : 'Enabled tasks',
            icon: 'i-pixelarticons-clock',
        },
    ];
});

const timelineSubtitle = computed(() => {
    if (activeFilter.value === 'all') return 'Agent runs, approvals, and scheduled task activity.';
    const filter = filters.value.find((item) => item.value === activeFilter.value);
    return filter ? `Showing ${filter.label.toLowerCase()}.` : '';
});

onMounted(() => {
    void refreshAll();
});

async function refreshAll() {
    refreshing.value = true;
    errorMessage.value = '';
    try {
        await Promise.allSettled([
            loadAgentRunners().catch(() => undefined),
            loadJobs(),
            loadApprovals(),
            loadCronJobs(),
        ]).then((results) => {
            const failed = results.filter((result) => result.status === 'rejected');
            if (failed.length) {
                errorMessage.value = describeError(
                    (failed[0] as PromiseRejectedResult).reason,
                    'Some activity sources could not be refreshed.',
                );
            }
        });
    } finally {
        refreshing.value = false;
    }
}

function jobToEntry(job: JobSnapshot): ActivityEntry {
    const status = normalizeStatusLabel(job.status);
    const title = job.title || job.task || jobLabel(job.kind);
    return {
        id: `job:${job.job_id}`,
        category: 'jobs',
        title: trim(title, 72),
        detail: trim(job.final_text || job.error || job.task || job.kind || 'Agent run activity.', 140),
        source: jobSource(job),
        status,
        icon: jobIcon(job.kind),
        tone: statusTone(job.status),
        timestamp: parseIso(job.finished_at || job.updated_at || job.created_at),
        sourceId: job.job_id,
    };
}

function approvalToEntry(approval: ApprovalRequest): ActivityEntry {
    const status = normalizeStatusLabel(approval.status || 'pending');
    return {
        id: `approval:${approval.id}`,
        category: 'approvals',
        title: approval.status === 'pending' ? 'Approval requested' : `Approval ${status}`,
        detail: approvalDetail(approval),
        source: approval.domain || approval.type || 'Approvals',
        status,
        icon: 'i-pixelarticons-shield',
        tone: approvalTone(approval.status),
        timestamp: parseIso(approval.created_at),
        sourceId: String(approval.id),
    };
}

function cronToEntries(job: CronJob): ActivityEntry[] {
    const output: ActivityEntry[] = [];
    const title = job.name || job.id;
    const prompt = cronPrompt(job);

    if (job.state?.last_run_at_ms) {
        output.push({
            id: `cron:last:${job.id}`,
            category: 'scheduled',
            title: `Scheduled task ran: ${trim(title, 52)}`,
            detail: job.state.last_error || prompt || describeSchedule(job),
            source: 'Scheduled task',
            status: normalizeStatusLabel(job.state.last_status || 'ran'),
            icon: 'i-pixelarticons-clock',
            tone: cronTone(job.state.last_status),
            timestamp: job.state.last_run_at_ms,
            sourceId: job.id,
        });
    }

    const configuredAt = job.updated_at_ms || job.created_at_ms;
    if (configuredAt) {
        output.push({
            id: `cron:config:${job.id}`,
            category: 'scheduled',
            title: `${job.enabled ? 'Scheduled task active' : 'Scheduled task paused'}: ${trim(title, 52)}`,
            detail: `${describeSchedule(job)} · ${prompt || 'No prompt set.'}`,
            source: 'Scheduler',
            status: job.enabled ? 'active' : 'paused',
            icon: job.enabled ? 'i-pixelarticons-clock' : 'i-pixelarticons-pause',
            tone: job.enabled ? 'green' : 'neutral',
            timestamp: configuredAt,
            sourceId: job.id,
        });
    }

    return output;
}

function openEntry(entry: ActivityEntry) {
    selectedEntry.value = entry;
    jobDetailOpen.value = entry.category === 'jobs';
    approvalDetailOpen.value = entry.category === 'approvals';
    cronDetailOpen.value = entry.category === 'scheduled';
}

async function cancelSelectedJob(job: JobSnapshot) {
    jobActionBusy.value = true;
    try {
        await abortJob(job.job_id);
        toast.add({ title: 'Job canceled', color: 'success', icon: 'i-pixelarticons-check' });
    } catch (error) {
        toast.add({ title: 'Could not cancel job', description: describeError(error, 'Try again from the Agents page.'), color: 'error' });
    } finally {
        jobActionBusy.value = false;
    }
}

async function retrySelectedJob(job: JobSnapshot) {
    jobActionBusy.value = true;
    try {
        const retried = await retryJob(job.job_id);
        toast.add({ title: retried ? 'Job queued again' : 'Could not retry this job', color: retried ? 'success' : 'warning' });
        if (retried?.job_id) selectedEntry.value = { ...jobToEntry({ ...job, job_id: retried.job_id, status: retried.status, updated_at: new Date().toISOString() }), sourceId: retried.job_id };
    } catch (error) {
        toast.add({ title: 'Retry failed', description: describeError(error, 'Try again from the Agents page.'), color: 'error' });
    } finally {
        jobActionBusy.value = false;
    }
}

async function continueJobInAgents() {
    await navigateTo('/agents');
}

async function approveSelectedApproval(remember: boolean) {
    const approval = selectedApproval.value;
    if (!approval) return;
    approvalActionBusy.value = true;
    try {
        await approve(approval.id, remember, remember ? 'approved and remembered from activity' : 'approved from activity');
        toast.add({ title: remember ? 'Approved and remembered' : 'Approved once', color: 'success', icon: 'i-pixelarticons-check' });
        approvalDetailOpen.value = false;
    } catch (error) {
        toast.add({ title: 'Approval failed', description: describeError(error, 'Unable to approve this request.'), color: 'error' });
    } finally {
        approvalActionBusy.value = false;
    }
}

async function denySelectedApproval() {
    const approval = selectedApproval.value;
    if (!approval) return;
    approvalActionBusy.value = true;
    try {
        await deny(approval.id, 'denied from activity');
        toast.add({ title: 'Approval denied', color: 'success', icon: 'i-pixelarticons-close' });
        approvalDetailOpen.value = false;
    } catch (error) {
        toast.add({ title: 'Deny failed', description: describeError(error, 'Unable to deny this request.'), color: 'error' });
    } finally {
        approvalActionBusy.value = false;
    }
}

async function cancelSelectedApproval() {
    const approval = selectedApproval.value;
    if (!approval) return;
    approvalActionBusy.value = true;
    try {
        await cancel(approval.id, 'canceled from activity');
        toast.add({ title: 'Approval canceled', color: 'success' });
        approvalDetailOpen.value = false;
    } catch (error) {
        toast.add({ title: 'Cancel failed', description: describeError(error, 'Unable to cancel this request.'), color: 'error' });
    } finally {
        approvalActionBusy.value = false;
    }
}

async function runSelectedCronJob() {
    const job = selectedCronJob.value;
    if (!job) return;
    cronActionBusy.value = true;
    try {
        await runCronJob(job.id);
        toast.add({ title: 'Scheduled task started', description: job.name || job.id, color: 'success', icon: 'i-pixelarticons-play' });
    } catch (error) {
        toast.add({ title: 'Run failed', description: describeError(error, 'Unable to run scheduled task.'), color: 'error' });
    } finally {
        cronActionBusy.value = false;
    }
}

function cronStatusLabel(job: CronJob) {
    if (!job.enabled) return 'paused';
    if (job.state?.last_status === 'error') return 'error';
    if (job.state?.next_run_at_ms) return 'scheduled';
    return 'active';
}

function cronStatusTone(job: CronJob): ActivityTone {
    if (job.state?.last_status === 'error') return 'danger';
    if (!job.enabled) return 'neutral';
    if (!job.state?.next_run_at_ms) return 'amber';
    return 'green';
}

function cronStats(job: CronJob) {
    return [
        { label: 'Next', value: formatAbsolute(job.state?.next_run_at_ms) },
        { label: 'Last', value: formatAbsolute(job.state?.last_run_at_ms) },
        { label: 'Status', value: job.state?.last_status || (job.enabled ? 'active' : 'paused') },
        { label: 'Session', value: job.payload?.session_key || 'default' },
    ];
}

function jobLabel(kind?: string) {
    if (!kind) return 'Agent run';
    if (kind.startsWith('agent_cli:')) return `${kind.slice('agent_cli:'.length)} run`;
    if (kind === 'subagent') return 'Subagent run';
    if (kind === 'turn') return 'Assistant reply';
    if (kind === 'exec' || kind === 'terminal') return 'Terminal command';
    if (kind === 'file_list') return 'File listing';
    if (kind === 'file_write') return 'File change';
    return kind.replace(/_/g, ' ');
}

function jobSource(job: JobSnapshot) {
    if (job.runner_label) return job.runner_label;
    if (job.runner_id) return job.runner_id;
    if (job.kind?.startsWith('agent_cli:')) return job.kind.slice('agent_cli:'.length);
    if (job.kind === 'subagent') return 'or3-intern';
    return 'Agent job';
}

function jobIcon(kind?: string) {
    if (kind === 'exec' || kind === 'terminal') return 'i-pixelarticons-terminal';
    if (kind === 'file_list' || kind === 'file_write') return 'i-pixelarticons-folder';
    if (kind === 'turn') return 'i-pixelarticons-message';
    return 'i-pixelarticons-robot';
}

function statusTone(status?: string): ActivityTone {
    if (status === 'failed' || status === 'aborted' || status === 'timed_out') return 'danger';
    if (status === 'completed' || status === 'succeeded') return 'green';
    if (status === 'queued' || status === 'running' || status === 'starting') return 'amber';
    return 'neutral';
}

function approvalTone(status?: string): ActivityTone {
    if (status === 'pending') return 'amber';
    if (status === 'approved') return 'green';
    if (status === 'denied' || status === 'expired' || status === 'canceled') return 'danger';
    return 'neutral';
}

function cronTone(status?: string): ActivityTone {
    if (status === 'error') return 'danger';
    if (status === 'ok' || status === 'ran') return 'green';
    if (status === 'skipped') return 'amber';
    return 'neutral';
}

function approvalDetail(approval: ApprovalRequest) {
    const subject = (approval.subject ?? {}) as Record<string, unknown>;
    const candidate =
        stringValue(subject.command) ||
        stringValue(subject.path) ||
        stringValue(subject.file) ||
        stringValue(subject.url) ||
        stringValue(subject.reason) ||
        '';
    if (candidate) return trim(candidate, 140);
    if (approval.type === 'exec') return 'Shell command approval.';
    if (approval.type === 'file_write') return 'File change approval.';
    return approval.type || 'Privileged action approval.';
}

function cronPrompt(job: CronJob) {
    if (job.payload?.kind === 'agent_cli_run') return job.payload?.agent_run?.task || '';
    return job.payload?.message || '';
}

function describeSchedule(job: CronJob) {
    const schedule = job.schedule;
    if (schedule.kind === 'at') return `Once at ${formatAbsolute(schedule.at_ms)}`;
    if (schedule.kind === 'every') return `Every ${formatDuration(schedule.every_ms || 0)}`;
    return schedule.expr ? `Cron ${schedule.expr}` : 'Cron schedule';
}

function normalizeStatusLabel(status?: string) {
    return (status || 'unknown').replace(/_/g, ' ');
}

function parseIso(value?: string) {
    if (!value) return 0;
    const parsed = Date.parse(value);
    return Number.isFinite(parsed) ? parsed : 0;
}

function formatRelative(value: number) {
    if (!value) return 'Unknown time';
    const deltaMs = Date.now() - value;
    const abs = Math.abs(deltaMs);
    const suffix = deltaMs >= 0 ? 'ago' : 'from now';
    if (abs < 60_000) return 'Just now';
    if (abs < 60 * 60_000) return `${Math.round(abs / 60_000)}m ${suffix}`;
    if (abs < 24 * 60 * 60_000) return `${Math.round(abs / (60 * 60_000))}h ${suffix}`;
    if (abs < 7 * 24 * 60 * 60_000) return `${Math.round(abs / (24 * 60 * 60_000))}d ${suffix}`;
    return formatAbsolute(value);
}

function formatAbsolute(value?: number | null) {
    if (!value) return 'not scheduled';
    return new Intl.DateTimeFormat(undefined, {
        month: 'short',
        day: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
    }).format(new Date(value));
}

function formatDuration(ms: number) {
    if (!ms) return 'custom interval';
    if (ms % (24 * 60 * 60 * 1000) === 0) return `${ms / (24 * 60 * 60 * 1000)}d`;
    if (ms % (60 * 60 * 1000) === 0) return `${ms / (60 * 60 * 1000)}h`;
    if (ms % (60 * 1000) === 0) return `${ms / (60 * 1000)}m`;
    return `${Math.round(ms / 1000)}s`;
}

function stringValue(value: unknown) {
    return typeof value === 'string' ? value : '';
}

function trim(value: string, max: number) {
    const flat = value.replace(/\s+/g, ' ').trim();
    return flat.length > max ? `${flat.slice(0, max - 1)}…` : flat;
}

function describeError(error: unknown, fallback: string) {
    const appError = error as Or3AppError | undefined;
    return appError?.message || fallback;
}
</script>

<style scoped>
.or3-activity-hero {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 1rem;
}

.or3-activity-eyebrow {
    display: inline-flex;
    align-items: center;
    gap: 0.4rem;
    font-family:
        'JetBrains Mono', ui-monospace, SFMono-Regular, Menlo, monospace;
    font-size: 0.7rem;
    font-weight: 700;
    letter-spacing: 0.16em;
    text-transform: uppercase;
    color: var(--or3-green-dark);
}

.or3-history-row {
    display: flex;
    align-items: flex-start;
    gap: 0.85rem;
    width: 100%;
    max-width: 100%;
    min-width: 0;
    overflow: hidden;
    border: 1px solid var(--or3-border);
    border-radius: 1.25rem;
    background: color-mix(in srgb, var(--or3-surface) 92%, white 8%);
    padding: 0.85rem 0.95rem;
    text-decoration: none;
    box-shadow: var(--or3-shadow-soft);
    overflow-wrap: anywhere;
    word-break: break-word;
    transition:
        border-color 0.15s ease,
        transform 0.12s ease,
        background 0.15s ease;
}

.or3-history-row:hover {
    border-color: color-mix(in srgb, var(--or3-green) 35%, var(--or3-border));
    background: white;
}

.or3-history-row:active {
    transform: scale(0.99);
}

.or3-history-row__icon {
    display: grid;
    width: 2.5rem;
    height: 2.5rem;
    flex: 0 0 auto;
    place-items: center;
    border-radius: 0.95rem;
    background: var(--or3-green-soft);
    color: var(--or3-green-dark);
}

.or3-history-row__icon[data-tone='amber'] {
    background: color-mix(in srgb, var(--or3-amber) 18%, white 82%);
    color: #8a5a0a;
}

.or3-history-row__icon[data-tone='danger'] {
    background: color-mix(in srgb, var(--or3-danger) 14%, white 86%);
    color: var(--or3-danger);
}

.or3-history-row__icon[data-tone='neutral'] {
    background: color-mix(in srgb, var(--or3-border) 42%, white 58%);
    color: var(--or3-text-muted);
}

@media (max-width: 520px) {
    .or3-activity-hero {
        flex-direction: column;
    }
}
</style>