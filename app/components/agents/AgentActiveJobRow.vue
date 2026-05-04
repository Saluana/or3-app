<template>
    <div
        class="or3-pressable or3-focus-ring relative flex w-full items-center gap-3 rounded-2xl border border-(--or3-border) bg-(--or3-surface) p-3 text-left"
    >
        <button
            type="button"
            class="or3-focus-ring absolute inset-0 rounded-2xl"
            :aria-label="`Open details for ${title}`"
            @click="$emit('open', job)"
        />

        <span
            class="relative grid size-11 shrink-0 place-items-center rounded-xl bg-(--or3-surface-soft) text-(--or3-text)"
        >
            <Icon :name="iconName" class="size-5" />
        </span>

        <div class="relative min-w-0 flex-1 pointer-events-none">
            <p
                class="truncate font-mono text-sm font-semibold text-(--or3-text)"
            >
                {{ title }}
            </p>
            <p class="mt-0.5 truncate text-xs text-(--or3-text-muted)">
                {{ description }}
            </p>

            <div class="mt-2 flex items-center gap-2">
                <div
                    :class="[
                        'relative h-1.5 flex-1 overflow-hidden rounded-full',
                        showIndeterminate
                            ? 'or3-indeterminate-bar'
                            : 'bg-stone-200/80',
                    ]"
                    role="progressbar"
                    :aria-valuetext="progressLabel"
                    :aria-valuenow="
                        progressValue === null ? undefined : progressValue
                    "
                    :aria-valuemin="progressValue === null ? undefined : 0"
                    :aria-valuemax="progressValue === null ? undefined : 100"
                >
                    <div
                        v-if="!showIndeterminate"
                        class="absolute inset-y-0 left-0 rounded-full transition-all duration-700"
                        :class="progressTone"
                        :style="{ width: `${progressValue ?? 0}%` }"
                    />
                </div>
                <span
                    class="font-mono text-[11px] tabular-nums text-(--or3-text-muted)"
                    >{{ progressLabel }}</span
                >
            </div>

            <p
                class="mt-1.5 flex items-center gap-1.5 text-[11px] text-(--or3-text-muted)"
            >
                <span
                    :class="[
                        'size-1.5 rounded-full',
                        dotTone,
                        isLive ? 'or3-live-dot' : '',
                    ]"
                />
                <span class="capitalize">{{ statusVerb }}</span>
            </p>
        </div>

        <div class="relative shrink-0 text-right pointer-events-none">
            <p
                class="font-mono text-sm font-semibold tabular-nums text-(--or3-text)"
            >
                {{ elapsed }}
            </p>
            <p class="text-[11px] text-(--or3-text-muted)">elapsed</p>
        </div>

        <button
            v-if="canCancel"
            type="button"
            class="or3-focus-ring relative grid size-9 shrink-0 place-items-center rounded-full border border-(--or3-border) bg-(--or3-surface-soft) text-(--or3-text-muted) transition hover:border-(--or3-danger)/60 hover:text-(--or3-danger) disabled:cursor-not-allowed disabled:opacity-50"
            :disabled="cancelling"
            :aria-label="
                confirming ? `Confirm cancel ${title}` : `Cancel ${title}`
            "
            @click.stop="onCancelClick"
        >
            <Icon
                v-if="cancelling"
                name="i-pixelarticons-loader"
                class="size-4 animate-spin"
            />
            <Icon
                v-else-if="confirming"
                name="i-pixelarticons-check"
                class="size-4 text-(--or3-danger)"
            />
            <Icon v-else name="i-pixelarticons-close" class="size-4" />
        </button>
    </div>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue';
import type { JobSnapshot } from '~/types/or3-api';
import { isCliJob, runnerLabel } from '~/utils/or3/jobs';

const props = defineProps<{ job: JobSnapshot; cancelling?: boolean }>();
const emit = defineEmits<{
    open: [job: JobSnapshot];
    cancel: [job: JobSnapshot];
}>();

const now = ref(Date.now());
let timer: ReturnType<typeof setInterval> | null = null;
const confirming = ref(false);
let confirmTimer: ReturnType<typeof setTimeout> | null = null;

onMounted(() => {
    timer = setInterval(() => (now.value = Date.now()), 1000);
});
onBeforeUnmount(() => {
    if (timer) clearInterval(timer);
    if (confirmTimer) clearTimeout(confirmTimer);
});

function onCancelClick() {
    if (props.cancelling) return;
    if (!confirming.value) {
        confirming.value = true;
        confirmTimer = setTimeout(() => {
            confirming.value = false;
        }, 3_000);
        return;
    }
    if (confirmTimer) clearTimeout(confirmTimer);
    confirming.value = false;
    emit('cancel', props.job);
}

const canCancel = computed(
    () => props.job.status === 'running' || props.job.status === 'queued',
);

function categoryFromKind(
    kind?: string,
): 'research' | 'review' | 'draft' | 'organize' | 'general' {
    const k = (kind ?? '').toLowerCase();
    if (k.includes('research') || k.includes('search')) return 'research';
    if (
        k.includes('review') ||
        k.includes('monitor') ||
        k.includes('watch') ||
        k.includes('mention')
    )
        return 'review';
    if (k.includes('draft') || k.includes('write') || k.includes('email'))
        return 'draft';
    if (
        k.includes('organize') ||
        k.includes('summarize') ||
        k.includes('notes')
    )
        return 'organize';
    return 'general';
}

const category = computed(() => categoryFromKind(props.job.kind));

const iconName = computed(() => {
    switch (category.value) {
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

const title = computed(() => {
    if (props.job.title) return props.job.title;
    if (props.job.task) return props.job.task;
    const kind = props.job.kind;
    if (isCliJob(kind)) {
        return runnerLabel(kind?.slice('agent_cli:'.length)) + ' task';
    }
    if (!kind || kind === 'agent' || kind === 'subagent') return 'Agent task';
    return kind.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
});

const description = computed(() => {
    if (props.job.status === 'failed' || props.job.status === 'aborted') {
        if (props.job.error) return props.job.error.slice(0, 120);
        if (isCliJob(props.job.kind) && props.job.stderr_preview) {
            return props.job.stderr_preview.slice(0, 120);
        }
    }
    if (props.job.final_text) return props.job.final_text.slice(0, 120);
    if (isCliJob(props.job.kind) && props.job.stdout_preview) {
        return props.job.stdout_preview.slice(0, 120);
    }
    switch (category.value) {
        case 'research':
            return 'Searching and pulling together findings';
        case 'review':
            return 'Looking through inputs and summarizing';
        case 'draft':
            return 'Writing draft based on inputs';
        case 'organize':
            return 'Organizing and summarizing';
        default:
            return 'Working on your request';
    }
});

const statusVerb = computed(() => {
    if (props.job.status === 'queued') return 'Queued';
    if (props.job.status === 'failed') return 'Failed';
    if (props.job.status === 'completed') return 'Complete';
    if (props.job.status === 'aborted') return 'Cancelled';
    if (isCliJob(props.job.kind)) {
        const label = runnerLabel(props.job.runner_id);
        return `Running ${label}`;
    }
    switch (category.value) {
        case 'research':
            return 'Researching';
        case 'review':
            return 'Reviewing';
        case 'draft':
            return 'Drafting';
        case 'organize':
            return 'Organizing';
        default:
            return 'Working';
    }
});

const isLive = computed(
    () => props.job.status === 'running' || props.job.status === 'queued',
);

const elapsedMs = computed(() => {
    const startSource = props.job.started_at ?? props.job.created_at ?? null;
    if (!startSource) return 0;
    const start = new Date(startSource).getTime();
    if (Number.isNaN(start)) return 0;
    const end =
        props.job.status === 'running' || props.job.status === 'queued'
            ? now.value
            : new Date(
                  props.job.finished_at ??
                      props.job.updated_at ??
                      props.job.created_at ??
                      now.value,
              ).getTime();
    return Math.max(0, end - start);
});

function pad(n: number) {
    return n < 10 ? `0${n}` : `${n}`;
}

const elapsed = computed(() => {
    const totalSeconds = Math.floor(elapsedMs.value / 1000);
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;
    if (hours > 0) return `${hours}:${pad(minutes)}:${pad(seconds)}`;
    return `${minutes}:${pad(seconds)}`;
});

const showIndeterminate = computed(
    () => props.job.status === 'running' || props.job.status === 'queued',
);

const progressValue = computed<number | null>(() => {
    if (props.job.status === 'completed') return 100;
    if (props.job.status === 'failed' || props.job.status === 'aborted')
        return 0;
    return null;
});

const progressLabel = computed(() => {
    switch (props.job.status) {
        case 'queued':
            return 'In line';
        case 'running':
            return 'Working\u2026';
        case 'completed':
            return 'Done';
        case 'failed':
            return 'Failed';
        case 'aborted':
            return 'Stopped';
        default:
            return '';
    }
});

const progressTone = computed(() =>
    props.job.status === 'failed' ? 'bg-(--or3-danger)' : 'bg-(--or3-green)',
);

const dotTone = computed(() => {
    if (props.job.status === 'failed') return 'bg-(--or3-danger)';
    if (props.job.status === 'queued') return 'bg-(--or3-amber)';
    return 'bg-(--or3-green)';
});
</script>
