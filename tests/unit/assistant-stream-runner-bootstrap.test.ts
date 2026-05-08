import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ChatMessage } from '../../app/types/app-state';

const requestMock = vi.fn();
const streamMock = vi.fn(async function* (path: string) {
    if (path.includes('/runner-chat/') && path.endsWith('/stream')) {
        yield {
            event: 'completion',
            json: {
                status: 'completed',
                job_id: 'job_runner_1',
            },
        };
    }
});

vi.mock('../../app/composables/useOr3Api', () => ({
    useOr3Api: () => ({
        stream: streamMock,
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

describe('assistant stream runner bootstrap', () => {
    beforeEach(() => {
        vi.stubGlobal('useToast', () => ({ add: vi.fn() }));
        requestMock.mockReset();
        streamMock.mockClear();
    });

    afterEach(() => {
        useLocalCache().clearAll();
        vi.clearAllMocks();
    });

    it('uses replay for the first native-capable runner turn before a session ref exists', async () => {
        addHost();
        requestMock.mockImplementation(async (path: string, options?: { body?: Record<string, unknown> }) => {
            if (path === '/internal/v1/runner-chat/sessions') {
                return {
                    id: 'rcs_bootstrap',
                    app_session_key: 'or3-app:test-host:session_1',
                    runner_id: 'opencode',
                    continuation_mode: 'native',
                };
            }
            if (path === '/internal/v1/runner-chat/sessions/rcs_bootstrap/turns') {
                expect(options?.body).toMatchObject({
                    continuation_mode: 'replay',
                    user_message: 'hello runner',
                });
                return {
                    session_id: 'rcs_bootstrap',
                    turn_id: 'rct_bootstrap',
                    job_id: 'job_runner_1',
                    status: 'running',
                };
            }
            if (path === '/internal/v1/runner-chat/sessions/rcs_bootstrap/turns/rct_bootstrap') {
                return {
                    id: 'rct_bootstrap',
                    session_id: 'rcs_bootstrap',
                    status: 'succeeded',
                    final_text: 'OpenCode says hi.',
                    agent_cli_job_id: 'job_runner_1',
                };
            }
            throw new Error(`Unexpected request path: ${path}`);
        });

        await useAssistantStream().send({
            text: 'hello runner',
            transportText: 'hello runner',
            attachments: [],
            runnerId: 'opencode',
            runnerLabel: 'OpenCode',
            runnerContinuationMode: 'native',
        });

        const assistantMessage = useChatSessions().messages.value.find(
            (message: ChatMessage) => message.role === 'assistant',
        );
        expect(assistantMessage?.status).toBe('complete');
        expect(assistantMessage?.content).toBe('OpenCode says hi.');
        expect(requestMock).toHaveBeenCalledWith(
            '/internal/v1/runner-chat/sessions/rcs_bootstrap/turns',
            expect.objectContaining({
                body: expect.objectContaining({ continuation_mode: 'replay' }),
            }),
        );
    });
});
