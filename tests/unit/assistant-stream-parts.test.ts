import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const streamEvents: Array<{
    event: string;
    sequence: number;
    data: Record<string, unknown>;
}> = [];

vi.mock('../../app/composables/useOr3Api', () => ({
    useOr3Api: () => ({
        async *stream(
            _path: string,
            options?: { onOpen?: (response: Response) => void },
        ) {
            options?.onOpen?.(
                new Response(null, {
                    headers: { 'X-Or3-Job-Id': 'job_parts' },
                }),
            );
            for (const event of streamEvents) {
                yield event;
            }
        },
        request: vi.fn(async () => ({
            job_id: 'job_parts',
            status: 'completed',
            events: [],
        })),
    }),
}));

import { useAssistantStream } from '../../app/composables/useAssistantStream';
import { useChatSessions } from '../../app/composables/useChatSessions';
import { useLocalCache } from '../../app/composables/useLocalCache';

describe('assistant stream ordered parts', () => {
    beforeEach(() => {
        vi.stubGlobal('useToast', () => ({ add: vi.fn() }));
    });

    afterEach(() => {
        streamEvents.length = 0;
        useLocalCache().clearAll();
        vi.clearAllMocks();
    });

    it('keeps tool calls at the point where they occurred in streamed text', async () => {
        useLocalCache().updateHost({
            id: 'test-host',
            name: 'Test Host',
            baseUrl: 'http://127.0.0.1:9100',
            token: 'secret',
        });

        streamEvents.push(
            {
                event: 'text_delta',
                sequence: 1,
                data: { content: 'First text.', job_id: 'job_parts' },
            },
            {
                event: 'tool_call',
                sequence: 2,
                data: {
                    name: 'read_file',
                    arguments: '{"path":"README.md"}',
                    tool_call_id: 'call_1',
                    job_id: 'job_parts',
                },
            },
            {
                event: 'tool_result',
                sequence: 3,
                data: {
                    name: 'read_file',
                    result: 'contents',
                    tool_call_id: 'call_1',
                    job_id: 'job_parts',
                },
            },
            {
                event: 'text_delta',
                sequence: 4,
                data: { content: ' Final text.', job_id: 'job_parts' },
            },
            {
                event: 'completion',
                sequence: 5,
                data: { status: 'completed', job_id: 'job_parts' },
            },
        );

        await useAssistantStream().send('check file');

        const assistant = useChatSessions().messages.value.find(
            (message) => message.role === 'assistant',
        );

        expect(assistant?.content).toBe('First text. Final text.');
        expect(
            assistant?.parts?.map((part) =>
                part.type === 'text' ? part.content : part.name,
            ),
        ).toEqual(['First text.', 'read_file', 'Final text.']);
        expect(assistant?.parts?.[1]).toMatchObject({
            type: 'tool',
            toolCallId: 'call_1',
            status: 'complete',
            resultPreview: 'contents',
        });
    });
});
