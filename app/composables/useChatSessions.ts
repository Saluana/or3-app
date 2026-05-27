import { computed } from 'vue';
import type { ChatMessage, ChatSession } from '~/types/app-state';
import type { ChatHistoryMessage, ChatSessionMeta } from '~/types/or3-api';
import { compactAssistantRunMessages } from '~/utils/chat/merge-assistant-run';
import {
    resetHostSessionsForTests,
    syncHostSessions,
    useHostSessionsRef,
} from './chat/chat-host-sessions';
import { backendIdsForMessage } from './chat/chat-hydration-utils';
import type { MessageMutationOptions } from './chat/chat-message-mutation';

export type { MessageMutationOptions } from './chat/chat-message-mutation';
import {
    createChatApprovals,
    resetChatApprovalsForTests,
} from './chat/useChatApprovals';
import { hydrateBackendMessages } from './chat/useChatHydration';
import {
    bumpActiveSessionMessagesView,
    clearSessionMessageIndex,
    createdAtForNewMessage,
    findMessageInIndex,
    indexMessage,
    installChatMessageIndexSync,
    reindexMessagesFromCache,
    removeMessageFromIndex,
    refreshActiveSessionMessages,
    replaceIndexedMessage,
    resetChatMessageIndexForTests,
    sessionMessagesFor,
    setSessionMessagesInIndex,
    useChatMessageIndex,
} from './chat/useChatMessageIndex';
import { createId, msToIso, now } from './chat/chat-session-utils';
import { useActiveHost } from './useActiveHost';
import { useLocalCache } from './useLocalCache';

let chatSyncInstalled = false;

/** Test-only reset for module-level chat indexes. */
export function resetChatSessionIndexesForTests() {
    resetChatMessageIndexForTests();
    resetHostSessionsForTests();
    resetChatApprovalsForTests();
    chatSyncInstalled = false;
}

function defaultRunnerFields() {
    return {
        runnerId: 'or3-intern',
        runnerLabel: 'OR3 Intern',
        runnerContinuationMode: 'replay',
        archived: false,
    } satisfies Partial<ChatSession>;
}

function patchFromBackendSessionMeta(
    meta: ChatSessionMeta,
    session: ChatSession,
): Partial<ChatSession> {
    return {
        title: meta.title || session.title,
        runnerId: meta.runner_id || session.runnerId || 'or3-intern',
        runnerLabel: meta.runner_label || session.runnerLabel,
        runnerChatSessionId:
            meta.runner_chat_session_id || session.runnerChatSessionId,
        runnerContinuationMode:
            meta.runner_continuation_mode ||
            session.runnerContinuationMode ||
            'replay',
        runnerModel: meta.runner_model || session.runnerModel,
        runnerMode: meta.runner_mode || session.runnerMode,
        runnerIsolation: meta.runner_isolation || session.runnerIsolation,
        runnerCwd: meta.runner_cwd || session.runnerCwd,
        backendMessageCount: meta.message_count,
        lastMessagePreview: meta.last_message_preview,
        lastMessageAt: meta.last_message_at
            ? msToIso(meta.last_message_at)
            : session.lastMessageAt,
        parentSessionKey: meta.parent_session_key || undefined,
        forkAnchorMessageId: meta.fork_anchor_message_id || undefined,
        forkedFromRunnerId: meta.forked_from_runner_id || undefined,
        forkStrategy: meta.fork_strategy || undefined,
        archived: Boolean(meta.archived),
        createdAt: meta.created_at
            ? msToIso(meta.created_at)
            : session.createdAt,
        updatedAt: meta.updated_at ? msToIso(meta.updated_at) : now(),
    };
}

function normalizeContent(value?: string) {
    return (value ?? '').trim();
}

function messagePreview(value?: string) {
    return normalizeContent(value).replace(/\s+/g, ' ').slice(0, 160);
}

export function useChatSessions() {
    const cache = useLocalCache();
    const { activeHost } = useActiveHost();
    const hostSessions = useHostSessionsRef();
    const { activeSessionMessages } = useChatMessageIndex();

    function syncSessionsFromCache(options: { force?: boolean } = {}) {
        syncHostSessions(
            activeHost.value?.id,
            cache.state.value.sessions,
            options,
        );
    }

    function activeSessionIdFromCache() {
        const hostId = activeHost.value?.id?.trim();
        if (!hostId) return undefined;
        return cache.state.value.activeChatSessionIdByHost?.[hostId]?.trim();
    }

    function setActiveChatSessionId(sessionId: string) {
        const hostId = activeHost.value?.id?.trim();
        if (!hostId) return;
        if (!cache.state.value.activeChatSessionIdByHost) {
            cache.state.value.activeChatSessionIdByHost = {};
        }
        cache.state.value.activeChatSessionIdByHost[hostId] = sessionId;
        refreshActiveSessionMessages(sessionId);
        cache.persist();
    }

    const activeSession = computed(() => {
        const hostSessionList = hostSessions.value;
        const hostId = activeHost.value?.id?.trim();
        if (!hostSessionList.length) return null;
        if (!hostId) return hostSessionList[0] ?? null;
        const activeId =
            cache.state.value.activeChatSessionIdByHost?.[hostId]?.trim();
        if (activeId) {
            const match = hostSessionList.find(
                (session) => session.id === activeId,
            );
            if (match) return match;
        }
        return hostSessionList[0] ?? null;
    });

    if (!chatSyncInstalled) {
        chatSyncInstalled = true;
        reindexMessagesFromCache(cache.state.value.messages);
        syncSessionsFromCache({ force: true });
        installChatMessageIndexSync(cache, activeSessionIdFromCache);
    }

    function pendingStreamingMessagesForHost(hostId = activeHost.value?.id) {
        const normalizedHostId = hostId?.trim();
        if (!normalizedHostId) return [];
        const sessionIds = new Set(
            cache.state.value.sessions
                .filter((session) => session.hostId === normalizedHostId)
                .map((session) => session.id),
        );
        return cache.state.value.messages.filter(
            (message) =>
                message.role === 'assistant' &&
                message.status === 'streaming' &&
                sessionIds.has(message.sessionId) &&
                (Boolean(message.jobId) || Boolean(message.runnerChatTurnId)),
        );
    }
    const messages = activeSessionMessages;
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
            setActiveChatSessionId(sessionId);
            syncSessionsFromCache({ force: true });
            cache.persist();
            return (
                cache.state.value.sessions.find(
                    (item) => item.id === sessionId,
                ) ?? null
            );
        }
        const [session] = cache.state.value.sessions.splice(index, 1);
        if (!session) return null;
        cache.state.value.sessions.unshift(session);
        touchSession(session.id);
        setActiveChatSessionId(session.id);
        syncSessionsFromCache({ force: true });
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
            ...defaultRunnerFields(),
        };
        cache.state.value.sessions.unshift(session);
        setActiveChatSessionId(id);
        syncSessionsFromCache({ force: true });
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
            ...defaultRunnerFields(),
        };
        cache.state.value.sessions.unshift(session);
        setActiveChatSessionId(session.id);
        syncSessionsFromCache({ force: true });
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

    function syncSessionMessageSummary(sessionId: string) {
        const session = cache.state.value.sessions.find(
            (item) => item.id === sessionId,
        );
        if (!session) return;
        const sessionMessages = sessionMessagesFor(sessionId);
        session.backendMessageCount = sessionMessages.length;
        const latestVisible = [...sessionMessages]
            .reverse()
            .find((message) => messagePreview(message.content));
        if (latestVisible) {
            session.lastMessagePreview = messagePreview(latestVisible.content);
            session.lastMessageAt = latestVisible.createdAt;
        } else {
            session.lastMessagePreview = undefined;
            session.lastMessageAt = undefined;
        }
    }

    function addMessage(
        message: Omit<ChatMessage, 'id' | 'createdAt'> &
            Partial<Pick<ChatMessage, 'id' | 'createdAt'>>,
        options: MessageMutationOptions = {},
    ) {
        const sessionId = message.sessionId;
        const complete: ChatMessage = {
            ...message,
            id: message.id ?? createId('msg'),
            sessionId,
            createdAt: createdAtForNewMessage(sessionId, message.createdAt),
        };
        cache.state.value.messages.push(complete);
        indexMessage(complete);
        bumpActiveSessionMessagesView(complete.sessionId);
        if (options.touch !== false) {
            touchSession(
                complete.sessionId,
                complete.role === 'user' ? complete.content : undefined,
            );
        }
        if (options.syncSummary !== false) {
            syncSessionMessageSummary(complete.sessionId);
        }
        if (options.persist !== false) cache.persist();
        return complete;
    }

    function applyMessagePatch(
        message: ChatMessage,
        patch: Partial<ChatMessage>,
        options: MessageMutationOptions = {},
    ) {
        if (!message) return;
        const current = findMessageById(message.id) ?? message;
        const next = { ...current, ...patch };
        const index = cache.state.value.messages.findIndex(
            (item) => item.id === message.id,
        );
        if (index >= 0) cache.state.value.messages[index] = next;
        replaceIndexedMessage(next);
        bumpActiveSessionMessagesView(next.sessionId);
        if (options.touch !== false) touchSession(next.sessionId);
        if (options.syncSummary !== false)
            syncSessionMessageSummary(next.sessionId);
        if (options.persist !== false) cache.persist();
        return next;
    }

    function findMessageById(id: string) {
        const cached = findMessageInIndex(id);
        if (cached) return cached;
        const message =
            cache.state.value.messages.find((item) => item.id === id) ?? null;
        if (message) indexMessage(message);
        return message;
    }

    function updateMessage(
        id: string,
        patch: Partial<ChatMessage>,
        options: MessageMutationOptions = {},
    ) {
        const message = findMessageById(id);
        if (!message) return;
        return applyMessagePatch(message, patch, options);
    }

    function updateMessageRecord(
        message: ChatMessage,
        patch: Partial<ChatMessage>,
        options: MessageMutationOptions = {},
    ) {
        return applyMessagePatch(message, patch, options);
    }

    function flushMessage(id: string) {
        const message = findMessageById(id);
        if (!message) return;
        touchSession(message.sessionId);
        syncSessionMessageSummary(message.sessionId);
        cache.persist();
        return message;
    }

    function toggleMessagePin(id: string) {
        const message = findMessageById(id);
        if (!message) return false;
        const next = applyMessagePatch(message, { pinned: !message.pinned });
        return next?.pinned ?? false;
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
            ...defaultRunnerFields(),
        };
        cache.state.value.sessions.unshift(session);
        setActiveChatSessionId(id);
        syncSessionsFromCache({ force: true });
        cache.persist();
        return session;
    }

    function clearSessionMessages(
        sessionId = activeSession.value?.id,
        options: { persist?: boolean } = {},
    ) {
        if (!sessionId) return 0;
        const before = cache.state.value.messages.length;
        cache.state.value.messages = cache.state.value.messages.filter(
            (message) => message.sessionId !== sessionId,
        );
        clearSessionMessageIndex(sessionId);
        const removed = before - cache.state.value.messages.length;
        const session = cache.state.value.sessions.find(
            (item) => item.id === sessionId,
        );
        if (session) {
            session.updatedAt = now();
            session.title = 'New conversation';
            session.backendMessageCount = 0;
            session.lastMessagePreview = undefined;
            session.lastMessageAt = undefined;
        }
        if (options.persist !== false) cache.persist();
        bumpActiveSessionMessagesView(sessionId);
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

    function latestBackendMessageId(sessionId = activeSession.value?.id) {
        if (!sessionId) return 0;
        return cache.state.value.messages.reduce((latest, message) => {
            if (message.sessionId !== sessionId) return latest;
            return Math.max(latest, ...backendIdsForMessage(message));
        }, 0);
    }

    function setSessionRunnerMetadata(
        sessionId: string,
        patch: Partial<ChatSession>,
    ) {
        const session = cache.state.value.sessions.find(
            (item) => item.id === sessionId,
        );
        if (!session) return null;
        Object.assign(session, patch, { updatedAt: now() });
        cache.persist();
        return session;
    }

    function bindRunnerChatSession(
        sessionId: string,
        runnerChatSessionId: string,
    ) {
        return setSessionRunnerMetadata(sessionId, { runnerChatSessionId });
    }

    function syncBackendSessionMeta(meta: ChatSessionMeta) {
        const existing = findSessionByKey(meta.session_key);
        if (!existing) return null;
        return setSessionRunnerMetadata(
            existing.id,
            patchFromBackendSessionMeta(meta, existing),
        );
    }

    function applyBackendSessionMeta(meta: ChatSessionMeta) {
        const session = activateSessionByKey(meta.session_key, meta.title);
        if (!session) return null;
        return setSessionRunnerMetadata(
            session.id,
            patchFromBackendSessionMeta(meta, session),
        );
    }

    function compactSessionMessages(sessionId: string) {
        const sessionMessages = sessionMessagesFor(sessionId);
        const otherMessages = cache.state.value.messages.filter(
            (message) => message.sessionId !== sessionId,
        );
        const compacted = compactAssistantRunMessages(sessionMessages);
        if (compacted.length === sessionMessages.length) return;
        cache.state.value.messages = [...otherMessages, ...compacted];
        setSessionMessagesInIndex(sessionId, compacted);
        bumpActiveSessionMessagesView(sessionId);
        cache.persist();
    }

    const {
        findAssistantMessageForApproval,
        isApprovalResolved,
        markApprovalResolved,
        ensureApprovalMessage,
    } = createChatApprovals({
        cache,
        activeHost,
        activeSession,
        findSessionByKey,
        activateSessionByKey,
        ensureSession,
        updateMessage,
        addMessage,
    });

    function hydrateBackendMessagesForSession(
        session: ChatSession,
        backendMessages: ChatHistoryMessage[],
    ) {
        hydrateBackendMessages(
            {
                cache,
                sessionMessagesFor,
                addMessage,
                updateMessage,
                removeMessageFromIndex,
                reindexMessagesFromCache,
                bumpActiveSessionMessagesView,
                touchSession,
                syncSessionMessageSummary,
                compactSessionMessages,
            },
            session,
            backendMessages,
        );
    }

    return {
        sessions: hostSessions,
        activeSession,
        messages,
        draft,
        setActiveChatSessionId,
        promoteSession,
        pendingStreamingMessagesForHost,
        ensureSession,
        findSessionByKey,
        activateSessionByKey,
        newSession,
        addMessage,
        updateMessage,
        updateMessageRecord,
        findMessageById,
        flushMessage,
        toggleMessagePin,
        findAssistantMessageForApproval,
        isApprovalResolved,
        markApprovalResolved,
        ensureApprovalMessage,
        clearSessionMessages,
        appendSystemMessage,
        messageCount,
        latestBackendMessageId,
        setSessionRunnerMetadata,
        bindRunnerChatSession,
        syncBackendSessionMeta,
        applyBackendSessionMeta,
        hydrateBackendMessages: hydrateBackendMessagesForSession,
        compactSessionMessages,
    };
}
