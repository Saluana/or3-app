<template>
    <div class="or3-activity-list space-y-4">
        <SurfaceCard class-name="or3-activity-toolbar" padded>
            <div class="space-y-3">
                <div class="relative">
                    <Icon
                        name="i-pixelarticons-search"
                        class="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-(--or3-text-muted)"
                    />
                    <input
                        v-model="searchInput"
                        type="search"
                        enterkeyhint="search"
                        class="or3-focus-ring w-full rounded-xl border border-(--or3-border) bg-(--or3-surface) py-2 pl-10 pr-9 font-mono text-sm text-(--or3-text) placeholder:text-(--or3-text-muted)"
                        placeholder="Search tasks, runners, results…"
                        aria-label="Search agent activity"
                    />
                    <button
                        v-if="searchInput.trim()"
                        type="button"
                        class="or3-focus-ring absolute right-2 top-1/2 grid size-7 -translate-y-1/2 place-items-center rounded-full text-(--or3-text-muted) hover:bg-(--or3-surface-soft) hover:text-(--or3-text)"
                        aria-label="Clear search"
                        @click="clearSearch"
                    >
                        <Icon name="i-pixelarticons-close" class="size-3.5" />
                    </button>
                </div>

                <div
                    class="-mx-1 flex gap-1.5 overflow-x-auto px-1 pb-0.5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
                >
                    <button
                        v-for="chip in statusChips"
                        :key="chip.value"
                        type="button"
                        class="or3-chip shrink-0 whitespace-nowrap"
                        :class="{ 'is-active': selectedStatus === chip.value }"
                        :aria-pressed="selectedStatus === chip.value"
                        @click="$emit('change-status', chip.value)"
                    >
                        {{ chip.label }}
                    </button>
                </div>

                <div
                    class="flex flex-col gap-2 border-t border-(--or3-border) pt-3 sm:flex-row sm:items-center sm:justify-between"
                >
                    <div
                        class="flex min-w-0 flex-1 flex-col gap-2 sm:flex-row sm:items-center"
                    >
                        <label class="sr-only" for="activity-runner-filter">
                            Filter by runner
                        </label>
                        <select
                            id="activity-runner-filter"
                            :value="selectedRunner"
                            class="or3-focus-ring w-full rounded-xl border border-(--or3-border) bg-(--or3-surface) px-3 py-2 font-mono text-sm text-(--or3-text) sm:max-w-[11rem]"
                            @change="
                                $emit(
                                    'change-runner',
                                    ($event.target as HTMLSelectElement)
                                        .value,
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
                        <button
                            type="button"
                            class="or3-chip shrink-0 self-start whitespace-nowrap"
                            :class="{ 'is-active': hideReviewed }"
                            :aria-pressed="hideReviewed"
                            @click="
                                $emit('change-hide-reviewed', !hideReviewed)
                            "
                        >
                            Hide reviewed
                        </button>
                    </div>

                    <div
                        class="flex shrink-0 items-center justify-between gap-2 sm:justify-end"
                    >
                        <span
                            class="font-mono text-[11px] tabular-nums text-(--or3-text-muted)"
                        >
                            {{ visibleCount }}
                            {{ visibleCount === 1 ? 'job' : 'jobs' }}
                        </span>
                        <button
                            v-if="hasActiveFilters"
                            type="button"
                            class="or3-focus-ring font-mono text-[11px] font-semibold text-(--or3-green-dark)"
                            @click="clearFilters"
                        >
                            Clear filters
                        </button>
                    </div>
                </div>
            </div>
        </SurfaceCard>

        <div
            v-if="loading"
            class="flex items-center gap-2 rounded-2xl border border-(--or3-border) bg-(--or3-surface-soft) px-4 py-3 font-mono text-sm text-(--or3-text-muted)"
        >
            <Icon name="i-pixelarticons-loader" class="size-4 animate-spin" />
            Refreshing…
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
                class="or3-focus-ring shrink-0 rounded-xl border border-(--or3-border) bg-(--or3-surface) px-3 py-1.5 font-mono text-sm font-semibold"
                @click="$emit('retry')"
            >
                Retry
            </button>
        </div>

        <EmptyState
            v-else-if="isEmpty"
            icon="i-pixelarticons-robot"
            :title="emptyTitle"
            :description="emptyDescription"
        />

        <div v-else class="space-y-5">
            <section
                v-if="showResultsSection && resultJobsList.length"
                class="space-y-2"
            >
                <p class="or3-activity-section-label">Results</p>
                <ul class="m-0 list-none space-y-1 p-0">
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
                                    class="mt-1 line-clamp-2 text-xs leading-relaxed"
                                    :class="
                                        normalizeStatus(job.status) ===
                                        'failed'
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

            <section
                v-for="group in groups"
                :key="group.key"
                class="space-y-2"
            >
                <p class="or3-activity-section-label">{{ group.label }}</p>
                <ul class="m-0 list-none space-y-1 p-0">
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
                                        normalizeStatus(job.status) ===
                                        'failed'
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
import { computed, onBeforeUnmount, ref, watch } from 'vue';
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

const emit = defineEmits<{
    open: [job: JobSnapshot];
    'change-status': [status: ActivityStatusFilter];
    'change-runner': [runnerId: string];
    search: [query: string];
    'change-hide-reviewed': [hide: boolean];
    retry: [];
}>();

const searchInput = ref(props.query);
let searchDebounce: ReturnType<typeof setTimeout> | null = null;

watch(
    () => props.query,
    (value) => {
        if (value !== searchInput.value) searchInput.value = value;
    },
);

watch(searchInput, (value) => {
    if (searchDebounce) clearTimeout(searchDebounce);
    searchDebounce = setTimeout(() => emit('search', value), 100);
});

onBeforeUnmount(() => {
    if (searchDebounce) clearTimeout(searchDebounce);
});

const statusChips: Array<{ label: string; value: ActivityStatusFilter }> = [
    { label: 'All', value: 'all' },
    { label: 'Running', value: 'running' },
    { label: 'Queued', value: 'queued' },
    { label: 'Done', value: 'completed' },
    { label: 'Failed', value: 'failed' },
    { label: 'Cancelled', value: 'cancelled' },
];

const resultJobsList = computed(() => props.resultJobs ?? []);

const visibleCount = computed(() => {
    const grouped = props.groups.reduce((n, g) => n + g.jobs.length, 0);
    const highlighted = props.showResultsSection
        ? resultJobsList.value.length
        : 0;
    return grouped + highlighted;
});

const isEmpty = computed(
    () => !props.loading && !props.error && visibleCount.value === 0,
);

const hasActiveFilters = computed(
    () =>
        props.selectedStatus !== 'all' ||
        props.selectedRunner !== 'all' ||
        props.hideReviewed ||
        searchInput.value.trim().length > 0,
);

const emptyTitle = computed(() =>
    props.hasAnyJobs ? 'No jobs match these filters' : 'No agent activity yet',
);

const emptyDescription = computed(() =>
    props.hasAnyJobs
        ? 'Try a different search term or clear filters.'
        : 'Delegate a task from the command center and it will show up here.',
);

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

function clearSearch() {
    searchInput.value = '';
    emit('search', '');
}

function clearFilters() {
    clearSearch();
    emit('change-status', 'all');
    emit('change-runner', 'all');
    if (props.hideReviewed) emit('change-hide-reviewed', false);
}
</script>

<style scoped>
.or3-activity-toolbar {
    padding-top: 0.85rem;
    padding-bottom: 0.85rem;
}

.or3-activity-section-label {
    font-family: var(--font-mono, ui-monospace, monospace);
    font-size: 11px;
    font-weight: 600;
    letter-spacing: 0.14em;
    text-transform: uppercase;
    color: var(--or3-text-muted);
}
</style>
