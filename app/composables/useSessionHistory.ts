import { computed, ref } from 'vue';
import type {
    ChatMessagePageResponse,
    ChatSessionForkRequest,
    ChatSessionListResponse,
    ChatSessionMeta,
    ChatSessionUpdateRequest,
} from '~/types/or3-api';
import { useChatSessions } from './useChatSessions';
import { useOr3Api } from './useOr3Api';

const historyOpen = ref(false);
const loading = ref(false);
const error = ref<string | null>(null);
const sessions = ref<ChatSessionMeta[]>([]);

function createSessionKey(hostId = 'local') {
    return `or3-app:${hostId}:session_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

export function useSessionHistory() {
    const api = useOr3Api();
    const chat = useChatSessions();

    const activeBackendSession = computed(() => {
        const key = chat.activeSession.value?.sessionKey;
        if (!key) return null;
        return sessions.value.find((session) => session.session_key === key) ?? null;
    });

    async function refresh(options: { includeArchived?: boolean; runnerId?: string; q?: string } = {}) {
        loading.value = true;
        error.value = null;
        try {
            const params = new URLSearchParams();
            if (options.includeArchived) params.set('include_archived', 'true');
            if (options.runnerId) params.set('runner_id', options.runnerId);
            if (options.q) params.set('q', options.q);
            const suffix = params.toString() ? `?${params.toString()}` : '';
            const response = await api.request<ChatSessionListResponse>(
                `/internal/v1/chat-sessions${suffix}`,
            );
            sessions.value = response.sessions ?? [];
            for (const meta of sessions.value) chat.syncBackendSessionMeta(meta);
            return sessions.value;
        } catch (err) {
            error.value =
                err && typeof err === 'object' && 'message' in err
                    ? String((err as { message?: unknown }).message || 'Session history failed')
                    : 'Session history failed';
            return [];
        } finally {
            loading.value = false;
        }
    }

    async function hydrate(sessionKey: string, limit = 100) {
        const local = chat.activateSessionByKey(sessionKey);
        if (!local) return null;
        const params = new URLSearchParams({ limit: String(limit) });
        const response = await api.request<ChatMessagePageResponse>(
            `/internal/v1/chat-sessions/${encodeURIComponent(sessionKey)}/messages?${params.toString()}`,
        );
        chat.hydrateBackendMessages(local, response.messages ?? []);
        return local;
    }

    async function openSession(meta: ChatSessionMeta) {
        const session = chat.applyBackendSessionMeta(meta);
        await hydrate(meta.session_key);
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
        const meta = await api.request<ChatSessionMeta>(
            `/internal/v1/chat-sessions/${encodeURIComponent(sessionKey)}`,
            { method: 'PATCH', body: { archived } satisfies ChatSessionUpdateRequest },
        );
        chat.applyBackendSessionMeta(meta);
        await refresh({ includeArchived: true });
        return meta;
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
        openSession,
        rename,
        archive,
        forkSession,
    };
}
