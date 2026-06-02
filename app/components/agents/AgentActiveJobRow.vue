<template>
    <div
        class="or3-pressable relative flex w-full flex-col gap-3 rounded-2xl border border-(--or3-border) bg-(--or3-surface) p-3 sm:flex-row sm:items-center"
        :class="attention ? 'border-(--or3-amber)/50' : ''"
    >
        <span
            class="grid size-11 shrink-0 place-items-center rounded-xl bg-(--or3-surface-soft) text-(--or3-text)"
        >
            <Icon :name="iconName" class="size-5" />
        </span>

        <div class="min-w-0 flex-1">
            <p
                class="line-clamp-2 font-mono text-sm font-semibold leading-snug text-(--or3-text)"
            >
                {{ title }}
            </p>
            <p class="mt-0.5 truncate text-xs text-(--or3-text-muted)">
                {{ runnerName }} · {{ statusLabel }}
                <span v-if="staleMinutes !== null">
                    · Last update {{ staleMinutes }} min ago</span
                >
            </p>
            <p
                class="mt-1 line-clamp-2 text-xs leading-relaxed text-(--or3-text-muted)"
            >
                {{ activityPreview }}
            </p>
            <div
                v-if="isLive"
                class="mt-2 flex items-center gap-2"
            >
                <div
                    class="relative h-1.5 flex-1 overflow-hidden rounded-full or3-indeterminate-bar"
                    role="progressbar"
                    aria-valuetext="Working"
                />
                <span
                    class="font-mono text-[11px] tabular-nums text-(--or3-text-muted)"
                    >{{ progressLabel }}</span
                >
            </div>
        </div>

        <div
            class="flex shrink-0 items-center justify-between gap-2 sm:flex-col sm:items-end sm:justify-center"
        >
            <div class="text-left sm:text-right">
                <p
                    class="font-mono text-sm font-semibold tabular-nums text-(--or3-text)"
                >
                    {{ elapsed }}
                </p>
                <p class="text-[11px] text-(--or3-text-muted)">elapsed</p>
            </div>
            <div class="flex items-center gap-2">
                <button
                    type="button"
                    class="or3-focus-ring rounded-xl border border-(--or3-border) bg-(--or3-surface-soft) px-3 py-1.5 font-mono text-xs font-semibold text-(--or3-text)"
                    @click="$emit('open', job)"
                >
                    Open
                </button>
                <button
                    v-if="canCancel"
                    type="button"
                    class="or3-focus-ring grid size-9 place-items-center rounded-full border border-(--or3-border) bg-(--or3-surface-soft) text-(--or3-text-muted) transition hover:border-(--or3-danger)/60 hover:text-(--or3-danger) disabled:cursor-not-allowed disabled:opacity-50"
                    :disabled="cancelling"
                    :aria-label="
                        confirming
                            ? `Confirm stop ${title}`
                            : `Stop ${title}`
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
        </div>
    </div>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, ref } from 'vue';
import type { JobSnapshot } from '~/types/or3-api';
import {
    activeStatusLabel,
    formatElapsed,
    isAttentionStatus,
    isStaleJob,
    jobDisplayTitle,
    jobRunnerDisplay,
    lastActivityPreview,
    minutesSinceUpdate,
} from '~/utils/or3/agent-jobs';
import { isActiveStatus, isCliJob } from '~/utils/or3/jobs';
import { useSharedNow } from '~/composables/useSharedNow';

const props = defineProps<{ job: JobSnapshot; cancelling?: boolean }>();
const emit = defineEmits<{
    open: [job: JobSnapshot];
    cancel: [job: JobSnapshot];
}>();

const now = useSharedNow(1000);
const confirming = ref(false);
let confirmTimer: ReturnType<typeof setTimeout> | null = null;

onBeforeUnmount(() => {
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

const title = computed(() => jobDisplayTitle(props.job));
const runnerName = computed(() => jobRunnerDisplay(props.job));
const statusLabel = computed(() => activeStatusLabel(props.job));
const attention = computed(() => isAttentionStatus(props.job));
const activityPreview = computed(() => lastActivityPreview(props.job));
const isLive = computed(() => isActiveStatus(props.job.status));

const staleMinutes = computed(() => {
    if (!isStaleJob(props.job, now.value)) return null;
    return minutesSinceUpdate(props.job, now.value);
});

const elapsed = computed(() => {
    const end =
        props.job.status === 'running' || props.job.status === 'queued'
            ? undefined
            : props.job.finished_at ?? props.job.updated_at;
    return formatElapsed(
        props.job.started_at ?? props.job.created_at,
        end,
        now.value,
    );
});

const progressLabel = computed(() => {
    if (props.job.status === 'queued') return 'In line';
    if (attention.value) return 'Needs attention';
    return 'Working';
});

const iconName = computed(() => {
    if (attention.value) return 'i-pixelarticons-alert';
    if (isCliJob(props.job.kind)) return 'i-pixelarticons-terminal';
    return 'i-pixelarticons-robot';
});
</script>
