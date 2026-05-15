<template>
    <USlideover
        :open="open"
        :side="side"
        :ui="{ content: contentClass }"
        @update:open="emit('update:open', $event)"
    >
        <template #content>
            <div
                ref="sheetRef"
                class="or3-task-sheet"
                :class="side === 'bottom' ? 'is-bottom' : 'is-side'"
            >
                <!-- Drag handle on mobile -->
                <div
                    v-if="side === 'bottom'"
                    ref="handleRef"
                    class="or3-task-handle"
                    aria-label="Drag down to close"
                    role="button"
                    tabindex="0"
                >
                    <span />
                </div>

                <!-- Header -->
                <header class="or3-task-head">
                    <div class="or3-task-head__main">
                        <span class="or3-task-head__icon">
                            <Icon
                                name="i-pixelarticons-clock"
                                class="size-5"
                            />
                        </span>
                        <div class="or3-task-head__text">
                            <p class="or3-label or3-task-head__eyebrow">
                                {{ isEdit ? 'EDIT TASK' : 'NEW TASK' }}
                            </p>
                            <h2 class="or3-task-head__title">
                                {{ isEdit ? 'Update scheduled task' : 'Create scheduled task' }}
                            </h2>
                            <p class="or3-task-head__subtitle">
                                {{ isEdit ? 'Change when and how this task runs.' : 'Describe the work, pick a schedule, and enable it when ready.' }}
                            </p>
                        </div>
                    </div>
                    <UButton
                        color="neutral"
                        variant="ghost"
                        icon="i-pixelarticons-close"
                        size="sm"
                        square
                        aria-label="Close"
                        class="or3-task-head__close"
                        @click="emit('update:open', false)"
                    />
                </header>

                <!-- Body -->
                <div class="or3-task-body">
                    <div class="or3-task-form">
                        <label class="or3-task-field sm:col-span-2">
                            <span>Task name</span>
                            <input v-model="form.name" class="or3-task-input" placeholder="Morning repo summary" />
                        </label>

                        <label class="or3-task-field sm:col-span-2">
                            <span>{{ form.target === 'agent_cli' ? 'What should the external agent do?' : 'What should OR3 do?' }}</span>
                            <textarea
                                v-model="form.message"
                                class="or3-task-textarea"
                                rows="4"
                                placeholder="Check the repo for overnight changes, summarize open risks, and send me the top 3 actions."
                            />
                        </label>

                        <label class="or3-task-field">
                            <span>Target</span>
                            <USelectMenu
                                v-model="form.target"
                                :items="targetOptions"
                                value-key="value"
                                size="lg"
                                class="or3-task-select"
                            />
                        </label>

                        <label v-if="form.target === 'agent_cli'" class="or3-task-field">
                            <span>Runner</span>
                            <USelectMenu
                                v-model="form.runnerId"
                                :items="runnerSelectOptions"
                                value-key="value"
                                size="lg"
                                placeholder="Select runner"
                                class="or3-task-select"
                            />
                        </label>

                        <label class="or3-task-field">
                            <span>Schedule</span>
                            <USelectMenu
                                v-model="form.preset"
                                :items="scheduleOptions"
                                value-key="value"
                                size="lg"
                                class="or3-task-select"
                            />
                        </label>

                        <label v-if="form.preset === 'interval'" class="or3-task-field">
                            <span>Run every</span>
                            <div class="grid grid-cols-[1fr_1.2fr] gap-2">
                                <input v-model.number="form.intervalValue" class="or3-task-input" min="1" type="number" />
                                <USelectMenu
                                    v-model="form.intervalUnit"
                                    :items="intervalUnitOptions"
                                    value-key="value"
                                    size="lg"
                                    class="or3-task-select"
                                />
                            </div>
                        </label>

                        <label v-else-if="form.preset === 'once'" class="or3-task-field">
                            <span>Run at</span>
                            <input v-model="form.atLocal" class="or3-task-input" type="datetime-local" />
                        </label>

                        <label v-else-if="form.preset === 'custom'" class="or3-task-field">
                            <span>Cron expression</span>
                            <input v-model="form.cronExpr" class="or3-task-input font-mono" placeholder="0 9 * * 1-5" />
                        </label>

                        <div v-else class="or3-task-preview">
                            <span>Preview</span>
                            <p>{{ schedulePreview }}</p>
                        </div>

                        <label class="or3-task-field">
                            <span>Session key</span>
                            <input v-model="form.sessionKey" class="or3-task-input font-mono" placeholder="cron:default" />
                        </label>

                        <label v-if="form.target === 'or3'" class="or3-task-field">
                            <span>Delivery channel</span>
                            <input v-model="form.channel" class="or3-task-input" placeholder="optional, e.g. cli" />
                        </label>

                        <label v-if="form.target === 'or3'" class="or3-task-field sm:col-span-2">
                            <span>Send to</span>
                            <input v-model="form.to" class="or3-task-input" placeholder="optional destination/user/channel id" />
                        </label>

                        <template v-if="form.target === 'agent_cli'">
                            <label class="or3-task-field">
                                <span>Mode</span>
                                <USelectMenu
                                    v-model="form.mode"
                                    :items="modeOptions"
                                    value-key="value"
                                    size="lg"
                                    class="or3-task-select"
                                />
                            </label>

                            <label class="or3-task-field">
                                <span>Isolation</span>
                                <USelectMenu
                                    v-model="form.isolation"
                                    :items="isolationOptions"
                                    value-key="value"
                                    size="lg"
                                    class="or3-task-select"
                                />
                            </label>

                            <label class="or3-task-field">
                                <span>Working directory</span>
                                <button
                                    type="button"
                                    class="or3-task-cwd-trigger"
                                    @click="showCwdSlideover = true"
                                >
                                    <span class="truncate">{{ cwdDisplayLabel }}</span>
                                    <Icon
                                        name="i-pixelarticons-folder"
                                        class="size-4 shrink-0 text-(--or3-text-muted)"
                                    />
                                </button>
                            </label>

                            <label class="or3-task-field">
                                <span>Model</span>
                                <input v-model="form.model" class="or3-task-input" placeholder="runner default" />
                            </label>

                            <label class="or3-task-field">
                                <span>Timeout seconds</span>
                                <input v-model.number="form.timeoutSeconds" class="or3-task-input" min="1" type="number" placeholder="900" />
                            </label>

                            <label class="or3-task-field">
                                <span>Max turns</span>
                                <input v-model.number="form.maxTurns" class="or3-task-input" min="1" type="number" placeholder="optional" />
                            </label>
                        </template>
                    </div>

                    <div class="or3-task-toggles">
                        <label class="or3-task-toggle">
                            <USwitch v-model="form.enabled" color="primary" />
                            <span>
                                <strong>Enable immediately</strong>
                                <small>The scheduler may run this task automatically.</small>
                            </span>
                        </label>
                        <label class="or3-task-toggle">
                            <USwitch v-model="form.deleteAfterRun" color="primary" />
                            <span>
                                <strong>Delete after first run</strong>
                                <small>Best for reminders and one-time tasks.</small>
                            </span>
                        </label>
                    </div>

                    <div v-if="formError" class="or3-task-error">
                        <Icon name="i-pixelarticons-alert" class="size-4" />
                        <span>{{ formError }}</span>
                    </div>
                </div>

                <!-- Footer -->
                <footer class="or3-task-foot">
                    <p class="or3-task-foot__hint">
                        <Icon name="i-pixelarticons-shield" class="size-3.5" />
                        Review carefully&mdash;scheduled tasks can spend tokens and act while you are away.
                    </p>
                    <div class="or3-task-foot__actions">
                        <UButton color="neutral" variant="ghost" size="lg" @click="cancel">Cancel</UButton>
                        <UButton
                            color="primary"
                            variant="solid"
                            size="lg"
                            icon="i-pixelarticons-check"
                            class="or3-task-foot__cta"
                            @click="save"
                        >
                            {{ isEdit ? 'Save changes' : 'Create task' }}
                        </UButton>
                    </div>
                </footer>
            </div>
        </template>
    </USlideover>

    <CwdPickerSheet
        v-model:open="showCwdSlideover"
        :initial-path="form.cwd"
        @select="onCwdSelected"
    />
</template>

<script setup lang="ts">
import { computed, reactive, ref, watch } from 'vue';
import type { AgentRunnerInfo, CronJob, CronSchedule } from '~/types/or3-api';
import type { Or3AppError } from '~/types/app-state';
import CwdPickerSheet from '~/components/agents/CwdPickerSheet.vue';
import { useIsDesktop } from '~/composables/useViewport';
import { useSheetSwipeDismiss } from '~/composables/useSheetSwipeDismiss';

const props = defineProps<{
    open: boolean;
    editJob?: CronJob | null;
}>();

const emit = defineEmits<{
    'update:open': [value: boolean];
    save: [payload: Partial<CronJob>, isEdit: boolean];
}>();

const isDesktop = useIsDesktop();
const side = computed<'bottom' | 'right'>(() =>
    isDesktop.value ? 'right' : 'bottom',
);
const contentClass = computed(() =>
    side.value === 'bottom'
        ? 'or3-fb-sheet-shell or3-fb-sheet-shell--bottom h-[92dvh] rounded-t-3xl'
        : 'or3-fb-sheet-shell or3-fb-sheet-shell--side sm:max-w-xl',
);

const sheetRef = ref<HTMLElement | null>(null);
const handleRef = ref<HTMLElement | null>(null);
const swipeEnabled = computed(() => props.open && side.value === 'bottom');
useSheetSwipeDismiss({
    handle: handleRef,
    sheet: sheetRef,
    enabled: swipeEnabled,
    onDismiss: () => emit('update:open', false),
});

const { agentRunners, loadAgentRunners } = useJobs();

const formError = ref<string | null>(null);
const showCwdSlideover = ref(false);
const isEdit = computed(() => Boolean(props.editJob));

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

const schedulePreview = computed(() => describeScheduleFromPreset());

const targetOptions = [
    { label: 'OR3 turn', value: 'or3' },
    { label: 'External agent', value: 'agent_cli' },
];

const scheduleOptions = [
    { label: 'Every hour', value: 'hourly' },
    { label: 'Every day at 9 AM', value: 'daily' },
    { label: 'Weekdays at 9 AM', value: 'weekdays' },
    { label: 'Mondays at 9 AM', value: 'weekly' },
    { label: 'Custom interval', value: 'interval' },
    { label: 'One time', value: 'once' },
    { label: 'Advanced cron expression', value: 'custom' },
];

const intervalUnitOptions = [
    { label: 'minutes', value: 'minutes' },
    { label: 'hours', value: 'hours' },
    { label: 'days', value: 'days' },
];

const modeOptions = [
    { label: 'Review only', value: 'review' },
    { label: 'Safe edit', value: 'safe_edit' },
    { label: 'Sandbox auto', value: 'sandbox_auto' },
];

const isolationOptions = [
    { label: 'Host read-only', value: 'host_readonly' },
    { label: 'Host workspace write', value: 'host_workspace_write' },
    { label: 'Sandbox workspace write', value: 'sandbox_workspace_write' },
    { label: 'Sandbox dangerous', value: 'sandbox_dangerous' },
];

const runnerSelectOptions = computed(() =>
    externalRunnerOptions.value.map((runner) => ({
        label: runner.display_name || runner.id,
        value: runner.id,
    })),
);

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

function resetForm() {
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

function applyEditJob(job: CronJob) {
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
}

function defaultRunnerId() {
    return externalRunnerOptions.value[0]?.id?.toString() || '';
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
            kind: 'agent_cli_run' as const,
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
            kind: 'agent_turn' as const,
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

function save() {
    formError.value = null;
    const validation = validateForm();
    if (validation) {
        formError.value = validation;
        return;
    }
    const payload = buildJobPayload();
    emit('save', payload, isEdit.value);
}

function cancel() {
    emit('update:open', false);
}

function onCwdSelected(path: string) {
    form.cwd = path;
}

function positiveNumberOrUndefined(value?: number) {
    return Number.isFinite(value) && Number(value) > 0 ? Number(value) : undefined;
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

function formatDate(value?: number | null) {
    if (!value) return 'Not scheduled';
    return new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value));
}

watch(
    () => props.open,
    (isOpen) => {
        if (!isOpen) return;
        void loadAgentRunners().catch(() => undefined);
        if (props.editJob) {
            applyEditJob(props.editJob);
        } else {
            resetForm();
        }
    },
    { immediate: true },
);
</script>

<style scoped>
/* ── Sheet shell ────────────────────────────────────────────────── */
.or3-task-sheet {
    display: flex;
    flex-direction: column;
    height: 100%;
    min-height: 0;
}

/* ── Drag handle (mobile) ───────────────────────────────────────── */
.or3-task-handle {
    display: flex;
    align-items: center;
    justify-content: center;
    height: 1.6rem;
    padding: 0.55rem 0 0.4rem;
    cursor: grab;
    touch-action: none;
    user-select: none;
    flex-shrink: 0;
}
.or3-task-handle:active {
    cursor: grabbing;
}
.or3-task-handle span {
    display: block;
    width: 2.6rem;
    height: 5px;
    border-radius: 999px;
    background: color-mix(in srgb, var(--or3-text-muted) 45%, transparent);
    transition:
        background 140ms ease,
        width 140ms ease;
}
.or3-task-handle:hover span {
    background: color-mix(in srgb, var(--or3-text-muted) 65%, transparent);
    width: 3rem;
}

/* ── Header ─────────────────────────────────────────────────────── */
.or3-task-head {
    display: flex;
    align-items: flex-start;
    gap: 0.85rem;
    padding: 0.5rem 1.35rem 1rem;
    border-bottom: 1px solid var(--or3-border);
    background: var(--or3-surface);
    flex-shrink: 0;
}
.or3-task-head__main {
    display: flex;
    align-items: flex-start;
    gap: 0.85rem;
    min-width: 0;
    flex: 1 1 auto;
}
.or3-task-head__icon {
    display: grid;
    place-items: center;
    width: 2.85rem;
    height: 2.85rem;
    flex-shrink: 0;
    border-radius: 1rem;
    background: var(--or3-green-soft);
    color: var(--or3-green-dark);
    border: 1px solid color-mix(in srgb, var(--or3-green) 22%, transparent);
    box-shadow: inset 0 0 0 1px rgb(255 255 255 / 0.6);
}
.or3-task-head__text {
    min-width: 0;
    flex: 1 1 auto;
}
.or3-task-head__eyebrow {
    font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
    font-size: 10px;
    font-weight: 700;
    letter-spacing: 0.2em;
    text-transform: uppercase;
    color: var(--or3-green-dark);
}
.or3-task-head__title {
    margin-top: 0.25rem;
    font-family: Georgia, 'Iowan Old Style', 'Times New Roman', serif;
    font-size: 1.35rem;
    font-weight: 700;
    letter-spacing: -0.02em;
    color: var(--or3-text);
    line-height: 1.15;
}
.or3-task-head__subtitle {
    margin-top: 0.35rem;
    font-size: 0.82rem;
    line-height: 1.5;
    color: var(--or3-text-muted);
    max-width: 44ch;
}
.or3-task-head__close {
    flex-shrink: 0;
}

/* ── Body (scrollable) ──────────────────────────────────────────── */
.or3-task-body {
    flex: 1 1 auto;
    min-height: 0;
    overflow-y: auto;
    padding: 1.1rem 1.35rem 0.5rem;
    display: flex;
    flex-direction: column;
    gap: 1rem;
}

/* ── Form grid ──────────────────────────────────────────────────── */
.or3-task-form {
    display: grid;
    gap: 0.85rem;
}
@media (min-width: 640px) {
    .or3-task-form {
        grid-template-columns: repeat(2, minmax(0, 1fr));
        gap: 0.85rem 1rem;
    }
    .or3-task-field.sm\:col-span-2 {
        grid-column: span 2 / span 2;
    }
}

.or3-task-field {
    display: grid;
    gap: 0.45rem;
    font-size: 0.8rem;
    font-weight: 600;
    color: var(--or3-text);
    letter-spacing: -0.005em;
}

.or3-task-input,
.or3-task-textarea {
    width: 100%;
    border-radius: var(--or3-radius-control);
    border: 1px solid var(--or3-border);
    background: rgb(255 255 255 / 0.85);
    padding: 0.7rem 0.85rem;
    font-family: inherit;
    font-size: 0.92rem;
    font-weight: 500;
    color: var(--or3-text);
    outline: none;
    transition: border-color 140ms ease, box-shadow 140ms ease, background 140ms ease;
    appearance: none;
}

.or3-task-input::placeholder,
.or3-task-textarea::placeholder {
    color: color-mix(in srgb, var(--or3-text-muted) 75%, transparent);
}

.or3-task-textarea {
    resize: vertical;
    line-height: 1.55;
    min-height: 5.5rem;
}

.or3-task-input:hover,
.or3-task-textarea:hover {
    border-color: color-mix(in srgb, var(--or3-green) 25%, var(--or3-border) 75%);
}

.or3-task-input:focus,
.or3-task-textarea:focus {
    border-color: var(--or3-green);
    background: white;
    box-shadow: 0 0 0 3px color-mix(in srgb, var(--or3-green-soft) 80%, transparent);
}

select.or3-task-input {
    cursor: pointer;
    background-image:
        linear-gradient(45deg, transparent 50%, var(--or3-text-muted) 50%),
        linear-gradient(135deg, var(--or3-text-muted) 50%, transparent 50%);
    background-position: calc(100% - 1.05rem) 1.05rem, calc(100% - 0.7rem) 1.05rem;
    background-size: 5px 5px, 5px 5px;
    background-repeat: no-repeat;
    padding-right: 2rem;
}

/* USelectMenu trigger -- match input styling exactly */
.or3-task-select {
    width: 100%;
}
.or3-task-select :deep(button) {
    width: 100%;
    border-radius: var(--or3-radius-control);
    border: 1px solid var(--or3-border);
    background: rgb(255 255 255 / 0.85);
    padding: 0.7rem 0.85rem;
    min-height: 2.85rem;
    font-size: 0.92rem;
    font-weight: 500;
    color: var(--or3-text);
    transition: border-color 140ms ease, box-shadow 140ms ease, background 140ms ease;
}
.or3-task-select :deep(button:hover) {
    border-color: color-mix(in srgb, var(--or3-green) 25%, var(--or3-border) 75%);
}
.or3-task-select :deep(button:focus-visible),
.or3-task-select :deep(button[data-state='open']) {
    border-color: var(--or3-green);
    background: white;
    box-shadow: 0 0 0 3px color-mix(in srgb, var(--or3-green-soft) 80%, transparent);
    outline: none;
}

.or3-task-cwd-trigger {
    display: flex;
    width: 100%;
    min-height: 2.85rem;
    align-items: center;
    justify-content: space-between;
    gap: 0.65rem;
    border-radius: var(--or3-radius-control);
    border: 1px solid var(--or3-border);
    background: rgb(255 255 255 / 0.85);
    padding: 0.7rem 0.85rem;
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
.or3-task-cwd-trigger:hover {
    background: var(--or3-surface-soft);
    border-color: color-mix(in srgb, var(--or3-green) 25%, var(--or3-border) 75%);
}
.or3-task-cwd-trigger:focus-visible {
    border-color: var(--or3-green);
    box-shadow: 0 0 0 3px color-mix(in srgb, var(--or3-green-soft) 80%, transparent);
}

.or3-task-preview {
    display: grid;
    align-content: center;
    gap: 0.4rem;
    border-radius: var(--or3-radius-control);
    border: 1px dashed color-mix(in srgb, var(--or3-green) 30%, var(--or3-border) 70%);
    background:
        radial-gradient(circle at 0% 0%, color-mix(in srgb, var(--or3-green-soft) 55%, transparent) 0%, transparent 60%),
        rgb(255 255 255 / 0.7);
    padding: 0.85rem 0.95rem;
    font-size: 0.88rem;
    font-weight: 500;
    color: var(--or3-text);
}
.or3-task-preview span {
    font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
    font-size: 0.66rem;
    font-weight: 700;
    letter-spacing: 0.16em;
    text-transform: uppercase;
    color: var(--or3-green-dark);
}

/* ── Toggles ────────────────────────────────────────────────────── */
.or3-task-toggles {
    display: grid;
    gap: 0.55rem;
}
.or3-task-toggle {
    display: flex;
    align-items: center;
    gap: 0.85rem;
    border-radius: var(--or3-radius-control);
    border: 1px solid var(--or3-border);
    background: rgb(255 255 255 / 0.78);
    padding: 0.85rem 0.95rem;
    cursor: pointer;
    transition: border-color 140ms ease, background 140ms ease;
}
.or3-task-toggle:hover {
    border-color: color-mix(in srgb, var(--or3-green) 25%, var(--or3-border) 75%);
    background: rgb(255 255 255 / 0.95);
}
.or3-task-toggle > span {
    flex: 1 1 auto;
    min-width: 0;
}
.or3-task-toggle strong,
.or3-task-toggle small {
    display: block;
}
.or3-task-toggle strong {
    font-size: 0.88rem;
    font-weight: 600;
    color: var(--or3-text);
}
.or3-task-toggle small {
    margin-top: 0.2rem;
    font-size: 0.76rem;
    line-height: 1.45;
    color: var(--or3-text-muted);
}

/* ── Error ──────────────────────────────────────────────────────── */
.or3-task-error {
    display: flex;
    align-items: flex-start;
    gap: 0.5rem;
    border-radius: var(--or3-radius-control);
    border: 1px solid rgb(254 202 202);
    background: rgb(254 242 242 / 0.9);
    padding: 0.75rem 0.9rem;
    font-size: 0.82rem;
    color: rgb(153 27 27);
}

/* ── Footer ─────────────────────────────────────────────────────── */
.or3-task-foot {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 0.75rem;
    flex-wrap: wrap;
    padding: 0.85rem 1.35rem calc(env(safe-area-inset-bottom, 0px) + 1rem);
    border-top: 1px solid var(--or3-border);
    background:
        linear-gradient(180deg, color-mix(in srgb, var(--or3-surface) 88%, white 12%) 0%, var(--or3-surface) 100%);
    flex-shrink: 0;
}
.or3-task-foot__hint {
    display: inline-flex;
    align-items: center;
    gap: 0.4rem;
    font-size: 0.74rem;
    line-height: 1.5;
    color: var(--or3-text-muted);
    flex: 1 1 16ch;
    min-width: 12ch;
}
.or3-task-foot__actions {
    display: flex;
    gap: 0.5rem;
    justify-content: flex-end;
    flex-shrink: 0;
}
.or3-task-foot__cta {
    box-shadow: 0 6px 18px color-mix(in srgb, var(--or3-green) 30%, transparent);
}
</style>
