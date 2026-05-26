import type { ChatMessage } from '~/types/app-state';

export function isMessageApprovalPending(message: ChatMessage) {
    const requestId = String(message.approvalRequestId ?? '').trim();
    if (!requestId) return false;
    const state = String(message.approvalState ?? '').trim();
    if (state === 'pending' || state === 'retrying') return true;
    if (
        state &&
        !['pending', 'retrying', 'approved', 'denied', 'canceled', 'expired'].includes(
            state,
        )
    ) {
        return false;
    }
    return message.status === 'attention';
}

export function findPendingApprovalMessage(messages: ChatMessage[]) {
    for (let index = messages.length - 1; index >= 0; index -= 1) {
        const message = messages[index];
        if (!message || message.role !== 'assistant') continue;
        if (isMessageApprovalPending(message)) return message;
    }
    return null;
}

export const COMPOSER_APPROVAL_MESSAGE_ID_KEY = Symbol('composerApprovalMessageId');
