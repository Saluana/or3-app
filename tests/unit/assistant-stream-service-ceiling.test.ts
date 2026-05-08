import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ChatActivityEntry, ChatMessage } from '../../app/types/app-state';

const requestMock = vi.fn();
let streamFailure: unknown = null;

vi.mock('../../app/composables/useOr3Api', () => ({
    useOr3Api: () => ({
        async *stream() {
            if (streamFailure) throw streamFailure;
        },
        request: requestMock,
    }),
}));

import { useAssistantStream } from '../../app/composables/useAssistantStream';
import { useChatSessions } from '../../app/composables/useChatSessions';
import { useLocalCache } from '../../app/composables/useLocalCache';

function addHost() {
    useLocalCache().updateHost({
        id: 'test-host',
        name: 'Test Host',
        baseUrl: 'http://127.0.0.1:9100',
        token: 'secret',
    });
}

describe('assistant stream service ceiling handling', () => {
    beforeEach(() => {
        vi.stubGlobal('useToast', () => ({ add: vi.fn() }));
        requestMock.mockReset();
        streamFailure = null;
    });

    afterEach(() => {
        useLocalCache().clearAll();
        vi.clearAllMocks();
    });

    it('retries OR3 turns in ask mode when work mode exceeds the service ceiling', async () => {
        addHost();
        streamFailure = Object.assign(
            new Error('requested tools exceed service capability ceiling'),
            {
                status: 400,
                request_id: 'req_trace_1',
            },
        );
        requestMock.mockResolvedValue({
            status: 'completed',
            final_text: 'Recovered in ask mode.',
        });

        const assistant = useAssistantStream();
        assistant.chatMode.value = 'work';
        await assistant.send('check this safely');

        expect(requestMock).toHaveBeenCalledWith(
            '/internal/v1/turns',
            expect.objectContaining({
                body: expect.objectContaining({
                    tool_policy: { mode: 'ask' },
                }),
            }),
        );

        const assistantMessage = useChatSessions().messages.value.find(
            (message: ChatMessage) => message.role === 'assistant',
        );
        expect(assistantMessage?.status).toBe('complete');
        expect(assistantMessage?.content).toBe('Recovered in ask mode.');
        expect(
            assistantMessage?.activityLog?.some(
                (entry: ChatActivityEntry) => entry.type === 'policy_adjusted',
            ),
        ).toBe(true);
    });

    it('does not mark plain request failures as approval-required', async () => {
        addHost();
        streamFailure = new Error('stream unavailable');
        requestMock.mockRejectedValue({
            message: 'Bad request',
            status: 400,
            request_id: 'req_trace_2',
        });

        const assistant = useAssistantStream();
        await assistant.send('hello');

        const assistantMessage = useChatSessions().messages.value.find(
            (message: ChatMessage) => message.role === 'assistant',
        );
        expect(assistantMessage?.status).toBe('failed');
        expect(assistantMessage?.approvalState).toBeUndefined();
        expect(assistantMessage?.approvalRequestId).toBeUndefined();
    });
});
