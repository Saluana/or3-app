import type { RecentJobSummary } from '~/types/app-state';
import type {
    JobSnapshot,
    PersistedSubagentJob,
    PersistedSubagentStatus,
} from '~/types/or3-api';

/**
 * UI status vocabulary used across Active/Queue/History panels and the detail
 * sheet. Persisted backend statuses are normalized into this set so all
 * components can render with a single switch.
 */
export type AgentJobUiStatus =
    | 'queued'
    | 'running'
    | 'completed'
    | 'failed'
    | 'aborted';

const TERMINAL_STATUSES = new Set<AgentJobUiStatus>([
    'completed',
    'failed',
    'aborted',
]);

export function isTerminalStatus(status: string | undefined): boolean {
    if (!status) return false;
    return TERMINAL_STATUSES.has(normalizeStatus(status));
}

export function isActiveStatus(status: string | undefined): boolean {
    if (!status) return false;
    const normalized = normalizeStatus(status);
    return normalized === 'queued' || normalized === 'running';
}

/**
 * Map any backend or in-app status string to the small UI vocabulary above.
 *
 * - `succeeded` and `complete` → `completed`
 * - `interrupted` → `aborted`
 * - unknown values fall back to `queued` so they still render somewhere safe.
 */
export function normalizeStatus(status: string | undefined): AgentJobUiStatus {
    const value = (status ?? '').trim().toLowerCase();
    switch (value) {
        case 'queued':
            return 'queued';
        case 'running':
        case 'started':
            return 'running';
        case 'succeeded':
        case 'completed':
        case 'complete':
            return 'completed';
        case 'failed':
        case 'error':
            return 'failed';
        case 'aborted':
        case 'interrupted':
        case 'cancelled':
        case 'canceled':
            return 'aborted';
        default:
            return 'queued';
    }
}

/**
 * Convert a persisted backend job into a UI summary that can be merged with
 * locally cached metadata.
 */
export function persistedJobToSummary(
    job: PersistedSubagentJob,
): RecentJobSummary {
    const status = normalizeStatus(job.status);
    const updatedAt =
        job.updated_at ||
        job.finished_at ||
        job.started_at ||
        job.requested_at ||
        new Date().toISOString();
    return {
        job_id: job.job_id,
        kind: job.kind || 'subagent',
        status,
        title: job.task || 'Agent task',
        task: job.task,
        updated_at: updatedAt,
        final_text: job.result_preview,
        error: job.error,
        child_session_key: job.child_session_key,
        parent_session_key: job.parent_session_key,
        created_at: job.requested_at,
        started_at: job.started_at,
        finished_at: job.finished_at,
        artifact_id: job.artifact_id,
        source: 'persisted',
    };
}

/**
 * Merge a fresh persisted job into an existing local cache entry, preferring
 * server-truth fields (status, timestamps, preview, error) while preserving
 * UI-only metadata the user picked at submit time (category, priority,
 * notify, autoApprove).
 */
export function mergeJobSummary(
    existing: RecentJobSummary | undefined,
    next: RecentJobSummary,
): RecentJobSummary {
    if (!existing) return next;
    return {
        ...existing,
        ...next,
        title: next.title || existing.title,
        task: next.task ?? existing.task,
        final_text: next.final_text ?? existing.final_text,
        error: next.error ?? existing.error,
        category: existing.category ?? next.category,
        priority: existing.priority ?? next.priority,
        notify: existing.notify ?? next.notify,
        autoApprove: existing.autoApprove ?? next.autoApprove,
        created_at: existing.created_at ?? next.created_at,
    };
}

/**
 * Build a display snapshot from a cached summary. Components consume
 * `JobSnapshot` so the UI can use one shape regardless of source.
 */
export function summaryToSnapshot(summary: RecentJobSummary): JobSnapshot {
    return {
        job_id: summary.job_id,
        kind: summary.kind,
        status: normalizeStatus(summary.status),
        created_at: summary.created_at ?? summary.updated_at,
        updated_at: summary.updated_at,
        final_text: summary.final_text,
        error: summary.error,
        title: summary.title || summary.task,
        task: summary.task,
        category: summary.category,
        priority: summary.priority,
        notify: summary.notify,
        autoApprove: summary.autoApprove,
        started_at: summary.started_at,
        finished_at: summary.finished_at,
        child_session_key: summary.child_session_key,
        parent_session_key: summary.parent_session_key,
        artifact_id: summary.artifact_id,
    };
}

export function persistedStatusToUi(
    status: PersistedSubagentStatus,
): AgentJobUiStatus {
    return normalizeStatus(status);
}
