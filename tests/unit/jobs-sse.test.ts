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
});
