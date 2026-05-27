import { afterEach, describe, expect, it, vi } from 'vitest';
import { ref } from 'vue';
import type {
    AssistantSendPayload,
    ChatSession,
    Or3AppState,
    Or3HostProfile,
} from '../../app/types/app-state';
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
        createdAt: '2026-05-24T00:00:00.000Z',
        updatedAt: '2026-05-24T00:00:00.000Z',
        runnerId: 'or3-intern',
        runnerLabel: 'OR3 Intern',
        runnerContinuationMode: 'replay',
    };
}

afterEach(() => {
    resetStreamRecoveryForTests();
    vi.clearAllMocks();
});

describe('stream recovery for approved resume jobs', () => {
    it('recovers assistant messages left retrying with a resume job id', async () => {
        const isStreaming = ref(false);
        const send = vi.fn<
            (message: string | AssistantSendPayload) => Promise<void>
        >(async () => {
            isStreaming.value = true;
        });
        const state: Or3AppState = {
            activeHostId: 'test-host',
            hosts: [createHost()],
            sessions: [createSession()],
            messages: [
                {
                    id: 'msg_resume',
                    sessionId: 'session_1',
                    role: 'assistant',
                    content: 'Waiting to continue',
                    status: 'attention',
                    approvalState: 'retrying',
                    createdAt: '2026-05-24T00:00:00.000Z',
                    jobId: 'job_resume',
                    retryPayload: {
                        text: '',
                        transportText: '',
                    },
                },
            ],
            drafts: {},
            recentJobs: {},
            lastKnownStatus: {},
            preferences: {},
        };

        const { recoverPendingMessages } = useStreamRecovery({
            activeHost: ref(createHost()),
            cacheState: ref(state),
            isStreaming,
            isClient: true,
            send,
        });

        await recoverPendingMessages();

        expect(send).toHaveBeenCalledWith(
            expect.objectContaining({
                followJobId: 'job_resume',
                continueMessageId: 'msg_resume',
                suppressUserEcho: true,
            }),
        );
    });

    it('recovers assistant messages stuck on generic job failed stubs', async () => {
        const isStreaming = ref(false);
        const send = vi.fn<
            (message: string | AssistantSendPayload) => Promise<void>
        >(async () => {
            isStreaming.value = true;
        });
        const state: Or3AppState = {
            activeHostId: 'test-host',
            hosts: [createHost()],
            sessions: [createSession()],
            messages: [
                {
                    id: 'msg_failed',
                    sessionId: 'session_1',
                    role: 'assistant',
                    content: 'job failed',
                    status: 'failed',
                    createdAt: '2026-05-24T00:00:00.000Z',
                    jobId: 'job_failed',
                    retryPayload: {
                        text: 'make a two liner',
                        transportText: 'make a two liner',
                    },
                },
            ],
            drafts: {},
            recentJobs: {},
            lastKnownStatus: {},
            preferences: {},
        };

        const { recoverPendingMessages } = useStreamRecovery({
            activeHost: ref(createHost()),
            cacheState: ref(state),
            isStreaming,
            isClient: true,
            send,
        });

        await recoverPendingMessages();

        expect(send).toHaveBeenCalledWith(
            expect.objectContaining({
                followJobId: 'job_failed',
                continueMessageId: 'msg_failed',
                suppressUserEcho: true,
            }),
        );
    });
});
