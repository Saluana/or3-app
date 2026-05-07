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

    function ensureSession() {
        if (activeSession.value) return activeSession.value;
        const hostId = activeHost.value?.id ?? 'local';
        const timestamp = now();
        const session: ChatSession = {
            id: createId('session'),
            hostId,
            sessionKey: `or3-app:${hostId}:${Date.now().toString(36)}`,
            title: 'New conversation',
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

    function newSession(title = 'New conversation') {
        const hostId = activeHost.value?.id ?? 'local';
        const timestamp = now();
        const session: ChatSession = {
            id: createId('session'),
            hostId,
            sessionKey: `or3-app:${hostId}:${Date.now().toString(36)}`,
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
        newSession,
        addMessage,
        updateMessage,
        toggleMessagePin,
        findAssistantMessageForApproval,
        clearSessionMessages,
        appendSystemMessage,
        messageCount,
    };
}
