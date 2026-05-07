import { computed } from 'vue';
import type { ChatMessage, ChatSession } from '~/types/app-state';
import { useActiveHost } from './useActiveHost';
import { useLocalCache } from './useLocalCache';

function now() {
    return new Date().toISOString();
}

function createId(prefix: string) {
    return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

export function useChatSessions() {
    const cache = useLocalCache();
    const { activeHost } = useActiveHost();

    const sessions = computed(() =>
        cache.state.value.sessions.filter(
            (session) => session.hostId === activeHost.value?.id,
        ),
    );
    const activeSession = computed(() => sessions.value[0] ?? null);
    const messages = computed(() =>
        cache.state.value.messages.filter(
            (message) => message.sessionId === activeSession.value?.id,
        ),
    );
    const draftKey = computed(
        () =>
            `${activeHost.value?.id ?? 'none'}:${activeSession.value?.id ?? 'new'}`,
    );
    const draft = computed({
        get: () => cache.state.value.drafts[draftKey.value] ?? '',
        set: (value: string) => cache.setDraft(draftKey.value, value),
    });

    function sessionIndexById(sessionId: string) {
        return cache.state.value.sessions.findIndex(
            (item) => item.id === sessionId,
        );
    }

    function promoteSession(sessionId: string) {
        const index = sessionIndexById(sessionId);
        if (index < 0) return null;
        if (index === 0) {
            touchSession(sessionId);
            cache.persist();
            return cache.state.value.sessions[0] ?? null;
        }
        const [session] = cache.state.value.sessions.splice(index, 1);
        if (!session) return null;
        cache.state.value.sessions.unshift(session);
        touchSession(session.id);
        cache.persist();
        return session;
    }

    function ensureSession() {
        if (activeSession.value) return activeSession.value;
        const hostId = activeHost.value?.id ?? 'local';
        const timestamp = now();
        const id = createId('session');
        const session: ChatSession = {
            id,
            hostId,
            sessionKey: `or3-app:${hostId}:${id}`,
            title: 'New conversation',
            createdAt: timestamp,
            updatedAt: timestamp,
        };
        cache.state.value.sessions.unshift(session);
        cache.persist();
        return session;
    }

    function findSessionByKey(sessionKey?: string) {
        const requestedKey = sessionKey?.trim();
        if (!requestedKey) return null;
        const hostId = activeHost.value?.id;
        return (
            cache.state.value.sessions.find((session) => {
                if (hostId && session.hostId !== hostId) return false;
                return session.sessionKey === requestedKey;
            }) ?? null
        );
    }

    function activateSessionByKey(sessionKey?: string, title?: string) {
        const requestedKey = sessionKey?.trim();
        if (!requestedKey) return activeSession.value ?? ensureSession();

        const existing = findSessionByKey(requestedKey);
        if (existing) {
            if (
                (!existing.title || existing.title === 'New conversation') &&
                title?.trim()
            ) {
                existing.title = title.trim().slice(0, 48);
            }
            return promoteSession(existing.id);
        }

        const hostId = activeHost.value?.id ?? 'local';
        const timestamp = now();
        const session: ChatSession = {
            id: createId('session'),
            hostId,
            sessionKey: requestedKey,
            title: title?.trim().slice(0, 48) || 'New conversation',
            createdAt: timestamp,
            updatedAt: timestamp,
        };
        cache.state.value.sessions.unshift(session);
        cache.persist();
        return session;
    }

    function touchSession(sessionId: string, fallbackTitle?: string) {
        const session = cache.state.value.sessions.find(
            (item) => item.id === sessionId,
        );
        if (!session) return;
        session.updatedAt = now();
        if (
            (!session.title || session.title === 'New conversation') &&
            fallbackTitle?.trim()
        ) {
            session.title = fallbackTitle.trim().slice(0, 48);
        }
    }

    function addMessage(
        message: Omit<ChatMessage, 'id' | 'createdAt'> &
            Partial<Pick<ChatMessage, 'id' | 'createdAt'>>,
    ) {
        const complete: ChatMessage = {
            id: message.id ?? createId('msg'),
            createdAt: message.createdAt ?? now(),
            ...message,
        };
        cache.state.value.messages.push(complete);
        touchSession(
            complete.sessionId,
            complete.role === 'user' ? complete.content : undefined,
        );
        cache.persist();
        return complete;
    }

    function updateMessage(id: string, patch: Partial<ChatMessage>) {
        const message = cache.state.value.messages.find(
            (item) => item.id === id,
        );
        if (!message) return;
        Object.assign(message, patch);
        touchSession(message.sessionId);
        cache.persist();
    }

    function toggleMessagePin(id: string) {
        const message = cache.state.value.messages.find(
            (item) => item.id === id,
        );
        if (!message) return false;
        message.pinned = !message.pinned;
        touchSession(message.sessionId);
        cache.persist();
        return message.pinned;
    }

    function findAssistantMessageForApproval(
        approvalRequestId: number | string | undefined,
        sessionKey?: string,
    ) {
        const approvalKey = String(approvalRequestId ?? '').trim();
        if (!approvalKey) return null;

        const hostId = activeHost.value?.id;
        const requestedSessionKey = sessionKey?.trim();
        const sessionIds = new Set(
            cache.state.value.sessions
                .filter((session) => {
                    if (hostId && session.hostId !== hostId) return false;
                    if (requestedSessionKey)
                        return session.sessionKey === requestedSessionKey;
                    return session.id === activeSession.value?.id;
                })
                .map((session) => session.id),
        );
        if (!sessionIds.size) return null;

        for (
            let index = cache.state.value.messages.length - 1;
            index >= 0;
            index--
        ) {
            const message = cache.state.value.messages[index];
            if (!message || message.role !== 'assistant') continue;
            if (!sessionIds.has(message.sessionId)) continue;
            if (String(message.approvalRequestId ?? '').trim() !== approvalKey)
                continue;
            return message;
        }
        return null;
    }

    function ensureApprovalMessage(options: {
        approvalRequestId: number | string;
        sessionKey?: string;
        content?: string;
        createdAt?: string;
        status?: ChatMessage['status'];
        approvalState?: ChatMessage['approvalState'];
    }) {
        const approvalKey = String(options.approvalRequestId ?? '').trim();
        if (!approvalKey) return null;

        const existing = findAssistantMessageForApproval(
            options.approvalRequestId,
            options.sessionKey,
        );
        if (existing) {
            updateMessage(existing.id, {
                status: options.status ?? existing.status ?? 'attention',
                approvalState:
                    options.approvalState ??
                    existing.approvalState ??
                    'pending',
                content:
                    existing.content || options.content || existing.content,
                error: undefined,
            });
            return (
                cache.state.value.messages.find(
                    (item) => item.id === existing.id,
                ) ?? existing
            );
        }

        const session = options.sessionKey
            ? activateSessionByKey(options.sessionKey)
            : ensureSession();
        if (!session) return null;

        return addMessage({
            sessionId: session.id,
            role: 'assistant',
            content:
                options.content ||
                'Approval is needed before or3-intern can continue.',
            status: options.status ?? 'attention',
            approvalRequestId: options.approvalRequestId,
            approvalState: options.approvalState ?? 'pending',
            createdAt: options.createdAt,
            reasoningText: '',
            toolCalls: [],
            parts: [],
            activityLog: [],
        });
    }

    function newSession(title = 'New conversation') {
        const hostId = activeHost.value?.id ?? 'local';
        const timestamp = now();
        const id = createId('session');
        const session: ChatSession = {
            id,
            hostId,
            sessionKey: `or3-app:${hostId}:${id}`,
            title,
            createdAt: timestamp,
            updatedAt: timestamp,
        };
        cache.state.value.sessions.unshift(session);
        cache.persist();
        return session;
    }

    function clearSessionMessages(sessionId = activeSession.value?.id) {
        if (!sessionId) return 0;
        const before = cache.state.value.messages.length;
        cache.state.value.messages = cache.state.value.messages.filter(
            (message) => message.sessionId !== sessionId,
        );
        const removed = before - cache.state.value.messages.length;
        const session = cache.state.value.sessions.find(
            (item) => item.id === sessionId,
        );
        if (session) {
            session.updatedAt = now();
            session.title = 'New conversation';
        }
        cache.persist();
        return removed;
    }

    function appendSystemMessage(
        content: string,
        sessionId = activeSession.value?.id,
    ) {
        const targetSession = sessionId
            ? cache.state.value.sessions.find((item) => item.id === sessionId)
            : ensureSession();
        const resolvedSession = targetSession ?? ensureSession();
        return addMessage({
            sessionId: resolvedSession.id,
            role: 'system',
            content,
            status: 'complete',
        });
    }

    function messageCount(sessionId = activeSession.value?.id) {
        if (!sessionId) return 0;
        return cache.state.value.messages.filter(
            (message) => message.sessionId === sessionId,
        ).length;
    }

    return {
        sessions,
        activeSession,
        messages,
        draft,
        ensureSession,
        findSessionByKey,
        activateSessionByKey,
        newSession,
        addMessage,
        updateMessage,
        toggleMessagePin,
        findAssistantMessageForApproval,
        ensureApprovalMessage,
        clearSessionMessages,
        appendSystemMessage,
        messageCount,
    };
}
