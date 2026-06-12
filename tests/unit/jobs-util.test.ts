import { describe, expect, it } from 'vitest';
import {
    formatRunnerKind,
    isActiveStatus,
    isRunnerJob,
    isTerminalStatus,
    mergeJobSummary,
    normalizeStatus,
    persistedRunnerRunJobToSummary,
    runnerLabel,
    summaryToSnapshot,
} from '../../app/utils/or3/jobs';
import type { RecentJobSummary } from '../../app/types/app-state';
import type { PersistedRunnerRunJob } from '../../app/types/or3-api';

describe('normalizeStatus', () => {
    it('maps backend statuses to UI vocabulary', () => {
        expect(normalizeStatus('succeeded')).toBe('completed');
        expect(normalizeStatus('Complete')).toBe('completed');
        expect(normalizeStatus('interrupted')).toBe('aborted');
        expect(normalizeStatus('cancelled')).toBe('aborted');
        expect(normalizeStatus('canceled')).toBe('aborted');
        expect(normalizeStatus('started')).toBe('running');
        expect(normalizeStatus('starting')).toBe('running');
        expect(normalizeStatus('error')).toBe('failed');
        expect(normalizeStatus('timed_out')).toBe('failed');
        expect(normalizeStatus('queued')).toBe('queued');
    });

    it('falls back to queued for unknown values', () => {
        expect(normalizeStatus(undefined)).toBe('queued');
        expect(normalizeStatus('totally-bogus')).toBe('queued');
    });
});

describe('isTerminalStatus / isActiveStatus', () => {
    it('classifies statuses correctly', () => {
        expect(isTerminalStatus('succeeded')).toBe(true);
        expect(isTerminalStatus('failed')).toBe(true);
        expect(isTerminalStatus('aborted')).toBe(true);
        expect(isTerminalStatus('queued')).toBe(false);
        expect(isTerminalStatus('running')).toBe(false);
        expect(isActiveStatus('queued')).toBe(true);
        expect(isActiveStatus('running')).toBe(true);
        expect(isActiveStatus('completed')).toBe(false);
    });
});

describe('mergeJobSummary', () => {
    const base: RecentJobSummary = {
        job_id: 'j1',
        kind: 'runner:codex',
        status: 'queued',
        title: 'Codex task',
        task: 'Original task',
        category: 'research',
        priority: 'high',
        notify: 'always',
        autoApprove: true,
        updated_at: '2026-04-24T10:00:00Z',
        source: 'local',
    };

    it('returns the new summary when nothing existed', () => {
        const next: RecentJobSummary = {
            job_id: 'j1',
            kind: 'runner:codex',
            status: 'completed',
            title: 'Persisted codex task',
            updated_at: '2026-04-24T11:00:00Z',
        };
        expect(mergeJobSummary(undefined, next)).toEqual(next);
    });

    it('lets server-truth fields win while preserving UI metadata', () => {
        const next: RecentJobSummary = {
            job_id: 'j1',
            kind: 'runner:codex',
            status: 'completed',
            title: 'Persisted codex task',
            task: 'Original task',
            updated_at: '2026-04-24T11:00:00Z',
            final_text: 'preview',
            source: 'persisted',
        };
        const merged = mergeJobSummary(base, next);
        expect(merged.status).toBe('completed');
        expect(merged.updated_at).toBe('2026-04-24T11:00:00Z');
        expect(merged.final_text).toBe('preview');
        expect(merged.category).toBe('research');
        expect(merged.priority).toBe('high');
        expect(merged.notify).toBe('always');
        expect(merged.autoApprove).toBe(true);
    });

    it('keeps existing final_text when next has none', () => {
        const withPreview: RecentJobSummary = {
            ...base,
            final_text: 'original preview',
        };
        const next: RecentJobSummary = {
            job_id: 'j1',
            kind: 'runner:codex',
            status: 'completed',
            title: 'Persisted codex task',
            updated_at: '2026-04-24T12:00:00Z',
        };
        const merged = mergeJobSummary(withPreview, next);
        expect(merged.final_text).toBe('original preview');
    });
});

describe('summaryToSnapshot', () => {
    it('exposes title and task on the snapshot', () => {
        const summary: RecentJobSummary = {
            job_id: 'j1',
            kind: 'runner:codex',
            status: 'running',
            title: 'Display title',
            task: 'Original task',
            updated_at: '2026-04-24T10:00:00Z',
            created_at: '2026-04-24T09:59:00Z',
            child_session_key: 'child-x',
            priority: 'low',
        };
        const snapshot = summaryToSnapshot(summary);
        expect(snapshot.status).toBe('running');
        expect(snapshot.title).toBe('Display title');
        expect(snapshot.task).toBe('Original task');
        expect(snapshot.child_session_key).toBe('child-x');
        expect(snapshot.priority).toBe('low');
    });

    it('passes through CLI fields', () => {
        const summary: RecentJobSummary = {
            job_id: 'j-cli',
            kind: 'runner:codex',
            status: 'completed',
            title: 'Codex task',
            updated_at: '2026-04-24T10:00:00Z',
            runner_id: 'codex',
            runner_label: 'Codex',
            mode: 'safe_edit',
            isolation: 'host_workspace_write',
            model: 'gpt-5.4',
            cwd: '/workspace',
            stdout_preview: 'stdout text',
            stderr_preview: '',
            output_truncated: false,
        };
        const snapshot = summaryToSnapshot(summary);
        expect(snapshot.runner_id).toBe('codex');
        expect(snapshot.runner_label).toBe('Codex');
        expect(snapshot.mode).toBe('safe_edit');
        expect(snapshot.isolation).toBe('host_workspace_write');
        expect(snapshot.model).toBe('gpt-5.4');
        expect(snapshot.cwd).toBe('/workspace');
        expect(snapshot.stdout_preview).toBe('stdout text');
    });
});

describe('isRunnerJob', () => {
    it('returns true for runner:* kinds', () => {
        expect(isRunnerJob('runner:codex')).toBe(true);
        expect(isRunnerJob('runner:claude')).toBe(true);
        expect(isRunnerJob('runner:gemini')).toBe(true);
    });

    it('returns false for unknown non-CLI kinds', () => {
        expect(isRunnerJob(undefined)).toBe(false);
        expect(isRunnerJob('')).toBe(false);
    });
});

describe('runnerLabel', () => {
    it('returns display names for known runners', () => {
        expect(runnerLabel('opencode')).toBe('OpenCode');
        expect(runnerLabel('codex')).toBe('Codex');
        expect(runnerLabel('claude')).toBe('Claude');
        expect(runnerLabel('gemini')).toBe('Gemini');
    });

    it('returns the raw id for unknown runners', () => {
        expect(runnerLabel('custom')).toBe('custom');
        expect(runnerLabel(undefined)).toBe('External CLI');
    });
});

describe('formatRunnerKind', () => {
    it('formats CLI kind strings into task labels', () => {
        expect(formatRunnerKind('runner:codex')).toBe('Codex task');
        expect(formatRunnerKind('runner:claude')).toBe('Claude task');
        expect(formatRunnerKind('runner:gemini')).toBe('Gemini task');
    });

    it('returns generic labels for non-CLI kinds', () => {
        expect(formatRunnerKind('runner_run')).toBe('Runner Run');
        expect(formatRunnerKind(undefined)).toBe('Agent task');
    });
});

describe('persistedRunnerRunJobToSummary', () => {
    it('maps a persisted CLI job into a summary', () => {
        const job: PersistedRunnerRunJob = {
            job_id: 'j-cli-1',
            run_id: 'run-1',
            kind: 'runner:codex',
            runner_id: 'codex',
            parent_session_key: 'session-a',
            task: 'Fix the failing auth test',
            status: 'succeeded',
            requested_at: '2026-04-24T10:00:00Z',
            started_at: '2026-04-24T10:00:01Z',
            completed_at: '2026-04-24T10:00:30Z',
            updated_at: '2026-04-24T10:00:30Z',
            mode: 'safe_edit',
            isolation: 'host_workspace_write',
            model: 'gpt-5.4',
            cwd: '/workspace',
            stdout_preview: 'Fixed the test',
            final_text_preview: 'Final result text',
            attempts: 1,
        };
        const summary = persistedRunnerRunJobToSummary(job);
        expect(summary.status).toBe('completed');
        expect(summary.kind).toBe('runner:codex');
        expect(summary.title).toBe('Fix the failing auth test');
        expect(summary.task).toBe('Fix the failing auth test');
        expect(summary.final_text).toBe('Final result text');
        expect(summary.runner_id).toBe('codex');
        expect(summary.runner_label).toBe('Codex');
        expect(summary.mode).toBe('safe_edit');
        expect(summary.isolation).toBe('host_workspace_write');
        expect(summary.model).toBe('gpt-5.4');
        expect(summary.cwd).toBe('/workspace');
        expect(summary.source).toBe('persisted');
    });

    it('falls back to stdout_preview when final_text_preview is absent', () => {
        const job: PersistedRunnerRunJob = {
            job_id: 'j-cli-2',
            runner_id: 'codex',
            parent_session_key: 'session-a',
            task: 'Small task',
            status: 'succeeded',
            requested_at: '2026-04-24T10:00:00Z',
            updated_at: '2026-04-24T10:00:30Z',
            stdout_preview: 'Output only',
        };
        const summary = persistedRunnerRunJobToSummary(job);
        expect(summary.final_text).toBe('Output only');
    });

    it('sets error from stderr_preview when failed', () => {
        const job: PersistedRunnerRunJob = {
            job_id: 'j-cli-3',
            runner_id: 'codex',
            parent_session_key: 'session-a',
            task: 'Failing task',
            status: 'failed',
            requested_at: '2026-04-24T10:00:00Z',
            updated_at: '2026-04-24T10:00:30Z',
            stderr_preview: 'Command not found',
        };
        const summary = persistedRunnerRunJobToSummary(job);
        expect(summary.status).toBe('failed');
        expect(summary.error).toBe('Command not found');
    });

    it('falls back to updated_at when no completed_at', () => {
        const job: PersistedRunnerRunJob = {
            job_id: 'j-cli-4',
            runner_id: 'codex',
            parent_session_key: 'session-a',
            task: 'Task',
            status: 'running',
            requested_at: '2026-04-24T10:00:00Z',
            updated_at: '2026-04-24T10:00:01Z',
        };
        const summary = persistedRunnerRunJobToSummary(job);
        expect(summary.updated_at).toBe('2026-04-24T10:00:01Z');
    });
});
