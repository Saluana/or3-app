import { watch, type Ref } from 'vue';
import type {
    AssistantSendPayload,
    ChatMessage,
    Or3AppState,
    Or3HostProfile,
} from '~/types/app-state';

type AssistantRecoverySend = (
    message: string | AssistantSendPayload,
) => Promise<void>;

interface UseStreamRecoveryOptions {
    activeHost: Ref<Or3HostProfile | null | undefined>;
    cacheState: Ref<Or3AppState>;
    isStreaming: Ref<boolean>;
    isClient?: boolean;
    send: AssistantRecoverySend;
}

let recoveryWatcherInstalled = false;
const recoveryAttempted = new Set<string>();

/** Test-only reset for watcher / in-flight recovery keys. */
export function resetStreamRecoveryForTests() {
    recoveryWatcherInstalled = false;
    recoveryAttempted.clear();
}

function sessionsForHost(state: Or3AppState, hostId: string) {
    return new Set(
        state.sessions
            .filter((session) => session.hostId === hostId)
            .map((session) => session.id),
    );
}

function pendingStreamingMessages(
    messages: ChatMessage[],
    sessionIds: Set<string>,
) {
    return messages.filter(
        (message) =>
            message.role === 'assistant' &&
            message.status === 'streaming' &&
            (Boolean(message.jobId) || Boolean(message.runnerChatTurnId)) &&
            sessionIds.has(message.sessionId),
    );
}

function oldestPendingStreamingMessage(
    state: Or3AppState,
    hostId: string,
): ChatMessage | undefined {
    const sessionIds = sessionsForHost(state, hostId);
    if (!sessionIds.size) return undefined;

    return pendingStreamingMessages(state.messages, sessionIds).sort(
        (left, right) =>
            Date.parse(left.createdAt || '') -
            Date.parse(right.createdAt || ''),
    )[0];
}

function recoveryWatchSignature(state: Or3AppState, hostId: string) {
    const sessionIds = sessionsForHost(state, hostId);
    const pending = pendingStreamingMessages(state.messages, sessionIds)
        .map(
            (message) =>
                `${message.id}:${message.sessionId}:${message.jobId || message.runnerChatTurnId}:${message.status}`,
        )
        .join('|');
    return `${hostId}:${pending}`;
}

export function useStreamRecovery(options: UseStreamRecoveryOptions) {
    const isClient = options.isClient ?? import.meta.client;

    const recoverPendingMessages = async () => {
        if (!isClient || options.isStreaming.value) return;

        const hostId = options.activeHost.value?.id?.trim();
        const hasAuth = Boolean(
            options.activeHost.value?.token?.trim() ||
                options.activeHost.value?.authMode === 'secure-session',
        );
        if (!hostId || !hasAuth) return;

        const pendingMessage = oldestPendingStreamingMessage(
            options.cacheState.value,
            hostId,
        );
        if (!pendingMessage?.jobId && !pendingMessage?.runnerChatTurnId) return;

        const recoveryKey = `${hostId}:${pendingMessage.id}:${pendingMessage.jobId || pendingMessage.runnerChatTurnId}`;
        if (recoveryAttempted.has(recoveryKey)) return;

        recoveryAttempted.add(recoveryKey);
        try {
            await options.send({
                ...(pendingMessage.retryPayload ?? {
                    text: pendingMessage.content,
                    transportText: pendingMessage.content,
                }),
                text:
                    pendingMessage.retryPayload?.text || pendingMessage.content,
                transportText:
                    pendingMessage.retryPayload?.transportText ||
                    pendingMessage.retryPayload?.text ||
                    pendingMessage.content,
                attachments: pendingMessage.retryPayload?.attachments || [],
                followJobId: pendingMessage.jobId,
                continueMessageId: pendingMessage.id,
                suppressUserEcho: true,
                runnerChatSessionId: pendingMessage.runnerChatSessionId,
                runnerChatTurnId: pendingMessage.runnerChatTurnId,
                runnerId: pendingMessage.runnerId,
            });
        } finally {
            recoveryAttempted.delete(recoveryKey);
            if (!options.isStreaming.value) {
                queueMicrotask(() => {
                    void recoverPendingMessages();
                });
            }
        }
    };

    const installRecoveryWatcher = () => {
        if (!isClient || recoveryWatcherInstalled) return;

        recoveryWatcherInstalled = true;
        watch(
            () => {
                const hostId = options.activeHost.value?.id ?? '';
                const tokenState = options.activeHost.value?.token
                    ? 'ready'
                    : 'none';
                const pendingSignature = recoveryWatchSignature(
                    options.cacheState.value,
                    hostId,
                );
                return `${hostId}:${tokenState}:${pendingSignature}`;
            },
            () => {
                void recoverPendingMessages();
            },
            { immediate: true },
        );
    };

    return {
        recoverPendingMessages,
        installRecoveryWatcher,
    };
}
