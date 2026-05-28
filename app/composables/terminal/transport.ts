import { ref, type Ref } from 'vue';
import type { TerminalSessionSnapshot } from '~/types/or3-api';
import type { useOr3Api } from '../useOr3Api';

const terminalWebSocketProtocol = 'or3.terminal.v1';
const terminalWebSocketTicketPrefix = 'or3.ticket.';
const terminalReconnectMaxAttempts = 8;
const terminalReconnectBaseDelayMs = 400;
const terminalReconnectMaxDelayMs = 8000;

type Or3Api = ReturnType<typeof useOr3Api>;

type TerminalWebSocketTicketResponse = {
    ticket: string;
    expires_at?: string;
};

type TerminalWebSocketEvent = {
    type?: string;
    data?: Record<string, unknown>;
};

export type TerminalTransportDeps = {
    api: Or3Api;
    session: Ref<TerminalSessionSnapshot | null>;
    onStreamEvent: (
        eventType?: string,
        payload?: Record<string, unknown>,
    ) => void;
    onMissingSession: (error: unknown, message: string) => boolean;
    setTerminalError: (message: string) => void;
};

export function createTerminalTransport(deps: TerminalTransportDeps) {
    const terminalStreaming = ref(false);
    const terminalTransportDisconnected = ref(false);

    let attachGeneration = 0;
    let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
    let reconnectAttempt = 0;
    let streamAbortController: AbortController | null = null;
    let terminalSocket: WebSocket | null = null;
    let terminalSocketSessionId: string | null = null;
    let terminalSocketConnecting: Promise<boolean> | null = null;
    let terminalWebSocketUnsupported = false;
    let pendingWebSocketResolve: ((value: boolean) => void) | null = null;

    function isAttachStale(generation: number) {
        return generation !== attachGeneration;
    }

    function clearReconnectSchedule() {
        if (reconnectTimer != null) {
            clearTimeout(reconnectTimer);
            reconnectTimer = null;
        }
    }

    function isTerminalSessionMissing(error: unknown) {
        return (error as { status?: number })?.status === 404;
    }

    function isMethodNotAllowed(error: unknown) {
        return (error as { status?: number })?.status === 405;
    }

    function isWebSocketCapabilityError(error: unknown) {
        if ((error as { status?: number })?.status !== 400) return false;
        const message = String(
            (error as { message?: string; error?: string })?.message ??
                (error as { error?: string })?.error ??
                '',
        ).toLowerCase();
        return (
            message.includes('websocket') ||
            message.includes('not supported') ||
            message.includes('protocol')
        );
    }

    function closeTerminalSocket() {
        pendingWebSocketResolve?.(false);
        pendingWebSocketResolve = null;
        const socket = terminalSocket;
        terminalSocket = null;
        terminalSocketSessionId = null;
        terminalSocketConnecting = null;
        if (!socket) return;
        try {
            socket.onopen = null;
            socket.onmessage = null;
            socket.onerror = null;
            socket.onclose = null;
            socket.close();
        } catch {
            // Best effort cleanup only.
        }
    }

    function detach() {
        attachGeneration += 1;
        clearReconnectSchedule();
        reconnectAttempt = 0;
        streamAbortController?.abort();
        streamAbortController = null;
        closeTerminalSocket();
        terminalStreaming.value = false;
        terminalTransportDisconnected.value = false;
        // #region agent log
        fetch('http://127.0.0.1:7845/ingest/f9918b6c-53f1-4b7a-a810-8a4b7fbf8eb8',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'8186a8'},body:JSON.stringify({sessionId:'8186a8',location:'transport.ts:detach',message:'transport detached',data:{sessionId:deps.session.value?.session_id??null,attachGeneration},timestamp:Date.now(),hypothesisId:'H1-H3'})}).catch(()=>{});
        // #endregion
    }

    function resetWebSocketCapability() {
        terminalWebSocketUnsupported = false;
    }

    function terminalSocketReady(sessionId = deps.session.value?.session_id) {
        return Boolean(
            sessionId &&
                terminalSocket &&
                terminalSocketSessionId === sessionId &&
                terminalSocket.readyState === WebSocket.OPEN,
        );
    }

    function scheduleTransportReconnect(sessionId: string) {
        if (deps.session.value?.session_id !== sessionId) return;
        if (deps.session.value?.status !== 'running') return;
        if (reconnectTimer != null) return;

        terminalTransportDisconnected.value = true;
        terminalStreaming.value = false;

        if (reconnectAttempt >= terminalReconnectMaxAttempts) {
            deps.setTerminalError(
                'Terminal connection lost. Tap Reconnect to attach again.',
            );
            return;
        }

        const delay = Math.min(
            terminalReconnectBaseDelayMs * 2 ** reconnectAttempt,
            terminalReconnectMaxDelayMs,
        );
        reconnectAttempt += 1;

        reconnectTimer = setTimeout(() => {
            reconnectTimer = null;
            if (deps.session.value?.session_id !== sessionId) return;
            if (deps.session.value?.status !== 'running') return;
            void attach(sessionId);
        }, delay);
    }

    function noteTransportLost(sessionId: string) {
        if (deps.session.value?.session_id !== sessionId) return;
        if (deps.session.value?.status !== 'running') return;
        scheduleTransportReconnect(sessionId);
    }

    async function connectTerminalWebSocket(
        sessionId: string,
        generation: number,
        activeStreamController: AbortController,
    ) {
        let ticketResponse: TerminalWebSocketTicketResponse;
        try {
            ticketResponse = await deps.api.request<TerminalWebSocketTicketResponse>(
                `/internal/v1/terminal/sessions/${sessionId}/ws-ticket`,
                {
                    method: 'POST',
                    signal: activeStreamController.signal,
                },
            );
        } catch (error: unknown) {
            if (activeStreamController.signal.aborted || isAttachStale(generation))
                return false;
            if (isMethodNotAllowed(error) || isWebSocketCapabilityError(error)) {
                terminalWebSocketUnsupported = true;
                return false;
            }
            if (isTerminalSessionMissing(error)) {
                deps.onMissingSession(
                    error,
                    'Terminal session expired or was cleared. Start a new session.',
                );
                return false;
            }
            deps.setTerminalError(
                (error as { message?: string })?.message ??
                    'Terminal WebSocket ticket request failed.',
            );
            return false;
        }
        if (isAttachStale(generation)) return false;
        const ticket = ticketResponse?.ticket?.trim();
        if (!ticket) return false;

        return await new Promise<boolean>((resolve) => {
            let settled = false;
            let opened = false;
            pendingWebSocketResolve = resolve;

            const wsUrl = deps.api
                .buildUrl(`/internal/v1/terminal/sessions/${sessionId}/ws`)
                .replace(/^http:/i, 'ws:')
                .replace(/^https:/i, 'wss:');
            const socket = new WebSocket(wsUrl, [
                terminalWebSocketProtocol,
                `${terminalWebSocketTicketPrefix}${ticket}`,
            ]);
            terminalSocket = socket;
            terminalSocketSessionId = sessionId;

            const settle = (value: boolean) => {
                if (settled) return;
                settled = true;
                if (pendingWebSocketResolve === resolve) {
                    pendingWebSocketResolve = null;
                }
                resolve(value);
            };

            socket.onopen = () => {
                if (isAttachStale(generation)) {
                    closeTerminalSocket();
                    settle(false);
                    return;
                }
                opened = true;
                streamAbortController?.abort();
                terminalStreaming.value = true;
                terminalTransportDisconnected.value = false;
                reconnectAttempt = 0;
                // #region agent log
                fetch('http://127.0.0.1:7845/ingest/f9918b6c-53f1-4b7a-a810-8a4b7fbf8eb8',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'8186a8'},body:JSON.stringify({sessionId:'8186a8',location:'transport.ts:ws-open',message:'websocket streaming enabled',data:{sessionId,generation},timestamp:Date.now(),hypothesisId:'H1-H3'})}).catch(()=>{});
                // #endregion
                settle(true);
            };
            socket.onmessage = (message) => {
                if (isAttachStale(generation)) return;
                try {
                    const event = JSON.parse(
                        String(message.data),
                    ) as TerminalWebSocketEvent;
                    deps.onStreamEvent(event.type, event.data);
                } catch {
                    deps.onStreamEvent('error', {
                        error: 'Invalid terminal WebSocket event.',
                    });
                }
            };
            socket.onerror = () => {
                if (!settled) {
                    closeTerminalSocket();
                    settle(false);
                }
            };
            socket.onclose = () => {
                if (terminalSocket === socket) {
                    terminalSocket = null;
                    terminalSocketSessionId = null;
                }
                terminalStreaming.value = false;
                if (!settled) {
                    settle(false);
                    return;
                }
                if (opened && !isAttachStale(generation)) {
                    noteTransportLost(sessionId);
                }
            };
        });
    }

    async function attachWebSocket(
        sessionId: string,
        generation: number,
        activeStreamController: AbortController,
    ) {
        if (terminalWebSocketUnsupported) return false;
        if (!process.client || typeof WebSocket === 'undefined') return false;
        if (isAttachStale(generation)) return false;
        terminalSocketConnecting = connectTerminalWebSocket(
            sessionId,
            generation,
            activeStreamController,
        );
        return await terminalSocketConnecting;
    }

    async function attachSse(
        sessionId: string,
        generation: number,
        activeStreamController: AbortController,
    ) {
        let streamEndedCleanly = false;
        try {
            for await (const event of deps.api.stream(
                `/internal/v1/terminal/sessions/${sessionId}/stream`,
                {
                    method: 'GET',
                    signal: activeStreamController.signal,
                },
            )) {
                if (isAttachStale(generation)) return;
                deps.onStreamEvent(
                    event.event,
                    event.json as Record<string, unknown> | undefined,
                );
            }
            streamEndedCleanly = !activeStreamController.signal.aborted;
        } catch (error: unknown) {
            if (activeStreamController.signal.aborted || isAttachStale(generation))
                return;
            if (
                deps.onMissingSession(
                    error,
                    'Terminal session expired or was cleared. Start a new session.',
                )
            )
                return;
            deps.setTerminalError(
                (error as { message?: string })?.message ??
                    'Terminal stream ended unexpectedly.',
            );
            noteTransportLost(sessionId);
            return;
        }
        if (
            streamEndedCleanly &&
            !isAttachStale(generation) &&
            deps.session.value?.session_id === sessionId &&
            deps.session.value?.status === 'running' &&
            !terminalSocketReady(sessionId)
        ) {
            noteTransportLost(sessionId);
        }
    }

    async function attach(sessionId: string) {
        if (!sessionId) return;

        detach();
        const generation = attachGeneration;

        const activeStreamController = new AbortController();
        streamAbortController = activeStreamController;
        terminalStreaming.value = true;
        terminalTransportDisconnected.value = false;

        if (await attachWebSocket(sessionId, generation, activeStreamController)) {
            if (isAttachStale(generation)) return;
            if (streamAbortController === activeStreamController) {
                streamAbortController = null;
            }
            reconnectAttempt = 0;
            terminalTransportDisconnected.value = false;
            return;
        }

        if (isAttachStale(generation)) return;

        await attachSse(sessionId, generation, activeStreamController);

        if (isAttachStale(generation)) return;
        if (streamAbortController === activeStreamController) {
            streamAbortController = null;
            terminalStreaming.value = false;
        }
    }

    function sendSocketPayload(payload: Record<string, unknown>) {
        if (!terminalSocketReady()) return false;
        terminalSocket?.send(JSON.stringify(payload));
        return true;
    }

    function resetTransportForTests() {
        detach();
        resetWebSocketCapability();
    }

    return {
        terminalStreaming,
        terminalTransportDisconnected,
        attach,
        detach,
        terminalSocketReady,
        sendSocketPayload,
        closeTerminalSocket,
        resetTransportForTests,
        resetWebSocketCapability,
        getAttachGenerationForTests: () => attachGeneration,
        isWebSocketUnsupported: () => terminalWebSocketUnsupported,
    };
}

export type TerminalTransport = ReturnType<typeof createTerminalTransport>;
