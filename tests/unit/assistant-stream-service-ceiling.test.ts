import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ChatActivityEntry, ChatMessage } from '../../app/types/app-state';
import {
    defaultRunnerSendPayload,
    installRunnerChatRequestMock,
} from '../helpers/runnerChatApiMock';

const requestMock = vi.fn();
let streamFailure: unknown = null;

vi.mock('../../app/composables/useOr3Api', () => ({
    useOr3Api: () => ({
        async *stream(_path: string) {
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
        installRunnerChatRequestMock(requestMock, {
            sessionId: 'rcs_ceiling',
            turnId: 'rct_ceiling',
            jobId: 'job_ceiling',
            turnSnapshot: {
                status: 'succeeded',
                final_text: 'Recovered in ask mode.',
            },
        });
    });

    afterEach(() => {
        useLocalCache().clearAll();
        vi.clearAllMocks();
    });

    it('does not call removed direct-turn endpoints for runner chat sends', async () => {
        addHost();
        const assistant = useAssistantStream();
        assistant.chatMode.value = 'work';
        await assistant.send({
            text: 'hello loopback',
            transportText: 'hello loopback',
            ...defaultRunnerSendPayload,
        });

        expect(requestMock).not.toHaveBeenCalledWith(
            '/internal/v1/turns',
            expect.anything(),
        );
        expect(requestMock).toHaveBeenCalledWith(
            '/internal/v1/runner-chat/sessions',
            expect.objectContaining({
                method: 'POST',
            }),
        );
    });

    it('does not mark plain request failures as approval-required', async () => {
        addHost();
        streamFailure = new Error('stream unavailable');

        const assistant = useAssistantStream();
        await assistant.send({
            text: 'hello',
            transportText: 'hello',
            ...defaultRunnerSendPayload,
        });

        const assistantMessage = useChatSessions().messages.value.find(
            (message: ChatMessage) => message.role === 'assistant',
        );
        expect(assistantMessage?.status).toBe('failed');
        expect(assistantMessage?.approvalState).toBeUndefined();
        expect(assistantMessage?.approvalRequestId).toBeUndefined();
    });

    it('preserves existing partial content when a follow-up snapshot completes without new text', async () => {
        addHost();
        installRunnerChatRequestMock(requestMock, {
            sessionId: 'rcs_ceiling',
            turnId: 'rct_partial',
            jobId: 'job_partial',
            getTurnSnapshot: () => ({
                job_id: 'job_partial',
                status: 'completed',
                final_text: '',
                events: [],
            }),
        });

        const chat = useChatSessions();
        const session = chat.ensureSession();
        const assistantMessage = chat.addMessage({
            sessionId: session.id,
            role: 'assistant',
            content: 'Partial answer.',
            status: 'streaming',
            jobId: 'job_partial',
            runnerId: 'opencode',
            runnerChatSessionId: 'rcs_ceiling',
            runnerChatTurnId: 'rct_partial',
            retryPayload: {
                text: 'continue',
                transportText: 'continue',
                ...defaultRunnerSendPayload,
            },
            parts: [
                {
                    id: 'text:1',
                    type: 'text',
                    content: 'Partial answer.',
                },
            ],
        });

        await useAssistantStream().send({
            text: '',
            transportText: '',
            followJobId: 'job_partial',
            continueMessageId: assistantMessage.id,
            suppressUserEcho: true,
            runnerId: 'opencode',
            runnerChatSessionId: 'rcs_ceiling',
            runnerChatTurnId: 'rct_partial',
        });

        const latest = chat.messages.value.find(
            (message: ChatMessage) => message.id === assistantMessage.id,
        );
        expect(latest?.status).toBe('complete');
        expect(latest?.content).toBe('Partial answer.');
        expect(latest?.errorCode).toBeUndefined();
    });
});
