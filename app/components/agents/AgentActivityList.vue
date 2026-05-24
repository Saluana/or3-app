<template>
    <div class="space-y-4">
        <div class="space-y-3">
            <div class="relative">
                <Icon
                    name="i-pixelarticons-search"
                    class="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-(--or3-text-muted)"
                />
                <input
                    :value="query"
                    type="search"
                    class="or3-focus-ring w-full rounded-2xl border border-(--or3-border) bg-(--or3-surface) py-2.5 pl-10 pr-3 font-mono text-sm text-(--or3-text) placeholder:text-(--or3-text-muted)"
                    placeholder="Search tasks, results, errors…"
                    aria-label="Search agent activity"
                    @input="
                        $emit(
                            'search',
                            ($event.target as HTMLInputElement).value,
                        )
                    "
                />
            </div>

            <div class="-mx-1 flex flex-wrap gap-2 px-1">
                <button
                    v-for="chip in statusChips"
                    :key="chip.value"
                    type="button"
                    class="or3-chip"
                    :class="{ 'is-active': selectedStatus === chip.value }"
                    :aria-pressed="selectedStatus === chip.value"
                    @click="$emit('change-status', chip.value)"
                >
                    {{ chip.label }}
                </button>
            </div>

            <div class="flex flex-wrap items-center gap-2">
                <label
                    class="font-mono text-[11px] font-semibold tracking-[0.14em] text-(--or3-text-muted)"
                >
                    RUNNER
                </label>
                <select
                    :value="selectedRunner"
                    class="or3-focus-ring min-w-0 flex-1 rounded-xl border border-(--or3-border) bg-(--or3-surface) px-3 py-2 font-mono text-sm text-(--or3-text) sm:max-w-xs"
                    aria-label="Filter by runner"
                    @change="
                        $emit(
                            'change-runner',
                            ($event.target as HTMLSelectElement).value,
                        )
                    "
                >
                    <option value="all">All runners</option>
                    <option
                        v-for="runner in runnerOptions"
                        :key="runner.id"
                        :value="runner.id"
                    >
                        {{ runner.label }}
                    </option>
                </select>
                <label
                    class="inline-flex items-center gap-2 font-mono text-[11px] text-(--or3-text-muted)"
                >
                    <input
                        type="checkbox"
                        class="size-3.5 rounded border-(--or3-border)"
                        :checked="hideReviewed"
                        @change="
                            $emit(
                                'change-hide-reviewed',
                                ($event.target as HTMLInputElement).checked,
                            )
                        "
                    />
                    Hide reviewed
                </label>
            </div>
        </div>

        <div
            v-if="loading"
            class="flex items-center gap-2 rounded-2xl border border-(--or3-border) bg-(--or3-surface-soft) px-4 py-3 font-mono text-sm text-(--or3-text-muted)"
        >
            <Icon name="i-pixelarticons-loader" class="size-4 animate-spin" />
            Refreshing activity…
        </div>

        <div
            v-else-if="error"
            class="flex flex-col gap-3 rounded-2xl border border-(--or3-amber)/40 bg-(--or3-amber)/10 px-4 py-3 sm:flex-row sm:items-center sm:justify-between"
        >
            <p class="font-mono text-sm text-(--or3-text)">
                Couldn’t refresh jobs. Showing cached activity.
            </p>
            <button
                type="button"
                class="or3-focus-ring shrink-0 rounded-xl border border-(--or3-border) bg-(--or3-surface) px-3 py-1.5 font-mono text-sm font-semibold text-(--or3-text)"
                @click="$emit('retry')"
            >
                Retry
            </button>
        </div>

        <EmptyState
            v-if="!loading && !groups.length && !error"
            icon="i-pixelarticons-robot"
            :title="emptyTitle"
            :description="emptyDescription"
        />

        <div v-else-if="groups.length" class="space-y-5">
            <section
                v-if="showResultsSection && resultJobsList.length"
                class="space-y-2"
            >
                <p
                    class="or3-label text-[11px] font-semibold tracking-[0.18em] text-(--or3-text-muted)"
                >
                    RESULTS
                </p>
                <ul class="space-y-1">
                    <li
                        v-for="job in resultJobsList"
                        :key="`result-${job.job_id}`"
                    >
                        <button
                            type="button"
                            class="or3-focus-ring or3-pressable flex w-full gap-3 rounded-2xl border border-(--or3-border) bg-(--or3-surface) px-3 py-2.5 text-left transition hover:bg-(--or3-surface-soft)"
                            @click="$emit('open', job)"
                        >
                            <span
                                class="mt-1.5 size-2 shrink-0 rounded-full"
                                :class="statusDotClass(job.status)"
                            />
                            <div class="min-w-0 flex-1">
                                <p
                                    class="line-clamp-2 font-mono text-sm font-semibold leading-snug text-(--or3-text)"
                                >
                                    {{ jobDisplayTitle(job) }}
                                </p>
                                <p
                                    class="mt-0.5 text-[11px] text-(--or3-text-muted)"
                                >
                                    {{ jobRunnerDisplay(job) }} ·
                                    {{ activityStatusLabel(job.status) }}
                                    <span v-if="isReviewed(job.job_id)">
                                        · Reviewed</span
                                    >
                                </p>
                                <p
                                    v-if="resultPreviewForList(job)"
                                    class="mt-1 line-clamp-2 text-xs leading-relaxed text-(--or3-text-muted)"
                                >
                                    {{ resultPreviewForList(job) }}
                                </p>
                            </div>
                            <span
                                class="shrink-0 self-start pt-0.5 font-mono text-[11px] tabular-nums text-(--or3-text-muted)"
                            >
                                {{
                                    formatRelativeTime(
                                        job.updated_at || job.created_at,
                                    )
                                }}
                            </span>
                        </button>
                    </li>
                </ul>
            </section>

            <section
                v-for="group in groups"
                :key="group.key"
                class="space-y-2"
            >
                <p
                    class="or3-label text-[11px] font-semibold tracking-[0.18em] text-(--or3-text-muted)"
                >
                    {{ group.label.toUpperCase() }}
                </p>
                <ul class="space-y-1">
                    <li v-for="job in group.jobs" :key="job.job_id">
                        <button
                            type="button"
                            class="or3-focus-ring or3-pressable flex w-full gap-3 rounded-2xl border border-(--or3-border) bg-(--or3-surface) px-3 py-2.5 text-left transition hover:bg-(--or3-surface-soft)"
                            @click="$emit('open', job)"
                        >
                            <span
                                class="mt-1.5 size-2 shrink-0 rounded-full"
                                :class="statusDotClass(job.status)"
                            />
                            <div class="min-w-0 flex-1">
                                <p
                                    class="line-clamp-2 font-mono text-sm font-semibold leading-snug text-(--or3-text)"
                                >
                                    {{ jobDisplayTitle(job) }}
                                </p>
                                <p
                                    class="mt-0.5 text-[11px] text-(--or3-text-muted)"
                                >
                                    {{ jobRunnerDisplay(job) }} ·
                                    {{ activityStatusLabel(job.status) }}
                                    <span v-if="isReviewed(job.job_id)">
                                        · Reviewed</span
                                    >
                                </p>
                                <p
                                    v-if="resultPreviewForList(job)"
                                    class="mt-1 line-clamp-2 text-xs leading-relaxed"
                                    :class="
                                        normalizeStatus(job.status) === 'failed'
                                            ? 'text-(--or3-danger)/90'
                                            : 'text-(--or3-text-muted)'
                                    "
                                >
                                    {{ resultPreviewForList(job) }}
                                </p>
                            </div>
                            <span
                                class="shrink-0 self-start pt-0.5 font-mono text-[11px] tabular-nums text-(--or3-text-muted)"
                            >
                                {{
                                    formatRelativeTime(
                                        job.updated_at || job.created_at,
                                    )
                                }}
                            </span>
                        </button>
                    </li>
                </ul>
            </section>
        </div>
    </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import type { JobSnapshot } from '~/types/or3-api';
import type { ActivityStatusFilter, JobDateGroup } from '~/utils/or3/agent-jobs';
import {
    activityStatusLabel,
    formatRelativeTime,
    jobDisplayTitle,
    jobRunnerDisplay,
    resultPreviewForList,
} from '~/utils/or3/agent-jobs';
import { normalizeStatus } from '~/utils/or3/jobs';

const props = defineProps<{
    groups: JobDateGroup[];
    resultJobs?: JobSnapshot[];
    showResultsSection?: boolean;
    loading?: boolean;
    error?: string | null;
    selectedStatus: ActivityStatusFilter;
    selectedRunner: string;
    runnerOptions: Array<{ id: string; label: string }>;
    query: string;
    hideReviewed?: boolean;
    isReviewed: (jobId: string) => boolean;
    hasAnyJobs?: boolean;
}>();

defineEmits<{
    open: [job: JobSnapshot];
    'change-status': [status: ActivityStatusFilter];
    'change-runner': [runnerId: string];
    search: [query: string];
    'change-hide-reviewed': [hide: boolean];
    retry: [];
}>();

const statusChips: Array<{ label: string; value: ActivityStatusFilter }> = [
    { label: 'All', value: 'all' },
    { label: 'Running', value: 'running' },
    { label: 'Queued', value: 'queued' },
    { label: 'Completed', value: 'completed' },
    { label: 'Failed', value: 'failed' },
    { label: 'Cancelled', value: 'cancelled' },
];

const emptyTitle = computed(() =>
    props.hasAnyJobs ? 'No jobs match these filters' : 'No agent activity yet',
);

const emptyDescription = computed(() =>
    props.hasAnyJobs
        ? 'Try clearing filters or broadening your search.'
        : 'Delegate a task from the command center and it will show up here.',
);

const resultJobsList = computed(() => props.resultJobs ?? []);

function statusDotClass(status?: string) {
    switch (normalizeStatus(status)) {
        case 'failed':
            return 'bg-(--or3-danger)';
        case 'aborted':
            return 'bg-stone-400';
        case 'queued':
            return 'bg-(--or3-amber)';
        case 'completed':
            return 'bg-(--or3-green)';
        default:
            return 'bg-(--or3-green)';
    }
}
</script>
