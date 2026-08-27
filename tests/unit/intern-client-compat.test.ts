import { afterEach, describe, expect, it, vi } from 'vitest';
import { useLocalCache } from '../../app/composables/useLocalCache';
import { useOr3Api } from '../../app/composables/useOr3Api';

function connectedHost(token = 'paired-secret') {
    useLocalCache().updateHost({
        id: 'compat-host',
        name: 'Compatibility host',
        baseUrl: 'http://127.0.0.1:9100',
        token,
        pairedToken: token,
        status: 'online',
    });
}

describe('@or3/intern-client compatibility adapter', () => {
    afterEach(() => {
        useLocalCache().clearAll();
        vi.unstubAllGlobals();
    });

    it('preserves authenticated SSE parsing and open callbacks', async () => {
        connectedHost();
        const onOpen = vi.fn();
        vi.stubGlobal(
            'fetch',
            vi.fn(
                async (
                    input: string | URL | Request,
                    init?: RequestInit,
                ) => {
                    expect(String(input)).toBe(
                        'http://127.0.0.1:9100/internal/v1/jobs/job-1/stream',
                    );
                    expect(init?.method).toBe('GET');
                    expect(init?.headers).toMatchObject({
                        Authorization: 'Bearer paired-secret',
                        Accept: 'text/event-stream',
                    });
                    const bytes = new TextEncoder().encode(
                        'id: 7\nevent: update\ndata: {"status":"running"}\n\n',
                    );
                    return new Response(
                        new ReadableStream<Uint8Array>({
                            start(controller) {
                                controller.enqueue(bytes);
                                controller.close();
                            },
                        }),
                        {
                            status: 200,
                            headers: { 'Content-Type': 'text/event-stream' },
                        },
                    );
                },
            ),
        );

        const received = [];
        for await (const event of useOr3Api().stream(
            '/internal/v1/jobs/job-1/stream',
            { method: 'GET', onOpen },
        )) {
            received.push(event);
        }

        expect(onOpen).toHaveBeenCalledOnce();
        expect(received).toEqual([
            {
                id: '7',
                event: 'update',
                data: '{"status":"running"}',
                json: { status: 'running' },
                cursor: '7',
            },
        ]);
    });

    it('does not expose a bearer token through a network error', async () => {
        connectedHost('do-not-log-this-token');
        vi.stubGlobal(
            'fetch',
            vi.fn(async () => {
                throw new Error(
                    'network failed for do-not-log-this-token',
                );
            }),
        );

        const error = await useOr3Api()
            .request('/internal/v1/health')
            .catch((caught) => caught);

        expect(error).toMatchObject({ code: 'host_unreachable' });
        expect(String(error.cause?.message ?? error.message)).not.toContain(
            'do-not-log-this-token',
        );
    });

    it('preserves the missing-host error instead of reporting a network failure', async () => {
        const error = await useOr3Api()
            .request('/internal/v1/health', { requireAuth: false })
            .catch((caught) => caught);

        expect(error).toMatchObject({
            status: 0,
            message: 'No or3-intern host is configured',
        });
        expect(error.code).not.toBe('host_unreachable');
    });
});
