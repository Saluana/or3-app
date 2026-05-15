import type { RecentJobSummary } from '~/types/app-state';
import type {
    JobSnapshot,
    PersistedAgentCliJob,
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
 * - `timed_out` → `failed`
 * - `starting` → `running`
 * - unknown values fall back to `queued` so they still render somewhere safe.
 */
export function normalizeStatus(status: string | undefined): AgentJobUiStatus {
    const value = (status ?? '').trim().toLowerCase();
    switch (value) {
        case 'queued':
            return 'queued';
        case 'running':
        case 'started':
        case 'starting':
            return 'running';
        case 'succeeded':
        case 'completed':
        case 'complete':
            return 'completed';
        case 'failed':
        case 'error':
        case 'timed_out':
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
        runner_id: next.runner_id ?? existing.runner_id,
        runner_label: next.runner_label ?? existing.runner_label,
        mode: next.mode ?? existing.mode,
        isolation: next.isolation ?? existing.isolation,
        model: next.model ?? existing.model,
        cwd: next.cwd ?? existing.cwd,
        stdout_preview: next.stdout_preview ?? existing.stdout_preview,
        stderr_preview: next.stderr_preview ?? existing.stderr_preview,
        output_preview: next.output_preview ?? existing.output_preview,
        error_preview: next.error_preview ?? existing.error_preview,
        raw_events: next.raw_events ?? existing.raw_events,
        structured_events: next.structured_events ?? existing.structured_events,
        output_truncated: next.output_truncated ?? existing.output_truncated,
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
        runner_id: summary.runner_id,
        runner_label: summary.runner_label,
        mode: summary.mode,
        isolation: summary.isolation,
        model: summary.model,
        cwd: summary.cwd,
        stdout_preview: summary.stdout_preview,
        stderr_preview: summary.stderr_preview,
        output_preview: summary.output_preview,
        error_preview: summary.error_preview,
        raw_events: summary.raw_events,
        structured_events: summary.structured_events,
        output_truncated: summary.output_truncated,
    };
}

export function persistedStatusToUi(
    status: PersistedSubagentStatus,
): AgentJobUiStatus {
    return normalizeStatus(status);
}

/**
 * Returns true when the job kind indicates an external CLI runner.
 */
export function isCliJob(kind?: string): boolean {
    return (kind ?? '').startsWith('agent_cli:');
}

/**
 * Human-readable label for a runner id.
 */
export function runnerLabel(runnerId?: string): string {
    switch (runnerId) {
        case 'or3-intern':
            return 'or3-intern';
        case 'opencode':
            return 'OpenCode';
        case 'codex':
            return 'Codex';
        case 'claude':
            return 'Claude';
        case 'gemini':
            return 'Gemini';
        default:
            return runnerId || 'External CLI';
    }
}

/**
 * Format a `kind` string like `agent_cli:codex` into a user-facing label
 * such as "Codex task".
 */
export function formatAgentCliKind(kind?: string): string {
    if (!kind) return 'Agent task';
    if (!isCliJob(kind)) {
        if (kind === 'subagent' || kind === 'agent') return 'Agent task';
        return kind.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
    }
    const runnerId = kind.slice('agent_cli:'.length);
    const label = runnerLabel(runnerId);
    return `${label} task`;
}

/**
 * Convert a persisted external CLI job into a UI summary.
 */
export function persistedAgentCliJobToSummary(
    job: PersistedAgentCliJob,
): RecentJobSummary {
    const status = normalizeStatus(job.status);
    const kind = job.kind || `agent_cli:${job.runner_id}`;
    const updatedAt =
        job.updated_at ||
        job.completed_at ||
        job.started_at ||
        job.requested_at ||
        new Date().toISOString();
    return {
        job_id: job.job_id,
        kind,
        status,
        title: job.task || formatAgentCliKind(kind),
        task: job.task,
        updated_at: updatedAt,
        final_text: job.final_text_preview || job.stdout_preview,
        error:
            (status === 'failed' || status === 'aborted'
                ? job.error || job.stderr_preview
                : undefined),
        parent_session_key: job.parent_session_key,
        created_at: job.requested_at,
        started_at: job.started_at,
        finished_at: job.completed_at,
        runner_id: job.runner_id,
        runner_label: runnerLabel(job.runner_id),
        mode: job.mode,
        isolation: job.isolation,
        model: job.model,
        cwd: job.cwd,
        stdout_preview: job.stdout_preview,
        stderr_preview: job.stderr_preview,
        source: 'persisted',
    };
}

