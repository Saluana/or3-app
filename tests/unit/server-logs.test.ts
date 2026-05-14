import { beforeEach, describe, expect, it, vi } from 'vitest';

const { stream } = vi.hoisted(() => ({
    stream: vi.fn(),
}));

vi.mock('../../app/composables/useOr3Api', () => ({
    useOr3Api: () => ({ stream }),
}));

import { useServerLogs } from '../../app/composables/useServerLogs';

async function waitForMicrotasks() {
    await Promise.resolve();
    await Promise.resolve();
}

describe('useServerLogs', () => {
    beforeEach(() => {
        stream.mockReset();
        const logs = useServerLogs();
        logs.disconnect();
        logs.clear();
    });

    it('connects with query filters and stores normalized log events', async () => {
        stream.mockImplementation(async function* (path: string) {
            expect(path).toContain('/internal/v1/logs/stream?');
            expect(path).toContain('level=warn');
            expect(path).toContain('component=service_turn');
            expect(path).toContain('trace_id=trace-a');
            yield {
                event: 'log',
                json: {
                    id: 'log_1',
                    timestamp: '2026-05-14T00:00:00Z',
                    level: 'warn',
                    component: 'service_turn',
                    message: 'approval required',
                    trace_id: 'trace-a',
                    session: 'session-a',
                },
            };
        });

        const logs = useServerLogs();
        logs.connect({ level: 'warn', component: 'service_turn', traceId: 'trace-a' });
        await waitForMicrotasks();

        expect(logs.entries.value).toHaveLength(1);
        expect(logs.entries.value[0]).toMatchObject({
            id: 'log_1',
            level: 'warn',
            component: 'service_turn',
            traceId: 'trace-a',
            session: 'session-a',
        });
    });

    it('disconnect aborts the active stream', async () => {
        let signal: AbortSignal | undefined;
        stream.mockImplementation(async function* (_path: string, options: { signal?: AbortSignal }) {
            signal = options.signal;
            await new Promise<void>((resolve) => options.signal?.addEventListener('abort', () => resolve(), { once: true }));
        });

        const logs = useServerLogs();
        logs.connect();
        await waitForMicrotasks();
        expect(logs.isStreaming.value).toBe(true);

        logs.disconnect();
        await waitForMicrotasks();

        expect(signal?.aborted).toBe(true);
        expect(logs.isStreaming.value).toBe(false);
    });
});
