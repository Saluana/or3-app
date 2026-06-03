import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../app/utils/assistant-stream/execution', () => ({
    streamFollowJob: vi.fn(async () => ({
        sawStreamEvent: false,
        streamEndedWithFailure: false,
        streamedJobId: 'job_bg',
        runnerChatTurnForRecovery: null,
    })),
    streamFollowRunnerTurn: vi.fn(),
    streamRunnerChat: vi.fn(),
    fetchAndApplyJobSnapshot: vi.fn(),
    handleRunnerExecutionError: vi.fn(),
}));

vi.stubGlobal('useToast', () => ({ add: vi.fn() }));

import { resetChatSessionIndexesForTests } from '../../app/composables/useChatSessions';
import { useAssistantStream } from '../../app/composables/useAssistantStream';
import { useChatSessions } from '../../app/composables/useChatSessions';
import { useLocalCache } from '../../app/composables/useLocalCache';

describe('useAssistantStream send recovery', () => {
    afterEach(() => {
        useLocalCache().clearAll();
        resetChatSessionIndexesForTests();
        vi.clearAllMocks();
    });

    it('promotes the continue target session before resuming a background stream', async () => {
        useLocalCache().updateHost({
            id: 'test-host',
            name: 'Test Host',
            baseUrl: 'http://127.0.0.1:9100',
            token: 'secret',
        });

        const chat = useChatSessions();
        const background = chat.newSession('Background');
        const foreground = chat.newSession('Foreground');
        chat.setActiveChatSessionId(foreground.id);

        const assistant = chat.addMessage({
            sessionId: background.id,
            role: 'assistant',
            content: 'still streaming',
            status: 'streaming',
            jobId: 'job_bg',
            retryPayload: {
                text: 'continue please',
                transportText: 'continue please',
            },
        });

        const { send } = useAssistantStream();
        await send({
            text: 'continue please',
            transportText: 'continue please',
            followJobId: 'job_bg',
            continueMessageId: assistant.id,
            suppressUserEcho: true,
            runnerId: 'opencode',
        });
        expect(chat.activeSession.value?.id).toBe(background.id);
    });
});
