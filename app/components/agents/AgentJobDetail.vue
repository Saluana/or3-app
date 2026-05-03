<template>
    <USlideover
        :open="open"
        side="right"
        :ui="{ content: 'bg-(--or3-surface) sm:max-w-lg' }"
        @update:open="onUpdateOpen"
    >
        <template #content>
            <div v-if="job" class="flex h-full flex-col">
                <!-- Header -->
                <div
                    class="border-b border-(--or3-border) bg-(--or3-surface) px-5 pb-5 pt-5"
                >
                    <div class="flex items-start gap-3">
                        <span
                            class="grid size-11 shrink-0 place-items-center rounded-2xl"
                            :class="iconBg"
                        >
                            <Icon :name="iconName" class="size-5" />
                        </span>
                        <div class="min-w-0 flex-1">
                            <p
                                class="or3-label text-[11px] font-semibold tracking-[0.18em] text-(--or3-text-muted)"
                            >
                                AGENT TASK
                            </p>
                            <h2
                                class="mt-1 wrap-break-word font-mono text-base font-semibold leading-snug text-(--or3-text)"
                            >
                                {{ title }}
                            </h2>
                        </div>
                        <button
                            type="button"
                            class="or3-focus-ring grid size-9 shrink-0 place-items-center rounded-full text-(--or3-text-muted) hover:bg-(--or3-surface-soft) hover:text-(--or3-text)"
                            aria-label="Close details"
                            @click="$emit('update:open', false)"
                        >
                            <Icon name="i-pixelarticons-close" class="size-4" />
                        </button>
                    </div>

                    <div class="mt-4 flex flex-wrap items-center gap-2">
                        <span
                            :class="[
                                'inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 font-mono text-[11px] font-semibold uppercase tracking-wider',
                                statusChipClass,
                            ]"
                        >
                            <span
                                :class="[
                                    'size-1.5 rounded-full',
                                    statusDotClass,
                                    isLive ? 'or3-live-dot' : '',
                                ]"
                            />
                            {{ statusLabel }}
                        </span>
                        <span
                            v-if="categoryLabel"
                            class="inline-flex items-center gap-1 rounded-full border border-(--or3-border) bg-(--or3-surface-soft) px-2.5 py-1 text-[11px] font-medium text-(--or3-text-muted)"
                        >
                            <Icon :name="iconName" class="size-3" />
                            {{ categoryLabel }}
                        </span>
                        <span
                            v-if="job.priority && job.priority !== 'balanced'"
                            class="inline-flex items-center gap-1 rounded-full border border-(--or3-border) bg-(--or3-surface-soft) px-2.5 py-1 text-[11px] font-medium text-(--or3-text-muted)"
                        >
                            <Icon name="i-pixelarticons-flag" class="size-3" />
                            {{ capitalize(job.priority) }} priority
                        </span>
                        <span
                            v-if="job.notify && job.notify !== 'complete'"
                            class="inline-flex items-center gap-1 rounded-full border border-(--or3-border) bg-(--or3-surface-soft) px-2.5 py-1 text-[11px] font-medium text-(--or3-text-muted)"
                        >
                            <Icon name="i-pixelarticons-bell" class="size-3" />
                            {{ notifyLabel }}
                        </span>
                    </div>
                </div>

                <!-- Body -->
                <div class="flex-1 overflow-y-auto px-5 py-5">
                    <div class="space-y-6">
                        <!-- Quick stats grid -->
                        <section
                            class="grid grid-cols-2 gap-2 sm:grid-cols-4"
                            aria-label="Task summary"
                        >
                            <div
                                v-for="stat in quickStats"
                                :key="stat.id"
                                class="rounded-2xl border border-(--or3-border) bg-(--or3-surface-soft) px-3 py-2.5"
                            >
                                <p
                                    class="flex items-center gap-1 font-mono text-[10px] font-semibold uppercase tracking-wider text-(--or3-text-muted)"
                                >
                                    <Icon :name="stat.icon" class="size-3" />
                                    {{ stat.label }}
                                </p>
                                <p
                                    class="mt-1 font-mono text-sm font-semibold text-(--or3-text)"
                                >
                                    {{ stat.value }}
                                </p>
                            </div>
                        </section>

                        <!-- Original task text (only show if different from title) -->
                        <section v-if="taskText && taskText !== title">
                            <p
                                class="or3-label text-[11px] font-semibold tracking-[0.18em] text-(--or3-text-muted)"
                            >
                                TASK
                            </p>
                            <p
                                class="mt-2 wrap-break-word rounded-2xl border border-(--or3-border) bg-(--or3-surface-soft) px-3 py-2.5 font-mono text-[12px] leading-5 text-(--or3-text)"
                            >
                                {{ taskText }}
                            </p>
                        </section>

                        <!-- Timeline (vertical with connector) -->
                        <section v-if="timeline.length">
                            <p
                                class="or3-label text-[11px] font-semibold tracking-[0.18em] text-(--or3-text-muted)"
                            >
                                TIMELINE
                            </p>
                            <ol
                                class="relative mt-3 ml-2.5 space-y-4 border-l border-dashed border-(--or3-border) pl-5"
                            >
                                <li
                                    v-for="entry in timeline"
                                    :key="entry.id"
                                    class="relative"
                                >
                                    <span
                                        class="absolute -left-[26px] grid size-5 place-items-center rounded-full ring-2 ring-(--or3-surface)"
                                        :class="entry.tone"
                                    >
                                        <Icon
                                            :name="entry.icon"
                                            :class="[
                                                'size-3',
                                                entry.spin && 'animate-spin',
                                            ]"
                                        />
                                    </span>
                                    <p
                                        class="font-mono text-[12px] font-semibold text-(--or3-text)"
                                    >
                                        {{ entry.label }}
                                    </p>
                                    <p
                                        class="text-[11px] text-(--or3-text-muted)"
                                    >
                                        {{ entry.time }}
                                    </p>
                                </li>
                            </ol>
                        </section>

                        <!-- Result preview -->
                        <section v-if="showResultSection">
                            <div
                                class="flex items-center justify-between gap-2"
                            >
                                <p
                                    class="or3-label text-[11px] font-semibold tracking-[0.18em] text-(--or3-text-muted)"
                                >
                                    RESULT
                                    <span
                                        v-if="
                                            hasArtifact && !fullResultAvailable
                                        "
                                        class="ml-2 rounded-full bg-(--or3-amber)/10 px-2 py-0.5 font-mono text-[10px] font-medium text-(--or3-amber)"
                                    >
                                        Preview only
                                    </span>
                                    <span
                                        v-else-if="fullResultAvailable"
                                        class="ml-2 rounded-full bg-(--or3-green-soft) px-2 py-0.5 font-mono text-[10px] font-medium text-(--or3-green-dark)"
                                    >
                                        Full result
                                    </span>
                                </p>
                                <div class="flex items-center gap-1">
                                    <button
                                        v-if="
                                            hasArtifact && !fullResultAvailable
                                        "
                                        type="button"
                                        class="or3-focus-ring inline-flex items-center gap-1 rounded-full px-2 py-1 font-mono text-[11px] font-medium text-(--or3-text-muted) transition hover:bg-(--or3-surface-soft) hover:text-(--or3-text) disabled:cursor-not-allowed disabled:opacity-60"
                                        :disabled="fullResultLoading"
                                        @click="loadFullResult"
                                    >
                                        <Icon
                                            :name="
                                                fullResultLoading
                                                    ? 'i-pixelarticons-loader'
                                                    : 'i-pixelarticons-arrow-down'
                                            "
                                            :class="[
                                                'size-3',
                                                fullResultLoading &&
                                                    'animate-spin',
                                            ]"
                                        />
                                        {{
                                            fullResultLoading
                                                ? 'Loading…'
                                                : 'View full result'
                                        }}
                                    </button>
                                    <button
                                        v-else-if="fullResultAvailable"
                                        type="button"
                                        class="or3-focus-ring inline-flex items-center gap-1 rounded-full px-2 py-1 font-mono text-[11px] font-medium text-(--or3-text-muted) transition hover:bg-(--or3-surface-soft) hover:text-(--or3-text)"
                                        @click="collapseFullResult"
                                    >
                                        <Icon
                                            name="i-pixelarticons-arrow-up"
                                            class="size-3"
                                        />
                                        Show preview
                                    </button>
                                    <button
                                        type="button"
                                        class="or3-focus-ring inline-flex items-center gap-1 rounded-full px-2 py-1 font-mono text-[11px] font-medium text-(--or3-text-muted) transition hover:bg-(--or3-surface-soft) hover:text-(--or3-text)"
                                        @click="copyResult"
                                    >
                                        <Icon
                                            :name="
                                                resultCopied
                                                    ? 'i-pixelarticons-check'
                                                    : 'i-pixelarticons-copy'
                                            "
                                            class="size-3"
                                        />
                                        {{ resultCopied ? 'Copied' : 'Copy' }}
                                    </button>
                                </div>
                            </div>
                            <p
                                v-if="fullResultAvailable && fullResultMeta"
                                class="mt-1 font-mono text-[10px] text-(--or3-text-muted)"
                            >
                                {{ fullResultMeta }}
                            </p>
                            <p
                                v-if="fullResultError"
                                class="mt-1 font-mono text-[11px] text-(--or3-danger)"
                            >
                                {{ fullResultError }}
                            </p>
                            <div
                                class="mt-2 overflow-hidden rounded-2xl border-l-4 border-(--or3-green) bg-(--or3-surface-soft)"
                            >
                                <pre
                                    :class="[
                                        'overflow-y-auto px-4 py-3 font-mono text-[12px] leading-5 text-(--or3-text) whitespace-pre-wrap',
                                        fullResultAvailable
                                            ? 'max-h-112'
                                            : 'max-h-80',
                                    ]"
                                    >{{ displayedResultText }}</pre
                                >
                            </div>
                        </section>

                        <!-- Empty preview hint -->
                        <section
                            v-else-if="isTerminal && !job.error"
                            class="rounded-2xl border border-dashed border-(--or3-border) bg-(--or3-surface-soft) px-3 py-3 text-xs text-(--or3-text-muted)"
                        >
                            The task finished but didn't return a text preview.
                            You can retry or open it in chat to dig deeper.
                        </section>

                        <!-- Tool calls -->
                        <section v-if="toolCalls.length">
                            <p
                                class="or3-label text-[11px] font-semibold tracking-[0.18em] text-(--or3-text-muted)"
                            >
                                TOOL CALLS
                                <span
                                    class="ml-2 rounded-full bg-(--or3-surface-soft) px-2 py-0.5 font-mono text-[10px] font-medium text-(--or3-text-muted)"
                                >
                                    {{ toolCalls.length }}
                                </span>
                            </p>
                            <ol class="mt-2 space-y-2">
                                <li
                                    v-for="call in toolCalls"
                                    :key="call.id"
                                    class="overflow-hidden rounded-2xl border border-(--or3-border) bg-(--or3-surface-soft)"
                                >
                                    <button
                                        type="button"
                                        class="or3-focus-ring flex w-full items-center justify-between gap-2 px-3 py-2 text-left transition hover:bg-(--or3-surface)"
                                        @click="toggleToolCall(call.id)"
                                    >
                                        <div
                                            class="flex min-w-0 items-center gap-2"
                                        >
                                            <span
                                                :class="[
                                                    'grid size-5 shrink-0 place-items-center rounded-full',
                                                    call.status === 'failed'
                                                        ? 'bg-(--or3-danger)/10 text-(--or3-danger)'
                                                        : call.status ===
                                                            'running'
                                                          ? 'bg-(--or3-amber)/10 text-(--or3-amber)'
                                                          : 'bg-(--or3-green-soft) text-(--or3-green-dark)',
                                                ]"
                                            >
                                                <Icon
                                                    :name="
                                                        call.status === 'failed'
                                                            ? 'i-pixelarticons-close'
                                                            : call.status ===
                                                                'running'
                                                              ? 'i-pixelarticons-loader'
                                                              : 'i-pixelarticons-check'
                                                    "
                                                    :class="[
                                                        'size-3',
                                                        call.status ===
                                                            'running' &&
                                                            'animate-spin',
                                                    ]"
                                                />
                                            </span>
                                            <span
                                                class="truncate font-mono text-[12px] font-semibold text-(--or3-text)"
                                            >
                                                {{ call.name }}
                                            </span>
                                            <span
                                                v-if="call.finishedAt"
                                                class="hidden font-mono text-[10px] text-(--or3-text-muted) sm:inline"
                                            >
                                                {{
                                                    formatToolTime(
                                                        call.finishedAt,
                                                    )
                                                }}
                                            </span>
                                        </div>
                                        <Icon
                                            :name="
                                                isToolExpanded(call.id)
                                                    ? 'i-pixelarticons-chevron-up'
                                                    : 'i-pixelarticons-chevron-down'
                                            "
                                            class="size-3 shrink-0 text-(--or3-text-muted)"
                                        />
                                    </button>
                                    <div
                                        v-if="isToolExpanded(call.id)"
                                        class="border-t border-(--or3-border) bg-(--or3-surface) px-3 py-2.5 space-y-2"
                                    >
                                        <div v-if="call.arguments">
                                            <p
                                                class="font-mono text-[10px] font-semibold uppercase tracking-wider text-(--or3-text-muted)"
                                            >
                                                Arguments
                                            </p>
                                            <pre
                                                class="mt-1 max-h-40 overflow-y-auto rounded-lg border border-(--or3-border) bg-(--or3-surface-soft) px-2 py-1.5 font-mono text-[11px] leading-5 text-(--or3-text) whitespace-pre-wrap"
                                                >{{ call.arguments }}</pre
                                            >
                                        </div>
                                        <div v-if="call.result">
                                            <p
                                                class="font-mono text-[10px] font-semibold uppercase tracking-wider text-(--or3-text-muted)"
                                            >
                                                Result
                                            </p>
                                            <pre
                                                class="mt-1 max-h-48 overflow-y-auto rounded-lg border border-(--or3-border) bg-(--or3-surface-soft) px-2 py-1.5 font-mono text-[11px] leading-5 text-(--or3-text) whitespace-pre-wrap"
                                                >{{ call.result }}</pre
                                            >
                                        </div>
                                        <div v-if="call.error">
                                            <p
                                                class="font-mono text-[10px] font-semibold uppercase tracking-wider text-(--or3-danger)"
                                            >
                                                Error
                                            </p>
                                            <pre
                                                class="mt-1 max-h-32 overflow-y-auto rounded-lg border border-(--or3-danger)/30 bg-(--or3-danger)/10 px-2 py-1.5 font-mono text-[11px] leading-5 text-(--or3-text) whitespace-pre-wrap"
                                                >{{ call.error }}</pre
                                            >
                                        </div>
                                        <p
                                            v-if="
                                                !call.arguments &&
                                                !call.result &&
                                                !call.error
                                            "
                                            class="font-mono text-[11px] text-(--or3-text-muted)"
                                        >
                                            No payload captured for this call.
                                        </p>
                                    </div>
                                </li>
                            </ol>
                            <p
                                v-if="liveLoadFailed"
                                class="mt-2 font-mono text-[10px] text-(--or3-text-muted)"
                            >
                                Live event log expired — only persisted summary
                                is shown.
                            </p>
                        </section>
                        <section
                            v-else-if="
                                isTerminal &&
                                !liveLoadFailed &&
                                !toolCalls.length
                            "
                            class="rounded-2xl border border-dashed border-(--or3-border) bg-(--or3-surface-soft) px-3 py-2 font-mono text-[11px] text-(--or3-text-muted)"
                        >
                            No tool calls were recorded for this run.
                        </section>

                        <!-- Error -->
                        <section v-if="job.error">
                            <p
                                class="or3-label text-[11px] font-semibold tracking-[0.18em] text-(--or3-danger)"
                            >
                                ERROR
                            </p>
                            <pre
                                class="mt-2 max-h-48 overflow-y-auto rounded-2xl border border-(--or3-danger)/30 bg-(--or3-danger)/10 px-3 py-2.5 font-mono text-[12px] leading-5 text-(--or3-text) whitespace-pre-wrap"
                                >{{ job.error }}</pre
                            >
                        </section>

                        <!-- Execution details -->
                        <section>
                            <p
                                class="or3-label text-[11px] font-semibold tracking-[0.18em] text-(--or3-text-muted)"
                            >
                                EXECUTION DETAILS
                            </p>
                            <dl
                                class="mt-2 divide-y divide-(--or3-border) overflow-hidden rounded-2xl border border-(--or3-border) bg-(--or3-surface-soft)"
                            >
                                <div
                                    v-for="row in detailRows"
                                    :key="row.id"
                                    class="flex items-center justify-between gap-3 px-3 py-2"
                                >
                                    <dt
                                        class="flex items-center gap-1.5 font-mono text-[11px] font-medium text-(--or3-text-muted)"
                                    >
                                        <Icon :name="row.icon" class="size-3" />
                                        {{ row.label }}
                                    </dt>
                                    <dd
                                        class="flex min-w-0 items-center gap-1.5 text-right"
                                    >
                                        <span
                                            class="truncate font-mono text-[11px] text-(--or3-text)"
                                            :title="row.value"
                                            >{{ row.value }}</span
                                        >
                                        <button
                                            v-if="row.copyable"
                                            type="button"
                                            class="or3-focus-ring grid size-6 shrink-0 place-items-center rounded-md text-(--or3-text-muted) transition hover:bg-(--or3-surface) hover:text-(--or3-text)"
                                            :aria-label="`Copy ${row.label}`"
                                            @click="
                                                copyDetail(row.id, row.value)
                                            "
                                        >
                                            <Icon
                                                :name="
                                                    copiedRow === row.id
                                                        ? 'i-pixelarticons-check'
                                                        : 'i-pixelarticons-copy'
                                                "
                                                class="size-3"
                                            />
                                        </button>
                                    </dd>
                                </div>
                            </dl>
                        </section>
                    </div>
                </div>

                <!-- Footer actions -->
                <div
                    class="border-t border-(--or3-border) bg-(--or3-surface) px-5 py-3.5"
                >
                    <div class="flex flex-col gap-2">
                        <button
                            v-if="canContinue"
                            type="button"
                            class="or3-focus-ring or3-touch-target inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-(--or3-green) px-3.5 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-(--or3-green-dark)"
                            @click="$emit('continue', job)"
                        >
                            <Icon
                                name="i-pixelarticons-message"
                                class="size-4"
                            />
                            Continue in chat
                        </button>
                        <button
                            v-else-if="canDiscussError"
                            type="button"
                            class="or3-focus-ring or3-touch-target inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-(--or3-green) px-3.5 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-(--or3-green-dark)"
                            @click="$emit('continue', job)"
                        >
                            <Icon
                                name="i-pixelarticons-message"
                                class="size-4"
                            />
                            Discuss in chat
                        </button>
                        <div
                            v-if="canCancel || canRetry"
                            class="flex flex-wrap items-center justify-end gap-2"
                        >
                            <button
                                v-if="canCancel"
                                type="button"
                                class="or3-focus-ring or3-touch-target inline-flex items-center gap-2 rounded-2xl border border-(--or3-border) bg-(--or3-surface-soft) px-3.5 py-2 text-sm font-medium text-(--or3-text) transition hover:border-(--or3-danger)/60 hover:text-(--or3-danger) disabled:cursor-not-allowed disabled:opacity-60"
                                :disabled="busy"
                                @click="$emit('cancel', job)"
                            >
                                <Icon
                                    :name="
                                        busy
                                            ? 'i-pixelarticons-loader'
                                            : 'i-pixelarticons-close'
                                    "
                                    :class="['size-4', busy && 'animate-spin']"
                                />
                                Stop task
                            </button>
                            <button
                                v-if="canRetry"
                                type="button"
                                class="or3-focus-ring or3-touch-target inline-flex items-center gap-2 rounded-2xl border border-(--or3-border) bg-(--or3-surface-soft) px-3.5 py-2 text-sm font-medium text-(--or3-text) transition hover:border-(--or3-green)/40 disabled:cursor-not-allowed disabled:opacity-60"
                                :disabled="busy"
                                @click="$emit('retry', job)"
                            >
                                <Icon
                                    :name="
                                        busy
                                            ? 'i-pixelarticons-loader'
                                            : 'i-pixelarticons-redo'
                                    "
                                    :class="['size-4', busy && 'animate-spin']"
                                />
                                Try again
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </template>
    </USlideover>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import type { JobEvent, JobSnapshot } from '~/types/or3-api';
import { isActiveStatus, isTerminalStatus } from '~/utils/or3/jobs';

const props = defineProps<{
    open: boolean;
    job: JobSnapshot | null;
    busy?: boolean;
}>();

const emit = defineEmits<{
    'update:open': [value: boolean];
    cancel: [job: JobSnapshot];
    retry: [job: JobSnapshot];
    continue: [job: JobSnapshot];
}>();

function onUpdateOpen(value: boolean) {
    emit('update:open', value);
}

const resultCopied = ref(false);
const copiedRow = ref<string | null>(null);

const liveEvents = ref<JobEvent[]>([]);
const liveFinalText = ref<string | null>(null);
const liveLoadFailed = ref(false);
const fullResultText = ref<string | null>(null);
const fullResultTruncated = ref(false);
const fullResultBytes = ref(0);
const fullResultSize = ref(0);
const fullResultLoading = ref(false);
const fullResultError = ref<string | null>(null);
const fullResultExpanded = ref(false);

const { fetchJob, fetchArtifact } = useJobs();

async function loadJobDetail(jobId: string) {
    liveEvents.value = [];
    liveFinalText.value = null;
    liveLoadFailed.value = false;
    try {
        const snapshot = await fetchJob(jobId);
        liveEvents.value = Array.isArray(snapshot.events)
            ? snapshot.events
            : [];
        if (typeof snapshot.final_text === 'string') {
            liveFinalText.value = snapshot.final_text;
        }
    } catch {
        // 404 just means the in-memory job registry has expired this job;
        // we still have the persisted summary to render.
        liveLoadFailed.value = true;
    }
}

function resetDetailState() {
    resultCopied.value = false;
    copiedRow.value = null;
    fullResultText.value = null;
    fullResultTruncated.value = false;
    fullResultBytes.value = 0;
    fullResultSize.value = 0;
    fullResultLoading.value = false;
    fullResultError.value = null;
    fullResultExpanded.value = false;
    liveEvents.value = [];
    liveFinalText.value = null;
    liveLoadFailed.value = false;
}

watch(
    () => props.job?.job_id,
    (jobId) => {
        resetDetailState();
        if (jobId && props.open) {
            void loadJobDetail(jobId);
        }
    },
);

watch(
    () => props.open,
    (value) => {
        if (!value) {
            resetDetailState();
        } else if (props.job?.job_id) {
            void loadJobDetail(props.job.job_id);
        }
    },
);

const title = computed(() => {
    if (!props.job) return 'Agent task';
    return props.job.title || props.job.task || 'Agent task';
});

const taskText = computed(() => props.job?.task ?? '');

const isLive = computed(() => !!props.job && isActiveStatus(props.job.status));
const isTerminal = computed(
    () => !!props.job && isTerminalStatus(props.job.status),
);

const canCancel = computed(() => isLive.value);
const canRetry = computed(
    () =>
        !!props.job &&
        (props.job.status === 'failed' || props.job.status === 'aborted') &&
        !!props.job.task,
);
const canContinue = computed(
    () => !!props.job && props.job.status === 'completed',
);
const canDiscussError = computed(
    () =>
        !!props.job &&
        (props.job.status === 'failed' || props.job.status === 'aborted') &&
        (!!props.job.task || !!props.job.error),
);

const statusLabel = computed(() => {
    if (!props.job) return '';
    switch (props.job.status) {
        case 'queued':
            return 'Queued';
        case 'running':
            return 'Working';
        case 'completed':
            return 'Complete';
        case 'failed':
            return 'Failed';
        case 'aborted':
            return 'Cancelled';
        default:
            return props.job.status;
    }
});

const statusChipClass = computed(() => {
    if (!props.job) return '';
    switch (props.job.status) {
        case 'completed':
            return 'bg-(--or3-green-soft) text-(--or3-green-dark)';
        case 'failed':
            return 'bg-(--or3-danger)/10 text-(--or3-danger)';
        case 'aborted':
            return 'bg-stone-100 text-(--or3-text-muted)';
        case 'queued':
            return 'bg-(--or3-amber)/10 text-(--or3-amber)';
        default:
            return 'bg-(--or3-green-soft) text-(--or3-green-dark)';
    }
});

const statusDotClass = computed(() => {
    if (!props.job) return 'bg-(--or3-text-muted)';
    switch (props.job.status) {
        case 'completed':
            return 'bg-(--or3-green)';
        case 'failed':
            return 'bg-(--or3-danger)';
        case 'aborted':
            return 'bg-stone-400';
        case 'queued':
            return 'bg-(--or3-amber)';
        default:
            return 'bg-(--or3-green)';
    }
});

const notifyLabel = computed(() => {
    switch (props.job?.notify) {
        case 'always':
            return 'Always notify';
        case 'never':
            return 'Don\u2019t notify';
        default:
            return 'Notify when complete';
    }
});

function categoryFromKind(kind?: string) {
    const k = (kind ?? '').toLowerCase();
    if (k.includes('research') || k.includes('search')) return 'research';
    if (k.includes('review') || k.includes('monitor') || k.includes('watch'))
        return 'review';
    if (k.includes('draft') || k.includes('write')) return 'draft';
    if (k.includes('organize') || k.includes('summarize')) return 'organize';
    return 'general';
}

const iconName = computed(() => {
    switch (categoryFromKind(props.job?.kind)) {
        case 'research':
            return 'i-pixelarticons-file-text';
        case 'review':
            return 'i-pixelarticons-chart';
        case 'draft':
            return 'i-pixelarticons-edit';
        case 'organize':
            return 'i-pixelarticons-folder';
        default:
            return 'i-pixelarticons-robot';
    }
});

const iconBg = computed(() => 'bg-(--or3-surface-soft) text-(--or3-text)');

const categoryLabel = computed(() => {
    const c = props.job?.category;
    if (!c) return '';
    return capitalize(c);
});

interface TimelineEntry {
    id: string;
    label: string;
    time: string;
    icon: string;
    tone: string;
    spin?: boolean;
}

function formatTime(value?: string) {
    if (!value) return '';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return value;
    return date.toLocaleString(undefined, {
        month: 'short',
        day: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
    });
}

function durationMs(start?: string, end?: string): number | null {
    if (!start || !end) return null;
    const s = new Date(start).getTime();
    const e = new Date(end).getTime();
    if (Number.isNaN(s) || Number.isNaN(e) || e < s) return null;
    return e - s;
}

function formatDuration(ms: number): string {
    if (ms < 1000) return `${ms} ms`;
    const totalSeconds = Math.round(ms / 1000);
    if (totalSeconds < 60) return `${totalSeconds}s`;
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    if (minutes < 60)
        return seconds ? `${minutes}m ${seconds}s` : `${minutes}m`;
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return mins ? `${hours}h ${mins}m` : `${hours}h`;
}

const durationLabel = computed(() => {
    if (!props.job) return '\u2014';
    const start = props.job.started_at ?? props.job.created_at;
    const end =
        props.job.finished_at ??
        (props.job.status === 'running' ? new Date().toISOString() : undefined);
    const ms = durationMs(start, end);
    if (ms === null) {
        return props.job.status === 'queued' ? 'Waiting' : '\u2014';
    }
    return formatDuration(ms);
});

const outputTypeLabel = computed(() => {
    if (!props.job) return '\u2014';
    if (props.job.error) return 'Error';
    if (props.job.final_text) return 'Text';
    if (isLive.value) return 'Pending';
    return 'None';
});

const quickStats = computed(() => [
    {
        id: 'status',
        label: 'Status',
        icon: 'i-pixelarticons-flag',
        value: statusLabel.value,
    },
    {
        id: 'duration',
        label: 'Duration',
        icon: 'i-pixelarticons-clock',
        value: durationLabel.value,
    },
    {
        id: 'mode',
        label: 'Mode',
        icon: 'i-pixelarticons-robot',
        value: 'Agent',
    },
    {
        id: 'output',
        label: 'Output',
        icon: 'i-pixelarticons-file-text',
        value: outputTypeLabel.value,
    },
]);

interface DetailRow {
    id: string;
    label: string;
    icon: string;
    value: string;
    copyable?: boolean;
}

const detailRows = computed<DetailRow[]>(() => {
    if (!props.job) return [];
    const rows: DetailRow[] = [
        {
            id: 'job',
            label: 'Job ID',
            icon: 'i-pixelarticons-bookmark',
            value: props.job.job_id,
            copyable: true,
        },
    ];
    if (props.job.kind) {
        rows.push({
            id: 'kind',
            label: 'Kind',
            icon: 'i-pixelarticons-folder',
            value: props.job.kind,
        });
    }
    if (props.job.child_session_key) {
        rows.push({
            id: 'session',
            label: 'Session',
            icon: 'i-pixelarticons-link',
            value: props.job.child_session_key,
            copyable: true,
        });
    }
    if (props.job.parent_session_key) {
        rows.push({
            id: 'parent',
            label: 'Parent',
            icon: 'i-pixelarticons-arrow-up',
            value: props.job.parent_session_key,
            copyable: true,
        });
    }
    return rows;
});

const timeline = computed<TimelineEntry[]>(() => {
    if (!props.job) return [];
    const entries: TimelineEntry[] = [];
    if (props.job.created_at) {
        entries.push({
            id: 'created',
            label: 'Submitted',
            time: formatTime(props.job.created_at),
            icon: 'i-pixelarticons-bookmark',
            tone: 'bg-(--or3-surface-soft) text-(--or3-text-muted)',
        });
    }
    if (props.job.started_at) {
        entries.push({
            id: 'started',
            label: 'Started',
            time: formatTime(props.job.started_at),
            icon: 'i-pixelarticons-play',
            tone: 'bg-(--or3-green-soft) text-(--or3-green-dark)',
        });
    }
    if (props.job.finished_at) {
        const finishedLabel =
            props.job.status === 'failed'
                ? 'Failed'
                : props.job.status === 'aborted'
                  ? 'Cancelled'
                  : 'Finished';
        entries.push({
            id: 'finished',
            label: finishedLabel,
            time: formatTime(props.job.finished_at),
            icon:
                props.job.status === 'failed'
                    ? 'i-pixelarticons-close'
                    : props.job.status === 'aborted'
                      ? 'i-pixelarticons-undo'
                      : 'i-pixelarticons-check',
            tone:
                props.job.status === 'failed'
                    ? 'bg-(--or3-danger)/10 text-(--or3-danger)'
                    : props.job.status === 'aborted'
                      ? 'bg-stone-100 text-(--or3-text-muted)'
                      : 'bg-(--or3-green-soft) text-(--or3-green-dark)',
        });
    } else if (props.job.updated_at && props.job.status === 'running') {
        entries.push({
            id: 'updated',
            label: 'Working...',
            time: formatTime(props.job.updated_at),
            icon: 'i-pixelarticons-loader',
            tone: 'bg-(--or3-green-soft) text-(--or3-green-dark)',
            spin: true,
        });
    }
    return entries;
});

function capitalize(value: string) {
    return value.charAt(0).toUpperCase() + value.slice(1);
}

const previewText = computed(
    () => liveFinalText.value ?? props.job?.final_text ?? '',
);

const hasArtifact = computed(() => {
    const id = props.job?.artifact_id;
    return typeof id === 'string' && id.trim().length > 0;
});

const fullResultAvailable = computed(
    () => fullResultExpanded.value && fullResultText.value !== null,
);

const displayedResultText = computed(() =>
    fullResultAvailable.value ? fullResultText.value! : previewText.value,
);

const showResultSection = computed(
    () => !!previewText.value || fullResultAvailable.value,
);

function formatBytes(bytes: number): string {
    if (!bytes) return '0 B';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

const fullResultMeta = computed(() => {
    if (!fullResultAvailable.value) return '';
    const sizeLabel = fullResultSize.value
        ? formatBytes(fullResultSize.value)
        : formatBytes(fullResultBytes.value);
    if (fullResultTruncated.value) {
        return `Showing first ${formatBytes(fullResultBytes.value)} of ${sizeLabel}`;
    }
    return sizeLabel;
});

async function loadFullResult() {
    if (!props.job?.artifact_id) return;
    const sessionKey =
        props.job.child_session_key || props.job.parent_session_key;
    if (!sessionKey) {
        fullResultError.value =
            'Missing session key for this task — can\u2019t fetch the full result.';
        return;
    }
    fullResultLoading.value = true;
    fullResultError.value = null;
    try {
        const result = await fetchArtifact(props.job.artifact_id, sessionKey, {
            maxBytes: 1_000_000,
        });
        fullResultText.value = result.content ?? '';
        fullResultTruncated.value = !!result.truncated;
        fullResultBytes.value = result.read_bytes ?? 0;
        fullResultSize.value = result.size_bytes ?? 0;
        fullResultExpanded.value = true;
    } catch (error) {
        fullResultError.value =
            error instanceof Error && error.message
                ? error.message
                : 'Couldn\u2019t load the full result.';
    } finally {
        fullResultLoading.value = false;
    }
}

function collapseFullResult() {
    fullResultExpanded.value = false;
}

interface ToolCallEntry {
    id: string;
    name: string;
    arguments?: string;
    result?: string;
    error?: string;
    status: 'running' | 'completed' | 'failed';
    startedAt?: string;
    finishedAt?: string;
}

function stringifyToolValue(value: unknown): string {
    if (value === null || value === undefined) return '';
    if (typeof value === 'string') return value;
    try {
        return JSON.stringify(value, null, 2);
    } catch {
        return String(value);
    }
}

const toolCalls = computed<ToolCallEntry[]>(() => {
    const entries: ToolCallEntry[] = [];
    const pendingById = new Map<string, number>();
    const pendingByName = new Map<string, number[]>();
    for (const event of liveEvents.value) {
        if (event.type === 'tool_call') {
            const data = (event.data ?? event) as Record<string, unknown>;
            const name = stringifyToolValue(data.name) || 'tool';
            const toolCallId = stringifyToolValue(data.tool_call_id);
            const entry: ToolCallEntry = {
                id: toolCallId || `tc-${entries.length}`,
                name,
                arguments: stringifyToolValue(data.arguments),
                status: 'running',
                startedAt: stringifyToolValue(
                    (data.created_at ?? event.created_at) as unknown,
                ),
            };
            entries.push(entry);
            const entryIndex = entries.length - 1;
            if (toolCallId) {
                pendingById.set(toolCallId, entryIndex);
            }
            const nameQueue = pendingByName.get(name) ?? [];
            nameQueue.push(entryIndex);
            pendingByName.set(name, nameQueue);
        } else if (event.type === 'tool_result') {
            const data = (event.data ?? event) as Record<string, unknown>;
            const name = stringifyToolValue(data.name) || 'tool';
            const toolCallId = stringifyToolValue(data.tool_call_id);
            let matchIdx = toolCallId ? pendingById.get(toolCallId) : undefined;
            if (matchIdx === undefined) {
                const queue = pendingByName.get(name) ?? [];
                matchIdx = queue.shift();
                if (queue.length) {
                    pendingByName.set(name, queue);
                } else {
                    pendingByName.delete(name);
                }
            }
            const target =
                matchIdx !== undefined ? entries[matchIdx] : undefined;
            const resultText =
                stringifyToolValue(data.result) ||
                stringifyToolValue(data.content) ||
                stringifyToolValue(data.preview);
            const errorText = stringifyToolValue(data.error);
            const finishedAt = stringifyToolValue(
                (data.created_at ?? event.created_at) as unknown,
            );
            if (target) {
                target.result = resultText;
                target.error = errorText;
                target.status = errorText ? 'failed' : 'completed';
                target.finishedAt = finishedAt;
                if (toolCallId) {
                    pendingById.delete(toolCallId);
                }
            } else {
                entries.push({
                    id: toolCallId || `tr-${entries.length}`,
                    name,
                    result: resultText,
                    error: errorText,
                    status: errorText ? 'failed' : 'completed',
                    finishedAt,
                });
            }
        }
    }
    return entries;
});

const expandedToolCalls = ref<Set<string>>(new Set());

function toggleToolCall(id: string) {
    const next = new Set(expandedToolCalls.value);
    if (next.has(id)) {
        next.delete(id);
    } else {
        next.add(id);
    }
    expandedToolCalls.value = next;
}

function isToolExpanded(id: string) {
    return expandedToolCalls.value.has(id);
}

function formatToolTime(value?: string) {
    if (!value) return '';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '';
    return date.toLocaleTimeString(undefined, {
        hour: 'numeric',
        minute: '2-digit',
        second: '2-digit',
    });
}

async function copyResult() {
    const text = displayedResultText.value;
    if (!text) return;
    try {
        await navigator.clipboard.writeText(text);
        resultCopied.value = true;
        setTimeout(() => {
            resultCopied.value = false;
        }, 1500);
    } catch {
        /* ignore */
    }
}

async function copyDetail(id: string, value: string) {
    try {
        await navigator.clipboard.writeText(value);
        copiedRow.value = id;
        setTimeout(() => {
            if (copiedRow.value === id) copiedRow.value = null;
        }, 1500);
    } catch {
        /* ignore */
    }
}
</script>
