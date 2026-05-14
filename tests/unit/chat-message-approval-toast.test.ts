// @vitest-environment happy-dom
import { shallowMount } from '@vue/test-utils';
import { afterEach, describe, expect, it, vi } from 'vitest';

import ChatMessage from '../../app/components/assistant/ChatMessage.vue';
import type { ChatMessage as ChatMessageModel } from '../../app/types/app-state';

function deferred<T>() {
    let resolve!: (value: T | PromiseLike<T>) => void;
    let reject!: (reason?: unknown) => void;
    const promise = new Promise<T>((nextResolve, nextReject) => {
        resolve = nextResolve;
        reject = nextReject;
    });
    return { promise, resolve, reject };
}

const toastAdd = vi.hoisted(() => vi.fn());
const approveMock = vi.hoisted(() => vi.fn());
const denyMock = vi.hoisted(() => vi.fn());
const fetchApprovalMock = vi.hoisted(() => vi.fn());
const consumeIssuedApprovalTokenMock = vi.hoisted(() => vi.fn());
const sendMock = vi.hoisted(() => vi.fn());
const markApprovalResolvedMock = vi.hoisted(() => vi.fn());
const toggleMessagePinMock = vi.hoisted(() => vi.fn());
const sessionHistoryForkMock = vi.hoisted(() => vi.fn());

const messagesState = vi.hoisted(() => ({
    value: [] as ChatMessageModel[],
}));
const activeSessionState = vi.hoisted(() => ({
    value: { sessionKey: 'or3-app:test-host:session_1' },
}));
const streamingState = vi.hoisted(() => ({ value: false }));

vi.mock('@nuxt/ui/composables', () => ({
    useToast: () => ({ add: toastAdd }),
}));

vi.mock('../../app/composables/useApprovals', () => ({
    useApprovals: () => ({
        approve: approveMock,
        deny: denyMock,
        fetchApproval: fetchApprovalMock,
        consumeIssuedApprovalToken: consumeIssuedApprovalTokenMock,
    }),
}));

vi.mock('../../app/composables/useAssistantStream', () => ({
    useAssistantStream: () => ({
        isStreaming: streamingState,
        send: sendMock,
    }),
}));

vi.mock('../../app/composables/useChatSessions', () => ({
    useChatSessions: () => ({
        activeSession: activeSessionState,
        markApprovalResolved: markApprovalResolvedMock,
        messages: messagesState,
        toggleMessagePin: toggleMessagePinMock,
        updateMessage(id: string, patch: Partial<ChatMessageModel>) {
            const message = messagesState.value.find((item) => item.id === id);
            if (!message) return;
            Object.assign(message, patch);
        },
    }),
}));

vi.mock('../../app/composables/useSessionHistory', () => ({
    useSessionHistory: () => ({
        forkSession: sessionHistoryForkMock,
    }),
}));

function buildApprovalMessage(): ChatMessageModel {
    return {
        id: 'msg_approval',
        sessionId: 'session_1',
        role: 'assistant',
        content: 'Approval required before continuing.',
        status: 'attention',
        createdAt: '2026-05-13T20:00:00.000Z',
        approvalRequestId: 101,
        approvalState: 'pending',
        retryPayload: {
            text: 'continue',
            transportText: 'continue',
        },
        sourceSessionKey: 'or3-app:test-host:session_1',
    };
}

async function flushMicrotasks() {
    await Promise.resolve();
    await Promise.resolve();
}

describe('ChatMessage approval toast timing', () => {
    afterEach(() => {
        toastAdd.mockReset();
        approveMock.mockReset();
        denyMock.mockReset();
        fetchApprovalMock.mockReset();
        consumeIssuedApprovalTokenMock.mockReset();
        sendMock.mockReset();
        markApprovalResolvedMock.mockReset();
        toggleMessagePinMock.mockReset();
        sessionHistoryForkMock.mockReset();
        messagesState.value = [];
        streamingState.value = false;
    });

    it('shows approval granted immediately on click instead of waiting for resumed send to pause again', async () => {
        const message = buildApprovalMessage();
        messagesState.value = [message];

        const sendDeferred = deferred<void>();
        approveMock.mockResolvedValue({
            request_id: 101,
            token: 'approval-token',
        });
        consumeIssuedApprovalTokenMock.mockReturnValue(undefined);
        sendMock.mockReturnValue(sendDeferred.promise);

        const wrapper = shallowMount(ChatMessage, {
            props: { message },
            global: {
                stubs: {
                    Icon: true,
                    AssistantReasoningPanel: true,
                    AssistantToolCallList: true,
                    StreamingMarkdown: true,
                    AssistantInlineToolCall: true,
                    AssistantActivityLog: true,
                    UPopover: {
                        template: '<div><slot /><slot name="content" /></div>',
                    },
                },
            },
        });

        await wrapper
            .get('button[aria-label="Approve request"]')
            .trigger('click');
        await flushMicrotasks();

        expect(toastAdd).toHaveBeenCalledTimes(1);
        expect(toastAdd).toHaveBeenCalledWith(
            expect.objectContaining({
                title: 'Approval granted',
                description: 'The request was approved. OR3 is continuing now.',
            }),
        );

        messagesState.value[0] = {
            ...messagesState.value[0],
            approvalRequestId: 202,
            approvalState: 'pending',
            status: 'attention',
        };
        sendDeferred.resolve();
        await flushMicrotasks();

        expect(toastAdd).toHaveBeenCalledTimes(1);
    });
});
