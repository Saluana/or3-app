import type { AssistantSendPayload, ChatMessage } from '~/types/app-state';

export function buildApprovedResumePayload(
    message: ChatMessage,
    jobId: string,
): AssistantSendPayload {
    return {
        ...(message.retryPayload ?? { text: '', transportText: '' }),
        followJobId: jobId,
        continueMessageId: message.id,
        suppressUserEcho: true,
        runnerChatSessionId: message.runnerChatSessionId,
        runnerChatTurnId: message.runnerChatTurnId,
        runnerId: message.runnerId,
    };
}

export function prepareAssistantResumeContinuation(
    patchMessage: (messageId: string, patch: Partial<ChatMessage>) => void,
    messageId: string,
    jobId: string,
) {
    patchMessage(messageId, {
        jobId,
        status: 'streaming',
        approvalState: 'retrying',
        error: undefined,
        errorCode: undefined,
    });
}
