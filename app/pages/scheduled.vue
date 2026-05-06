<template>
    <AppShell>
        <AppHeader subtitle="SCHEDULED TASKS" />

        <div class="space-y-5">
            <SurfaceCard class-name="or3-scheduled-hero" padded>
                <div class="or3-scheduled-hero__copy">
                    <span class="or3-scheduled-eyebrow">
                        <Icon name="i-pixelarticons-clock" class="size-4" />
                        Automation center
                    </span>
                    <h1 class="or3-scheduled-title">Schedule OR3 to work later.</h1>
                    <p class="or3-scheduled-subtitle">
                        Create, pause, run, and review recurring tasks without digging through advanced settings.
                    </p>
                    <div class="or3-scheduled-actions">
                        <UButton
                            color="primary"
                            variant="solid"
                            icon="i-pixelarticons-plus"
                            :disabled="!cronAvailable"
                            @click="startCreate"
                        >
                            New scheduled task
                        </UButton>
                        <UButton
                            color="neutral"
                            variant="soft"
                            icon="i-pixelarticons-reload"
                            :loading="cronLoading"
                            @click="refreshAll"
                        >
                            Refresh
                        </UButton>
                    </div>
                </div>
                <div class="or3-scheduled-hero__status">
                    <StatusPill
                        :label="cronAvailable ? 'scheduler online' : 'scheduler off'"
                        :tone="cronAvailable ? 'green' : 'amber'"
                        :pulse="cronAvailable"
                    />
                    <p class="mt-3 font-mono text-xs text-(--or3-text-muted)">
                        {{ statusLine }}
                    </p>
                </div>
            </SurfaceCard>

            <div class="grid gap-3 sm:grid-cols-4">
                <SurfaceCard v-for="metric in metrics" :key="metric.label" class-name="or3-metric-card">
                    <p class="or3-command text-[10px] uppercase tracking-[0.18em] text-(--or3-green-dark)">{{ metric.label }}</p>
                    <p class="mt-2 font-mono text-2xl font-semibold text-(--or3-text)">{{ metric.value }}</p>
                    <p class="mt-1 text-xs text-(--or3-text-muted)">{{ metric.detail }}</p>
                </SurfaceCard>
            </div>

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

            <SurfaceCard v-if="formOpen" class-name="space-y-4" padded>
                <div class="flex items-start justify-between gap-3">
                    <div>
                        <p class="or3-command text-[11px] uppercase tracking-[0.2em] text-(--or3-green-dark)">
                            {{ editingId ? 'Edit scheduled task' : 'Create scheduled task' }}
                        </p>
                        <h2 class="mt-1 font-mono text-lg font-semibold text-(--or3-text)">{{ formTitle }}</h2>
                    </div>
                    <UButton color="neutral" variant="ghost" icon="i-pixelarticons-close" aria-label="Close form" @click="cancelForm" />
                </div>

                <div class="grid gap-3 sm:grid-cols-2">
                    <label class="or3-field sm:col-span-2">
                        <span>Task name</span>
                        <input v-model="form.name" class="or3-input" placeholder="Morning repo summary" />
                    </label>

                    <label class="or3-field sm:col-span-2">
                        <span>{{ form.target === 'agent_cli' ? 'What should the external agent do?' : 'What should OR3 do?' }}</span>
                        <textarea
                            v-model="form.message"
                            class="or3-textarea"
                            rows="5"
                            placeholder="Check the repo for overnight changes, summarize open risks, and send me the top 3 actions."
                        />
                    </label>

                    <label class="or3-field">
                        <span>Target</span>
                        <select v-model="form.target" class="or3-input">
                            <option value="or3">OR3 turn</option>
                            <option value="agent_cli">External agent</option>
                        </select>
                    </label>

                    <label v-if="form.target === 'agent_cli'" class="or3-field">
                        <span>Runner</span>
                        <select v-model="form.runnerId" class="or3-input">
                            <option value="" disabled>Select runner</option>
                            <option v-for="runner in externalRunnerOptions" :key="runner.id" :value="runner.id">
                                {{ runner.display_name || runner.id }}
                            </option>
                        </select>
                    </label>

                    <label class="or3-field">
                        <span>Schedule</span>
                        <select v-model="form.preset" class="or3-input">
                            <option value="hourly">Every hour</option>
                            <option value="daily">Every day at 9 AM</option>
                            <option value="weekdays">Weekdays at 9 AM</option>
                            <option value="weekly">Mondays at 9 AM</option>
                            <option value="interval">Custom interval</option>
                            <option value="once">One time</option>
                            <option value="custom">Advanced cron expression</option>
                        </select>
                    </label>

                    <label v-if="form.preset === 'interval'" class="or3-field">
                        <span>Run every</span>
                        <div class="grid grid-cols-[1fr_1.2fr] gap-2">
                            <input v-model.number="form.intervalValue" class="or3-input" min="1" type="number" />
                            <select v-model="form.intervalUnit" class="or3-input">
                                <option value="minutes">minutes</option>
                                <option value="hours">hours</option>
                                <option value="days">days</option>
                            </select>
                        </div>
                    </label>

                    <label v-else-if="form.preset === 'once'" class="or3-field">
                        <span>Run at</span>
                        <input v-model="form.atLocal" class="or3-input" type="datetime-local" />
                    </label>

                    <label v-else-if="form.preset === 'custom'" class="or3-field">
                        <span>Cron expression</span>
                        <input v-model="form.cronExpr" class="or3-input font-mono" placeholder="0 9 * * 1-5" />
                    </label>

                    <div v-else class="or3-preview-box">
                        <span>Preview</span>
                        <p>{{ schedulePreview }}</p>
                    </div>

                    <label class="or3-field">
                        <span>Session key</span>
                        <input v-model="form.sessionKey" class="or3-input font-mono" placeholder="cron:default" />
                    </label>

                    <label v-if="form.target === 'or3'" class="or3-field">
                        <span>Delivery channel</span>
                        <input v-model="form.channel" class="or3-input" placeholder="optional, e.g. cli" />
                    </label>

                    <label v-if="form.target === 'or3'" class="or3-field sm:col-span-2">
                        <span>Send to</span>
                        <input v-model="form.to" class="or3-input" placeholder="optional destination/user/channel id" />
                    </label>

                    <template v-if="form.target === 'agent_cli'">
                        <label class="or3-field">
                            <span>Mode</span>
                            <select v-model="form.mode" class="or3-input">
                                <option value="review">Review only</option>
                                <option value="safe_edit">Safe edit</option>
                                <option value="sandbox_auto">Sandbox auto</option>
                            </select>
                        </label>

                        <label class="or3-field">
                            <span>Isolation</span>
                            <select v-model="form.isolation" class="or3-input">
                                <option value="host_readonly">Host read-only</option>
                                <option value="host_workspace_write">Host workspace write</option>
                                <option value="sandbox_workspace_write">Sandbox workspace write</option>
                                <option value="sandbox_dangerous">Sandbox dangerous</option>
                            </select>
                        </label>

                        <label class="or3-field">
                            <span>Working directory</span>
                            <button
                                type="button"
                                class="or3-cwd-trigger"
                                @click="showCwdSlideover = true"
                            >
                                <span class="truncate">{{ cwdDisplayLabel }}</span>
                                <Icon
                                    name="i-pixelarticons-folder"
                                    class="size-4 shrink-0 text-(--or3-text-muted)"
                                />
                            </button>
                        </label>

                        <label class="or3-field">
                            <span>Model</span>
                            <input v-model="form.model" class="or3-input" placeholder="runner default" />
                        </label>

                        <label class="or3-field">
                            <span>Timeout seconds</span>
                            <input v-model.number="form.timeoutSeconds" class="or3-input" min="1" type="number" placeholder="900" />
                        </label>

                        <label class="or3-field">
                            <span>Max turns</span>
                            <input v-model.number="form.maxTurns" class="or3-input" min="1" type="number" placeholder="optional" />
                        </label>
                    </template>
                </div>

                <div class="grid gap-2 sm:grid-cols-2">
                    <label class="or3-toggle-row">
                        <input v-model="form.enabled" type="checkbox" />
                        <span>
                            <strong>Enable immediately</strong>
                            <small>The scheduler may run this task automatically.</small>
                        </span>
                    </label>
                    <label class="or3-toggle-row">
                        <input v-model="form.deleteAfterRun" type="checkbox" />
                        <span>
                            <strong>Delete after first run</strong>
                            <small>Best for reminders and one-time tasks.</small>
                        </span>
                    </label>
                </div>

                <div v-if="formError" class="or3-error-box">
                    <Icon name="i-pixelarticons-alert" class="size-4" />
                    <span>{{ formError }}</span>
                </div>

                <div class="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-(--or3-border) bg-white/70 p-3">
                    <p class="text-xs leading-5 text-(--or3-text-muted)">
                        Review carefully: scheduled tasks can spend tokens and act while you are away.
                    </p>
                    <div class="flex gap-2">
                        <UButton color="neutral" variant="soft" @click="cancelForm">Cancel</UButton>
                        <UButton color="primary" variant="solid" :loading="cronSaving" icon="i-pixelarticons-check" @click="saveForm">
                            {{ editingId ? 'Save changes' : 'Create task' }}
                        </UButton>
                    </div>
                </div>
            </SurfaceCard>

            <section>
                <SectionHeader title="Scheduled tasks">
                    <template #action>
                        <span v-if="cronLoading" class="flex items-center gap-1 font-mono text-[11px] text-(--or3-text-muted)">
                            <Icon name="i-pixelarticons-loader" class="size-3 animate-spin" />
                            Loading
                        </span>
                        <span v-else class="font-mono text-[11px] text-(--or3-text-muted)">{{ cronJobs.length }} total</span>
                    </template>
                </SectionHeader>

                <div v-if="cronError" class="or3-error-box mb-3">
                    <Icon name="i-pixelarticons-alert" class="size-4" />
                    <span>{{ cronError.message || 'Unable to load scheduled tasks.' }}</span>
                </div>

                <div v-if="cronJobs.length" class="space-y-3">
                    <SurfaceCard
                        v-for="job in cronJobs"
                        :key="job.id"
                        class-name="or3-job-card"
                    >
                        <div class="or3-job-card__main">
                            <div class="or3-job-card__icon" :class="job.enabled ? 'or3-job-card__icon--active' : ''">
                                <Icon :name="job.enabled ? 'i-pixelarticons-clock' : 'i-pixelarticons-pause'" class="size-5" />
                            </div>
                            <div class="min-w-0 flex-1">
                                <div class="flex flex-wrap items-center gap-2">
                                    <p class="truncate font-mono text-sm font-semibold text-(--or3-text)">{{ job.name || job.id }}</p>
                                    <StatusPill :label="statusLabel(job)" :tone="statusTone(job)" />
                                </div>
                                <p class="mt-1 line-clamp-2 text-xs leading-5 text-(--or3-text-muted)">{{ jobPrompt(job) }}</p>
                                <div class="mt-3 grid gap-2 text-xs sm:grid-cols-3">
                                    <span class="or3-job-meta"><strong>Next</strong>{{ formatDate(job.state?.next_run_at_ms) }}</span>
                                    <span class="or3-job-meta"><strong>Last</strong>{{ formatLastRun(job) }}</span>
                                    <span class="or3-job-meta"><strong>Schedule</strong>{{ describeSchedule(job) }}</span>
                                </div>
                                <div v-if="job.payload?.kind === 'agent_cli_run'" class="mt-2 grid gap-2 text-xs sm:grid-cols-3">
                                    <span class="or3-job-meta"><strong>Runner</strong>{{ agentRunnerLabel(job.payload?.agent_run?.runner_id) }}</span>
                                    <span class="or3-job-meta"><strong>Mode</strong>{{ job.payload?.agent_run?.mode || 'review' }}</span>
                                    <span class="or3-job-meta"><strong>Last run</strong>{{ job.state?.last_enqueued_run_id || 'Not enqueued' }}</span>
                                </div>
                                <p v-if="job.state?.last_error" class="mt-2 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-800">
                                    {{ job.state.last_error }}
                                </p>
                            </div>
                        </div>
                        <div class="or3-job-actions">
                            <UButton size="xs" color="neutral" variant="soft" icon="i-pixelarticons-play" :loading="actionId === `${job.id}:run`" @click="run(job)">Run now</UButton>
                            <UButton
                                size="xs"
                                :color="job.enabled ? 'warning' : 'success'"
                                variant="soft"
                                :icon="job.enabled ? 'i-pixelarticons-pause' : 'i-pixelarticons-play'"
                                :loading="actionId === `${job.id}:toggle`"
                                @click="toggle(job)"
                            >
                                {{ job.enabled ? 'Pause' : 'Resume' }}
                            </UButton>
                            <UButton size="xs" color="neutral" variant="ghost" icon="i-pixelarticons-edit" @click="startEdit(job)">Edit</UButton>
                            <UButton size="xs" color="error" variant="ghost" icon="i-pixelarticons-trash" :loading="actionId === `${job.id}:delete`" @click="remove(job)">Delete</UButton>
                        </div>
                    </SurfaceCard>
                </div>

                <EmptyState
                    v-else-if="cronAvailable && !cronLoading"
                    icon="i-pixelarticons-clock"
                    title="No scheduled tasks yet"
                    description="Create your first recurring task for check-ins, reminders, summaries, and follow-up work."
                />
            </section>
        </div>
        <CwdPickerSheet
            v-model:open="showCwdSlideover"
            :initial-path="form.cwd"
            @select="onCwdSelected"
        />
    </AppShell>
</template>

<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue';
import type { AgentRunnerInfo, CronJob, CronSchedule } from '~/types/or3-api';
import type { Or3AppError } from '~/types/app-state';
import CwdPickerSheet from '~/components/agents/CwdPickerSheet.vue';

const toast = useToast();
const {
    cronJobs,
    cronStatus,
    cronLoading,
    cronSaving,
    cronError,
    activeJobs,
    pausedJobs,
    erroredJobs,
    nextJob,
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
const editingId = ref<string | null>(null);
const formError = ref<string | null>(null);
const actionId = ref<string | null>(null);
const showCwdSlideover = ref(false);

const form = reactive({
    name: '',
    message: '',
    target: 'or3' as 'or3' | 'agent_cli',
    runnerId: '',
    mode: 'review' as 'review' | 'safe_edit' | 'sandbox_auto',
    isolation: 'host_readonly' as 'host_readonly' | 'host_workspace_write' | 'sandbox_workspace_write' | 'sandbox_dangerous',
    cwd: '',
    model: '',
    timeoutSeconds: undefined as number | undefined,
    maxTurns: undefined as number | undefined,
    preset: 'daily' as 'hourly' | 'daily' | 'weekdays' | 'weekly' | 'interval' | 'once' | 'custom',
    intervalValue: 1,
    intervalUnit: 'hours' as 'minutes' | 'hours' | 'days',
    atLocal: defaultAtLocal(),
    cronExpr: '0 9 * * *',
    sessionKey: 'cron:default',
    channel: '',
    to: '',
    enabled: true,
    deleteAfterRun: false,
});

const cronAvailable = computed(() => cronStatus.value?.available !== false && cronStatus.value?.enabled !== false);
const formTitle = computed(() => editingId.value ? 'Update when and how this task runs.' : 'Describe the work, pick a schedule, and enable it when ready.');
const schedulePreview = computed(() => describeScheduleFromPreset());
const externalRunnerOptions = computed(() => {
    const runners = (agentRunners.value ?? []).filter((runner) => runner.id !== 'or3-intern');
    const available = runners.filter((runner) => runner.status === 'available');
    return available.length ? available : runners;
});
const cwdDisplayLabel = computed(() => {
    const path = form.cwd.trim();
    if (!path) return 'Default working directory';
    if (path.length > 44) return `...${path.slice(-41)}`;
    return path;
});

const statusLine = computed(() => {
    if (!cronStatus.value) return 'Checking scheduler status…';
    if (!cronAvailable.value) return 'Cron is disabled or the running service does not expose cron management yet.';
    const next = nextJob.value?.state?.next_run_at_ms ?? cronStatus.value.next_wake_at_ms;
    return next ? `Next run ${formatDate(next)}` : 'No upcoming runs scheduled.';
});

const metrics = computed(() => [
    { label: 'Active', value: activeJobs.value.length, detail: 'Enabled tasks waiting to run.' },
    { label: 'Paused', value: pausedJobs.value.length, detail: 'Saved but not currently armed.' },
    { label: 'Errors', value: erroredJobs.value.length, detail: 'Last run reported a failure.' },
    { label: 'Next', value: nextJob.value ? formatShortDate(nextJob.value.state?.next_run_at_ms) : '—', detail: nextJob.value?.name || 'Nothing queued.' },
]);

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
    resetForm();
    formOpen.value = true;
}

function startEdit(job: CronJob) {
    resetForm();
    editingId.value = job.id;
    form.target = job.payload?.kind === 'agent_cli_run' ? 'agent_cli' : 'or3';
    form.name = job.name || '';
    form.message = job.payload?.kind === 'agent_cli_run' ? job.payload?.agent_run?.task || '' : job.payload?.message || '';
    form.sessionKey = job.payload?.session_key || 'cron:default';
    form.channel = job.payload?.channel || '';
    form.to = job.payload?.to || '';
    form.runnerId = job.payload?.agent_run?.runner_id || defaultRunnerId();
    form.mode = (job.payload?.agent_run?.mode as typeof form.mode) || 'review';
    form.isolation = (job.payload?.agent_run?.isolation as typeof form.isolation) || 'host_readonly';
    form.cwd = job.payload?.agent_run?.cwd || '';
    form.model = job.payload?.agent_run?.model || '';
    form.timeoutSeconds = job.payload?.agent_run?.timeout_seconds || undefined;
    form.maxTurns = job.payload?.agent_run?.max_turns || undefined;
    form.enabled = job.enabled;
    form.deleteAfterRun = Boolean(job.delete_after_run);
    applyScheduleToForm(job.schedule);
    formOpen.value = true;
}

function cancelForm() {
    resetForm();
    formOpen.value = false;
}

function resetForm() {
    editingId.value = null;
    formError.value = null;
    form.name = '';
    form.message = '';
    form.target = 'or3';
    form.runnerId = defaultRunnerId();
    form.mode = 'review';
    form.isolation = 'host_readonly';
    form.cwd = '';
    form.model = '';
    form.timeoutSeconds = undefined;
    form.maxTurns = undefined;
    form.preset = 'daily';
    form.intervalValue = 1;
    form.intervalUnit = 'hours';
    form.atLocal = defaultAtLocal();
    form.cronExpr = '0 9 * * *';
    form.sessionKey = 'cron:default';
    form.channel = '';
    form.to = '';
    form.enabled = true;
    form.deleteAfterRun = false;
}

async function saveForm() {
    formError.value = null;
    const validation = validateForm();
    if (validation) {
        formError.value = validation;
        return;
    }
    const job = buildJobPayload();
    try {
        if (editingId.value) {
            await updateJob(editingId.value, job);
            toast.add({ title: 'Scheduled task updated', color: 'success', icon: 'i-pixelarticons-check' });
        } else {
            await createJob(job);
            toast.add({ title: 'Scheduled task created', color: 'success', icon: 'i-pixelarticons-check' });
        }
        cancelForm();
    } catch (error) {
        formError.value = describeError(error, 'Unable to save scheduled task.');
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
    if (!confirm(`Delete scheduled task “${job.name || job.id}”?`)) return;
    actionId.value = `${job.id}:delete`;
    try {
        await deleteJob(job.id);
        toast.add({ title: 'Scheduled task deleted', color: 'success', icon: 'i-pixelarticons-trash' });
    } catch (error) {
        toast.add({ title: 'Delete failed', description: describeError(error, 'Unable to delete task.'), color: 'error' });
    } finally {
        actionId.value = null;
    }
}

function validateForm() {
    if (!form.name.trim()) return 'Give this scheduled task a name.';
    if (!form.message.trim()) return form.target === 'agent_cli' ? 'Describe what the external agent should do when the task runs.' : 'Describe what OR3 should do when the task runs.';
    if (form.target === 'agent_cli' && !form.runnerId.trim()) return 'Choose an external agent runner.';
    if (form.preset === 'interval' && (!Number.isFinite(form.intervalValue) || form.intervalValue <= 0)) return 'Choose an interval greater than zero.';
    if (form.preset === 'once' && Number.isNaN(Date.parse(form.atLocal))) return 'Choose a valid run date and time.';
    if (form.preset === 'custom' && !form.cronExpr.trim()) return 'Enter a cron expression.';
    return null;
}

function buildJobPayload(): Partial<CronJob> {
    const payload = form.target === 'agent_cli'
        ? {
            kind: 'agent_cli_run',
            session_key: form.sessionKey.trim() || undefined,
            agent_run: {
                runner_id: form.runnerId.trim(),
                task: form.message.trim(),
                mode: form.mode,
                isolation: form.isolation,
                cwd: form.cwd.trim() || undefined,
                model: form.model.trim() || undefined,
                timeout_seconds: positiveNumberOrUndefined(form.timeoutSeconds),
                max_turns: positiveNumberOrUndefined(form.maxTurns),
            },
        }
        : {
            kind: 'agent_turn',
            message: form.message.trim(),
            deliver: Boolean(form.channel.trim() || form.to.trim()),
            channel: form.channel.trim() || undefined,
            to: form.to.trim() || undefined,
            session_key: form.sessionKey.trim() || undefined,
        };
    return {
        name: form.name.trim(),
        enabled: form.enabled,
        schedule: buildSchedule(),
        payload,
        delete_after_run: form.deleteAfterRun,
    };
}

function buildSchedule(): CronSchedule {
    switch (form.preset) {
        case 'hourly':
            return { kind: 'every', every_ms: 60 * 60 * 1000 };
        case 'daily':
            return { kind: 'cron', expr: '0 9 * * *' };
        case 'weekdays':
            return { kind: 'cron', expr: '0 9 * * 1-5' };
        case 'weekly':
            return { kind: 'cron', expr: '0 9 * * 1' };
        case 'interval':
            return { kind: 'every', every_ms: intervalToMs(form.intervalValue, form.intervalUnit) };
        case 'once':
            return { kind: 'at', at_ms: Date.parse(form.atLocal) };
        case 'custom':
            return { kind: 'cron', expr: form.cronExpr.trim() };
    }
}

function applyScheduleToForm(schedule: CronSchedule) {
    if (schedule.kind === 'at') {
        form.preset = 'once';
        form.atLocal = toLocalInput(schedule.at_ms || Date.now());
        return;
    }
    if (schedule.kind === 'every') {
        form.preset = 'interval';
        const everyMs = schedule.every_ms || 60 * 60 * 1000;
        if (everyMs % (24 * 60 * 60 * 1000) === 0) {
            form.intervalUnit = 'days';
            form.intervalValue = everyMs / (24 * 60 * 60 * 1000);
        } else if (everyMs % (60 * 60 * 1000) === 0) {
            form.intervalUnit = 'hours';
            form.intervalValue = everyMs / (60 * 60 * 1000);
        } else {
            form.intervalUnit = 'minutes';
            form.intervalValue = Math.max(1, Math.round(everyMs / (60 * 1000)));
        }
        return;
    }
    const expression = schedule.expr || '';
    if (expression === '0 9 * * *') form.preset = 'daily';
    else if (expression === '0 9 * * 1-5') form.preset = 'weekdays';
    else if (expression === '0 9 * * 1') form.preset = 'weekly';
    else {
        form.preset = 'custom';
        form.cronExpr = expression;
    }
}

function describeSchedule(job: CronJob) {
    const schedule = job.schedule;
    if (schedule.kind === 'at') return `Once at ${formatDate(schedule.at_ms)}`;
    if (schedule.kind === 'every') return `Every ${formatDuration(schedule.every_ms || 0)}`;
    return schedule.expr || 'Cron expression';
}

function jobPrompt(job: CronJob) {
    if (job.payload?.kind === 'agent_cli_run') return job.payload?.agent_run?.task || 'No task set.';
    return job.payload?.message || 'No prompt set.';
}

function agentRunnerLabel(id?: string) {
    if (!id) return 'Unknown';
    const runner = (agentRunners.value ?? []).find((item: AgentRunnerInfo) => item.id === id);
    return runner?.display_name || id;
}

function defaultRunnerId() {
    return externalRunnerOptions.value[0]?.id?.toString() || '';
}

function positiveNumberOrUndefined(value?: number) {
    return Number.isFinite(value) && Number(value) > 0 ? Number(value) : undefined;
}

function onCwdSelected(path: string) {
    form.cwd = path;
}

function describeScheduleFromPreset() {
    switch (form.preset) {
        case 'hourly': return 'Runs every hour.';
        case 'daily': return 'Runs every day at 9 AM.';
        case 'weekdays': return 'Runs Monday through Friday at 9 AM.';
        case 'weekly': return 'Runs every Monday at 9 AM.';
        case 'interval': return `Runs every ${form.intervalValue} ${form.intervalUnit}.`;
        case 'once': return `Runs once at ${formatDate(Date.parse(form.atLocal))}.`;
        case 'custom': return form.cronExpr || 'Custom cron expression.';
    }
}

function statusLabel(job: CronJob) {
    if (!job.enabled) return 'paused';
    if (job.state?.last_status === 'error') return 'error';
    if (job.state?.next_run_at_ms) return 'scheduled';
    return 'enabled';
}

function statusTone(job: CronJob): 'green' | 'amber' | 'danger' | 'neutral' {
    if (job.state?.last_status === 'error') return 'danger';
    if (!job.enabled) return 'neutral';
    if (!job.state?.next_run_at_ms) return 'amber';
    return 'green';
}

function formatLastRun(job: CronJob) {
    if (!job.state?.last_run_at_ms) return 'Never';
    const suffix = job.state.last_status ? ` · ${job.state.last_status}` : '';
    return `${formatDate(job.state.last_run_at_ms)}${suffix}`;
}

function formatDate(value?: number | null) {
    if (!value) return 'Not scheduled';
    return new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value));
}

function formatShortDate(value?: number | null) {
    if (!value) return '—';
    return new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric', hour: 'numeric' }).format(new Date(value));
}

function formatDuration(ms: number) {
    if (ms % (24 * 60 * 60 * 1000) === 0) return `${ms / (24 * 60 * 60 * 1000)}d`;
    if (ms % (60 * 60 * 1000) === 0) return `${ms / (60 * 60 * 1000)}h`;
    if (ms % (60 * 1000) === 0) return `${ms / (60 * 1000)}m`;
    return `${Math.round(ms / 1000)}s`;
}

function intervalToMs(value: number, unit: 'minutes' | 'hours' | 'days') {
    const multiplier = unit === 'days' ? 24 * 60 * 60 * 1000 : unit === 'hours' ? 60 * 60 * 1000 : 60 * 1000;
    return Math.max(1, value) * multiplier;
}

function defaultAtLocal() {
    return toLocalInput(Date.now() + 60 * 60 * 1000);
}

function toLocalInput(value: number) {
    const date = new Date(value);
    date.setMinutes(date.getMinutes() - date.getTimezoneOffset());
    return date.toISOString().slice(0, 16);
}

function describeError(error: unknown, fallback: string) {
    const appError = error as Or3AppError | undefined;
    return appError?.message || fallback;
}
</script>

<style scoped>
.or3-scheduled-hero {
    display: flex;
    align-items: stretch;
    justify-content: space-between;
    gap: 1rem;
    overflow: hidden;
    background:
        radial-gradient(circle at 92% 12%, color-mix(in srgb, var(--or3-green-soft) 72%, transparent) 0%, transparent 34%),
        var(--or3-surface);
}

.or3-scheduled-hero__copy {
    min-width: 0;
    flex: 1 1 auto;
}

.or3-scheduled-hero__status {
    min-width: 10rem;
    border-radius: 1rem;
    border: 1px solid var(--or3-border);
    background: rgb(255 255 255 / 0.66);
    padding: 1rem;
}

.or3-scheduled-eyebrow {
    display: inline-flex;
    align-items: center;
    gap: 0.45rem;
    font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
    font-size: 0.72rem;
    font-weight: 700;
    letter-spacing: 0.14em;
    text-transform: uppercase;
    color: var(--or3-green-dark);
}

.or3-scheduled-title {
    margin-top: 0.7rem;
    max-width: 13ch;
    font-family: Georgia, 'Iowan Old Style', 'Times New Roman', serif;
    font-size: clamp(2rem, 8vw, 3rem);
    font-weight: 700;
    line-height: 0.98;
    letter-spacing: -0.04em;
    color: var(--or3-text);
}

.or3-scheduled-subtitle {
    margin-top: 0.75rem;
    max-width: 38rem;
    color: var(--or3-text-muted);
    line-height: 1.65;
}

.or3-scheduled-actions {
    margin-top: 1rem;
    display: flex;
    flex-wrap: wrap;
    gap: 0.65rem;
}

.or3-metric-card {
    min-height: 7rem;
}

.or3-field {
    display: grid;
    gap: 0.4rem;
    font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
    font-size: 0.74rem;
    font-weight: 700;
    color: var(--or3-text);
}

.or3-input,
.or3-textarea {
    width: 100%;
    border-radius: 1rem;
    border: 1px solid var(--or3-border);
    background: rgb(255 255 255 / 0.78);
    padding: 0.75rem 0.9rem;
    font-family: inherit;
    font-size: 0.9rem;
    font-weight: 500;
    color: var(--or3-text);
    outline: none;
}

.or3-textarea {
    resize: vertical;
    line-height: 1.55;
}

.or3-input:focus,
.or3-textarea:focus {
    border-color: var(--or3-green);
    box-shadow: 0 0 0 3px color-mix(in srgb, var(--or3-green-soft) 78%, transparent);
}

.or3-cwd-trigger {
    display: flex;
    width: 100%;
    min-height: 2.9rem;
    align-items: center;
    justify-content: space-between;
    gap: 0.65rem;
    border-radius: 1rem;
    border: 1px solid var(--or3-border);
    background: rgb(255 255 255 / 0.78);
    padding: 0.75rem 0.9rem;
    font-family: inherit;
    font-size: 0.9rem;
    font-weight: 500;
    color: var(--or3-text);
    text-align: left;
    outline: none;
    transition:
        border-color 140ms ease,
        background 140ms ease,
        box-shadow 140ms ease;
}

.or3-cwd-trigger:hover {
    background: var(--or3-surface-soft);
}

.or3-cwd-trigger:focus-visible {
    border-color: var(--or3-green);
    box-shadow: 0 0 0 3px color-mix(in srgb, var(--or3-green-soft) 78%, transparent);
}

.or3-preview-box {
    display: grid;
    align-content: center;
    gap: 0.35rem;
    border-radius: 1rem;
    border: 1px dashed var(--or3-border);
    background: rgb(255 255 255 / 0.62);
    padding: 0.75rem 0.9rem;
    font-size: 0.8rem;
    color: var(--or3-text-muted);
}

.or3-preview-box span {
    font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
    font-size: 0.68rem;
    font-weight: 700;
    letter-spacing: 0.12em;
    text-transform: uppercase;
    color: var(--or3-green-dark);
}

.or3-toggle-row {
    display: flex;
    align-items: flex-start;
    gap: 0.75rem;
    border-radius: 1rem;
    border: 1px solid var(--or3-border);
    background: rgb(255 255 255 / 0.72);
    padding: 0.85rem;
}

.or3-toggle-row strong,
.or3-toggle-row small {
    display: block;
}

.or3-toggle-row strong {
    font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
    font-size: 0.82rem;
    color: var(--or3-text);
}

.or3-toggle-row small {
    margin-top: 0.2rem;
    font-size: 0.74rem;
    line-height: 1.45;
    color: var(--or3-text-muted);
}

.or3-error-box {
    display: flex;
    align-items: flex-start;
    gap: 0.5rem;
    border-radius: 1rem;
    border: 1px solid rgb(254 202 202);
    background: rgb(254 242 242 / 0.9);
    padding: 0.75rem 0.9rem;
    font-size: 0.8rem;
    color: rgb(153 27 27);
}

.or3-job-card {
    display: grid;
    gap: 1rem;
}

.or3-job-card__main {
    display: flex;
    align-items: flex-start;
    gap: 0.85rem;
}

.or3-job-card__icon {
    display: grid;
    place-items: center;
    width: 2.6rem;
    height: 2.6rem;
    border-radius: 0.9rem;
    border: 1px solid var(--or3-border);
    background: white;
    color: var(--or3-text-muted);
}

.or3-job-card__icon--active {
    background: var(--or3-green-soft);
    color: var(--or3-green-dark);
}

.or3-job-meta {
    display: grid;
    gap: 0.2rem;
    min-width: 0;
    border-radius: 0.85rem;
    background: rgb(255 255 255 / 0.66);
    padding: 0.55rem 0.65rem;
    color: var(--or3-text-muted);
}

.or3-job-meta strong {
    font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
    font-size: 0.65rem;
    letter-spacing: 0.12em;
    text-transform: uppercase;
    color: var(--or3-text);
}

.or3-job-actions {
    display: flex;
    flex-wrap: wrap;
    justify-content: flex-end;
    gap: 0.5rem;
}

@media (max-width: 640px) {
    .or3-scheduled-hero {
        display: grid;
    }

    .or3-scheduled-hero__status {
        min-width: 0;
    }

    .or3-job-card__main {
        gap: 0.65rem;
    }

    .or3-job-actions {
        justify-content: stretch;
    }
}
</style>
