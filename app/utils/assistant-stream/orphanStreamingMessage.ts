import type { ChatMessage } from '~/types/app-state';
import { EMPTY_STREAM_USER_MESSAGE } from '~/utils/assistant-stream/userErrorCopy';

export function isOrphanClientStreamingMessage(
    message: Pick<
        ChatMessage,
        'role' | 'status' | 'jobId' | 'runnerChatTurnId'
    >,
): boolean {
    return (
        message.role === 'assistant' &&
        message.status === 'streaming' &&
        !message.jobId &&
        !message.runnerChatTurnId
    );
}

/** Mark a client-only streaming placeholder failed (reload or aborted send). */
export function markOrphanClientStreamingFailed<T extends ChatMessage>(
    message: T,
): T {
    if (!isOrphanClientStreamingMessage(message)) return message;
    const failureText = EMPTY_STREAM_USER_MESSAGE;
    return {
        ...message,
        status: 'failed',
        content: failureText,
        error: failureText,
        errorCode: 'client_error',
        activityLog: (message.activityLog ?? []).map((entry) =>
            entry.status === 'running'
                ? { ...entry, status: 'error' as const }
                : entry,
        ),
    };
}
