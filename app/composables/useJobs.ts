import { computed, ref, shallowRef } from 'vue';
import type { Or3AppError, RecentJobSummary } from '~/types/app-state';
import type {
    RunnerRunListResponse,
    RunnerRunRequest,
    RunnerRunResponse,
    AgentRunnerInfo,
    AgentRunnersResponse,
    ArtifactResponse,
    JobSnapshot,
    Or3SseEvent,
    PersistedRunnerRunJob,
} from '~/types/or3-api';
import {
    isActiveStatus,
    isRunnerJob,
    isTerminalStatus,
    mergeJobSummary,
    normalizeStatus,
    persistedRunnerRunJobToSummary,
    runnerLabel,
    summaryToSnapshot,
} from '~/utils/or3/jobs';
import { useActiveHost } from './useActiveHost';
import { useLocalCache } from './useLocalCache';
import { useOr3Api } from './useOr3Api';
import { canUseHostApi } from './useSecureHostTokens';

export interface AgentJobUiMeta {
    task?: string;
    category?: string;
    priority?: string;
    notify?: string;
    autoApprove?: boolean;
    parent_session_key?: string;
}

export interface RunnerRunJobUiMeta extends AgentJobUiMeta {
    runner_id: string;
    runner_label?: string;
    mode?: string;
    isolation?: string;
    model?: string;
    cwd?: string;
    max_turns?: number;
}

const MAX_RECENT_JOBS_PER_HOST = 80;
const MAX_LIVE_STREAMS = 3;
const POLL_INTERVAL_MS = 6_000;
const HISTORY_REFRESH_MS = 45_000;

const MAX_CACHED_CLI_OUTPUT_CHARS = 64_000;
const MAX_CACHED_STRUCTURED_EVENTS = 100;
const MAX_CACHED_RAW_EVENTS = 200;

const loadingJobs = ref(false);
const lastListError = shallowRef<Or3AppError | null>(null);
const listSupported = ref(true);

// ── Runner discovery ──
const loadingRunners = ref(false);
const runnerListSupported = ref(true);
const lastRunnerError = shallowRef<Or3AppError | null>(null);
const agentRunners = shallowRef<AgentRunnerInfo[]>([]);

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

function normalizeRunnerList(runners: AgentRunnerInfo[]): AgentRunnerInfo[] {
    return runners.map((runner) => ({
        ...runner,
        auth_status:
            runner.status === 'available' && runner.auth_status === 'unknown'
                ? 'ready'
                : runner.auth_status,
    }));
}

function selectableAgentRunners(runners: AgentRunnerInfo[]): AgentRunnerInfo[] {
    return runners;
}

function hostJobSummaries(cache: ReturnType<typeof useLocalCache>) {
    const hostId = activeHostId(cache);
    cache.state.value.recentJobs[hostId] ??= [];
    return cache.state.value.recentJobs[hostId];
}

function fallbackJobKind(job: Pick<JobSnapshot, 'kind' | 'runner_id'>) {
    const explicit = String(job.kind ?? '').trim();
    if (explicit) return explicit;
    const runnerID = String(job.runner_id ?? '').trim();
    if (runnerID) return `runner:${runnerID}`;
    return 'runner';
}

function snapshotToSummary(
    job: JobSnapshot,
    base?: RecentJobSummary,
): RecentJobSummary {
    return {
        ...(base ?? {
            job_id: job.job_id,
            kind: fallbackJobKind(job),
            status: normalizeStatus(job.status),
            title: 'Agent task',
            updated_at: job.updated_at,
        }),
        job_id: job.job_id,
        kind: fallbackJobKind(job) || base?.kind || 'runner',
        status: normalizeStatus(job.status),
        title: base?.title || base?.task || 'Agent task',
        updated_at: job.updated_at,
        created_at: job.created_at ?? base?.created_at,
        final_text: job.final_text ?? base?.final_text,
        error: job.error ?? base?.error,
        artifact_id: job.artifact_id ?? base?.artifact_id,
        runner_id: job.runner_id ?? base?.runner_id,
        runner_label: job.runner_label ?? base?.runner_label,
        mode: job.mode ?? base?.mode,
        isolation: job.isolation ?? base?.isolation,
        model: job.model ?? base?.model,
        cwd: job.cwd ?? base?.cwd,
        stdout_preview: job.stdout_preview ?? base?.stdout_preview,
        stderr_preview: job.stderr_preview ?? base?.stderr_preview,
        output_preview: job.output_preview ?? base?.output_preview,
        error_preview: job.error_preview ?? base?.error_preview,
        raw_events: job.raw_events ?? base?.raw_events,
        structured_events: job.structured_events ?? base?.structured_events,
        output_truncated: job.output_truncated ?? base?.output_truncated,
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
    options?: { persist?: boolean },
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
    if (options?.persist !== false) {
        cache.persist();
    }
}

function batchUpsertHostJobs(
    cache: ReturnType<typeof useLocalCache>,
    summaries: RecentJobSummary[],
) {
    if (summaries.length === 0) return;
    const jobs = hostJobSummaries(cache);
    for (const summary of summaries) {
        const index = jobs.findIndex((job) => job.job_id === summary.job_id);
        if (index >= 0) {
            const merged = mergeJobSummary(jobs[index], summary);
            jobs.splice(index, 1, merged);
        } else {
            jobs.unshift(summary);
        }
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
    let stdoutPreview = existing.stdout_preview;
    let stderrPreview = existing.stderr_preview;
    let structuredEvents = existing.structured_events;
    let rawEvents = existing.raw_events;
    let outputTruncated = existing.output_truncated;
    let terminal = false;

    switch (eventType) {
        case 'queued':
            nextStatus = 'queued';
            rawEvents = appendBoundedRaw(rawEvents, payload ?? {}, MAX_CACHED_RAW_EVENTS);
            break;
        case 'started':
            nextStatus = 'running';
            rawEvents = appendBoundedRaw(rawEvents, payload ?? {}, MAX_CACHED_RAW_EVENTS);
            break;
        case 'text_delta':
            if (payload && typeof payload.text === 'string') {
                finalText = (finalText ?? '') + payload.text;
            }
            nextStatus = 'running';
            rawEvents = appendBoundedRaw(rawEvents, payload ?? {}, MAX_CACHED_RAW_EVENTS);
            break;
        case 'assistant':
            if (payload && typeof payload.text === 'string') {
                finalText = payload.text;
            } else if (payload && typeof payload.final_text === 'string') {
                finalText = payload.final_text;
            }
            nextStatus = 'running';
            rawEvents = appendBoundedRaw(rawEvents, payload ?? {}, MAX_CACHED_RAW_EVENTS);
            break;
        case 'tool_call':
        case 'tool_result':
            nextStatus = 'running';
            rawEvents = appendBoundedRaw(rawEvents, payload ?? {}, MAX_CACHED_RAW_EVENTS);
            break;
        case 'output': {
            nextStatus = 'running';
            const stream = payload && typeof payload.stream === 'string'
                ? payload.stream
                : 'stdout';
            const chunk = payload && typeof payload.chunk === 'string'
                ? payload.chunk
                : '';
            if (stream === 'stderr') {
                stderrPreview = boundedAppend(stderrPreview, chunk, MAX_CACHED_CLI_OUTPUT_CHARS);
            } else {
                stdoutPreview = boundedAppend(stdoutPreview, chunk, MAX_CACHED_CLI_OUTPUT_CHARS);
            }
            rawEvents = appendBoundedRaw(rawEvents, payload ?? {}, MAX_CACHED_RAW_EVENTS);
            break;
        }
        case 'structured': {
            nextStatus = 'running';
            structuredEvents = appendBoundedRaw(
                structuredEvents,
                payload ?? {},
                MAX_CACHED_STRUCTURED_EVENTS,
            );
            rawEvents = appendBoundedRaw(rawEvents, payload ?? {}, MAX_CACHED_RAW_EVENTS);
            break;
        }
        case 'output_truncated':
            outputTruncated = true;
            rawEvents = appendBoundedRaw(rawEvents, payload ?? {}, MAX_CACHED_RAW_EVENTS);
            break;
        case 'completion': {
            const completionStatus =
                payload && typeof payload.status === 'string'
                    ? normalizeStatus(payload.status)
                    : 'completed';
            nextStatus = completionStatus;
            terminal = true;
            rawEvents = appendBoundedRaw(rawEvents, payload ?? {}, MAX_CACHED_RAW_EVENTS);
            if (payload && typeof payload.final_text === 'string') {
                finalText = payload.final_text as string;
            } else if (payload && typeof payload.result_preview === 'string') {
                finalText = payload.result_preview as string;
            } else if (payload && typeof payload.preview === 'string') {
                finalText = payload.preview as string;
            } else if (payload && typeof payload.message === 'string') {
                finalText = payload.message as string;
            } else if (payload && typeof payload.final_text_preview === 'string') {
                finalText = payload.final_text_preview as string;
            } else if (payload && typeof payload.stdout_preview === 'string') {
                finalText = payload.stdout_preview as string;
            }
            if (payload && typeof payload.stderr_preview === 'string') {
                stderrPreview = payload.stderr_preview as string;
            }
            if (payload && typeof payload.stdout_preview === 'string') {
                stdoutPreview = payload.stdout_preview as string;
            }
            if (payload && typeof payload.error_message === 'string') {
                errorText = payload.error_message as string;
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
            rawEvents = appendBoundedRaw(rawEvents, payload ?? {}, MAX_CACHED_RAW_EVENTS);
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
        stdout_preview: stdoutPreview,
        stderr_preview: stderrPreview,
        structured_events: structuredEvents,
        raw_events: rawEvents,
        output_truncated: outputTruncated,
        updated_at: new Date().toISOString(),
        source: 'live',
    }, { persist: terminal });
    return terminal;
}

function boundedAppend(
    existing: string | undefined,
    chunk: string,
    maxChars: number,
): string {
    const base = existing ?? '';
    const combined = base + chunk;
    if (combined.length <= maxChars) return combined;
    return combined.slice(combined.length - maxChars);
}

function appendBoundedRaw(
    existing: unknown[] | undefined,
    item: unknown,
    maxItems: number,
): unknown[] {
    const list = existing ?? [];
    const next = [...list, item];
    return maxItems > 0 && next.length > maxItems
        ? next.slice(next.length - maxItems)
        : next;
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
        const { activeHost } = useActiveHost();
        if (!canUseHostApi(activeHost.value)) return;
        loadingJobs.value = true;
        lastListError.value = null;
        try {
            await loadRunnerRunHistory(options);
            listSupported.value = true;
        } catch (error) {
            const err = error as Or3AppError;
            if (err?.code === 'pin_locked') return;
            if (
                err?.status === 401 ||
                err?.status === 403 ||
                err?.status === 429 ||
                err?.code === 'auth_required' ||
                err?.code === 'unauthorized' ||
                err?.code === 'invalid_token' ||
                err?.code === 'auth_rate_limited'
            ) {
                if (hostJobSummaries(cache).length > 0) return;
            }
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

    async function loadRunnerRunHistory(
        options: { status?: string; limit?: number } = {},
    ) {
        try {
            const params = new URLSearchParams();
            if (options.status) params.set('status', options.status);
            params.set('limit', String(options.limit ?? 50));
            const response = await api.request<RunnerRunListResponse>(
                `/internal/v1/runner-runs?${params.toString()}`,
            );
            const items: PersistedRunnerRunJob[] = Array.isArray(response?.items)
                ? response.items
                : [];
            if (items.length > 0) {
                batchUpsertHostJobs(cache, items.map(persistedRunnerRunJobToSummary));
            }
        } catch (_err) {
            const err = _err as Or3AppError;
            if (
                err?.status === 404 ||
                err?.status === 405 ||
                err?.code === 'capability_unavailable'
            ) {
                return;
            }
            throw err;
        }
    }

    async function loadAgentRunners() {
        const { activeHost } = useActiveHost();
        if (!canUseHostApi(activeHost.value)) return;
        loadingRunners.value = true;
        lastRunnerError.value = null;
        try {
            const response = await api.request<AgentRunnersResponse>(
                '/internal/v1/runner-runners',
            );
            runnerListSupported.value = true;
            agentRunners.value = selectableAgentRunners(
                normalizeRunnerList(
                    Array.isArray(response?.runners) ? response.runners : [],
                ),
            );
        } catch (error) {
            const err = error as Or3AppError;
            if (
                err?.status === 404 ||
                err?.status === 405 ||
                err?.status === 503 ||
                err?.code === 'capability_unavailable'
            ) {
                runnerListSupported.value = false;
                agentRunners.value = [];
                return;
            }
            lastRunnerError.value = err;
            agentRunners.value = [];
        } finally {
            loadingRunners.value = false;
        }
    }

    async function queueRunnerRunJob(
        request: RunnerRunRequest,
        uiMeta?: RunnerRunJobUiMeta,
    ) {
        const response = await api.request<RunnerRunResponse>(
            '/internal/v1/runner-runs',
            { body: request as unknown as Record<string, unknown> },
        );
        const nowIso = new Date().toISOString();
        const label = uiMeta?.runner_label ?? runnerLabel(request.runner_id);
        upsertHostJob(cache, {
            job_id: response.job_id,
            kind: `runner:${request.runner_id}`,
            status: normalizeStatus(response.status ?? 'queued'),
            title: uiMeta?.task || request.task || `${label} task`,
            task: uiMeta?.task ?? request.task,
            updated_at: nowIso,
            created_at: nowIso,
            parent_session_key: request.parent_session_key,
            runner_id: request.runner_id,
            runner_label: label,
            mode: request.mode,
            isolation: request.isolation,
            model: request.model,
            cwd: request.cwd,
            category: uiMeta?.category,
            priority: uiMeta?.priority,
            notify: uiMeta?.notify,
            autoApprove: uiMeta?.autoApprove,
            source: 'live',
        });
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
        if (isRunnerJob(summary.kind) && summary.runner_id) {
            return await queueRunnerRunJob(
                {
                    parent_session_key: summary.parent_session_key,
                    runner_id: summary.runner_id,
                    task: summary.task,
                    mode: summary.mode as RunnerRunRequest['mode'],
                    isolation: summary.isolation as RunnerRunRequest['isolation'],
                    model: summary.model,
                    cwd: summary.cwd,
                    max_turns: undefined,
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
                    runner_id: summary.runner_id,
                    runner_label: summary.runner_label,
                    mode: summary.mode,
                    isolation: summary.isolation,
                    model: summary.model,
                    cwd: summary.cwd,
                },
            );
        }
        return null;
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
        queueRunnerRunJob,
        loadJobs,
        loadAgentRunners,
        loadRunnerRunHistory,
        fetchJob,
        fetchArtifact,
        subscribeJob,
        abortJob,
        retryJob,
        startActiveJobTracking,
        stopActiveJobTracking,
        findSummary,
        agentRunners,
        loadingRunners,
        runnerListSupported,
        lastRunnerError,
    };
}
