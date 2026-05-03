import { computed, ref, shallowRef } from 'vue';
import type { Or3AppError, RecentJobSummary } from '~/types/app-state';
import type {
    ArtifactResponse,
    JobSnapshot,
    Or3SseEvent,
    PersistedSubagentJob,
    SubagentListResponse,
    SubagentRequest,
    SubagentResponse,
} from '~/types/or3-api';
import {
    isActiveStatus,
    isTerminalStatus,
    mergeJobSummary,
    normalizeStatus,
    persistedJobToSummary,
    summaryToSnapshot,
} from '~/utils/or3/jobs';
import { useLocalCache } from './useLocalCache';
import { useOr3Api } from './useOr3Api';

export interface AgentJobUiMeta {
    task?: string;
    category?: string;
    priority?: string;
    notify?: string;
    autoApprove?: boolean;
    parent_session_key?: string;
}

const MAX_RECENT_JOBS_PER_HOST = 80;
const MAX_LIVE_STREAMS = 3;
const POLL_INTERVAL_MS = 6_000;
const HISTORY_REFRESH_MS = 45_000;

const loadingJobs = ref(false);
const lastListError = shallowRef<Or3AppError | null>(null);
const listSupported = ref(true);

interface JobTracker {
    jobId: string;
    abort: AbortController;
    polling: ReturnType<typeof setInterval> | null;
}

const trackers = new Map<string, JobTracker>();
let historyTimer: ReturnType<typeof setInterval> | null = null;
let visibilityHandler: (() => void) | null = null;

function activeHostId(cache: ReturnType<typeof useLocalCache>) {
    return cache.state.value.activeHostId ?? 'local';
}

function hostJobSummaries(cache: ReturnType<typeof useLocalCache>) {
    const hostId = activeHostId(cache);
    cache.state.value.recentJobs[hostId] ??= [];
    return cache.state.value.recentJobs[hostId];
}

function snapshotToSummary(
    job: JobSnapshot,
    base?: RecentJobSummary,
): RecentJobSummary {
    return {
        ...(base ?? {
            job_id: job.job_id,
            kind: job.kind || 'subagent',
            status: normalizeStatus(job.status),
            title: 'Agent task',
            updated_at: job.updated_at,
        }),
        job_id: job.job_id,
        kind: job.kind || base?.kind || 'subagent',
        status: normalizeStatus(job.status),
        title: base?.title || base?.task || 'Agent task',
        updated_at: job.updated_at,
        created_at: job.created_at ?? base?.created_at,
        final_text: job.final_text ?? base?.final_text,
        error: job.error ?? base?.error,
        artifact_id: job.artifact_id ?? base?.artifact_id,
        source: 'live',
    };
}

function pruneJobs(jobs: RecentJobSummary[]) {
    if (jobs.length <= MAX_RECENT_JOBS_PER_HOST) return jobs;
    const active = jobs.filter((job) => isActiveStatus(job.status));
    const terminal = jobs.filter((job) => !isActiveStatus(job.status));
    const remainingTerminalCount = Math.max(
        0,
        MAX_RECENT_JOBS_PER_HOST - active.length,
    );
    return [...active, ...terminal.slice(0, remainingTerminalCount)];
}

function upsertHostJob(
    cache: ReturnType<typeof useLocalCache>,
    summary: RecentJobSummary,
) {
    const jobs = hostJobSummaries(cache);
    const index = jobs.findIndex((job) => job.job_id === summary.job_id);
    if (index >= 0) {
        const merged = mergeJobSummary(jobs[index], summary);
        jobs.splice(index, 1, merged);
    } else {
        jobs.unshift(summary);
    }
    cache.state.value.recentJobs[activeHostId(cache)] = pruneJobs(jobs);
    cache.persist();
}

function jobsSortedForUi(jobs: RecentJobSummary[]) {
    return [...jobs].sort((a, b) => {
        const aTime = Date.parse(a.updated_at || a.created_at || '');
        const bTime = Date.parse(b.updated_at || b.created_at || '');
        if (Number.isNaN(aTime) && Number.isNaN(bTime)) return 0;
        if (Number.isNaN(aTime)) return 1;
        if (Number.isNaN(bTime)) return -1;
        return bTime - aTime;
    });
}

function parseSseJson(event: Or3SseEvent): Record<string, unknown> | null {
    if (event.json && typeof event.json === 'object') {
        return event.json as Record<string, unknown>;
    }
    if (!event.data) return null;
    try {
        const parsed = JSON.parse(event.data);
        return typeof parsed === 'object' && parsed !== null
            ? (parsed as Record<string, unknown>)
            : null;
    } catch {
        return null;
    }
}

export function applySseEventToCache(
    cache: ReturnType<typeof useLocalCache>,
    jobId: string,
    event: Or3SseEvent,
): boolean {
    const eventType = (event.event ?? '').toLowerCase();
    const payload = parseSseJson(event);
    const jobs = hostJobSummaries(cache);
    const existing = jobs.find((job) => job.job_id === jobId);
    if (!existing) return false;

    let nextStatus = existing.status;
    let finalText = existing.final_text;
    let errorText = existing.error;
    let artifactId = existing.artifact_id;
    let terminal = false;

    switch (eventType) {
        case 'queued':
            nextStatus = 'queued';
            break;
        case 'started':
            nextStatus = 'running';
            break;
        case 'text_delta':
            if (payload && typeof payload.text === 'string') {
                finalText = (finalText ?? '') + payload.text;
            }
            nextStatus = 'running';
            break;
        case 'assistant':
            if (payload && typeof payload.text === 'string') {
                finalText = payload.text;
            } else if (payload && typeof payload.final_text === 'string') {
                finalText = payload.final_text;
            }
            nextStatus = 'running';
            break;
        case 'tool_call':
        case 'tool_result':
            nextStatus = 'running';
            break;
        case 'completion': {
            const completionStatus =
                payload && typeof payload.status === 'string'
                    ? normalizeStatus(payload.status)
                    : 'completed';
            nextStatus = completionStatus;
            terminal = true;
            if (payload && typeof payload.final_text === 'string') {
                finalText = payload.final_text as string;
            } else if (payload && typeof payload.result_preview === 'string') {
                finalText = payload.result_preview as string;
            } else if (payload && typeof payload.preview === 'string') {
                finalText = payload.preview as string;
            } else if (payload && typeof payload.message === 'string') {
                finalText = payload.message as string;
            }
            if (payload && typeof payload.artifact_id === 'string') {
                artifactId = payload.artifact_id as string;
            }
            break;
        }
        case 'error':
        case 'runtime_error':
            nextStatus = 'failed';
            terminal = true;
            if (payload && typeof payload.message === 'string') {
                errorText = payload.message as string;
            } else if (payload && typeof payload.error === 'string') {
                errorText = payload.error as string;
            }
            break;
        default:
            return false;
    }

    upsertHostJob(cache, {
        ...existing,
        status: nextStatus,
        final_text: finalText,
        error: errorText,
        artifact_id: artifactId,
        updated_at: new Date().toISOString(),
        source: 'live',
    });
    return terminal;
}

function stopTracker(jobId: string) {
    const tracker = trackers.get(jobId);
    if (!tracker) return;
    tracker.abort.abort();
    if (tracker.polling) clearInterval(tracker.polling);
    trackers.delete(jobId);
}

function stopAllTrackers() {
    for (const id of Array.from(trackers.keys())) stopTracker(id);
}

export function useJobs() {
    const api = useOr3Api();
    const cache = useLocalCache();

    const recentJobs = computed(() =>
        jobsSortedForUi(hostJobSummaries(cache)).map(summaryToSnapshot),
    );
    const activeJobs = computed(() =>
        recentJobs.value.filter((job) => isActiveStatus(job.status)),
    );

    function findSummary(jobId: string): RecentJobSummary | undefined {
        return hostJobSummaries(cache).find((job) => job.job_id === jobId);
    }

    async function loadJobs(options: { status?: string; limit?: number } = {}) {
        loadingJobs.value = true;
        lastListError.value = null;
        try {
            const params = new URLSearchParams();
            if (options.status) params.set('status', options.status);
            params.set('limit', String(options.limit ?? 50));
            const path = `/internal/v1/subagents?${params.toString()}`;
            const response = await api.request<SubagentListResponse>(path);
            listSupported.value = true;
            const items: PersistedSubagentJob[] = Array.isArray(response?.items)
                ? response.items
                : [];
            for (const item of items) {
                upsertHostJob(cache, persistedJobToSummary(item));
            }
        } catch (error) {
            const err = error as Or3AppError;
            if (
                err?.status === 404 ||
                err?.status === 405 ||
                err?.code === 'capability_unavailable'
            ) {
                listSupported.value = false;
                return;
            }
            lastListError.value = err;
            throw err;
        } finally {
            loadingJobs.value = false;
        }
    }

    async function queueJob(request: SubagentRequest, uiMeta?: AgentJobUiMeta) {
        const response = await api.request<SubagentResponse>(
            '/internal/v1/subagents',
            { body: request },
        );
        const nowIso = new Date().toISOString();
        const summary: RecentJobSummary = {
            job_id: response.job_id,
            kind: 'subagent',
            status: normalizeStatus(response.status ?? 'queued'),
            title: uiMeta?.task || request.task || 'Agent task',
            task: uiMeta?.task ?? request.task,
            updated_at: nowIso,
            created_at: nowIso,
            child_session_key: response.child_session_key,
            parent_session_key:
                uiMeta?.parent_session_key ?? request.parent_session_key,
            category: uiMeta?.category,
            priority: uiMeta?.priority,
            notify: uiMeta?.notify,
            autoApprove: uiMeta?.autoApprove,
            source: 'live',
        };
        upsertHostJob(cache, summary);
        void subscribeJob(response.job_id);
        return response;
    }

    async function fetchJob(jobId: string) {
        const snapshot = await api.request<JobSnapshot>(
            `/internal/v1/jobs/${encodeURIComponent(jobId)}`,
        );
        upsertHostJob(cache, snapshotToSummary(snapshot, findSummary(jobId)));
        return snapshot;
    }

    async function fetchArtifact(
        artifactId: string,
        sessionKey: string,
        options: { offset?: number; maxBytes?: number } = {},
    ) {
        const params = new URLSearchParams();
        params.set('session_key', sessionKey);
        if (options.offset && options.offset > 0) {
            params.set('offset', String(options.offset));
        }
        if (options.maxBytes && options.maxBytes > 0) {
            params.set('max_bytes', String(options.maxBytes));
        }
        return await api.request<ArtifactResponse>(
            `/internal/v1/artifacts/${encodeURIComponent(artifactId)}?${params.toString()}`,
        );
    }

    async function subscribeJob(jobId: string) {
        if (trackers.has(jobId)) return;
        if (trackers.size >= MAX_LIVE_STREAMS) return;

        const summary = findSummary(jobId);
        if (summary && isTerminalStatus(summary.status)) return;

        const abort = new AbortController();
        const tracker: JobTracker = { jobId, abort, polling: null };
        trackers.set(jobId, tracker);
        let usingPollingFallback = false;

        try {
            const stream = api.stream(
                `/internal/v1/jobs/${encodeURIComponent(jobId)}/stream`,
                { method: 'GET', signal: abort.signal },
            );
            for await (const event of stream) {
                const terminal = applySseEventToCache(cache, jobId, event);
                if (terminal) break;
            }
        } catch (error) {
            const err = error as Or3AppError;
            if (err?.status === 404) {
                // Job registry expired — keep persisted history but stop tracking.
            } else if (err?.code !== 'host_unreachable') {
                startPolling(jobId);
                usingPollingFallback = true;
                return;
            }
        } finally {
            if (!usingPollingFallback) {
                stopTracker(jobId);
            }
        }
    }

    function startPolling(jobId: string) {
        const tracker = trackers.get(jobId);
        if (!tracker || tracker.polling) return;
        tracker.polling = setInterval(async () => {
            if (
                typeof document !== 'undefined' &&
                document.visibilityState === 'hidden'
            ) {
                return;
            }
            try {
                const snapshot = await fetchJob(jobId);
                if (isTerminalStatus(snapshot.status)) {
                    stopTracker(jobId);
                }
            } catch {
                stopTracker(jobId);
            }
        }, POLL_INTERVAL_MS);
    }

    async function abortJob(jobId: string) {
        const response = await api.request<JobSnapshot>(
            `/internal/v1/jobs/${encodeURIComponent(jobId)}/abort`,
            { method: 'POST' },
        );
        const status =
            (response as unknown as { status?: string }).status ?? 'aborted';
        const existing = findSummary(jobId);
        if (existing) {
            upsertHostJob(cache, {
                ...existing,
                status: normalizeStatus(status),
                updated_at: new Date().toISOString(),
                source: 'live',
            });
        }
        stopTracker(jobId);
        try {
            await fetchJob(jobId);
        } catch {
            /* refresh failure is non-fatal — local state already reflects abort */
        }
        return response;
    }

    async function retryJob(jobId: string) {
        const summary = findSummary(jobId);
        if (!summary || !summary.task || !summary.parent_session_key) {
            return null;
        }
        return await queueJob(
            {
                parent_session_key: summary.parent_session_key,
                task: summary.task,
                meta: {
                    category: summary.category,
                    priority: summary.priority,
                    notify: summary.notify,
                    auto_approve_safe: summary.autoApprove,
                    retry_of: jobId,
                },
            },
            {
                task: summary.task,
                category: summary.category,
                priority: summary.priority,
                notify: summary.notify,
                autoApprove: summary.autoApprove,
                parent_session_key: summary.parent_session_key,
            },
        );
    }

    function startActiveJobTracking() {
        for (const summary of hostJobSummaries(cache)) {
            if (isActiveStatus(summary.status)) {
                void subscribeJob(summary.job_id);
            }
        }
        if (typeof window === 'undefined') return;
        if (!historyTimer) {
            historyTimer = setInterval(() => {
                if (document.visibilityState === 'hidden') return;
                void loadJobs().catch(() => {});
            }, HISTORY_REFRESH_MS);
        }
        if (!visibilityHandler) {
            visibilityHandler = () => {
                if (document.visibilityState === 'visible') {
                    void loadJobs().catch(() => {});
                }
            };
            document.addEventListener('visibilitychange', visibilityHandler);
        }
    }

    function stopActiveJobTracking() {
        stopAllTrackers();
        if (historyTimer) {
            clearInterval(historyTimer);
            historyTimer = null;
        }
        if (visibilityHandler && typeof document !== 'undefined') {
            document.removeEventListener('visibilitychange', visibilityHandler);
            visibilityHandler = null;
        }
    }

    return {
        jobs: recentJobs,
        activeJobs,
        loadingJobs,
        lastListError,
        listSupported,
        queueJob,
        loadJobs,
        fetchJob,
        fetchArtifact,
        subscribeJob,
        abortJob,
        retryJob,
        startActiveJobTracking,
        stopActiveJobTracking,
        findSummary,
    };
}
