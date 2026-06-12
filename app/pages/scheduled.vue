<template>
    <AppShell
        desktop-title="Scheduled"
        desktop-subtitle="Recurring tasks and automations."
    >
        <template #sidebar>
            <ComputerSidebar />
        </template>
        <AppHeader subtitle="SCHEDULED TASKS" />

        <div class="space-y-6">
            <!-- Hero -->
            <SurfaceCard class-name="or3-sched-command-center space-y-5" padded>
                <header class="or3-sched-hero">
                    <div class="or3-sched-hero__copy">
                        <p class="or3-sched-eyebrow">
                            <Icon
                                name="i-pixelarticons-clock"
                                class="size-3.5"
                                aria-hidden="true"
                            />
                            <span>Automation Center</span>
                        </p>
                        <h1 class="or3-sched-title">
                            Your work,<br />
                            <span class="or3-sched-title__accent">on autopilot.</span>
                        </h1>
                        <p class="or3-sched-sub">
                            Create once, then let OR3 handle the rest&mdash;so you can focus on what matters.
                        </p>
                        <div class="or3-sched-actions">
                            <UButton
                                color="primary"
                                variant="solid"
                                icon="i-pixelarticons-plus"
                                size="lg"
                                :disabled="!cronAvailable"
                                class="or3-sched-btn-primary"
                                @click="startCreate"
                            >
                                Schedule task
                            </UButton>
                            <UButton
                                color="neutral"
                                variant="outline"
                                icon="i-pixelarticons-reload"
                                size="lg"
                                :loading="cronLoading"
                                class="or3-sched-btn-secondary"
                                @click="refreshAll"
                            >
                                Refresh
                            </UButton>
                        </div>
                    </div>
                    <div class="or3-sched-stage" aria-hidden="true">
                        <span class="or3-sched-stage__sparkle or3-sched-stage__sparkle--a" />
                        <span class="or3-sched-stage__sparkle or3-sched-stage__sparkle--b" />
                        <span class="or3-sched-stage__sparkle or3-sched-stage__sparkle--c" />
                        <div class="or3-sched-stage__podium">
                            <span class="or3-sched-stage__glow" />
                            <RetroComputerMascot
                                :size="152"
                                src="/computer-icons/cron-job-guy.webp"
                                sparkle
                                class="or3-sched-stage__mascot"
                            />
                        </div>
                    </div>
                </header>
            </SurfaceCard>

            <!-- Scheduler offline warning -->
            <SurfaceCard v-if="!cronAvailable" tone="caution" class-name="space-y-3">
                <div class="flex items-start gap-3">
                    <Icon name="i-pixelarticons-warning-box" class="mt-0.5 size-5 shrink-0 text-(--or3-amber)" />
                    <div class="min-w-0 flex-1">
                        <p class="font-mono text-sm font-semibold text-amber-900">Scheduled tasks are not available</p>
                        <p class="mt-1 text-xs leading-5 text-amber-800/85">
                            Enable the cron scheduler in settings, restart or3-intern service, then come back here to create jobs.
                        </p>
                    </div>
                </div>
                <UButton to="/settings/section/automation" color="warning" variant="soft" icon="i-pixelarticons-settings-cog">
                    Open automation settings
                </UButton>
            </SurfaceCard>

            <!-- Tabs -->
            <div v-if="cronAvailable" class="or3-sched-tabs">
                <button
                    v-for="tab in tabs"
                    :key="tab.value"
                    type="button"
                    class="or3-sched-tab"
                    :aria-pressed="activeTab === tab.value"
                    @click="activeTab = tab.value"
                >
                    <Icon :name="tab.icon" class="or3-sched-tab__icon" />
                    <span class="or3-sched-tab__label">{{ tab.label }}</span>
                    <span class="or3-sched-tab__count">{{ tab.count }}</span>
                </button>
            </div>

            <!-- Loading -->
            <div v-if="cronLoading" class="rounded-2xl border border-(--or3-border) bg-white/70 p-4 text-sm text-(--or3-text-muted)">
                Loading…
            </div>

            <!-- Error -->
            <div v-else-if="cronError" class="or3-sched-error">
                <Icon name="i-pixelarticons-alert" class="size-4" />
                <span>{{ cronError.message || 'Unable to load scheduled tasks.' }}</span>
            </div>

            <!-- Task list -->
            <div v-else-if="filteredJobs.length" class="space-y-3">
                <div
                    v-for="job in filteredJobs"
                    :key="job.id"
                    class="or3-sched-card"
                    role="button"
                    tabindex="0"
                    @click="startEdit(job)"
                    @keydown.enter.prevent="startEdit(job)"
                >
                    <span
                        class="or3-sched-card__icon"
                        :class="`or3-sched-card__icon--${statusTone(job)}`"
                    >
                        <Icon
                            :name="job.payload?.kind === 'runner_run' ? 'i-pixelarticons-terminal' : 'i-pixelarticons-calendar'"
                            class="size-4.5"
                        />
                    </span>
                    <div class="or3-sched-card__body">
                        <div class="or3-sched-card__heading">
                            <p class="or3-sched-card__title">{{ job.name || job.id }}</p>
                            <span
                                class="or3-sched-card__status"
                                :class="`or3-sched-card__status--${statusTone(job)}`"
                            >
                                <span class="or3-sched-card__status-dot" />
                                {{ statusLabel(job) }}
                            </span>
                        </div>
                        <p class="or3-sched-card__desc">{{ jobPrompt(job) }}</p>
                        <div class="or3-sched-card__chips">
                            <span class="or3-sched-chip or3-sched-chip--schedule">
                                <Icon name="pixelarticons:calendar-import" class="size-3.5" />
                                {{ describeSchedule(job) }}
                            </span>
                            <span class="or3-sched-chip">
                                <Icon
                                    :name="job.payload?.kind === 'runner_run' ? 'pixelarticons:mood-happy' : 'pixelarticons:zap'"
                                    class="size-3"
                                />
                                {{
                                    job.payload?.kind === 'runner_run'
                                        ? agentRunnerLabel(
                                              job.payload?.agent_run?.runner_id,
                                          )
                                        : 'Legacy scheduled task'
                                }}
                            </span>
                        </div>
                    </div>
                    <div class="or3-sched-card__menu" @click.stop>
                        <UDropdownMenu
                            :items="jobMenuItems(job)"
                            :content="{ align: 'end', sideOffset: 6 }"
                        >
                            <UButton
                                icon="i-pixelarticons-more-vertical"
                                color="neutral"
                                variant="ghost"
                                size="sm"
                                square
                                :aria-label="`Actions for ${job.name || job.id}`"
                            />
                        </UDropdownMenu>
                    </div>
                </div>
            </div>

            <!-- Empty state -->
            <div v-else-if="cronAvailable && !cronLoading" class="or3-sched-empty">
                <span class="or3-sched-empty__icon">
                    <Icon name="i-pixelarticons-calendar-search" class="size-5" />
                </span>
                <div class="or3-sched-empty__copy">
                    <p class="or3-sched-empty__title">No scheduled tasks yet</p>
                    <p class="or3-sched-empty__subtitle">
                        Automate your recurring work and get time back for what matters.
                    </p>
                </div>
                <UButton
                    color="primary"
                    variant="solid"
                    icon="i-pixelarticons-plus"
                    class="or3-sched-empty__btn"
                    @click="startCreate"
                >
                    Create your first task
                </UButton>
            </div>

            <!-- Tip -->
            <div v-if="cronAvailable" class="or3-sched-tip">
                <span class="or3-sched-tip__text">
                    <Icon name="pixelarticons:lightbulb-on" class="size-4 text-(--or3-amber)" />
                    <span><strong>Tip:</strong> Enable &ldquo;Delete after first run&rdquo; for one-time tasks.</span>
                </span>
                <NuxtLink to="/settings/section/automation" class="or3-sched-tip__link">
                    Learn more
                    <Icon name="i-pixelarticons-arrow-right" class="size-3.5" />
                </NuxtLink>
            </div>
        </div>

        <ScheduledTaskFormSheet
            v-model:open="formOpen"
            :edit-job="editingJob"
            @save="onSave"
        />
        <DestructiveActionConfirmModal
            v-model:open="deleteConfirmOpen"
            title="Delete this scheduled task?"
            :item-name="deleteTargetName"
            consequence="This task will stop running and will be removed from the schedule."
            undo-availability="There is no undo. You can create the task again later."
            confirm-label="Delete task"
            :loading="Boolean(actionId?.endsWith(':delete'))"
            @confirm="confirmRemove"
        />
    </AppShell>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import type { AgentRunnerInfo, CronJob, CronSchedule } from '~/types/or3-api';
import type { Or3AppError } from '~/types/app-state';
import ScheduledTaskFormSheet from '~/components/scheduled/ScheduledTaskFormSheet.vue';

const toast = useToast();
const {
    cronJobs,
    cronStatus,
    cronLoading,
    cronError,
    activeJobs,
    loadStatus,
    loadJobs,
    createJob,
    updateJob,
    deleteJob,
    runJob,
    pauseJob,
    resumeJob,
} = useCronJobs();
const {
    agentRunners,
    loadAgentRunners,
} = useJobs();

const formOpen = ref(false);
const editingJob = ref<CronJob | null>(null);
const actionId = ref<string | null>(null);
const activeTab = ref<'upcoming' | 'active' | 'all'>('upcoming');
const deleteConfirmOpen = ref(false);
const deleteTarget = ref<CronJob | null>(null);

const cronAvailable = computed(() => cronStatus.value?.available !== false && cronStatus.value?.enabled !== false);

const tabs = computed(() => [
    {
        label: 'Upcoming',
        value: 'upcoming' as const,
        icon: 'i-pixelarticons-clock',
        count: upcomingJobs.value.length,
    },
    {
        label: 'Active',
        value: 'active' as const,
        icon: 'i-pixelarticons-play',
        count: activeJobs.value.length,
    },
    {
        label: 'All',
        value: 'all' as const,
        icon: 'i-pixelarticons-inbox-all',
        count: cronJobs.value.length,
    },
]);

const upcomingJobs = computed(() =>
    activeJobs.value.filter((job) => job.state?.next_run_at_ms),
);

const filteredJobs = computed(() => {
    switch (activeTab.value) {
        case 'upcoming':
            return upcomingJobs.value;
        case 'active':
            return activeJobs.value;
        case 'all':
        default:
            return cronJobs.value;
    }
});
const deleteTargetName = computed(() => deleteTarget.value?.name || deleteTarget.value?.id || 'This scheduled task');

onMounted(() => {
    void refreshAll();
});

async function refreshAll() {
    try {
        const [status] = await Promise.all([
            loadStatus(),
            loadAgentRunners().catch(() => undefined),
        ]);
        if (status?.available === false || status?.enabled === false) return;
        await loadJobs();
    } catch {
        // State is already captured by the composable.
    }
}

function startCreate() {
    editingJob.value = null;
    formOpen.value = true;
}

function startEdit(job: CronJob) {
    editingJob.value = job;
    formOpen.value = true;
}

async function onSave(payload: Partial<CronJob>, isEdit: boolean) {
    try {
        if (isEdit && editingJob.value) {
            await updateJob(editingJob.value.id, payload);
            toast.add({ title: 'Scheduled task updated', color: 'success', icon: 'i-pixelarticons-check' });
        } else {
            await createJob(payload);
            toast.add({ title: 'Scheduled task created', color: 'success', icon: 'i-pixelarticons-check' });
        }
        formOpen.value = false;
        editingJob.value = null;
    } catch (error) {
        const message = describeError(error, 'Unable to save scheduled task.');
        toast.add({ title: 'Save failed', description: message, color: 'error' });
    }
}

async function run(job: CronJob) {
    actionId.value = `${job.id}:run`;
    try {
        await runJob(job.id);
        toast.add({ title: 'Task started', description: job.name, color: 'success', icon: 'i-pixelarticons-play' });
    } catch (error) {
        toast.add({ title: 'Run failed', description: describeError(error, 'Unable to run task.'), color: 'error' });
    } finally {
        actionId.value = null;
    }
}

async function toggle(job: CronJob) {
    actionId.value = `${job.id}:toggle`;
    try {
        if (job.enabled) await pauseJob(job.id);
        else await resumeJob(job.id);
        toast.add({ title: job.enabled ? 'Task paused' : 'Task resumed', description: job.name, color: 'success' });
    } catch (error) {
        toast.add({ title: 'Update failed', description: describeError(error, 'Unable to update task.'), color: 'error' });
    } finally {
        actionId.value = null;
    }
}

async function remove(job: CronJob) {
    deleteTarget.value = job;
    deleteConfirmOpen.value = true;
}

async function confirmRemove() {
    const job = deleteTarget.value;
    if (!job) return;
    actionId.value = `${job.id}:delete`;
    try {
        await deleteJob(job.id);
        deleteConfirmOpen.value = false;
        deleteTarget.value = null;
        toast.add({ title: 'Scheduled task deleted', color: 'success', icon: 'i-pixelarticons-trash' });
    } catch (error) {
        toast.add({ title: 'Delete failed', description: describeError(error, 'Unable to delete task.'), color: 'error' });
    } finally {
        actionId.value = null;
    }
}

function jobMenuItems(job: CronJob) {
    const isBusy = Boolean(actionId.value?.startsWith(`${job.id}:`));
    return [
        [
            {
                label: 'Run now',
                icon: 'i-pixelarticons-play',
                disabled: isBusy,
                onSelect: () => run(job),
            },
            {
                label: job.enabled ? 'Pause' : 'Resume',
                icon: job.enabled ? 'i-pixelarticons-pause' : 'i-pixelarticons-play',
                disabled: isBusy,
                onSelect: () => toggle(job),
            },
        ],
        [
            {
                label: 'Edit',
                icon: 'i-pixelarticons-edit',
                onSelect: () => startEdit(job),
            },
            {
                label: 'Delete',
                icon: 'i-pixelarticons-trash',
                disabled: isBusy,
                onSelect: () => remove(job),
            },
        ],
    ];
}

function describeSchedule(job: CronJob) {
    const schedule = job.schedule;
    if (schedule.kind === 'at') return `Once at ${formatDate(schedule.at_ms)}`;
    if (schedule.kind === 'every') return `Every ${formatDuration(schedule.every_ms || 0)}`;
    return schedule.expr || 'Cron expression';
}

function jobPrompt(job: CronJob) {
    if (job.payload?.kind === 'runner_run') return job.payload?.agent_run?.task || 'No task set.';
    return job.payload?.message || 'No prompt set.';
}

function agentRunnerLabel(id?: string) {
    if (!id) return 'Unknown';
    const runner = (agentRunners.value ?? []).find((item: AgentRunnerInfo) => item.id === id);
    return runner?.display_name || id;
}

function statusLabel(job: CronJob) {
    if (!job.enabled) return 'paused';
    if (job.state?.last_status === 'error') return 'error';
    if (job.state?.next_run_at_ms) return 'scheduled';
    return 'active';
}

function statusTone(job: CronJob): 'green' | 'amber' | 'danger' | 'neutral' {
    if (job.state?.last_status === 'error') return 'danger';
    if (!job.enabled) return 'neutral';
    if (!job.state?.next_run_at_ms) return 'amber';
    return 'green';
}

function formatDate(value?: number | null) {
    if (!value) return 'Not scheduled';
    return new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value));
}

function formatDuration(ms: number) {
    if (ms % (24 * 60 * 60 * 1000) === 0) return `${ms / (24 * 60 * 60 * 1000)}d`;
    if (ms % (60 * 60 * 1000) === 0) return `${ms / (60 * 60 * 1000)}h`;
    if (ms % (60 * 1000) === 0) return `${ms / (60 * 1000)}m`;
    return `${Math.round(ms / 1000)}s`;
}

function describeError(error: unknown, fallback: string) {
    const appError = error as Or3AppError | undefined;
    return appError?.message || fallback;
}
</script>

<style scoped>
/* ── Hero ───────────────────────────────────────────────────────── */
.or3-sched-command-center {
    position: relative;
    overflow: hidden;
    background:
        radial-gradient(
            120% 90% at 100% 0%,
            color-mix(in srgb, var(--or3-green) 18%, transparent) 0%,
            transparent 55%
        ),
        radial-gradient(
            90% 70% at 0% 0%,
            color-mix(in srgb, var(--or3-green) 8%, transparent) 0%,
            transparent 60%
        ),
        var(--or3-surface);
}

.or3-sched-command-center::before {
    content: '';
    position: absolute;
    inset: 0;
    pointer-events: none;
    background-image: radial-gradient(
        color-mix(in srgb, var(--or3-green) 22%, transparent) 1px,
        transparent 1px
    );
    background-size: 14px 14px;
    background-position: top right;
    mask-image: radial-gradient(
        70% 60% at 100% 0%,
        rgba(0, 0, 0, 0.55),
        transparent 70%
    );
    opacity: 0.55;
}

.or3-sched-command-center > * {
    position: relative;
}

.or3-sched-hero {
    display: grid;
    grid-template-columns: minmax(0, 1fr) auto;
    gap: 24px;
    align-items: center;
}

.or3-sched-hero__copy {
    min-width: 0;
}

.or3-sched-eyebrow {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    font-family:
        'IBM Plex Mono', ui-monospace, SFMono-Regular, Menlo, monospace;
    font-size: 11px;
    font-weight: 600;
    letter-spacing: 0.18em;
    color: var(--or3-green-dark);
    text-transform: uppercase;
}

.or3-sched-title {
    margin-top: 6px;
    font-family: 'IBM Plex Serif', 'Georgia', ui-serif, serif;
    font-size: clamp(1.65rem, 5vw, 2.15rem);
    font-weight: 600;
    line-height: 1.05;
    letter-spacing: -0.01em;
    color: var(--or3-text);
}

.or3-sched-title__accent {
    display: inline;
    color: var(--or3-green-dark);
    font-style: italic;
}

.or3-sched-sub {
    margin-top: 10px;
    max-width: 32ch;
    font-size: 13.5px;
    line-height: 1.55;
    color: var(--or3-text-muted);
}

.or3-sched-actions {
    display: flex;
    flex-wrap: nowrap;
    align-items: center;
    gap: 0.7rem;
    margin-top: 1rem;
}

.or3-sched-actions :deep(button) {
    white-space: nowrap;
    flex-shrink: 0;
}

.or3-sched-btn-primary :deep(button),
.or3-sched-btn-primary {
    box-shadow: 0 6px 18px color-mix(in srgb, var(--or3-green) 28%, transparent);
}

.or3-sched-btn-secondary {
    background: rgb(255 255 255 / 0.85);
}

.or3-sched-stage {
    position: relative;
    width: 192px;
    height: 192px;
    flex-shrink: 0;
}

.or3-sched-stage__podium {
    position: absolute;
    inset: 0;
    display: flex;
    align-items: center;
    justify-content: center;
}

.or3-sched-stage__glow {
    position: absolute;
    bottom: 28px;
    left: 50%;
    width: 130px;
    height: 28px;
    transform: translateX(-50%);
    border-radius: 999px;
    background: radial-gradient(
        ellipse at center,
        color-mix(in srgb, var(--or3-green) 55%, transparent) 0%,
        transparent 70%
    );
    filter: blur(2px);
}

.or3-sched-stage__mascot {
    position: relative;
    z-index: 1;
}

.or3-sched-stage__sparkle {
    position: absolute;
    width: 6px;
    height: 6px;
    border-radius: 999px;
    background: var(--or3-green);
    opacity: 0.7;
    box-shadow: 0 0 8px color-mix(in srgb, var(--or3-green) 60%, transparent);
}

.or3-sched-stage__sparkle--a {
    top: 18px;
    right: 30px;
}

.or3-sched-stage__sparkle--b {
    top: 82px;
    right: 6px;
    width: 4px;
    height: 4px;
}

.or3-sched-stage__sparkle--c {
    top: 16px;
    left: 46px;
    width: 4px;
    height: 4px;
}

@media (max-width: 560px) {
    .or3-sched-hero {
        gap: 16px;
    }

    .or3-sched-stage {
        width: 144px;
        height: 144px;
    }

    .or3-sched-stage__glow {
        bottom: 16px;
        width: 100px;
        height: 22px;
    }

    .or3-sched-title {
        font-size: 1.55rem;
    }

    .or3-sched-actions :deep(button) {
        flex: 0 1 auto;
    }
}

/* ── Tabs (underline style) ─────────────────────────────────────── */
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
    transition: color 140ms ease, border-color 140ms ease;
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

.or3-sched-tab__count {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    min-width: 1.4rem;
    height: 1.4rem;
    padding: 0 0.45rem;
    border-radius: 999px;
    background: color-mix(in srgb, var(--or3-surface-soft) 80%, transparent);
    color: var(--or3-text-muted);
    font-size: 0.72rem;
    font-weight: 600;
    line-height: 1;
}

.or3-sched-tab[aria-pressed='true'] .or3-sched-tab__count {
    background: var(--or3-green-soft);
    color: var(--or3-green-dark);
}

/* ── Cards ──────────────────────────────────────────────────────── */
.or3-sched-card {
    display: grid;
    grid-template-columns: auto 1fr auto;
    gap: 0.95rem;
    align-items: flex-start;
    border-radius: var(--or3-radius-card);
    border: 1px solid var(--or3-border);
    background: color-mix(in srgb, var(--or3-surface) 94%, white 6%);
    box-shadow: var(--or3-shadow-soft);
    padding: 1rem 1.1rem;
    cursor: pointer;
    transition: border-color 160ms ease, box-shadow 160ms ease, transform 160ms ease;
}

.or3-sched-card:hover {
    border-color: color-mix(in srgb, var(--or3-green) 35%, var(--or3-border) 65%);
    box-shadow: 0 6px 22px rgba(42, 35, 25, 0.07);
    transform: translateY(-1px);
}

.or3-sched-card:focus-visible {
    outline: none;
    border-color: var(--or3-green);
    box-shadow: 0 0 0 3px color-mix(in srgb, var(--or3-green-soft) 80%, transparent);
}

.or3-sched-card__icon {
    display: grid;
    place-items: center;
    width: 2.5rem;
    height: 2.5rem;
    flex-shrink: 0;
    border-radius: 0.85rem;
    border: 1px solid color-mix(in srgb, var(--or3-green) 18%, var(--or3-border) 82%);
    background: var(--or3-green-soft);
    color: var(--or3-green-dark);
}

.or3-sched-card__icon--amber {
    background: var(--or3-amber-soft);
    color: #8a5a08;
    border-color: color-mix(in srgb, var(--or3-amber) 28%, transparent);
}

.or3-sched-card__icon--danger {
    background: rgb(254 226 226);
    color: rgb(153 27 27);
    border-color: rgb(252 165 165);
}

.or3-sched-card__icon--neutral {
    background: var(--or3-surface-soft);
    color: var(--or3-text-muted);
    border-color: var(--or3-border);
}

.or3-sched-card__body {
    min-width: 0;
    display: flex;
    flex-direction: column;
    gap: 0.35rem;
}

.or3-sched-card__heading {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 0.75rem;
    min-width: 0;
}

.or3-sched-card__title {
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
    font-size: 0.95rem;
    font-weight: 700;
    letter-spacing: -0.005em;
    color: var(--or3-text);
}

.or3-sched-card__status {
    display: inline-flex;
    align-items: center;
    gap: 0.4rem;
    flex-shrink: 0;
    font-size: 0.78rem;
    font-weight: 500;
    color: var(--or3-text-muted);
    text-transform: capitalize;
}

.or3-sched-card__status-dot {
    display: block;
    width: 0.5rem;
    height: 0.5rem;
    border-radius: 999px;
    background: currentColor;
    box-shadow: 0 0 0 3px color-mix(in srgb, currentColor 18%, transparent);
}

.or3-sched-card__status--green {
    color: var(--or3-green);
}

.or3-sched-card__status--amber {
    color: var(--or3-amber);
}

.or3-sched-card__status--danger {
    color: rgb(220 38 38);
}

.or3-sched-card__status--neutral {
    color: var(--or3-text-muted);
}

.or3-sched-card__desc {
    overflow: hidden;
    display: -webkit-box;
    -webkit-line-clamp: 2;
    -webkit-box-orient: vertical;
    font-size: 0.83rem;
    line-height: 1.5;
    color: var(--or3-text-muted);
}

.or3-sched-card__chips {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 0.4rem;
    margin-top: 0.25rem;
}

.or3-sched-card__menu {
    display: flex;
    align-items: flex-start;
    flex-shrink: 0;
}

/* Chips */
.or3-sched-chip {
    display: inline-flex;
    align-items: center;
    gap: 0.35rem;
    padding: 0.3rem 0.65rem;
    border-radius: 999px;
    border: 1px solid var(--or3-border);
    background: rgb(255 255 255 / 0.7);
    font-size: 0.72rem;
    font-weight: 500;
    color: var(--or3-text-muted);
    white-space: nowrap;
}

.or3-sched-chip--schedule {
    background: color-mix(in srgb, var(--or3-green-soft) 85%, white 15%);
    border-color: color-mix(in srgb, var(--or3-green) 22%, transparent);
    color: var(--or3-green-dark);
}

/* ── Empty state ────────────────────────────────────────────────── */
.or3-sched-empty {
    display: flex;
    align-items: center;
    gap: 1rem;
    border-radius: var(--or3-radius-card);
    border: 1px dashed color-mix(in srgb, var(--or3-border) 80%, var(--or3-green) 20%);
    background:
        radial-gradient(circle at 12% 50%, color-mix(in srgb, var(--or3-green-soft) 35%, transparent) 0%, transparent 50%),
        color-mix(in srgb, var(--or3-surface) 80%, white 20%);
    padding: 1.1rem 1.25rem;
}

.or3-sched-empty__icon {
    display: grid;
    place-items: center;
    width: 2.6rem;
    height: 2.6rem;
    flex-shrink: 0;
    border-radius: 0.85rem;
    background: var(--or3-green-soft);
    color: var(--or3-green-dark);
    border: 1px solid color-mix(in srgb, var(--or3-green) 22%, transparent);
}

.or3-sched-empty__copy {
    min-width: 0;
    flex: 1 1 auto;
}

.or3-sched-empty__title {
    font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
    font-size: 0.95rem;
    font-weight: 700;
    color: var(--or3-text);
}

.or3-sched-empty__subtitle {
    margin-top: 0.3rem;
    font-size: 0.83rem;
    line-height: 1.5;
    color: var(--or3-text-muted);
    max-width: 38ch;
}

.or3-sched-empty__btn {
    flex-shrink: 0;
}

@media (max-width: 520px) {
    .or3-sched-empty {
        flex-wrap: wrap;
    }
    .or3-sched-empty__btn {
        width: 100%;
        justify-content: center;
    }
}

/* ── Tip ────────────────────────────────────────────────────────── */
.or3-sched-tip {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 1rem;
    flex-wrap: wrap;
    border-radius: var(--or3-radius-control);
    border: 1px solid color-mix(in srgb, var(--or3-amber) 22%, var(--or3-border) 78%);
    background: color-mix(in srgb, var(--or3-amber-soft) 30%, var(--or3-surface) 70%);
    padding: 0.75rem 1rem;
}

.or3-sched-tip__text {
    display: inline-flex;
    align-items: center;
    gap: 0.55rem;
    font-size: 0.8rem;
    color: var(--or3-text-muted);
}

.or3-sched-tip__text strong {
    color: var(--or3-text);
    font-weight: 600;
}

.or3-sched-tip__link {
    display: inline-flex;
    align-items: center;
    gap: 0.25rem;
    font-size: 0.78rem;
    font-weight: 600;
    color: var(--or3-green-dark);
}

.or3-sched-tip__link:hover {
    text-decoration: underline;
    text-underline-offset: 2px;
}

/* ── Error ──────────────────────────────────────────────────────── */
.or3-sched-error {
    display: flex;
    align-items: flex-start;
    gap: 0.5rem;
    border-radius: var(--or3-radius-card);
    border: 1px solid rgb(254 202 202);
    background: rgb(254 242 242 / 0.9);
    padding: 0.75rem 0.9rem;
    font-size: 0.8rem;
    color: rgb(153 27 27);
}
</style>
