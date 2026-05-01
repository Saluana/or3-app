import { describe, expect, it } from 'vitest';
import {
    isActiveStatus,
    isTerminalStatus,
    mergeJobSummary,
    normalizeStatus,
    persistedJobToSummary,
    summaryToSnapshot,
} from '../../app/utils/or3/jobs';
import type { RecentJobSummary } from '../../app/types/app-state';
import type { PersistedSubagentJob } from '../../app/types/or3-api';

describe('normalizeStatus', () => {
    it('maps backend statuses to UI vocabulary', () => {
        expect(normalizeStatus('succeeded')).toBe('completed');
        expect(normalizeStatus('Complete')).toBe('completed');
        expect(normalizeStatus('interrupted')).toBe('aborted');
        expect(normalizeStatus('cancelled')).toBe('aborted');
        expect(normalizeStatus('started')).toBe('running');
        expect(normalizeStatus('error')).toBe('failed');
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

describe('persistedJobToSummary', () => {
    it('maps a persisted job into a summary with normalized status', () => {
        const job: PersistedSubagentJob = {
            job_id: 'j1',
            kind: 'subagent',
            parent_session_key: 'session-a',
            child_session_key: 'child-a',
            task: 'Summarize the docs',
            status: 'succeeded',
            requested_at: '2026-04-24T10:00:00Z',
            started_at: '2026-04-24T10:00:01Z',
            finished_at: '2026-04-24T10:00:30Z',
            updated_at: '2026-04-24T10:00:30Z',
            result_preview: 'Here is the summary',
        };
        const summary = persistedJobToSummary(job);
        expect(summary.status).toBe('completed');
        expect(summary.title).toBe('Summarize the docs');
        expect(summary.task).toBe('Summarize the docs');
        expect(summary.final_text).toBe('Here is the summary');
        expect(summary.parent_session_key).toBe('session-a');
        expect(summary.source).toBe('persisted');
    });

    it('falls back to requested_at when timestamps missing', () => {
        const job: PersistedSubagentJob = {
            job_id: 'j2',
            kind: 'subagent',
            parent_session_key: 'session-a',
            child_session_key: 'child-a',
            task: 'Pending task',
            status: 'queued',
            requested_at: '2026-04-24T11:00:00Z',
            updated_at: '2026-04-24T11:00:00Z',
        };
        const summary = persistedJobToSummary(job);
        expect(summary.status).toBe('queued');
        expect(summary.created_at).toBe('2026-04-24T11:00:00Z');
    });
});

describe('mergeJobSummary', () => {
    const base: RecentJobSummary = {
        job_id: 'j1',
        kind: 'subagent',
        status: 'queued',
        title: 'Old title',
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
            kind: 'subagent',
            status: 'completed',
            title: 'Persisted',
            updated_at: '2026-04-24T11:00:00Z',
        };
        expect(mergeJobSummary(undefined, next)).toEqual(next);
    });

    it('lets server-truth fields win while preserving UI metadata', () => {
        const next: RecentJobSummary = {
            job_id: 'j1',
            kind: 'subagent',
            status: 'completed',
            title: 'Persisted task',
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
            kind: 'subagent',
            status: 'completed',
            title: 'Persisted task',
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
            kind: 'subagent',
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
});
