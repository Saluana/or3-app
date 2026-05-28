import { computed, ref } from 'vue';
import type {
    CreateTerminalSessionRequest,
    TerminalSessionSnapshot,
} from '~/types/or3-api';
import {
    approvalIdFromError,
    isApprovalRequiredError,
} from '~/utils/approval-errors';
import { createLogger } from '~/utils/logger';
import { useApprovals } from './useApprovals';
import { useOr3Api } from './useOr3Api';
import { createTerminalTransport } from './terminal/transport';

const logger = createLogger('terminal');

const terminalSessionStorageKey = 'or3:terminal-session';

const session = ref<TerminalSessionSnapshot | null>(null);
const terminalLines = ref<string[]>([]);
const terminalChunks = ref<{ id: number; data: string }[]>([]);
let chunkSeq = 0;
const terminalError = ref<string | null>(null);
const terminalBusy = ref(false);
const terminalUnavailable = ref(false);
const pendingApprovalId = ref<number | null>(null);
const lastLaunchPayload = ref<CreateTerminalSessionRequest | null>(null);
const activeSessions = ref<TerminalSessionSnapshot[]>([]);
const sessionListingUnsupported = ref(false);

const terminalLineLimit = 600;
const terminalChunkLimit = 2000;

type PersistedTerminalSession = {
    sessionId: string;
    payload: CreateTerminalSessionRequest;
};

function appendTerminalLine(line: string) {
    const lines = terminalLines.value;
    lines.push(line);
    if (lines.length > terminalLineLimit) {
        lines.splice(0, lines.length - terminalLineLimit);
    }
}

function appendTerminalChunk(chunk: string) {
    if (!chunk) return;
    chunkSeq += 1;
    const next = [
        ...terminalChunks.value,
        { id: chunkSeq, data: chunk },
    ];
    if (next.length > terminalChunkLimit) {
        terminalChunks.value = next.slice(next.length - terminalChunkLimit);
        return;
    }
    terminalChunks.value = next;
}

function isTerminalSessionMissing(error: unknown) {
    return (error as { status?: number })?.status === 404;
}

function isTerminalSessionConflict(error: unknown) {
    return (error as { status?: number })?.status === 409;
}

function isMethodNotAllowed(error: unknown) {
    return (error as { status?: number })?.status === 405;
}

function storageAvailable() {
    return (
        process.client && typeof window !== 'undefined' && !!window.localStorage
    );
}

function readPersistedTerminalSession(): PersistedTerminalSession | null {
    if (!storageAvailable()) return null;
    const raw = window.localStorage.getItem(terminalSessionStorageKey);
    if (!raw) return null;
    try {
        const parsed = JSON.parse(raw) as PersistedTerminalSession | null;
        if (!parsed?.sessionId || !parsed?.payload?.root_id) return null;
        return parsed;
    } catch {
        return null;
    }
}

function writePersistedTerminalSession(
    nextSession: TerminalSessionSnapshot | null,
    payload = lastLaunchPayload.value,
) {
    if (!storageAvailable()) return;
    if (!nextSession || !payload?.root_id) {
        window.localStorage.removeItem(terminalSessionStorageKey);
        return;
    }
    window.localStorage.setItem(
        terminalSessionStorageKey,
        JSON.stringify({
            sessionId: nextSession.session_id,
            payload: {
                root_id: payload.root_id,
                path: payload.path,
                shell: payload.shell,
                rows: nextSession.rows || payload.rows,
                cols: nextSession.cols || payload.cols,
                approval_token: payload.approval_token,
            },
        } satisfies PersistedTerminalSession),
    );
}

function rememberLaunchPayload(payload: CreateTerminalSessionRequest | null) {
    lastLaunchPayload.value = payload;
}

function applySession(nextSession: TerminalSessionSnapshot | null) {
    session.value = nextSession;
    writePersistedTerminalSession(nextSession);
}

function handleMissingSession(error: unknown, fallbackMessage: string) {
    if (!isTerminalSessionMissing(error)) return false;
    resetTerminalState();
    terminalError.value = fallbackMessage;
    return true;
}

function resetTerminalState() {
    getTransport().detach();
    chunkSeq = 0;
    session.value = null;
    terminalLines.value = [];
    terminalChunks.value = [];
    terminalBusy.value = false;
    writePersistedTerminalSession(null);
}

function applyTerminalEvent(
    eventType?: string,
    payload?: Record<string, unknown>,
) {
    switch (eventType) {
        case 'snapshot':
            if (payload) applySession(payload as unknown as TerminalSessionSnapshot);
            break;
        case 'output': {
            const chunk = String(payload?.chunk ?? '');
            appendTerminalChunk(chunk);
            const stripped = chunk.replace(/\x1b\[[0-9;?]*[ -\/]*[@-~]/g, '');
            if (stripped) appendTerminalLine(stripped);
            break;
        }
        case 'input':
            break;
        case 'error':
            if (payload?.error) {
                appendTerminalLine(`\n[error] ${String(payload.error)}\n`);
            }
            break;
        case 'status':
            if (session.value && payload?.status) {
                applySession({
                    ...session.value,
                    status: String(payload.status),
                });
            }
            break;
        case 'resize':
            if (session.value) {
                applySession({
                    ...session.value,
                    rows: Number(payload?.rows ?? session.value.rows),
                    cols: Number(payload?.cols ?? session.value.cols),
                });
            }
            break;
    }
}

let transport: ReturnType<typeof createTerminalTransport> | null = null;

/** Lazily creates transport; requires Nuxt composable context (or mocked useOr3Api in tests). */
function getTransport() {
    if (!transport) {
        transport = createTerminalTransport({
            api: useOr3Api(),
            session,
            onStreamEvent: applyTerminalEvent,
            onMissingSession: handleMissingSession,
            setTerminalError: (message) => {
                terminalError.value = message;
            },
        });
    }
    return transport;
}

export function useTerminalSession() {
    const api = useOr3Api();
    const transport = getTransport();
    const { consumeIssuedApprovalToken } = useApprovals();

    const transcript = computed(() => terminalLines.value.join(''));
    const status = computed(() => session.value?.status ?? 'idle');
    const isInteractive = computed(() => session.value?.status === 'running');
    const terminalStreaming = transport.terminalStreaming;
    const terminalTransportDisconnected = transport.terminalTransportDisconnected;
    const canInteract = computed(
        () => isInteractive.value && terminalStreaming.value,
    );
    const reconnectMode = computed<'transport' | 'session' | null>(() => {
        if (terminalTransportDisconnected.value && isInteractive.value) {
            return 'transport';
        }
        if (session.value && session.value.status !== 'running') {
            return 'session';
        }
        return null;
    });

    async function listSessions() {
        if (sessionListingUnsupported.value) {
            activeSessions.value = [];
            return activeSessions.value;
        }
        try {
            const response = await api.request<{
                items?: TerminalSessionSnapshot[];
            }>(`/internal/v1/terminal/sessions`);
            sessionListingUnsupported.value = false;
            activeSessions.value = (response.items ?? []).filter(
                (item) => item.status === 'running',
            );
        } catch (error: unknown) {
            if (isMethodNotAllowed(error)) {
                sessionListingUnsupported.value = true;
                activeSessions.value = [];
                logger.warn(
                    'sessions:list_unsupported',
                    'Active terminal session listing is unavailable',
                );
                return activeSessions.value;
            }
            throw error;
        }
        return activeSessions.value;
    }

    async function attachExistingSession(sessionId: string) {
        terminalBusy.value = true;
        terminalError.value = null;
        try {
            const existing = await refresh(sessionId);
            if (!existing) return null;
            rememberLaunchPayload({
                root_id: existing.root_id,
                path: existing.path || '.',
                shell: existing.shell,
                rows: existing.rows,
                cols: existing.cols,
            });
            terminalLines.value = [`$ Reconnected to ${existing.cwd}\n`];
            terminalChunks.value = [];
            chunkSeq = 0;
            void transport.attach(existing.session_id);
            return existing;
        } catch (error: unknown) {
            if (
                handleMissingSession(
                    error,
                    'That terminal is no longer active.',
                )
            ) {
                await listSessions().catch(() => {});
                return null;
            }
            throw error;
        } finally {
            terminalBusy.value = false;
        }
    }

    async function handleSessionConflict(error: unknown, fallbackMessage: string) {
        if (!isTerminalSessionConflict(error)) return false;
        try {
            await refresh();
        } catch (refreshError: unknown) {
            if (
                handleMissingSession(
                    refreshError,
                    'Terminal session expired or was closed. Open a new terminal to continue.',
                )
            ) {
                return true;
            }
        }
        terminalError.value = fallbackMessage;
        return true;
    }

    function buildReconnectPayload(): CreateTerminalSessionRequest | null {
        if (lastLaunchPayload.value?.root_id) {
            return { ...lastLaunchPayload.value };
        }
        const persisted = readPersistedTerminalSession();
        if (persisted?.payload?.root_id) {
            return { ...persisted.payload };
        }
        if (!session.value?.root_id) return null;
        return {
            root_id: session.value.root_id,
            path: session.value.path || '.',
            shell: session.value.shell,
            rows: session.value.rows,
            cols: session.value.cols,
        };
    }

    async function start(
        payload: CreateTerminalSessionRequest,
        approvalId?: number | string | null,
    ) {
        terminalBusy.value = true;
        terminalError.value = null;
        terminalUnavailable.value = false;
        const launchPayload = { ...payload };
        const tokenSourceId = approvalId ?? pendingApprovalId.value;
        const approvalToken = tokenSourceId
            ? consumeIssuedApprovalToken(tokenSourceId)
            : undefined;
        if (approvalToken) {
            launchPayload.approval_token = approvalToken;
        }
        pendingApprovalId.value = null;
        rememberLaunchPayload(launchPayload);
        const previousSessionId = session.value?.session_id ?? null;

        try {
            const created = await api.request<TerminalSessionSnapshot>(
                '/internal/v1/terminal/sessions',
                {
                    method: 'POST',
                    body: launchPayload,
                },
            );
            chunkSeq = 0;
            terminalChunks.value = [];
            applySession(created);
            terminalLines.value = [`$ Connected to ${created.cwd}\n`];
            await listSessions().catch(() => {});
            void transport.attach(created.session_id);
        } catch (error: unknown) {
            const err = error as {
                status?: number;
                message?: string;
                request_id?: number | string;
                requires_approval?: boolean;
            };
            pendingApprovalId.value = approvalIdFromError(error);
            if (isApprovalRequiredError(error)) {
                terminalError.value = null;
                if (
                    previousSessionId &&
                    session.value?.session_id === previousSessionId
                ) {
                    void transport.attach(previousSessionId);
                }
            } else {
                terminalError.value =
                    err?.message ?? 'Unable to start a terminal session.';
            }
            terminalUnavailable.value = err?.status === 503;
            throw error;
        } finally {
            terminalBusy.value = false;
        }
    }

    async function refresh(sessionId = session.value?.session_id) {
        if (!sessionId) return;
        const nextSession = await api.request<TerminalSessionSnapshot>(
            `/internal/v1/terminal/sessions/${sessionId}`,
        );
        applySession(nextSession);
        return nextSession;
    }

    async function restoreSession() {
        const persisted = readPersistedTerminalSession();
        if (!persisted) return null;
        rememberLaunchPayload({ ...persisted.payload });
        terminalError.value = null;
        try {
            const restored = await refresh(persisted.sessionId);
            if (!restored) return null;
            await listSessions().catch(() => {});
            void transport.attach(restored.session_id);
            return restored;
        } catch (error: unknown) {
            if (
                handleMissingSession(
                    error,
                    'Previous terminal session expired. Open a new session to continue.',
                )
            ) {
                terminalError.value = null;
                return null;
            }
            throw error;
        }
    }

    async function reconnect(approvalId?: number | string | null) {
        const payload = buildReconnectPayload();
        if (!payload?.root_id) {
            terminalError.value =
                'Pick an area before reconnecting the terminal.';
            return;
        }
        resetTerminalState();
        terminalError.value = null;
        await start(payload, approvalId ?? pendingApprovalId.value);
    }

    async function resumePendingApproval(approvalId?: number | string | null) {
        const id = approvalId ?? pendingApprovalId.value;
        if (!id) return false;
        const payload = buildReconnectPayload();
        if (!payload?.root_id) return false;
        if (!session.value?.session_id) {
            resetTerminalState();
        }
        terminalError.value = null;
        pendingApprovalId.value = null;
        await start(payload, id);
        return true;
    }

    async function reattachTransport() {
        const sessionId = session.value?.session_id;
        if (!sessionId || session.value?.status !== 'running') return;
        terminalError.value = null;
        await transport.attach(sessionId);
    }

    async function writeToTerminal(input: string) {
        if (!session.value || !input || !canInteract.value) {
            return;
        }

        if (
            transport.sendSocketPayload({
                type: 'input',
                input,
            })
        ) {
            return;
        }

        try {
            await api.request(
                `/internal/v1/terminal/sessions/${session.value.session_id}/input`,
                {
                    method: 'POST',
                    body: { input },
                },
            );
        } catch (error: unknown) {
            if (
                handleMissingSession(
                    error,
                    'Terminal session expired or was closed. Open a new terminal to continue.',
                )
            )
                return;
            if (
                await handleSessionConflict(
                    error,
                    'This terminal is no longer writable. Reconnect to start a fresh shell.',
                )
            )
                return;
            terminalError.value =
                (error as { message?: string })?.message ??
                'Could not send input to the terminal.';
            appendTerminalLine(`\n[error] ${terminalError.value}\n`);
            throw error;
        }
    }

    /** Sends raw terminal input; HTTP fallback handles 409 session conflicts. */
    async function sendKeys(bytes: string) {
        await writeToTerminal(bytes);
    }

    async function resize(rows: number, cols: number) {
        if (!session.value || session.value.status !== 'running') return;
        if (
            transport.sendSocketPayload({
                type: 'resize',
                rows,
                cols,
            })
        ) {
            applySession({ ...session.value, rows, cols });
            return;
        }
        try {
            await api.request(
                `/internal/v1/terminal/sessions/${session.value.session_id}/resize`,
                {
                    method: 'POST',
                    body: { rows, cols },
                },
            );
        } catch (error: unknown) {
            if (
                handleMissingSession(
                    error,
                    'Terminal session expired or was closed. Open a new terminal to continue.',
                )
            )
                return;
            if (
                await handleSessionConflict(
                    error,
                    'This terminal is no longer resizable. Reconnect to continue.',
                )
            )
                return;
            terminalError.value =
                (error as { message?: string })?.message ??
                'Could not resize the terminal.';
            throw error;
        }
        applySession({ ...session.value, rows, cols });
    }

    async function close() {
        if (!session.value) return;
        const sessionId = session.value.session_id;
        if (transport.terminalSocketReady(sessionId)) {
            transport.sendSocketPayload({ type: 'close' });
            transport.closeTerminalSocket();
        } else {
            transport.detach();
            await api.request(
                `/internal/v1/terminal/sessions/${sessionId}/close`,
                { method: 'POST' },
            );
        }
        if (session.value) applySession({ ...session.value, status: 'closed' });
        writePersistedTerminalSession(null);
        await listSessions().catch(() => {});
    }

    function reset() {
        resetTerminalState();
        terminalError.value = null;
        terminalUnavailable.value = false;
        pendingApprovalId.value = null;
        sessionListingUnsupported.value = false;
        transport.resetWebSocketCapability();
    }

    return {
        session,
        activeSessions,
        transcript,
        terminalLines,
        terminalChunks,
        terminalError,
        terminalBusy,
        terminalStreaming,
        terminalTransportDisconnected,
        terminalUnavailable,
        pendingApprovalId,
        status,
        isInteractive,
        canInteract,
        reconnectMode,
        sessionListingUnsupported,
        listSessions,
        attachExistingSession,
        start,
        refresh,
        attach: transport.attach,
        reattachTransport,
        detach: transport.detach,
        restoreSession,
        reconnect,
        resumePendingApproval,
        sendKeys,
        resize,
        close,
        reset,
    };
}

/** Resets module-scoped terminal state between unit tests. Mock useOr3Api before calling. */
export function resetTerminalSessionModuleForTests() {
    getTransport().resetTransportForTests();
    chunkSeq = 0;
    session.value = null;
    terminalLines.value = [];
    terminalChunks.value = [];
    terminalBusy.value = false;
    terminalError.value = null;
    terminalUnavailable.value = false;
    pendingApprovalId.value = null;
    lastLaunchPayload.value = null;
    activeSessions.value = [];
    sessionListingUnsupported.value = false;
}

/** @internal Used by unit tests to assert transport invalidation. */
export function getTerminalAttachGenerationForTests() {
    return getTransport().getAttachGenerationForTests();
}
