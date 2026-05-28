import { ref } from 'vue';
import type { Or3AppState, Or3HostProfile } from '~/types/app-state';
import { compareSessionMessages } from './chat/useChatMessageIndex';
import { compactAssistantRunMessages } from '~/utils/chat/merge-assistant-run';
import { needsUnlock } from './usePinLock';
import {
    useSecureHostTokens,
    withResolvedHostTokens,
} from './useSecureHostTokens';

const STORAGE_KEY = 'or3-app:v1:state';
const MAX_PERSISTED_SESSIONS_PER_HOST = 30;
const MAX_PERSISTED_MESSAGES_PER_SESSION = 300;
const MAX_PERSISTED_DRAFTS = 120;

const defaultState = (): Or3AppState => ({
    activeHostId: null,
    hosts: [],
    sessions: [],
    messages: [],
    drafts: {},
    recentJobs: {},
    lastKnownStatus: {},
    preferences: {},
});

const state = ref<Or3AppState>(defaultState());
let loaded = false;
let listeningForExternalChanges = false;
let persistTimer: ReturnType<typeof setTimeout> | null = null;
const PERSIST_DEBOUNCE_MS = 200;

function serializableState() {
    prunePersistedChatCache();
    return {
        ...state.value,
        hosts: state.value.hosts.map(
            ({
                token: _token,
                pairedToken: _pairedToken,
                sessionToken: _sessionToken,
                ...host
            }) => host,
        ),
    };
}

function timestampValue(value?: string) {
    if (!value) return 0;
    const timestamp = Date.parse(value);
    return Number.isFinite(timestamp) ? timestamp : 0;
}

function sortSessionMessagesForPersist(
    messages: Or3AppState['messages'],
) {
    return [...messages].sort(compareSessionMessages);
}

function prunePersistedChatCache() {
    const activeSessionIds = new Set(
        Object.values(state.value.activeChatSessionIdByHost ?? {}).filter(
            Boolean,
        ),
    );
    const sessionsByHost = new Map<string, Or3AppState['sessions']>();
    for (const session of state.value.sessions) {
        const bucket = sessionsByHost.get(session.hostId) ?? [];
        bucket.push(session);
        sessionsByHost.set(session.hostId, bucket);
    }

    const keptSessionIds = new Set<string>();
    const nextSessions: Or3AppState['sessions'] = [];
    for (const sessions of sessionsByHost.values()) {
        const ranked = [...sessions].sort(
            (left, right) =>
                timestampValue(right.updatedAt || right.lastMessageAt) -
                timestampValue(left.updatedAt || left.lastMessageAt),
        );
        const active = ranked.filter((session) =>
            activeSessionIds.has(session.id),
        );
        const recent = ranked.filter(
            (session) => !activeSessionIds.has(session.id),
        );
        const kept = [...active, ...recent].slice(
            0,
            Math.max(MAX_PERSISTED_SESSIONS_PER_HOST, active.length),
        );
        for (const session of kept) {
            keptSessionIds.add(session.id);
            nextSessions.push(session);
        }
    }
    state.value.sessions = nextSessions.sort(
        (left, right) =>
            timestampValue(right.updatedAt || right.lastMessageAt) -
            timestampValue(left.updatedAt || left.lastMessageAt),
    );

    const messagesBySession = new Map<string, Or3AppState['messages']>();
    for (const message of state.value.messages) {
        if (!keptSessionIds.has(message.sessionId)) continue;
        const bucket = messagesBySession.get(message.sessionId) ?? [];
        bucket.push(message);
        messagesBySession.set(message.sessionId, bucket);
    }

    const nextMessages: Or3AppState['messages'] = [];
    for (const messages of messagesBySession.values()) {
        const pinnedOrLive = messages.filter(
            (message) =>
                message.pinned ||
                message.status === 'streaming' ||
                message.status === 'attention',
        );
        const pinnedOrLiveIds = new Set(
            pinnedOrLive.map((message) => message.id),
        );
        const recent = messages
            .filter((message) => !pinnedOrLiveIds.has(message.id))
            .sort(
                (left, right) =>
                    timestampValue(right.createdAt) -
                    timestampValue(left.createdAt),
            )
            .slice(0, MAX_PERSISTED_MESSAGES_PER_SESSION);
        nextMessages.push(
            ...sortSessionMessagesForPersist([...pinnedOrLive, ...recent]),
        );
    }
    state.value.messages = nextMessages;

    const draftEntries = Object.entries(state.value.drafts);
    if (draftEntries.length > MAX_PERSISTED_DRAFTS) {
        state.value.drafts = Object.fromEntries(
            draftEntries.slice(-MAX_PERSISTED_DRAFTS),
        );
    }
}

function persistSessionTokens() {
    if (needsUnlock()) return;
    useSecureHostTokens().replaceTokens(state.value.hosts);
}

function isLoopbackHost(hostname: string) {
    const host = hostname.trim().toLowerCase();
    return (
        host === 'localhost' ||
        host === '127.0.0.1' ||
        host === '::1' ||
        host === '[::1]'
    );
}

function serviceBaseUrlForCurrentBrowser() {
    if (!import.meta.client) return '';
    const { protocol, hostname } = window.location;
    if (protocol !== 'http:' && protocol !== 'https:') return '';
    if (!hostname || isLoopbackHost(hostname)) return '';
    return `${protocol}//${hostname}:9100`;
}

function replaceLoopbackServiceBaseUrl(baseUrl: string) {
    const browserServiceBaseUrl = serviceBaseUrlForCurrentBrowser();
    if (!browserServiceBaseUrl) return baseUrl;
    let hostname = '';
    try {
        hostname = new URL(baseUrl).hostname;
    } catch {
        const firstSegment =
            baseUrl.replace(/^https?:\/\//i, '').split('/')[0] ?? '';
        hostname = firstSegment.split(':')[0] ?? '';
    }
    if (isLoopbackHost(hostname) || !hostname) return browserServiceBaseUrl;
    return baseUrl;
}

function normalizePersistedSessions(
    sessions: Or3AppState['sessions'] = [],
): Or3AppState['sessions'] {
    return sessions.map((session) => ({
        ...session,
        runnerId: session.runnerId || 'or3-intern',
        runnerLabel: session.runnerLabel || 'OR3 Intern',
        runnerContinuationMode: session.runnerContinuationMode || 'replay',
        archived: Boolean(session.archived),
    }));
}

function normalizePersistedMessages(
    messages: Or3AppState['messages'] = [],
): Or3AppState['messages'] {
    const normalized = messages.map((message) => ({
        ...message,
        attachments: message.attachments ?? [],
        backendMessageIds: message.backendMessageIds ?? [],
        toolCalls: message.toolCalls ?? [],
        parts: message.parts ?? [],
        activityLog: message.activityLog ?? [],
    }));
    const bySession = new Map<string, typeof normalized>();
    for (const message of normalized) {
        const bucket = bySession.get(message.sessionId) ?? [];
        bucket.push(message);
        bySession.set(message.sessionId, bucket);
    }
    const compacted: typeof normalized = [];
    for (const bucket of bySession.values()) {
        compacted.push(
            ...compactAssistantRunMessages(bucket).map((message) => ({
                ...message,
                attachments: message.attachments ?? [],
                backendMessageIds: message.backendMessageIds ?? [],
                toolCalls: message.toolCalls ?? [],
                parts: message.parts ?? [],
                activityLog: message.activityLog ?? [],
            })),
        );
    }
    return compacted;
}

function readPersistedState() {
    if (!import.meta.client) return defaultState();
    const tokenStore = useSecureHostTokens();
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return defaultState();

    const parsed = { ...defaultState(), ...JSON.parse(raw) } as Or3AppState;
    const tokens = tokenStore.loadAllTokens();
    const hosts = (parsed.hosts ?? []).map((host) =>
        withResolvedHostTokens({
            ...host,
            baseUrl: replaceLoopbackServiceBaseUrl(host.baseUrl),
            pairedToken: tokens[host.id]?.pairedToken,
            sessionToken: tokens[host.id]?.sessionToken,
            tokenOrigin: tokens[host.id]?.origin,
        }),
    );
    const activeHostId = hosts.some((host) => host.id === parsed.activeHostId)
        ? parsed.activeHostId
        : (hosts.find((host) => host.token)?.id ?? hosts[0]?.id ?? null);
    return {
        ...parsed,
        activeHostId,
        hosts,
        sessions: normalizePersistedSessions(parsed.sessions),
        messages: normalizePersistedMessages(parsed.messages),
    } satisfies Or3AppState;
}

function refreshFromStorage() {
    if (!import.meta.client) return;
    try {
        state.value = readPersistedState();
    } catch {
        state.value = defaultState();
    }
}

function startExternalChangeListener() {
    if (!import.meta.client || listeningForExternalChanges) return;
    listeningForExternalChanges = true;
    window.addEventListener('storage', (event) => {
        if (
            event.key === STORAGE_KEY ||
            event.key === 'or3-app:v1:secure-host-tokens'
        )
            refreshFromStorage();
    });
}

function load() {
    if (!import.meta.client) return;
    startExternalChangeListener();
    if (loaded) return;
    loaded = true;

    refreshFromStorage();
    persistNow();
    void useSecureHostTokens()
        .hydrateTokens()
        .then((nativeTokens) => {
            if (!Object.keys(nativeTokens).length) return;
            state.value = {
                ...state.value,
                hosts: state.value.hosts.map((host) =>
                    withResolvedHostTokens({
                        ...host,
                        pairedToken:
                            nativeTokens[host.id]?.pairedToken ??
                            host.pairedToken,
                        sessionToken:
                            nativeTokens[host.id]?.sessionToken ??
                            host.sessionToken,
                        tokenOrigin:
                            nativeTokens[host.id]?.origin ?? host.tokenOrigin,
                    }),
                ),
            };
            persist();
        });
}

function flushPersist() {
    if (!import.meta.client) return;
    persistTimer = null;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(serializableState()));
    persistSessionTokens();
}

function persist() {
    if (!import.meta.client) return;
    if (persistTimer) clearTimeout(persistTimer);
    persistTimer = setTimeout(flushPersist, PERSIST_DEBOUNCE_MS);
}

function persistNow() {
    if (!import.meta.client) return;
    if (persistTimer) clearTimeout(persistTimer);
    flushPersist();
}

if (import.meta.client) {
    window.addEventListener('beforeunload', () => {
        if (persistTimer) flushPersist();
    });
}

export function useLocalCache() {
    load();

    function updateHost(host: Or3HostProfile) {
        const normalizedHost = withResolvedHostTokens({
            ...host,
            baseUrl: replaceLoopbackServiceBaseUrl(host.baseUrl),
        });
        const existing = state.value.hosts.findIndex(
            (item) => item.id === host.id || item.baseUrl === host.baseUrl,
        );
        if (existing >= 0)
            state.value.hosts.splice(existing, 1, normalizedHost);
        else state.value.hosts.push(normalizedHost);
        state.value.activeHostId = normalizedHost.id;
        persist();
    }

    function setActiveHost(hostId: string) {
        state.value.activeHostId = hostId;
        persist();
    }

    function removeHost(hostId: string) {
        state.value.hosts = state.value.hosts.filter(
            (host) => host.id !== hostId,
        );
        if (state.value.activeHostId === hostId)
            state.value.activeHostId = state.value.hosts[0]?.id ?? null;
        persist();
    }

    function setDraft(key: string, value: string) {
        state.value.drafts[key] = value;
        persist();
    }

    function setLastKnownStatus(hostId: string, value: unknown) {
        state.value.lastKnownStatus[hostId] = {
            value,
            checkedAt: new Date().toISOString(),
        };
        persist();
    }

    function clearAll() {
        state.value = defaultState();
        if (import.meta.client) {
            localStorage.removeItem(STORAGE_KEY);
        }
        useSecureHostTokens().replaceTokens([]);
    }

    function forceReload() {
        refreshFromStorage();
    }

    return {
        state,
        persist,
        persistNow,
        updateHost,
        setActiveHost,
        removeHost,
        setDraft,
        setLastKnownStatus,
        clearAll,
        forceReload,
    };
}
