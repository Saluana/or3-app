import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { TerminalSessionSnapshot } from '../../app/types/or3-api';

const requestMock = vi.fn();
const streamMock = vi.fn(async function* () {
    yield { event: 'status', json: { status: 'running' } };
});

vi.mock('../../app/composables/useOr3Api', () => ({
    useOr3Api: () => ({
        request: requestMock,
        buildUrl: (path: string) => `http://127.0.0.1:9100${path}`,
        stream: streamMock,
    }),
}));

vi.mock('../../app/composables/useApprovals', () => ({
    useApprovals: () => ({
        consumeIssuedApprovalToken: () => undefined,
    }),
}));

import {
    getTerminalAttachGenerationForTests,
    resetTerminalSessionModuleForTests,
    useTerminalSession,
} from '../../app/composables/useTerminalSession';

function runningSession(): TerminalSessionSnapshot {
    return {
        session_id: 'term-1',
        root_id: 'workspace',
        path: '.',
        cwd: '/tmp',
        shell: '/bin/zsh',
        created_at: '2026-01-01T00:00:00.000Z',
        expires_at: '2026-01-01T00:10:00.000Z',
        last_active_at: '2026-01-01T00:00:00.000Z',
        status: 'running',
        rows: 24,
        cols: 80,
    };
}

class StubWebSocket {
    static readonly CONNECTING = 0;
    static readonly OPEN = 1;
    static readonly CLOSING = 2;
    static readonly CLOSED = 3;
    readyState = StubWebSocket.CONNECTING;
    onopen: (() => void) | null = null;
    onerror: (() => void) | null = null;
    onclose: (() => void) | null = null;
    onmessage: ((event: { data: string }) => void) | null = null;
    close() {
        this.readyState = StubWebSocket.CLOSED;
        this.onclose?.();
    }
    send() {}
}

describe('useTerminalSession', () => {
    beforeEach(() => {
        vi.useFakeTimers();
        vi.stubGlobal('process', { ...process, client: true });
        vi.stubGlobal('WebSocket', StubWebSocket);
        resetTerminalSessionModuleForTests();
        requestMock.mockReset();
        streamMock.mockClear();
    });

    afterEach(() => {
        resetTerminalSessionModuleForTests();
        vi.useRealTimers();
        vi.unstubAllGlobals();
    });

    it('keeps websocket enabled after a ws-ticket 404', async () => {
        const { session, attach } = useTerminalSession();
        session.value = runningSession();

        requestMock.mockRejectedValue({ status: 404, message: 'not found' });
        await attach('term-1');

        requestMock.mockRejectedValue({ status: 404, message: 'not found' });
        await attach('term-1');

        const wsTicketCalls = requestMock.mock.calls.filter(([path]) =>
            String(path).includes('/ws-ticket'),
        );
        expect(wsTicketCalls).toHaveLength(2);
    });

    it('disables websocket only for capability errors', async () => {
        const { session, attach } = useTerminalSession();
        session.value = runningSession();

        requestMock.mockRejectedValue({
            status: 405,
            message: 'method not allowed',
        });
        await attach('term-1');

        requestMock.mockRejectedValue({
            status: 404,
            message: 'not found',
        });
        await attach('term-1');

        const wsTicketCalls = requestMock.mock.calls.filter(([path]) =>
            String(path).includes('/ws-ticket'),
        );
        expect(wsTicketCalls).toHaveLength(1);
        expect(streamMock).toHaveBeenCalled();
    });

    it('invalidates in-flight transport when start is called again', async () => {
        const generationBefore = getTerminalAttachGenerationForTests();
        requestMock.mockImplementation(async (path: string) => {
            if (String(path).includes('/ws-ticket')) {
                await new Promise((resolve) => setTimeout(resolve, 5_000));
                return { ticket: 'late-ticket' };
            }
            if (String(path).endsWith('/internal/v1/terminal/sessions')) {
                return {
                    session_id: 'term-new',
                    root_id: 'workspace',
                    path: '.',
                    cwd: '/tmp',
                    shell: '/bin/zsh',
                    created_at: '2026-01-01T00:00:00.000Z',
                    expires_at: '2026-01-01T00:10:00.000Z',
                    last_active_at: '2026-01-01T00:00:00.000Z',
                    status: 'running',
                    rows: 24,
                    cols: 80,
                };
            }
            throw new Error(`unexpected ${path}`);
        });

        const { start } = useTerminalSession();
        const firstStart = start({
            root_id: 'workspace',
            path: '.',
            rows: 24,
            cols: 80,
        });
        await vi.advanceTimersByTimeAsync(0);
        const generationAfterFirstStart =
            getTerminalAttachGenerationForTests();
        expect(generationAfterFirstStart).toBeGreaterThan(generationBefore);

        await start({
            root_id: 'workspace',
            path: '.',
            rows: 24,
            cols: 80,
        });
        const generationAfterSecondStart =
            getTerminalAttachGenerationForTests();
        expect(generationAfterSecondStart).toBeGreaterThan(
            generationAfterFirstStart,
        );

        await vi.advanceTimersByTimeAsync(10_000);
        await firstStart.catch(() => {});

        const wsTicketCalls = requestMock.mock.calls.filter(([path]) =>
            String(path).includes('/ws-ticket'),
        );
        expect(wsTicketCalls.length).toBeGreaterThanOrEqual(2);
    });

    it('reattaches after websocket disconnect via reconnect timer', async () => {
        let activeSocket: StubWebSocket | null = null;
        const OriginalWebSocket = StubWebSocket;
        class TrackingWebSocket extends OriginalWebSocket {
            constructor(...args: ConstructorParameters<typeof StubWebSocket>) {
                super(...args);
                activeSocket = this;
            }
        }
        vi.stubGlobal('WebSocket', TrackingWebSocket);

        requestMock.mockImplementation(async (path: string) => {
            if (String(path).includes('/ws-ticket')) {
                return { ticket: 'ticket-1' };
            }
            throw new Error(`unexpected ${path}`);
        });

        const { session, attach } = useTerminalSession();
        session.value = runningSession();

        const attachPromise = attach('term-1');
        await vi.advanceTimersByTimeAsync(0);
        activeSocket?.onopen?.();
        await attachPromise;

        const callsBeforeClose = requestMock.mock.calls.filter(([path]) =>
            String(path).includes('/ws-ticket'),
        ).length;

        activeSocket?.close();
        await vi.advanceTimersByTimeAsync(400);

        const callsAfterReconnect = requestMock.mock.calls.filter(([path]) =>
            String(path).includes('/ws-ticket'),
        ).length;
        expect(callsAfterReconnect).toBeGreaterThan(callsBeforeClose);
    });

    it('exposes reconnectMode for transport vs session loss', () => {
        const { session, reconnectMode } = useTerminalSession();
        session.value = runningSession();
        expect(reconnectMode.value).toBeNull();

        const { terminalTransportDisconnected } = useTerminalSession();
        terminalTransportDisconnected.value = true;
        expect(reconnectMode.value).toBe('transport');

        session.value = { ...runningSession(), status: 'closed' };
        terminalTransportDisconnected.value = false;
        expect(reconnectMode.value).toBe('session');
    });
});
