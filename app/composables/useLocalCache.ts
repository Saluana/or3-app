import { ref } from 'vue';
import type { Or3AppState, Or3HostProfile } from '~/types/app-state';
import { needsUnlock } from './usePinLock';
import {
    useSecureHostTokens,
    withResolvedHostTokens,
} from './useSecureHostTokens';

const STORAGE_KEY = 'or3-app:v1:state';

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

function serializableState() {
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
    persist();
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
                            nativeTokens[host.id]?.origin ??
                            host.tokenOrigin,
                    }),
                ),
            };
            persist();
        });
}

function persist() {
    if (!import.meta.client) return;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(serializableState()));
    persistSessionTokens();
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
        updateHost,
        setActiveHost,
        removeHost,
        setDraft,
        setLastKnownStatus,
        clearAll,
        forceReload,
    };
}
