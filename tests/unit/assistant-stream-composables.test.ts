import { afterEach, describe, expect, it, vi } from 'vitest';
import { nextTick, ref } from 'vue';
import type {
    AssistantSendPayload,
    ChatSession,
    Or3AppState,
    Or3HostProfile,
} from '../../app/types/app-state';
import type { useChatRuntimeLog } from '../../app/composables/useChatRuntimeLog';
import type { useChatSessions } from '../../app/composables/useChatSessions';
import type { useOr3Api } from '../../app/composables/useOr3Api';

const {
    streamDirectTurn,
    streamFollowJob,
    streamFollowRunnerTurn,
    streamRunnerChat,
} = vi.hoisted(() => ({
    streamDirectTurn: vi.fn(),
    streamFollowJob: vi.fn(),
    streamFollowRunnerTurn: vi.fn(),
    streamRunnerChat: vi.fn(),
}));

vi.mock('../../app/utils/assistant-stream/execution', () => ({
    streamDirectTurn,
    streamFollowJob,
    streamFollowRunnerTurn,
    streamRunnerChat,
}));

import {
    resetApprovalHydrationForTests,
    useApprovalHydration,
} from '../../app/composables/assistant-stream/useApprovalHydration';
import { useExecutionRouter } from '../../app/composables/assistant-stream/useExecutionRouter';
import {
    resetStreamRecoveryForTests,
    useStreamRecovery,
} from '../../app/composables/assistant-stream/useStreamRecovery';

function createHost(): Or3HostProfile {
    return {
        id: 'test-host',
        name: 'Test Host',
        baseUrl: 'http://127.0.0.1:9100',
        token: 'secret',
    };
}

function createSession(): ChatSession {
    return {
        id: 'session_1',
        hostId: 'test-host',
        sessionKey: 'or3-app:test-host:session_1',
        title: 'Session',
        createdAt: '2026-05-13T00:00:00.000Z',
        updatedAt: '2026-05-13T00:00:00.000Z',
        runnerId: 'or3-intern',
        runnerLabel: 'OR3 Intern',
        runnerContinuationMode: 'replay',
    };
}

function createState(): Or3AppState {
    return {
        activeHostId: 'test-host',
        hosts: [createHost()],
        sessions: [createSession()],
        messages: [],
        drafts: {},
        recentJobs: {},
        lastKnownStatus: {},
        preferences: {},
    };
}

afterEach(() => {
    resetApprovalHydrationForTests();
    resetStreamRecoveryForTests();
    vi.clearAllMocks();
});

describe('assistant-stream helper composables', () => {
    it('recovers the oldest pending streaming assistant message', async () => {
        const isStreaming = ref(false);
        const send = vi.fn<
            (message: string | AssistantSendPayload) => Promise<void>
        >(async () => {
            isStreaming.value = true;
        });
        const state = createState();
        state.messages.push(
            {
                id: 'msg_oldest',
                sessionId: 'session_1',
                role: 'assistant',
                content: 'oldest',
                status: 'streaming',
                createdAt: '2026-05-13T00:00:00.000Z',
                jobId: 'job_oldest',
                retryPayload: {
                    text: 'retry oldest',
                    transportText: 'retry oldest',
                },
            },
            {
                id: 'msg_newest',
                sessionId: 'session_1',
                role: 'assistant',
                content: 'newest',
                status: 'streaming',
                createdAt: '2026-05-13T00:01:00.000Z',
                jobId: 'job_newest',
                retryPayload: {
                    text: 'retry newest',
                    transportText: 'retry newest',
                },
            },
        );

        const { recoverPendingMessages } = useStreamRecovery({
            activeHost: ref(createHost()),
            cacheState: ref(state),
            isStreaming,
            isClient: true,
            send,
        });

        await recoverPendingMessages();

        expect(send).toHaveBeenCalledTimes(1);
        expect(send).toHaveBeenCalledWith(
            expect.objectContaining({
                text: 'retry oldest',
                transportText: 'retry oldest',
                followJobId: 'job_oldest',
                continueMessageId: 'msg_oldest',
                suppressUserEcho: true,
            }),
        );
    });

    it('recovers pending streams from non-active sessions on the same host', async () => {
        const isStreaming = ref(false);
        const send = vi.fn<
            (message: string | AssistantSendPayload) => Promise<void>
        >(async () => {
            isStreaming.value = true;
        });
        const state = createState();
        state.sessions.unshift({
            ...createSession(),
            id: 'session_active',
            sessionKey: 'or3-app:test-host:session_active',
        });
        state.activeChatSessionIdByHost = { 'test-host': 'session_active' };
        state.messages.push({
            id: 'msg_background',
            sessionId: 'session_1',
            role: 'assistant',
            content: 'old paused response',
            status: 'streaming',
            createdAt: '2026-05-13T00:00:00.000Z',
            jobId: 'job_background',
            retryPayload: {
                text: 'retry background',
                transportText: 'retry background',
            },
        });

        const { recoverPendingMessages } = useStreamRecovery({
            activeHost: ref(createHost()),
            cacheState: ref(state),
            isStreaming,
            isClient: true,
            send,
        });

        await recoverPendingMessages();

        expect(send).toHaveBeenCalledTimes(1);
        expect(send).toHaveBeenCalledWith(
            expect.objectContaining({
                text: 'retry background',
                followJobId: 'job_background',
                continueMessageId: 'msg_background',
                suppressUserEcho: true,
            }),
        );
    });

    it('hydrates pending approvals for the active session only', async () => {
        const ensureApprovalMessage = vi.fn();
        const chat = {
            activeSession: ref(createSession()),
            isApprovalResolved: vi.fn().mockReturnValue(false),
            findAssistantMessageForApproval: vi.fn().mockReturnValue(null),
            ensureApprovalMessage,
        } as unknown as ReturnType<typeof useChatSessions>;
        const api = {
            request: vi.fn().mockResolvedValue({
                items: [
                    {
                        id: 42,
                        status: 'pending',
                        created_at: '2026-05-13T00:00:00.000Z',
                        requester_session_id: 'or3-app:test-host:session_1',
                    },
                    {
                        id: 99,
                        status: 'pending',
                        created_at: '2026-05-13T00:00:00.000Z',
                        requester_session_id: 'other-session',
                    },
                ],
            }),
        } as unknown as ReturnType<typeof useOr3Api>;
        const runtimeLog = {
            add: vi.fn(),
        } as unknown as ReturnType<typeof useChatRuntimeLog>;

        const { hydratePendingApprovalsForActiveSession } =
            useApprovalHydration({
                activeHost: ref(createHost()),
                api,
                chat,
                runtimeLog,
                isStreaming: ref(false),
                isClient: true,
            });

        await hydratePendingApprovalsForActiveSession();

        expect(api.request).toHaveBeenCalledWith(
            '/internal/v1/approvals?status=pending',
        );
        expect(ensureApprovalMessage).toHaveBeenCalledTimes(1);
        expect(ensureApprovalMessage).toHaveBeenCalledWith(
            expect.objectContaining({
                approvalRequestId: 42,
                sessionKey: 'or3-app:test-host:session_1',
                status: 'attention',
                approvalState: 'pending',
            }),
        );
    });

    it('does not rehydrate when the active session ref churns without a key change', async () => {
        const activeSession = ref(createSession());
        const chat = {
            activeSession,
            isApprovalResolved: vi.fn().mockReturnValue(false),
            findAssistantMessageForApproval: vi.fn().mockReturnValue(null),
            ensureApprovalMessage: vi.fn(),
        } as unknown as ReturnType<typeof useChatSessions>;
        const api = {
            request: vi.fn().mockResolvedValue({ items: [] }),
        } as unknown as ReturnType<typeof useOr3Api>;
        const runtimeLog = {
            add: vi.fn(),
        } as unknown as ReturnType<typeof useChatRuntimeLog>;

        useApprovalHydration({
            activeHost: ref(createHost()),
            api,
            chat,
            runtimeLog,
            isStreaming: ref(false),
            isClient: true,
        }).installApprovalHydrationWatcher();

        await nextTick();
        await Promise.resolve();
        await Promise.resolve();

        expect(api.request).toHaveBeenCalledTimes(1);

        activeSession.value = {
            ...activeSession.value,
            updatedAt: '2026-05-13T00:05:00.000Z',
        };

        await nextTick();
        await Promise.resolve();
        await Promise.resolve();

        expect(api.request).toHaveBeenCalledTimes(1);
    });

    it('routes follow-ups before starting a fresh direct turn', async () => {
        streamFollowRunnerTurn.mockResolvedValue({ route: 'runner_turn' });
        streamFollowJob.mockResolvedValue({ route: 'job' });
        streamDirectTurn.mockResolvedValue({ route: 'direct' });

        const chat = {} as ReturnType<typeof useChatSessions>;
        const { resolveExecutionRoute, routeExecution } = useExecutionRouter({
            chat,
        });
        const session = createSession();
        const payload: AssistantSendPayload = {
            text: 'continue',
            transportText: 'continue',
            runnerChatSessionId: 'runner_session_1',
        };

        const resolved = resolveExecutionRoute(payload, session);
        await routeExecution({
            executionContext: {} as never,
            followJobId: '',
            followRunnerTurnId: 'turn_1',
            payload,
            session,
            selectedRunnerId: resolved.selectedRunnerId,
            text: 'continue',
            turnRequest: null,
            useRunnerChat: resolved.useRunnerChat,
        });
        await routeExecution({
            executionContext: {} as never,
            followJobId: 'job_1',
            followRunnerTurnId: '',
            payload,
            session,
            selectedRunnerId: resolved.selectedRunnerId,
            text: 'continue',
            turnRequest: null,
            useRunnerChat: resolved.useRunnerChat,
        });
        await routeExecution({
            executionContext: {} as never,
            followJobId: '',
            followRunnerTurnId: '',
            payload,
            session,
            selectedRunnerId: resolved.selectedRunnerId,
            text: 'continue',
            turnRequest: { message: 'continue' },
            useRunnerChat: false,
        });

        expect(streamFollowRunnerTurn).toHaveBeenCalledWith(
            expect.objectContaining({
                runnerChatSessionId: 'runner_session_1',
                runnerChatTurnId: 'turn_1',
            }),
        );
        expect(streamFollowJob).toHaveBeenCalledWith(
            expect.objectContaining({ followJobId: 'job_1' }),
        );
        expect(streamDirectTurn).toHaveBeenCalledWith(
            expect.objectContaining({ turnRequest: { message: 'continue' } }),
        );
    });

    it('routes fresh non-default runners through runner chat', async () => {
        streamRunnerChat.mockResolvedValue({ route: 'runner_chat' });

        const chat = {
            bindRunnerChatSession: vi.fn(),
            messages: ref([]),
        } as unknown as ReturnType<typeof useChatSessions>;
        const { resolveExecutionRoute, routeExecution } = useExecutionRouter({
            chat,
        });
        const session = createSession();
        const payload: AssistantSendPayload = {
            text: 'hello runner',
            transportText: 'hello runner',
            runnerId: 'opencode',
        };
        const resolved = resolveExecutionRoute(payload, session);

        await routeExecution({
            executionContext: {} as never,
            followJobId: '',
            followRunnerTurnId: '',
            payload,
            session,
            selectedRunnerId: resolved.selectedRunnerId,
            text: 'hello runner',
            turnRequest: { message: 'hello runner' },
            useRunnerChat: resolved.useRunnerChat,
        });

        expect(resolved).toEqual({
            selectedRunnerId: 'opencode',
            useRunnerChat: true,
        });
        expect(streamRunnerChat).toHaveBeenCalledWith(
            expect.objectContaining({
                chat,
                session,
                payload,
                text: 'hello runner',
                selectedRunnerId: 'opencode',
            }),
        );
    });
});
