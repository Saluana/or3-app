import type { JobSnapshot } from '~/types/or3-api';
import {
    formatAgentCliKind,
    isActiveStatus,
    isCliJob,
    normalizeStatus,
    runnerLabel,
} from '~/utils/or3/jobs';

export type ActivityStatusFilter =
    | 'all'
    | 'running'
    | 'queued'
    | 'completed'
    | 'failed'
    | 'cancelled';

export interface JobDateGroup {
    key: string;
    label: string;
    jobs: JobSnapshot[];
}

export interface AgentCommandDraft {
    task: string;
    category?: string;
    priority?: string;
    notify?: string;
    runnerId?: string;
    mode?: string;
    model?: string;
    cwd?: string;
    maxTurns?: number;
    autoApprove?: boolean;
}

const STALE_MS = 5 * 60 * 1000;

export function jobDisplayTitle(job: JobSnapshot): string {
    if (job.title?.trim()) return job.title.trim();
    if (job.task?.trim()) return job.task.trim();
    return formatAgentCliKind(job.kind);
}

export function jobRunnerDisplay(job: JobSnapshot): string {
    return job.runner_label || runnerLabel(job.runner_id) || 'or3-intern';
}

export function sortJobsByUpdated(jobs: JobSnapshot[]): JobSnapshot[] {
    return [...jobs].sort((a, b) => {
        const ta = Date.parse(a.updated_at || a.created_at || '') || 0;
        const tb = Date.parse(b.updated_at || b.created_at || '') || 0;
        return tb - ta;
    });
}

export function jobMatchesSearch(job: JobSnapshot, query: string): boolean {
    const q = query.trim().toLowerCase();
    if (!q) return true;
    const haystack = [
        job.title,
        job.task,
        job.final_text,
        job.error,
        job.stdout_preview,
        job.stderr_preview,
        job.error_preview,
        job.runner_id,
        job.runner_label,
        job.status,
        job.category,
    ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();
    return haystack.includes(q);
}

export function filterJobsByStatus(
    jobs: JobSnapshot[],
    filter: ActivityStatusFilter,
): JobSnapshot[] {
    if (filter === 'all') return jobs;
    return jobs.filter((job) => {
        const status = normalizeStatus(job.status);
        switch (filter) {
            case 'running':
                return status === 'running';
            case 'queued':
                return status === 'queued';
            case 'completed':
                return status === 'completed';
            case 'failed':
                return status === 'failed';
            case 'cancelled':
                return status === 'aborted';
            default:
                return true;
        }
    });
}

export function filterJobsByRunner(
    jobs: JobSnapshot[],
    runnerId: string | 'all',
): JobSnapshot[] {
    if (runnerId === 'all') return jobs;
    return jobs.filter((job) => (job.runner_id || 'or3-intern') === runnerId);
}

export function filterUnreviewedJobs(
    jobs: JobSnapshot[],
    reviewedIds: Set<string>,
    hideReviewed: boolean,
): JobSnapshot[] {
    if (!hideReviewed) return jobs;
    return jobs.filter((job) => !reviewedIds.has(job.job_id));
}

export function buildRunnerFilterOptions(
    jobs: JobSnapshot[],
): Array<{ id: string; label: string }> {
    const ids = new Set<string>();
    for (const job of jobs) {
        ids.add(job.runner_id || 'or3-intern');
    }
    const sorted = [...ids].sort((a, b) => {
        if (a === 'or3-intern') return -1;
        if (b === 'or3-intern') return 1;
        return a.localeCompare(b);
    });
    return sorted.map((id) => ({ id, label: runnerLabel(id) }));
}

function startOfDay(date: Date): Date {
    const d = new Date(date);
    d.setHours(0, 0, 0, 0);
    return d;
}

export function dateGroupLabel(
    updatedAt: string | undefined,
    now = new Date(),
): string {
    const ms = Date.parse(updatedAt || '');
    if (!ms) return 'Earlier';
    const date = new Date(ms);
    const today = startOfDay(now);
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    const weekStart = new Date(today);
    weekStart.setDate(weekStart.getDate() - 6);
    const day = startOfDay(date);
    if (day.getTime() === today.getTime()) return 'Today';
    if (day.getTime() === yesterday.getTime()) return 'Yesterday';
    if (day.getTime() >= weekStart.getTime()) return 'Earlier this week';
    return date.toLocaleDateString(undefined, {
        month: 'short',
        day: 'numeric',
        year: date.getFullYear() !== now.getFullYear() ? 'numeric' : undefined,
    });
}

export function groupJobsByDate(
    jobs: JobSnapshot[],
    now = new Date(),
): JobDateGroup[] {
    const groups = new Map<string, JobDateGroup>();
    for (const job of jobs) {
        const label = dateGroupLabel(job.updated_at || job.created_at, now);
        const key = label;
        const existing = groups.get(key);
        if (existing) {
            existing.jobs.push(job);
        } else {
            groups.set(key, { key, label, jobs: [job] });
        }
    }
    const order = ['Today', 'Yesterday', 'Earlier this week'];
    return [...groups.values()].sort((a, b) => {
        const ai = order.indexOf(a.label);
        const bi = order.indexOf(b.label);
        if (ai !== -1 || bi !== -1) {
            if (ai === -1) return 1;
            if (bi === -1) return -1;
            return ai - bi;
        }
        const ta = Date.parse(a.jobs[0]?.updated_at || '') || 0;
        const tb = Date.parse(b.jobs[0]?.updated_at || '') || 0;
        return tb - ta;
    });
}

export function formatElapsed(
    startIso: string | undefined,
    endIso: string | undefined,
    nowMs: number = Date.now(),
): string {
    const start = Date.parse(startIso || '');
    if (!start || Number.isNaN(start)) return '—';
    const end = endIso ? Date.parse(endIso) : nowMs;
    const totalSeconds = Math.max(0, Math.floor((end - start) / 1000));
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;
    if (hours > 0) return `${hours}h ${minutes}m`;
    if (minutes > 0) return `${minutes}m`;
    return `${seconds}s`;
}

export function minutesSinceUpdate(
    job: JobSnapshot,
    nowMs: number = Date.now(),
): number | null {
    const ms = Date.parse(job.updated_at || job.created_at || '');
    if (!ms || Number.isNaN(ms)) return null;
    return Math.floor((nowMs - ms) / 60_000);
}

export function isStaleJob(job: JobSnapshot, nowMs: number = Date.now()): boolean {
    if (!isActiveStatus(job.status)) return false;
    const ms = Date.parse(job.updated_at || job.created_at || '');
    if (!ms || Number.isNaN(ms)) return false;
    return nowMs - ms >= STALE_MS;
}

export function isAttentionStatus(job: JobSnapshot): boolean {
    const status = normalizeStatus(job.status);
    if (status === 'failed') return true;
    if (job.error?.trim()) return true;
    if (job.error_preview?.trim()) return true;
    if (isStaleJob(job)) return true;
    const runner = (job.runner_id || 'or3-intern').toLowerCase();
    if (runner !== 'or3-intern' && status === 'queued' && !job.started_at) {
        return true;
    }
    return false;
}

export function activeStatusLabel(job: JobSnapshot): string {
    const status = normalizeStatus(job.status);
    if (status === 'queued') return 'Queued';
    if (status === 'failed') return 'Failed';
    if (status === 'aborted') return 'Cancelled';
    if (isAttentionStatus(job) && status === 'running') return 'Needs attention';
    if (status === 'running') return 'Working';
    return 'Working';
}

export function lastActivityPreview(job: JobSnapshot, maxLen = 120): string {
    if (job.error?.trim()) return job.error.trim().slice(0, maxLen);
    if (job.error_preview?.trim()) return job.error_preview.trim().slice(0, maxLen);
    if (job.final_text?.trim()) return job.final_text.trim().slice(0, maxLen);
    if (isCliJob(job.kind) && job.stdout_preview?.trim()) {
        return job.stdout_preview.trim().slice(0, maxLen);
    }
    if (isCliJob(job.kind) && job.stderr_preview?.trim()) {
        return job.stderr_preview.trim().slice(0, maxLen);
    }
    const events = job.structured_events ?? job.raw_events;
    if (Array.isArray(events) && events.length > 0) {
        const last = events[events.length - 1] as Record<string, unknown>;
        const text =
            (typeof last.message === 'string' && last.message) ||
            (typeof last.text === 'string' && last.text) ||
            (typeof last.summary === 'string' && last.summary) ||
            '';
        if (text.trim()) return text.trim().slice(0, maxLen);
    }
    if (job.status === 'queued') return 'Waiting to start';
    return 'Working on your request';
}

export function jobToCommandDraft(job: JobSnapshot): AgentCommandDraft {
    const category = (job.category || 'general') as AgentCommandDraft['category'];
    return {
        task: job.task || job.title || '',
        category,
        priority: job.priority,
        notify: job.notify,
        runnerId: job.runner_id || 'or3-intern',
        mode: job.mode,
        model: job.model,
        cwd: job.cwd,
        autoApprove: job.autoApprove,
    };
}

export function formatRelativeTime(iso?: string, now = new Date()): string {
    const ms = Date.parse(iso || '');
    if (!ms) return '';
    const d = new Date(ms);
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

export function activityStatusLabel(status: string | undefined): string {
    switch (normalizeStatus(status)) {
        case 'queued':
            return 'Queued';
        case 'running':
            return 'Working';
        case 'completed':
            return 'Completed';
        case 'failed':
            return 'Failed';
        case 'aborted':
            return 'Cancelled';
        default:
            return status || '';
    }
}

export function resultPreviewForList(job: JobSnapshot, maxLen = 100): string {
    if (normalizeStatus(job.status) === 'failed') {
        const err =
            job.error?.trim() ||
            job.error_preview?.trim() ||
            job.stderr_preview?.trim();
        if (err) return err.slice(0, maxLen);
    }
    const text =
        job.final_text?.trim() ||
        job.stdout_preview?.trim() ||
        job.output_preview?.trim();
    if (text) return text.slice(0, maxLen);
    return '';
}
