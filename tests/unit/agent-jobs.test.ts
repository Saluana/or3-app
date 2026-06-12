import { describe, expect, it } from 'vitest';
import type { JobSnapshot } from '../../app/types/or3-api';
import {
    activeStatusLabel,
    buildRunnerFilterOptions,
    dateGroupLabel,
    extractUserPromptFromJobText,
    filterJobsByRunner,
    filterJobsByStatus,
    formatElapsed,
    groupJobsByDate,
    isAttentionStatus,
    isStaleJob,
    jobDisplayTitle,
    jobMatchesSearch,
    jobToCommandDraft,
    resultPreviewForList,
    sortJobsByUpdated,
} from '../../app/utils/or3/agent-jobs';

function job(partial: Partial<JobSnapshot> & { job_id: string }): JobSnapshot {
    return {
        kind: 'agent_cli:codex',
        status: 'queued',
        created_at: '2026-05-24T10:00:00Z',
        updated_at: '2026-05-24T10:00:00Z',
        ...partial,
    };
}

describe('agent-jobs filters', () => {
    const jobs = [
        job({
            job_id: '1',
            status: 'running',
            task: 'Alpha research',
            runner_id: 'opencode',
            updated_at: '2026-05-24T12:00:00Z',
        }),
        job({
            job_id: '2',
            status: 'failed',
            task: 'Beta fix',
            error: 'boom',
            runner_id: 'codex',
            kind: 'agent_cli:codex',
            updated_at: '2026-05-24T11:00:00Z',
        }),
        job({
            job_id: '3',
            status: 'completed',
            task: 'Gamma summary',
            final_text: 'done',
            updated_at: '2026-05-24T10:30:00Z',
        }),
    ];

    it('sorts by updated_at descending', () => {
        const sorted = sortJobsByUpdated(jobs);
        expect(sorted.map((j) => j.job_id)).toEqual(['1', '2', '3']);
    });

    it('filters by status', () => {
        expect(filterJobsByStatus(jobs, 'failed').map((j) => j.job_id)).toEqual([
            '2',
        ]);
        expect(filterJobsByStatus(jobs, 'running').map((j) => j.job_id)).toEqual([
            '1',
        ]);
    });

    it('filters by runner', () => {
        expect(
            filterJobsByRunner(jobs, 'codex').map((j) => j.job_id),
        ).toEqual(['2']);
    });

    it('searches task, error, and runner fields', () => {
        expect(jobMatchesSearch(jobs[0], 'alpha')).toBe(true);
        expect(jobMatchesSearch(jobs[1], 'boom')).toBe(true);
        expect(jobMatchesSearch(jobs[1], 'codex')).toBe(true);
        expect(jobMatchesSearch(jobs[0], 'missing')).toBe(false);
    });

    it('matches all search tokens (multi-word)', () => {
        expect(jobMatchesSearch(jobs[0], 'alpha research')).toBe(true);
        expect(jobMatchesSearch(jobs[1], 'beta boom')).toBe(true);
        expect(jobMatchesSearch(jobs[1], 'boom alpha')).toBe(false);
    });

    it('prefers task over system replay titles for display and search', () => {
        const replayBlob =
            'System: This conversation is being replayed for context. Previous turns are provided below in chronological order. User: wat model r u';
        const replay = job({
            job_id: 'replay',
            title: replayBlob,
            task: replayBlob,
            status: 'failed',
            error: 'approval mode overridden',
            final_text: "I'm GPT-5, running as Codex in this workspace.",
        });
        expect(extractUserPromptFromJobText(replayBlob)).toBe('wat model r u');
        expect(jobDisplayTitle(replay)).toBe('wat model r u');
        expect(resultPreviewForList(replay)).toContain('approval mode');
        expect(jobMatchesSearch(replay, 'wat model')).toBe(true);
        expect(jobMatchesSearch(replay, 'approval')).toBe(true);
    });

    it('builds runner filter options from job runner ids', () => {
        const options = buildRunnerFilterOptions(jobs);
        expect(options.some((o) => o.id === 'opencode')).toBe(true);
        expect(options.some((o) => o.id === 'codex')).toBe(true);
    });
});

describe('agent-jobs grouping and time', () => {
    const now = new Date('2026-05-24T15:00:00Z');

    it('labels today and yesterday', () => {
        expect(dateGroupLabel('2026-05-24T12:00:00Z', now)).toBe('Today');
        expect(dateGroupLabel('2026-05-23T12:00:00Z', now)).toBe('Yesterday');
    });

    it('groups jobs under date labels', () => {
        const groups = groupJobsByDate(
            [
                job({
                    job_id: 'a',
                    updated_at: '2026-05-24T12:00:00Z',
                }),
                job({
                    job_id: 'b',
                    updated_at: '2026-05-23T12:00:00Z',
                }),
            ],
            now,
        );
        expect(groups.map((g) => g.label)).toEqual(['Today', 'Yesterday']);
        expect(groups[0]?.jobs[0]?.job_id).toBe('a');
    });

    it('formats elapsed durations', () => {
        expect(
            formatElapsed(
                '2026-05-24T10:00:00Z',
                '2026-05-24T10:00:32Z',
            ),
        ).toBe('32s');
        expect(
            formatElapsed(
                '2026-05-24T10:00:00Z',
                '2026-05-24T10:04:00Z',
            ),
        ).toBe('4m');
        expect(
            formatElapsed(
                '2026-05-24T08:00:00Z',
                '2026-05-24T09:12:00Z',
            ),
        ).toBe('1h 12m');
    });
});

describe('agent-jobs attention', () => {
    it('flags failed and stale running jobs', () => {
        const failed = job({ job_id: 'f', status: 'failed', error: 'x' });
        expect(isAttentionStatus(failed)).toBe(true);

        const staleMs = Date.now() - 6 * 60 * 1000;
        const stale = job({
            job_id: 's',
            status: 'running',
            updated_at: new Date(staleMs).toISOString(),
        });
        expect(isStaleJob(stale)).toBe(true);
        expect(isAttentionStatus(stale)).toBe(true);
        expect(activeStatusLabel(stale)).toBe('Needs attention');
    });
});

describe('jobToCommandDraft', () => {
    it('maps completed CLI job fields into a draft', () => {
        const draft = jobToCommandDraft(
            job({
                job_id: 'cli-1',
                status: 'completed',
                task: 'Fix tests',
                category: 'review',
                priority: 'high',
                notify: 'always',
                runner_id: 'codex',
                mode: 'safe_edit',
                model: 'gpt-5',
                cwd: '/workspace',
            }),
        );
        expect(draft).toMatchObject({
            task: 'Fix tests',
            category: 'review',
            priority: 'high',
            notify: 'always',
            runnerId: 'codex',
            mode: 'safe_edit',
            model: 'gpt-5',
            cwd: '/workspace',
        });
    });
});
