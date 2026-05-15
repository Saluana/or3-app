import { beforeEach, describe, expect, it } from 'vitest';
import { applySseEventToCache } from '../../app/composables/useJobs';
import { useLocalCache } from '../../app/composables/useLocalCache';

describe('applySseEventToCache', () => {
    beforeEach(() => {
        useLocalCache().clearAll();
    });

    function seed() {
        const cache = useLocalCache();
        cache.updateHost({
            id: 'alpha',
            name: 'Alpha',
            baseUrl: 'http://alpha.test',
            token: 'alpha-token',
        });
        cache.setActiveHost('alpha');
        cache.state.value.recentJobs.alpha = [
            {
                job_id: 'job-1',
                kind: 'subagent',
                status: 'queued',
                title: 'Test task',
                task: 'Test task',
                updated_at: '2026-04-24T10:00:00Z',
            },
        ];
        return cache;
    }

    it('updates status to running on a started event', () => {
        const cache = seed();
        const terminal = applySseEventToCache(cache, 'job-1', {
            event: 'started',
        });
        expect(terminal).toBe(false);
        expect(cache.state.value.recentJobs.alpha?.[0].status).toBe('running');
    });

    it('marks the job completed and stores final_text on completion', () => {
        const cache = seed();
        const terminal = applySseEventToCache(cache, 'job-1', {
            event: 'completion',
            data: JSON.stringify({
                status: 'succeeded',
                final_text: 'all done',
            }),
        });
        expect(terminal).toBe(true);
        const job = cache.state.value.recentJobs.alpha?.[0];
        expect(job?.status).toBe('completed');
        expect(job?.final_text).toBe('all done');
    });

    it('stores subagent preview text on completion', () => {
        const cache = seed();
        const terminal = applySseEventToCache(cache, 'job-1', {
            event: 'completion',
            data: JSON.stringify({
                status: 'succeeded',
                preview: 'subagent summary',
            }),
        });
        expect(terminal).toBe(true);
        const job = cache.state.value.recentJobs.alpha?.[0];
        expect(job?.status).toBe('completed');
        expect(job?.final_text).toBe('subagent summary');
    });

    it('stores error message on a runtime_error event', () => {
        const cache = seed();
        const terminal = applySseEventToCache(cache, 'job-1', {
            event: 'runtime_error',
            data: JSON.stringify({ message: 'tool crashed' }),
        });
        expect(terminal).toBe(true);
        const job = cache.state.value.recentJobs.alpha?.[0];
        expect(job?.status).toBe('failed');
        expect(job?.error).toBe('tool crashed');
    });

    it('appends streamed text deltas into final_text', () => {
        const cache = seed();
        applySseEventToCache(cache, 'job-1', {
            event: 'text_delta',
            data: JSON.stringify({ text: 'Hello, ' }),
        });
        applySseEventToCache(cache, 'job-1', {
            event: 'text_delta',
            data: JSON.stringify({ text: 'world!' }),
        });
        const job = cache.state.value.recentJobs.alpha?.[0];
        expect(job?.status).toBe('running');
        expect(job?.final_text).toBe('Hello, world!');
    });

    it('returns false and does not crash for unknown jobs', () => {
        const cache = seed();
        const terminal = applySseEventToCache(cache, 'no-such-job', {
            event: 'completion',
        });
        expect(terminal).toBe(false);
    });

    it('appends stdout chunk on output event', () => {
        const cache = seed();
        applySseEventToCache(cache, 'job-1', {
            event: 'output',
            data: JSON.stringify({ stream: 'stdout', chunk: 'Building...' }),
        });
        const job = cache.state.value.recentJobs.alpha?.[0];
        expect(job?.status).toBe('running');
        expect(job?.stdout_preview).toBe('Building...');
    });

    it('appends stderr chunk on output event', () => {
        const cache = seed();
        applySseEventToCache(cache, 'job-1', {
            event: 'output',
            data: JSON.stringify({ stream: 'stderr', chunk: 'WARNING: ...' }),
        });
        const job = cache.state.value.recentJobs.alpha?.[0];
        expect(job?.status).toBe('running');
        expect(job?.stderr_preview).toBe('WARNING: ...');
    });

    it('appends stdout and stderr separately', () => {
        const cache = seed();
        applySseEventToCache(cache, 'job-1', {
            event: 'output',
            data: JSON.stringify({ stream: 'stdout', chunk: 'Hello' }),
        });
        applySseEventToCache(cache, 'job-1', {
            event: 'output',
            data: JSON.stringify({ stream: 'stderr', chunk: 'Error!' }),
        });
        const job = cache.state.value.recentJobs.alpha?.[0];
        expect(job?.stdout_preview).toBe('Hello');
        expect(job?.stderr_preview).toBe('Error!');
    });

    it('sets output_truncated on output_truncated event', () => {
        const cache = seed();
        applySseEventToCache(cache, 'job-1', {
            event: 'output_truncated',
            data: JSON.stringify({ dropped_bytes: 1234 }),
        });
        const job = cache.state.value.recentJobs.alpha?.[0];
        expect(job?.output_truncated).toBe(true);
    });

    it('stores structured events boundedly', () => {
        const cache = seed();
        for (let i = 0; i < 5; i++) {
            applySseEventToCache(cache, 'job-1', {
                event: 'structured',
                data: JSON.stringify({ payload: { step: i } }),
            });
        }
        const job = cache.state.value.recentJobs.alpha?.[0];
        expect(job?.structured_events?.length).toBe(5);
        expect(job?.structured_events?.[0]).toEqual({
            payload: { step: 0 },
        });
    });

    it('keeps newest structured events after the cache limit', () => {
        const cache = seed();
        for (let i = 0; i < 105; i++) {
            applySseEventToCache(cache, 'job-1', {
                event: 'structured',
                data: JSON.stringify({ payload: { step: i } }),
            });
        }
        const job = cache.state.value.recentJobs.alpha?.[0];
        expect(job?.structured_events?.length).toBe(100);
        expect(job?.structured_events?.[0]).toEqual({
            payload: { step: 5 },
        });
        expect(job?.structured_events?.[99]).toEqual({
            payload: { step: 104 },
        });
    });

    it('keeps newest raw events after the cache limit', () => {
        const cache = seed();
        for (let i = 0; i < 205; i++) {
            applySseEventToCache(cache, 'job-1', {
                event: 'output',
                data: JSON.stringify({ stream: 'stdout', chunk: String(i) }),
            });
        }
        const job = cache.state.value.recentJobs.alpha?.[0];
        expect(job?.raw_events?.length).toBe(200);
        expect(job?.raw_events?.[0]).toEqual({
            stream: 'stdout',
            chunk: '5',
        });
        expect(job?.raw_events?.[199]).toEqual({
            stream: 'stdout',
            chunk: '204',
        });
    });

    it('handles completion with final_text_preview and stdout_preview', () => {
        const cache = seed();
        applySseEventToCache(cache, 'job-1', {
            event: 'completion',
            data: JSON.stringify({
                status: 'succeeded',
                final_text_preview: 'testing result',
                stdout_preview: 'full stdout',
                stderr_preview: '',
            }),
        });
        const job = cache.state.value.recentJobs.alpha?.[0];
        expect(job?.status).toBe('completed');
        expect(job?.final_text).toBe('testing result');
        expect(job?.stdout_preview).toBe('full stdout');
        expect(job?.stderr_preview).toBe('');
    });

    it('handles completion with timed_out status and error_message', () => {
        const cache = seed();
        applySseEventToCache(cache, 'job-1', {
            event: 'completion',
            data: JSON.stringify({
                status: 'timed_out',
                error_message: 'Task exceeded time limit',
            }),
        });
        const job = cache.state.value.recentJobs.alpha?.[0];
        expect(job?.status).toBe('failed');
        expect(job?.error).toBe('Task exceeded time limit');
    });

    it('populates raw_events on SSE event', () => {
        const cache = seed();
        applySseEventToCache(cache, 'job-1', {
            event: 'started',
            data: JSON.stringify({ job_id: 'job-1' }),
        });
        applySseEventToCache(cache, 'job-1', {
            event: 'output',
            data: JSON.stringify({ stream: 'stdout', chunk: 'hello' }),
        });
        const job = cache.state.value.recentJobs.alpha?.[0];
        expect(job?.raw_events?.length).toBeGreaterThanOrEqual(2);
    });
});
