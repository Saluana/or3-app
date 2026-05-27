import { computed, shallowRef, watch } from 'vue';
import type { ChatMessage } from '~/types/app-state';
import type { useLocalCache } from '../useLocalCache';

const messageById = new Map<string, ChatMessage>();
const messagesBySessionId = new Map<string, ChatMessage[]>();
const activeSessionViewVersion = shallowRef(0);
let activeSessionId = '';
let cacheSyncInstalled = false;

function timestampValue(value?: string) {
    if (!value) return 0;
    const timestamp = Date.parse(value);
    return Number.isFinite(timestamp) ? timestamp : 0;
}

/** Chronological order; user before assistant when timestamps collide. */
export function compareSessionMessages(
    left: ChatMessage,
    right: ChatMessage,
) {
    const delta =
        timestampValue(left.createdAt) - timestampValue(right.createdAt);
    if (delta !== 0) return delta;
    if (left.role === right.role) return left.id.localeCompare(right.id);
    if (left.role === 'user') return -1;
    if (right.role === 'user') return 1;
    return left.id.localeCompare(right.id);
}

export function sortSessionMessages(messages: ChatMessage[]) {
    return [...messages].sort(compareSessionMessages);
}

/** Ensure a new message sorts after existing session messages. */
export function createdAtForNewMessage(
    sessionId: string,
    preferred?: string,
) {
    let next = timestampValue(preferred) || Date.now();
    for (const message of sessionMessagesFor(sessionId)) {
        next = Math.max(next, timestampValue(message.createdAt) + 1);
    }
    return new Date(next).toISOString();
}

function sortSessionBucket(sessionId: string) {
    const bucket = messagesBySessionId.get(sessionId);
    if (!bucket?.length) return;
    bucket.sort(compareSessionMessages);
}

function rebuildSessionBucket(sessionId: string, messages: ChatMessage[]) {
    const sorted = sortSessionMessages(messages);
    messagesBySessionId.set(sessionId, sorted);
    for (const message of sorted) {
        messageById.set(message.id, message);
    }
}

function activeSessionBucket() {
    return activeSessionId
        ? (messagesBySessionId.get(activeSessionId) ?? [])
        : [];
}

const activeSessionMessages = computed(() => {
    void activeSessionViewVersion.value;
    const bucket = activeSessionBucket();
    if (!bucket.length) return [];
    return sortSessionMessages(bucket);
});

function touchActiveSessionView() {
    activeSessionViewVersion.value++;
}

export function reindexMessagesFromCache(messages: ChatMessage[]) {
    messageById.clear();
    messagesBySessionId.clear();
    for (const message of messages) {
        messageById.set(message.id, message);
        const bucket = messagesBySessionId.get(message.sessionId) ?? [];
        bucket.push(message);
        messagesBySessionId.set(message.sessionId, bucket);
    }
    for (const sessionId of messagesBySessionId.keys()) {
        sortSessionBucket(sessionId);
    }
    touchActiveSessionView();
}

export function sessionMessagesFor(sessionId: string) {
    return messagesBySessionId.get(sessionId) ?? [];
}

/** Identity lookup; always returns the canonical indexed object (post-replace). */
export function findMessageInIndex(id: string) {
    return messageById.get(id) ?? null;
}

export function indexMessage(message: ChatMessage) {
    messageById.set(message.id, message);
    const bucket = messagesBySessionId.get(message.sessionId) ?? [];
    bucket.push(message);
    sortSessionBucket(message.sessionId);
    messagesBySessionId.set(message.sessionId, bucket);
}

export function replaceIndexedMessage(message: ChatMessage) {
    messageById.set(message.id, message);
    const bucket = messagesBySessionId.get(message.sessionId);
    if (!bucket) return;
    const index = bucket.findIndex((item) => item.id === message.id);
    if (index >= 0) bucket[index] = message;
}

export function removeMessageFromIndex(message: ChatMessage) {
    messageById.delete(message.id);
    const bucket = messagesBySessionId.get(message.sessionId);
    if (!bucket) return;
    const index = bucket.findIndex((item) => item.id === message.id);
    if (index >= 0) bucket.splice(index, 1);
}

export function clearSessionMessageIndex(sessionId: string) {
    for (const message of messagesBySessionId.get(sessionId) ?? []) {
        messageById.delete(message.id);
    }
    messagesBySessionId.delete(sessionId);
}

export function setSessionMessagesInIndex(
    sessionId: string,
    messages: ChatMessage[],
) {
    for (const message of messagesBySessionId.get(sessionId) ?? []) {
        messageById.delete(message.id);
    }
    rebuildSessionBucket(sessionId, messages);
}

export function refreshActiveSessionMessages(sessionId?: string | null) {
    activeSessionId = sessionId?.trim() ?? '';
    touchActiveSessionView();
}

/** Invalidate list consumers without copying the full session bucket. */
export function bumpActiveSessionMessagesView(sessionId?: string | null) {
    const normalized = sessionId?.trim() ?? activeSessionId;
    if (!normalized || normalized !== activeSessionId) return;
    touchActiveSessionView();
}

export function useChatMessageIndex() {
    return {
        activeSessionMessages,
        reindexMessagesFromCache,
        sessionMessagesFor,
        findMessageInIndex,
        indexMessage,
        replaceIndexedMessage,
        removeMessageFromIndex,
        clearSessionMessageIndex,
        setSessionMessagesInIndex,
        refreshActiveSessionMessages,
        bumpActiveSessionMessagesView,
        compareSessionMessages,
        sortSessionMessages,
    };
}

export function installChatMessageIndexSync(
    cache: ReturnType<typeof useLocalCache>,
    getActiveSessionId: () => string | undefined | null,
) {
    if (cacheSyncInstalled) return;
    cacheSyncInstalled = true;

    watch(
        () => cache.state.value.messages,
        (messages) => {
            reindexMessagesFromCache(messages);
        },
        { deep: false },
    );

    watch(
        () => getActiveSessionId(),
        (sessionId) => refreshActiveSessionMessages(sessionId),
        { immediate: true },
    );
}

/** Test-only reset for module-level message indexes. */
export function resetChatMessageIndexForTests() {
    messageById.clear();
    messagesBySessionId.clear();
    activeSessionId = '';
    activeSessionViewVersion.value = 0;
    cacheSyncInstalled = false;
}
