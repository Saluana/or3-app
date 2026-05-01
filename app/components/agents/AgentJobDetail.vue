<template>
    <USlideover
        :open="open"
        side="right"
        :ui="{ content: 'bg-(--or3-surface) sm:max-w-md' }"
        @update:open="onUpdateOpen"
    >
        <template #content>
            <div v-if="job" class="flex h-full flex-col">
                <!-- Header -->
                <div
                    class="border-b border-(--or3-border) bg-(--or3-surface) px-5 pb-4 pt-5"
                >
                    <div class="flex items-start gap-3">
                        <span
                            class="grid size-10 shrink-0 place-items-center rounded-xl"
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
                <div class="flex-1 overflow-y-auto px-5 py-4">
                    <div class="space-y-5">
                        <!-- Timeline -->
                        <section>
                            <p
                                class="or3-label text-[11px] font-semibold tracking-[0.18em] text-(--or3-text-muted)"
                            >
                                TIMELINE
                            </p>
                            <ul class="mt-2 space-y-2">
                                <li
                                    v-for="entry in timeline"
                                    :key="entry.id"
                                    class="flex items-start gap-3 text-xs"
                                >
                                    <span
                                        class="mt-1 grid size-5 shrink-0 place-items-center rounded-full"
                                        :class="entry.tone"
                                    >
                                        <Icon
                                            :name="entry.icon"
                                            class="size-3"
                                        />
                                    </span>
                                    <div class="min-w-0 flex-1">
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
                                    </div>
                                </li>
                            </ul>
                        </section>

                        <!-- Result preview -->
                        <section v-if="job.final_text">
                            <p
                                class="or3-label text-[11px] font-semibold tracking-[0.18em] text-(--or3-text-muted)"
                            >
                                RESULT PREVIEW
                            </p>
                            <pre
                                class="mt-2 max-h-72 overflow-y-auto rounded-2xl border border-(--or3-border) bg-(--or3-surface-soft) px-3 py-2.5 font-mono text-[12px] leading-5 text-(--or3-text) whitespace-pre-wrap"
                                >{{ job.final_text }}</pre
                            >
                        </section>

                        <!-- Empty preview hint -->
                        <section
                            v-else-if="isTerminal && !job.error"
                            class="rounded-2xl border border-dashed border-(--or3-border) bg-(--or3-surface-soft) px-3 py-3 text-xs text-(--or3-text-muted)"
                        >
                            The task finished but didn't return a text preview.
                            You can retry or open it in chat to dig deeper.
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

                        <!-- IDs -->
                        <section>
                            <p
                                class="or3-label text-[11px] font-semibold tracking-[0.18em] text-(--or3-text-muted)"
                            >
                                IDS
                            </p>
                            <dl class="mt-2 space-y-1.5 text-[11px]">
                                <div
                                    class="flex items-center justify-between gap-2"
                                >
                                    <dt class="text-(--or3-text-muted)">Job</dt>
                                    <dd
                                        class="truncate font-mono text-(--or3-text)"
                                    >
                                        {{ job.job_id }}
                                    </dd>
                                </div>
                                <div
                                    v-if="job.child_session_key"
                                    class="flex items-center justify-between gap-2"
                                >
                                    <dt class="text-(--or3-text-muted)">
                                        Session
                                    </dt>
                                    <dd
                                        class="truncate font-mono text-(--or3-text)"
                                    >
                                        {{ job.child_session_key }}
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
                    <div class="flex flex-wrap items-center justify-end gap-2">
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
                        <button
                            v-if="canContinue"
                            type="button"
                            class="or3-focus-ring or3-touch-target inline-flex items-center gap-2 rounded-2xl bg-(--or3-green) px-3.5 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-(--or3-green-dark)"
                            @click="$emit('continue', job)"
                        >
                            <Icon
                                name="i-pixelarticons-message"
                                class="size-4"
                            />
                            Continue in chat
                        </button>
                    </div>
                </div>
            </div>
        </template>
    </USlideover>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import type { JobSnapshot } from '~/types/or3-api';
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

const title = computed(() => {
    if (!props.job) return 'Agent task';
    return props.job.title || props.job.task || 'Agent task';
});

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

interface TimelineEntry {
    id: string;
    label: string;
    time: string;
    icon: string;
    tone: string;
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
            label: 'Last update',
            time: formatTime(props.job.updated_at),
            icon: 'i-pixelarticons-loader',
            tone: 'bg-(--or3-green-soft) text-(--or3-green-dark)',
        });
    }
    return entries;
});

function capitalize(value: string) {
    return value.charAt(0).toUpperCase() + value.slice(1);
}
</script>
