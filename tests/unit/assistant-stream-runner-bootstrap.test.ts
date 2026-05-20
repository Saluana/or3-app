import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ChatMessage } from '../../app/types/app-state';

const requestMock = vi.fn();
let runnerStreamEvents: unknown[] = [
    {
        event: 'completion',
        json: {
            status: 'completed',
            job_id: 'job_runner_1',
        },
    },
];
const streamMock = vi.fn(async function* (path: string) {
    if (path.includes('/runner-chat/') && path.endsWith('/stream')) {
        for (const event of runnerStreamEvents) {
            yield event;
        }
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
        runnerStreamEvents = [
            {
                event: 'completion',
                json: {
                    status: 'completed',
                    job_id: 'job_runner_1',
                },
            },
        ];
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
                    thinking_level: 'high',
                    meta: { runner_thinking_level: 'high' },
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
            runnerThinkingLevel: 'high',
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

    it('renders Gemini structured stdout as chat text with tool cards', async () => {
        addHost();
        requestMock.mockImplementation(async (path: string) => {
            if (path === '/internal/v1/runner-chat/sessions') {
                return {
                    id: 'rcs_gemini',
                    app_session_key: 'or3-app:test-host:session_1',
                    runner_id: 'gemini',
                    continuation_mode: 'replay',
                };
            }
            if (path === '/internal/v1/runner-chat/sessions/rcs_gemini/turns') {
                return {
                    session_id: 'rcs_gemini',
                    turn_id: 'rct_gemini',
                    job_id: 'job_gemini_1',
                    status: 'running',
                };
            }
            if (path === '/internal/v1/runner-chat/sessions/rcs_gemini/turns/rct_gemini') {
                return {
                    id: 'rct_gemini',
                    session_id: 'rcs_gemini',
                    status: 'succeeded',
                    final_text: JSON.stringify({
                        session_id: 'gemini-session',
                        response: "I'm online and ready to go.",
                        stats: {
                            models: {
                                'gemini-3-flash-preview': {
                                    api: { totalRequests: 3, totalErrors: 1 },
                                    tokens: { total: 21059 },
                                },
                            },
                            tools: {
                                byName: {
                                    update_topic: {
                                        count: 1,
                                        success: 1,
                                        fail: 0,
                                    },
                                    run_shell_command: {
                                        count: 1,
                                        success: 0,
                                        fail: 1,
                                    },
                                },
                            },
                        },
                    }),
                    agent_cli_job_id: 'job_gemini_1',
                };
            }
            throw new Error(`Unexpected request path: ${path}`);
        });

        await useAssistantStream().send({
            text: 'you working?',
            transportText: 'you working?',
            attachments: [],
            runnerId: 'gemini',
            runnerLabel: 'Gemini CLI',
            runnerContinuationMode: 'replay',
        });

        const assistantMessage = useChatSessions().messages.value.find(
            (message: ChatMessage) => message.role === 'assistant',
        );
        expect(assistantMessage?.content).toBe("I'm online and ready to go.");
        expect(assistantMessage?.content).not.toContain('session_id');
        expect(assistantMessage?.toolCalls?.map((call) => call.name)).toEqual([
            'update_topic',
            'run_shell_command',
        ]);
        expect(assistantMessage?.toolCalls?.[1]?.status).toBe('error');
        expect(
            assistantMessage?.activityLog?.some(
                (item) => item.type === 'runner_stats',
            ),
        ).toBe(true);
    });

    it('recovers runner final text over an existing empty-final warning', async () => {
        addHost();
        runnerStreamEvents = [];
        requestMock.mockImplementation(async (path: string) => {
            if (path === '/internal/v1/runner-chat/sessions/rcs_recover/turns/rct_recover') {
                return {
                    id: 'rct_recover',
                    session_id: 'rcs_recover',
                    status: 'succeeded',
                    final_text: 'Runner recovered final answer.',
                    agent_cli_job_id: 'job_runner_recover',
                };
            }
            throw new Error(`Unexpected request path: ${path}`);
        });

        const chat = useChatSessions();
        const session = chat.ensureSession();
        const warning =
            'Tool work completed, but or3-intern did not return a final assistant message. The last tool result is shown above; retry the turn if it still matters.';
        const assistant = chat.addMessage({
            sessionId: session.id,
            role: 'assistant',
            content: warning,
            status: 'attention',
            error: 'or3-intern completed without a final assistant message.',
            errorCode: 'empty_final_text',
            runnerId: 'opencode',
            runnerChatSessionId: 'rcs_recover',
            runnerChatTurnId: 'rct_recover',
            parts: [
                {
                    id: 'text:1',
                    type: 'text',
                    content: warning,
                },
            ],
        });

        await useAssistantStream().send({
            text: '',
            transportText: '',
            runnerChatSessionId: 'rcs_recover',
            runnerChatTurnId: 'rct_recover',
            continueMessageId: assistant.id,
            suppressUserEcho: true,
        });

        const latest = chat.messages.value.find(
            (message) => message.id === assistant.id,
        );
        expect(latest?.status).toBe('complete');
        expect(latest?.error).toBeUndefined();
        expect(latest?.errorCode).toBeUndefined();
        expect(latest?.content).toBe('Runner recovered final answer.');
        expect(latest?.parts?.map((part) => part.content)).toEqual([
            'Runner recovered final answer.',
        ]);
    });
});
