import { describe, expect, it } from 'vitest';
import {
    findPendingApprovalMessage,
    isMessageApprovalPending,
} from '~/utils/chat/pending-approval-message';
import type { ChatMessage } from '~/types/app-state';

function assistantMessage(
    overrides: Partial<ChatMessage> = {},
): ChatMessage {
    return {
        id: 'msg-1',
        role: 'assistant',
        content: '',
        status: 'attention',
        approvalRequestId: '42',
        approvalState: 'pending',
        ...overrides,
    };
}

describe('pending approval message helpers', () => {
    it('detects pending approval messages', () => {
        expect(isMessageApprovalPending(assistantMessage())).toBe(true);
        expect(
            isMessageApprovalPending(
                assistantMessage({
                    approvalState: 'denied',
                    status: 'done',
                }),
            ),
        ).toBe(false);
    });

    it('returns the latest pending assistant message', () => {
        const messages = [
            assistantMessage({ id: 'older', approvalRequestId: '1' }),
            { id: 'user-1', role: 'user', content: 'hi', status: 'done' },
            assistantMessage({ id: 'newer', approvalRequestId: '2' }),
        ] as ChatMessage[];

        expect(findPendingApprovalMessage(messages)?.id).toBe('newer');
    });
});
