import { computed, ref, watch } from 'vue';
import type {
    ChatMessagePageResponse,
    ChatHistoryMessage,
    ChatSessionForkRequest,
    ChatSessionListResponse,
    ChatSessionMeta,
    ChatSessionUpdateRequest,
    Or3SseEvent,
} from '~/types/or3-api';
import type { ChatMessage, ChatSession, Or3HostProfile } from '~/types/app-state';
import { useActiveHost } from './useActiveHost';
import { useChatSessions } from './useChatSessions';
import { useElectronHostSetup } from './useElectronHostSetup';
import { usePinLockState } from './usePinLock';
import { canUseHostApi } from './useSecureHostTokens';
import { useOr3Api } from './useOr3Api';

const historyOpen = ref(false);
const loading = ref(false);
const error = ref<string | null>(null);
const backendSessions = ref<ChatSessionMeta[]>([]);
let unlockRefreshWatchAttached = false;
let refreshGeneration = 0;

function delay(ms: number) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

function isRetryableSessionListError(err: unknown) {
    if (!err || typeof err !== 'object') return false;
    const status = Number((err as { status?: unknown }).status);
    return status === 503 || status === 429;
}

function isTransientSessionListError(err: unknown) {
    if (!err || typeof err !== 'object') return false;
    const record = err as { code?: unknown; status?: unknown; message?: unknown };
    const status = Number(record.status);
    if (status !== 401 && status !== 403) return false;
    const code = String(record.code || '').toLowerCase();
    if (
        code === 'pin_locked' ||
        code === 'auth_required' ||
        code === 'unauthorized' ||
        code === 'invalid_token'
    ) {
        return true;
    }
    const message = String(record.message || '').toLowerCase();
    return message.includes('unauthorized') || message.includes('unlock');
}

function credentialsReadyForHost(host: Or3HostProfile | null | undefined) {
    return canUseHostApi(host);
}

function attachUnlockRefreshWatch(refresh: () => Promise<unknown>) {
    if (!import.meta.client || unlockRefreshWatchAttached) return;
    unlockRefreshWatchAttached = true;
    const pin = usePinLockState();
    watch(
        () => pin.needsUnlock.value,
        (locked, wasLocked) => {
            if (!wasLocked || locked) return;
            error.value = null;
            void refresh();
        },
    );
}

function createSessionKey(hostId = 'local') {
    return `or3-app:${hostId}:session_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

function isoToMS(value?: string) {
    if (!value) return 0;
    const ms = Date.parse(value);
    return Number.isFinite(ms) ? ms : 0;
}

function previewText(value?: string) {
    return (value || '').trim().replace(/\s+/g, ' ').slice(0, 160);
}

function localSessionToMeta(
    session: ChatSession,
    activeMessages: ChatMessage[],
): ChatSessionMeta {
    const latestMessage = [...activeMessages]
        .reverse()
        .find((message) => previewText(message.content));
    const lastMessagePreview =
        latestMessage?.content || session.lastMessagePreview || '';
    const lastMessageAt =
        isoToMS(latestMessage?.createdAt) || isoToMS(session.lastMessageAt);
    return {
        session_key: session.sessionKey,
        host_id: session.hostId,
        title: session.title || 'New conversation',
        runner_id: session.runnerId,
        runner_label: session.runnerLabel,
        runner_chat_session_id: session.runnerChatSessionId,
        runner_continuation_mode: session.runnerContinuationMode,
        runner_model: session.runnerModel,
        runner_mode: session.runnerMode,
        runner_isolation: session.runnerIsolation,
        runner_cwd: session.runnerCwd,
        message_count:
            activeMessages.length || session.backendMessageCount || 0,
        last_message_preview: previewText(lastMessagePreview),
        last_message_at: lastMessageAt || isoToMS(session.updatedAt),
        parent_session_key: session.parentSessionKey,
        fork_anchor_message_id: session.forkAnchorMessageId,
        forked_from_runner_id: session.forkedFromRunnerId,
        fork_strategy: session.forkStrategy,
        archived: Boolean(session.archived),
        created_at: isoToMS(session.createdAt),
        updated_at: isoToMS(session.updatedAt),
    };
}

function mergeSessionMeta(
    backend: ChatSessionMeta | undefined,
    local: ChatSessionMeta,
) {
    if (!backend) return local;
    const localFresh =
        (local.last_message_at || local.updated_at || 0) >=
        (backend.last_message_at || backend.updated_at || 0);
    return {
        ...backend,
        ...local,
        message_count: local.message_count || backend.message_count,
        last_message_preview:
            localFresh && local.last_message_preview
                ? local.last_message_preview
                : backend.last_message_preview || local.last_message_preview,
        last_message_at:
            localFresh && local.last_message_at
                ? local.last_message_at
                : backend.last_message_at || local.last_message_at,
        updated_at: Math.max(backend.updated_at || 0, local.updated_at || 0),
        created_at: backend.created_at || local.created_at,
    } satisfies ChatSessionMeta;
}

function isChatSessionNotFound(err: unknown) {
    if (!err || typeof err !== 'object') return false;
    const record = err as { code?: unknown; status?: unknown };
    return record.code === 'chat_session_not_found' || record.status === 404;
}

function isChatHistoryMessage(value: unknown): value is ChatHistoryMessage {
    if (!value || typeof value !== 'object') return false;
    const record = value as Record<string, unknown>;
    return (
        typeof record.id === 'number' &&
        typeof record.session_key === 'string' &&
        typeof record.role === 'string' &&
        typeof record.content === 'string' &&
        typeof record.created_at === 'number'
    );
}

export function useSessionHistory() {
    const api = useOr3Api();
    const chat = useChatSessions();
    const { activeHost } = useActiveHost();
    const electronHost = useElectronHostSetup();

    async function ensureHostReady() {
        await electronHost.ensureLoaded?.().catch(() => undefined);
    }

    const sessions = computed(() => {
        const merged = new Map<string, ChatSessionMeta>();
        for (const meta of backendSessions.value) {
            merged.set(meta.session_key, meta);
        }

        const localSessions =
            (chat as { sessions?: { value?: ChatSession[] } }).sessions
                ?.value ?? [];
        const activeMessages =
            (chat as { messages?: { value?: ChatMessage[] } }).messages
                ?.value ?? [];
        const activeMessageSessionId = chat.activeSession.value?.id;

        for (const local of localSessions) {
            const localMeta = localSessionToMeta(
                local,
                local.id === activeMessageSessionId ? activeMessages : [],
            );
            const existing = merged.get(localMeta.session_key);
            merged.set(
                localMeta.session_key,
                mergeSessionMeta(existing, localMeta),
            );
        }

        return [...merged.values()].sort(
            (a, b) =>
                (b.last_message_at || b.updated_at || 0) -
                (a.last_message_at || a.updated_at || 0),
        );
    });

    const activeBackendSession = computed(() => {
        const key = chat.activeSession.value?.sessionKey;
        if (!key) return null;
        return sessions.value.find((session) => session.session_key === key) ?? null;
    });

    async function refresh(options: { includeArchived?: boolean; runnerId?: string; q?: string } = {}) {
        attachUnlockRefreshWatch(() => refresh(options));
        await ensureHostReady();
        if (!credentialsReadyForHost(activeHost.value)) {
            error.value = null;
            return sessions.value;
        }

        const generation = ++refreshGeneration;
        loading.value = true;
        error.value = null;
        let lastError: unknown = null;
        try {
            const params = new URLSearchParams();
            if (options.includeArchived) params.set('include_archived', 'true');
            if (options.runnerId) params.set('runner_id', options.runnerId);
            if (options.q) params.set('q', options.q);
            const suffix = params.toString() ? `?${params.toString()}` : '';

            for (let attempt = 0; attempt < 3; attempt++) {
                if (attempt > 0) await delay(250 * attempt);
                try {
                    const response = await api.request<ChatSessionListResponse>(
                        `/internal/v1/chat-sessions${suffix}`,
                    );
                    backendSessions.value = response.sessions ?? [];
                    for (const meta of backendSessions.value)
                        chat.syncBackendSessionMeta(meta);
                    return sessions.value;
                } catch (err) {
                    lastError = err;
                    if (!isRetryableSessionListError(err) || attempt >= 2) break;
                }
            }

            const localSessions =
                (chat as { sessions?: { value?: ChatSession[] } }).sessions
                    ?.value ?? [];
            if (
                generation !== refreshGeneration ||
                localSessions.length > 0 ||
                backendSessions.value.length > 0 ||
                isTransientSessionListError(lastError)
            ) {
                error.value = null;
                return sessions.value;
            }

            if (generation !== refreshGeneration) return sessions.value;

            error.value =
                lastError &&
                typeof lastError === 'object' &&
                'message' in lastError
                    ? String(
                          (lastError as { message?: unknown }).message ||
                              'Session history failed',
                      )
                    : 'Session history failed';
            return sessions.value;
        } finally {
            if (generation === refreshGeneration) loading.value = false;
        }
    }

    async function hydrate(
        sessionKey: string,
        limit = 100,
        options: { replaceLocal?: boolean } = {},
    ) {
        await ensureHostReady();
        if (!credentialsReadyForHost(activeHost.value)) return null;
        const local = chat.activateSessionByKey(sessionKey);
        if (!local) return null;
        if (options.replaceLocal !== false) {
            chat.clearSessionMessages(local.id);
        }
        const params = new URLSearchParams({ limit: String(limit) });
        const response = await api.request<ChatMessagePageResponse>(
            `/internal/v1/chat-sessions/${encodeURIComponent(sessionKey)}/messages?${params.toString()}`,
        );
        chat.hydrateBackendMessages(local, response.messages ?? []);
        return local;
    }

    async function followLiveMessages(sessionKey: string, signal?: AbortSignal) {
        await ensureHostReady();
        if (!credentialsReadyForHost(activeHost.value)) return;
        const local = chat.findSessionByKey(sessionKey) ?? chat.activateSessionByKey(sessionKey);
        if (!local) return;
        const afterID = chat.latestBackendMessageId(local.id);
        const params = new URLSearchParams({ after_id: String(afterID) });
        const stream = api.stream(
            `/internal/v1/chat-sessions/${encodeURIComponent(sessionKey)}/messages/stream?${params.toString()}`,
            { method: 'GET', signal },
        );
        for await (const event of stream as AsyncIterable<Or3SseEvent>) {
            if (signal?.aborted) return;
            if (event.event !== 'message' || !isChatHistoryMessage(event.json)) {
                continue;
            }
            const current = chat.findSessionByKey(sessionKey) ?? chat.activateSessionByKey(sessionKey);
            if (!current) continue;
            chat.hydrateBackendMessages(current, [event.json]);
        }
    }

    async function openSession(
        meta: ChatSessionMeta,
        options: { replaceLocal?: boolean } = {},
    ) {
        const session = chat.applyBackendSessionMeta(meta);
        await hydrate(meta.session_key, 100, { replaceLocal: options.replaceLocal });
        historyOpen.value = false;
        return session;
    }

    async function rename(sessionKey: string, title: string) {
        const meta = await api.request<ChatSessionMeta>(
            `/internal/v1/chat-sessions/${encodeURIComponent(sessionKey)}`,
            { method: 'PATCH', body: { title } satisfies ChatSessionUpdateRequest },
        );
        chat.applyBackendSessionMeta(meta);
        await refresh();
        return meta;
    }

    async function archive(sessionKey: string, archived = true) {
        const local = chat.findSessionByKey(sessionKey);
        if (local) {
            chat.setSessionRunnerMetadata(local.id, { archived });
        }
        const backendKnown = backendSessions.value.some(
            (session) => session.session_key === sessionKey,
        );
        if (local && !backendKnown) {
            error.value = null;
            return localSessionToMeta(
                { ...local, archived },
                local.id === chat.activeSession.value?.id ? chat.messages.value : [],
            );
        }
        try {
            const meta = await api.request<ChatSessionMeta>(
                `/internal/v1/chat-sessions/${encodeURIComponent(sessionKey)}`,
                { method: 'PATCH', body: { archived } satisfies ChatSessionUpdateRequest },
            );
            chat.applyBackendSessionMeta(meta);
            await refresh({ includeArchived: true });
            return meta;
        } catch (err) {
            if (!local || !isChatSessionNotFound(err)) throw err;
            error.value = null;
            return localSessionToMeta(
                { ...local, archived },
                local.id === chat.activeSession.value?.id ? chat.messages.value : [],
            );
        }
    }

    async function forkSession(options: {
        sourceSessionKey: string;
        anchorMessageId: number;
        targetRunnerId?: string;
        title?: string;
        allowIncompleteAnchor?: boolean;
    }) {
        const newSessionKey = createSessionKey();
        const meta = await api.request<ChatSessionMeta>(
            `/internal/v1/chat-sessions/${encodeURIComponent(options.sourceSessionKey)}/fork`,
            {
                method: 'POST',
                body: {
                    new_session_key: newSessionKey,
                    anchor_message_id: options.anchorMessageId,
                    target_runner_id: options.targetRunnerId,
                    title: options.title || 'Forked conversation',
                    allow_incomplete_anchor: Boolean(options.allowIncompleteAnchor),
                    fork_strategy: 'replay',
                } satisfies ChatSessionForkRequest,
            },
        );
        const session = chat.applyBackendSessionMeta(meta);
        await hydrate(meta.session_key);
        historyOpen.value = false;
        return session;
    }

    return {
        historyOpen,
        loading,
        error,
        sessions,
        activeBackendSession,
        refresh,
        hydrate,
        followLiveMessages,
        openSession,
        rename,
        archive,
        forkSession,
    };
}
