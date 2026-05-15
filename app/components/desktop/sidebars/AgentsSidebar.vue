<template>
    <DesktopSecondarySidebar
        :search-value="query"
        search-placeholder="Search jobs…"
        :footer-text="`${filteredJobs.length} job${filteredJobs.length === 1 ? '' : 's'}`"
        :on-refresh="onRefresh"
        scroll-key="agents"
        @update:search-value="onSearch"
    >
        <template #filters>
            <button
                v-for="filter in filters"
                :key="filter.value"
                type="button"
                class="or3-chip"
                :class="{ 'is-active': activeFilter === filter.value }"
                :aria-pressed="activeFilter === filter.value"
                @click="activeFilter = filter.value"
            >
                {{ filter.label }}
            </button>
        </template>

        <p
            v-if="filteredJobs.length"
            class="or3-desktop-side-section-label"
        >
            Recent jobs
        </p>
        <button
            v-for="job in filteredJobs"
            :key="job.job_id"
            type="button"
            class="or3-desktop-list-item"
            @click="emit('open-job', job.job_id)"
        >
            <span class="or3-desktop-list-item__title-row">
                <span class="or3-desktop-list-item__title">
                    <span
                        class="inline-block size-2 rounded-full"
                        :class="statusDotClass(job.status)"
                    />
                    {{ jobTitle(job) }}
                </span>
                <span class="or3-desktop-list-item__meta">{{
                    formatStatus(job.status)
                }}</span>
            </span>
            <p class="or3-desktop-list-item__preview">
                {{ job.runner_id || 'or3-intern' }} · {{ formatTime(job) }}
            </p>
        </button>

        <div
            v-if="!filteredJobs.length"
            class="px-4 py-10 text-center font-mono text-xs text-(--or3-text-muted)"
        >
            No jobs yet.
            <br />
            Delegate a task from the command center.
        </div>
    </DesktopSecondarySidebar>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue';
import type { JobSnapshot } from '~/types/or3-api';

const props = defineProps<{
    jobs: JobSnapshot[];
    onRefresh?: () => void;
}>();

const emit = defineEmits<{
    'open-job': [id: string];
}>();

const query = ref('');
const activeFilter = ref<'all' | 'active' | 'completed'>('all');

const filters = [
    { label: 'All', value: 'all' as const },
    { label: 'Active', value: 'active' as const },
    { label: 'Completed', value: 'completed' as const },
];

const sortedJobs = computed(() =>
    [...(props.jobs || [])].sort((a, b) => {
        const ta = Date.parse(a.updated_at || a.created_at || '') || 0;
        const tb = Date.parse(b.updated_at || b.created_at || '') || 0;
        return tb - ta;
    }),
);

const filteredJobs = computed(() => {
    const q = query.value.trim().toLowerCase();
    return sortedJobs.value.filter((job) => {
        if (activeFilter.value === 'active') {
            if (!isActiveStatus(job.status)) return false;
        } else if (activeFilter.value === 'completed') {
            if (isActiveStatus(job.status)) return false;
        }
        if (!q) return true;
        return [job.title, job.task, job.runner_id, job.status]
            .filter(Boolean)
            .join(' ')
            .toLowerCase()
            .includes(q);
    });
});

function isActiveStatus(status?: string | null) {
    if (!status) return false;
    const s = status.toLowerCase();
    return (
        s === 'queued' ||
        s === 'pending' ||
        s === 'running' ||
        s === 'in_progress'
    );
}

function statusDotClass(status?: string | null) {
    if (isActiveStatus(status)) return 'bg-(--or3-amber)';
    const s = (status || '').toLowerCase();
    if (s === 'failed' || s === 'error' || s === 'cancelled')
        return 'bg-(--or3-danger)';
    return 'bg-(--or3-green)';
}

function jobTitle(job: JobSnapshot) {
    const t = job.title || job.task || `Job ${job.job_id.slice(0, 8)}`;
    return t.length > 64 ? t.slice(0, 64) + '…' : t;
}

function formatStatus(status?: string | null) {
    if (!status) return '';
    return status
        .split('_')
        .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
        .join(' ');
}

function formatTime(job: JobSnapshot) {
    const ms = Date.parse(job.updated_at || job.created_at || '');
    if (!ms) return '';
    const d = new Date(ms);
    const now = new Date();
    if (d.toDateString() === now.toDateString()) {
        return d.toLocaleTimeString(undefined, {
            hour: 'numeric',
            minute: '2-digit',
        });
    }
    const diffDays = Math.floor((now.getTime() - ms) / 86_400_000);
    if (diffDays < 7) {
        return d.toLocaleDateString(undefined, { weekday: 'short' });
    }
    return d.toLocaleDateString(undefined, {
        month: 'short',
        day: 'numeric',
    });
}

function onSearch(value: string) {
    query.value = value;
}
</script>
