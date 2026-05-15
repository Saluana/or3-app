<template>
    <div class="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <SurfaceCard class-name="space-y-3">
            <div class="flex items-center justify-between gap-2">
                <p
                    class="flex items-center gap-1.5 font-mono text-sm font-semibold text-(--or3-text)"
                >
                    <Icon
                        name="i-pixelarticons-hourglass"
                        class="size-4 text-(--or3-text-muted)"
                    />
                    Pending
                </p>
                <span
                    class="rounded-full bg-stone-100 px-2 py-0.5 text-xs font-semibold text-(--or3-text-muted)"
                >
                    {{ pending.length }}
                </span>
            </div>
            <ul v-if="pending.length" class="space-y-1">
                <li v-for="job in pending.slice(0, 4)" :key="job.job_id">
                    <button
                        type="button"
                        class="or3-focus-ring or3-pressable flex w-full items-center justify-between gap-2 rounded-xl px-2 py-1.5 text-left text-xs hover:bg-(--or3-surface-soft)"
                        @click="$emit('open', job)"
                    >
                        <span
                            class="min-w-0 flex-1 truncate text-(--or3-text)"
                            >{{ titleFor(job) }}</span
                        >
                        <span
                            class="flex shrink-0 items-center gap-1 text-(--or3-text-muted)"
                        >
                            <span
                                class="size-1.5 rounded-full bg-(--or3-amber)"
                            />
                            Queued
                        </span>
                    </button>
                </li>
            </ul>
            <p v-else class="text-xs text-(--or3-text-muted)">
                Nothing waiting in line.
            </p>
        </SurfaceCard>

        <SurfaceCard class-name="space-y-3">
            <div class="flex items-center justify-between gap-2">
                <p
                    class="flex items-center gap-1.5 font-mono text-sm font-semibold text-(--or3-text)"
                >
                    <Icon
                        name="i-pixelarticons-checkbox-on"
                        class="size-4 text-(--or3-green)"
                    />
                    Recent
                </p>
                <span
                    class="rounded-full bg-(--or3-green-soft) px-2 py-0.5 text-xs font-semibold text-(--or3-green-dark)"
                >
                    {{ recent.length }}
                </span>
            </div>
            <ul v-if="recent.length" class="space-y-1">
                <li v-for="job in recent.slice(0, 4)" :key="job.job_id">
                    <button
                        type="button"
                        class="or3-focus-ring or3-pressable flex w-full items-center justify-between gap-2 rounded-xl px-2 py-1.5 text-left text-xs hover:bg-(--or3-surface-soft)"
                        @click="$emit('open', job)"
                    >
                        <span
                            class="min-w-0 flex-1 truncate text-(--or3-text)"
                            >{{ titleFor(job) }}</span
                        >
                        <span
                            :class="[
                                'flex shrink-0 items-center gap-1',
                                toneFor(job),
                            ]"
                        >
                            <Icon :name="iconFor(job)" class="size-3" />
                            {{ labelFor(job) }}
                        </span>
                    </button>
                </li>
            </ul>
            <p v-else class="text-xs text-(--or3-text-muted)">
                Finished tasks show up here.
            </p>
        </SurfaceCard>
    </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import type { JobSnapshot } from '~/types/or3-api';
import { formatAgentCliKind } from '~/utils/or3/jobs';

const props = defineProps<{
    pending: JobSnapshot[];
    /** Combined completed/failed/aborted history (newest first). */
    recent?: JobSnapshot[];
    /** Backwards-compat: only completed jobs. */
    completed?: JobSnapshot[];
}>();

defineEmits<{ open: [job: JobSnapshot] }>();

const recent = computed<JobSnapshot[]>(
    () => props.recent ?? props.completed ?? [],
);

function titleFor(job: JobSnapshot) {
    if (job.title) return job.title;
    if (job.task) return job.task;
    return formatAgentCliKind(job.kind);
}

function labelFor(job: JobSnapshot) {
    switch (job.status) {
        case 'completed':
            return 'Done';
        case 'failed':
            return 'Failed';
        case 'aborted':
            return 'Cancelled';
        default:
            return job.status;
    }
}

function iconFor(job: JobSnapshot) {
    switch (job.status) {
        case 'completed':
            return 'i-pixelarticons-check';
        case 'failed':
            return 'i-pixelarticons-close';
        case 'aborted':
            return 'i-pixelarticons-undo';
        default:
            return 'i-pixelarticons-clock';
    }
}

function toneFor(job: JobSnapshot) {
    switch (job.status) {
        case 'completed':
            return 'text-(--or3-green-dark)';
        case 'failed':
            return 'text-(--or3-danger)';
        case 'aborted':
            return 'text-(--or3-text-muted)';
        default:
            return 'text-(--or3-text-muted)';
    }
}
</script>
