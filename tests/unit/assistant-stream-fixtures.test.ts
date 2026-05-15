import { describe, expect, it } from 'vitest';

type StreamFixture = {
    event: string;
    data: Record<string, unknown>;
};

const currentStreamFixtures: StreamFixture[] = [
    { event: 'queued', data: { status: 'queued', job_id: 'job_fixture' } },
    { event: 'started', data: { status: 'running', job_id: 'job_fixture' } },
    {
        event: 'text_delta',
        data: { content: 'Hello', job_id: 'job_fixture' },
    },
    {
        event: 'tool_call',
        data: {
            name: 'read_file',
            arguments: '{"path":"README.md"}',
            tool_call_id: 'call_fixture',
            job_id: 'job_fixture',
        },
    },
    {
        event: 'tool_result',
        data: {
            name: 'read_file',
            result: 'contents',
            tool_call_id: 'call_fixture',
            job_id: 'job_fixture',
        },
    },
    {
        event: 'assistant',
        data: { content: 'Done', job_id: 'job_fixture' },
    },
    {
        event: 'completion',
        data: {
            status: 'completed',
            final_text: 'Done',
            job_id: 'job_fixture',
        },
    },
    {
        event: 'failed',
        data: { status: 'failed', message: 'failed', job_id: 'job_fixture' },
    },
    {
        event: 'aborted',
        data: { status: 'aborted', message: 'aborted', job_id: 'job_fixture' },
    },
    {
        event: 'approval_required',
        data: {
            status: 'approval_required',
            code: 'approval_required',
            request_id: 42,
            tool: 'exec',
            job_id: 'job_fixture',
        },
    },
];

describe('assistant stream event fixtures', () => {
    it('pins the current event names and minimum reducer payload fields', () => {
        expect(currentStreamFixtures.map((item) => item.event)).toEqual([
            'queued',
            'started',
            'text_delta',
            'tool_call',
            'tool_result',
            'assistant',
            'completion',
            'failed',
            'aborted',
            'approval_required',
        ]);

        for (const fixture of currentStreamFixtures) {
            expect(fixture.data.job_id).toBe('job_fixture');
        }
    });
});
