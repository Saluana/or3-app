import type { Ref } from 'vue';
import type { ChatMessage, ChatSession } from '~/types/app-state';
import type { useLocalCache } from '../useLocalCache';
import { createId, now } from './chat-session-utils';

const MAX_RESOLVED_APPROVAL_KEYS = 500;
const resolvedApprovalKeys = new Set<string>();

function rememberResolvedApprovalKey(key: string) {
    if (resolvedApprovalKeys.has(key)) resolvedApprovalKeys.delete(key);
    resolvedApprovalKeys.add(key);
    while (resolvedApprovalKeys.size > MAX_RESOLVED_APPROVAL_KEYS) {
        const oldest = resolvedApprovalKeys.values().next().value as
            | string
            | undefined;
        if (!oldest) break;
        resolvedApprovalKeys.delete(oldest);
    }
}

function approvalResolutionKeys(
    approvalRequestId: number | string | undefined,
    sessionKey?: string,
) {
    const approvalKey = String(approvalRequestId ?? '').trim();
    if (!approvalKey) return [];
    const requestedSessionKey = sessionKey?.trim();
    return [
        `approval:${approvalKey}`,
        requestedSessionKey
            ? `approval:${requestedSessionKey}:${approvalKey}`
            : '',
    ].filter(Boolean);
}

export interface ChatApprovalsDeps {
    cache: ReturnType<typeof useLocalCache>;
    activeHost: Ref<{ id?: string } | null | undefined>;
    activeSession: Ref<ChatSession | null>;
    findSessionByKey: (sessionKey: string) => ChatSession | null | undefined;
    activateSessionByKey: (
        sessionKey: string,
        title?: string,
    ) => ChatSession | null;
    ensureSession: () => ChatSession;
    updateMessage: (
        id: string,
        patch: Partial<ChatMessage>,
    ) => ChatMessage | undefined;
    addMessage: (
        message: Omit<ChatMessage, 'id' | 'createdAt'> &
            Partial<Pick<ChatMessage, 'id' | 'createdAt'>>,
    ) => ChatMessage;
}

export function resetChatApprovalsForTests() {
    resolvedApprovalKeys.clear();
}

export function createChatApprovals(deps: ChatApprovalsDeps) {
    function findAssistantMessageForApproval(
        approvalRequestId: number | string | undefined,
        sessionKey?: string,
    ) {
        const approvalKey = String(approvalRequestId ?? '').trim();
        if (!approvalKey) return null;

        const hostId = deps.activeHost.value?.id;
        const requestedSessionKey = sessionKey?.trim();
        const sessionIds = new Set(
            deps.cache.state.value.sessions
                .filter((session) => {
                    if (hostId && session.hostId !== hostId) return false;
                    if (requestedSessionKey)
                        return session.sessionKey === requestedSessionKey;
                    return session.id === deps.activeSession.value?.id;
                })
                .map((session) => session.id),
        );
        if (!sessionIds.size) return null;

        for (
            let index = deps.cache.state.value.messages.length - 1;
            index >= 0;
            index--
        ) {
            const message = deps.cache.state.value.messages[index];
            if (!message || message.role !== 'assistant') continue;
            if (!sessionIds.has(message.sessionId)) continue;
            if (String(message.approvalRequestId ?? '').trim() !== approvalKey)
                continue;
            return message;
        }
        return null;
    }

    function isApprovalResolved(
        approvalRequestId: number | string | undefined,
        sessionKey?: string,
    ) {
        return approvalResolutionKeys(approvalRequestId, sessionKey).some(
            (key) => resolvedApprovalKeys.has(key),
        );
    }

    function findApprovalAttachTarget(sessionKey?: string) {
        const requestedSessionKey = sessionKey?.trim();
        const targetSession = requestedSessionKey
            ? deps.findSessionByKey(requestedSessionKey)
            : deps.activeSession.value;
        if (!targetSession) return null;

        for (
            let index = deps.cache.state.value.messages.length - 1;
            index >= 0;
            index--
        ) {
            const message = deps.cache.state.value.messages[index];
            if (!message || message.role !== 'assistant') continue;
            if (message.sessionId !== targetSession.id) continue;
            if (message.approvalRequestId) continue;
            if (
                message.status === 'streaming' ||
                message.status === 'attention' ||
                message.errorCode === 'approval_required'
            ) {
                return message;
            }
        }
        return null;
    }

    function markApprovalResolved(
        approvalRequestId: number | string | undefined,
        state: NonNullable<ChatMessage['approvalState']>,
        sessionKey?: string,
        error?: string,
    ) {
        const keys = approvalResolutionKeys(approvalRequestId, sessionKey);
        for (const key of keys) rememberResolvedApprovalKey(key);

        const approvalKey = String(approvalRequestId ?? '').trim();
        if (!approvalKey) return;
        const resolvedSessionKey = sessionKey?.trim();
        const sessionById = new Map(
            deps.cache.state.value.sessions.map((session) => [
                session.id,
                session,
            ]),
        );
        for (const message of deps.cache.state.value.messages) {
            if (message.role !== 'assistant') continue;
            if (String(message.approvalRequestId ?? '').trim() !== approvalKey)
                continue;
            if (
                resolvedSessionKey &&
                sessionById.get(message.sessionId)?.sessionKey !==
                    resolvedSessionKey
            ) {
                continue;
            }
            const preserveLiveStatus =
                message.status === 'streaming' ||
                message.approvalState === 'retrying';
            deps.updateMessage(message.id, {
                approvalRequestId: undefined,
                approvalState: state === 'approved' ? undefined : state,
                status:
                    state === 'failed'
                        ? 'failed'
                        : preserveLiveStatus
                          ? message.status
                          : 'complete',
                error,
                errorCode: undefined,
            });
        }
    }

    function ensureApprovalMessage(options: {
        approvalRequestId: number | string;
        sessionKey?: string;
        content?: string;
        createdAt?: string;
        status?: ChatMessage['status'];
        approvalState?: ChatMessage['approvalState'];
        approvalType?: string;
        approvalPreview?: string;
    }) {
        const approvalKey = String(options.approvalRequestId ?? '').trim();
        if (!approvalKey) return null;
        if (isApprovalResolved(options.approvalRequestId, options.sessionKey)) {
            return null;
        }

        const existing = findAssistantMessageForApproval(
            options.approvalRequestId,
            options.sessionKey,
        );
        if (existing) {
            deps.updateMessage(existing.id, {
                status: options.status ?? existing.status ?? 'attention',
                approvalState:
                    options.approvalState ??
                    existing.approvalState ??
                    'pending',
                content:
                    existing.content || options.content || existing.content,
                approvalType: options.approvalType ?? existing.approvalType,
                approvalPreview:
                    options.approvalPreview ?? existing.approvalPreview,
                error: undefined,
            });
            return (
                deps.cache.state.value.messages.find(
                    (item) => item.id === existing.id,
                ) ?? existing
            );
        }

        const attachTarget = findApprovalAttachTarget(options.sessionKey);
        if (attachTarget) {
            deps.updateMessage(attachTarget.id, {
                approvalRequestId: options.approvalRequestId,
                approvalState: options.approvalState ?? 'pending',
                status: options.status ?? 'attention',
                content:
                    attachTarget.content ||
                    options.content ||
                    attachTarget.content,
                approvalType: options.approvalType ?? attachTarget.approvalType,
                approvalPreview:
                    options.approvalPreview ?? attachTarget.approvalPreview,
                error: undefined,
                errorCode: 'approval_required',
            });
            return (
                deps.cache.state.value.messages.find(
                    (item) => item.id === attachTarget.id,
                ) ?? attachTarget
            );
        }

        const session = options.sessionKey
            ? deps.activateSessionByKey(options.sessionKey)
            : deps.ensureSession();
        if (!session) return null;

        return deps.addMessage({
            sessionId: session.id,
            role: 'assistant',
            content:
                options.content ||
                'Approval is needed before or3-intern can continue.',
            status: options.status ?? 'attention',
            approvalRequestId: options.approvalRequestId,
            approvalType: options.approvalType,
            approvalPreview: options.approvalPreview,
            approvalState: options.approvalState ?? 'pending',
            createdAt: options.createdAt,
            reasoningText: '',
            toolCalls: [],
            parts: [],
            activityLog: [],
        });
    }

    return {
        findAssistantMessageForApproval,
        isApprovalResolved,
        markApprovalResolved,
        ensureApprovalMessage,
    };
}
