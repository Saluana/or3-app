import { describe, expect, it, vi } from 'vitest';
import { useActiveHost } from '../../app/composables/useActiveHost';
import { useLocalCache } from '../../app/composables/useLocalCache';
import { useOr3Api } from '../../app/composables/useOr3Api';
import { extractErrorCode } from '../../app/utils/assistant-stream/errors';

describe('useOr3Api', () => {
    afterEach(() => {
        useLocalCache().clearAll();
        vi.unstubAllGlobals();
    });

    it('separates saved pairings from live connections and clears tokens on disconnect', () => {
        const cache = useLocalCache();
        cache.clearAll();
        cache.updateHost({
            id: 'test',
            name: 'Test Mac',
            baseUrl: 'http://100.82.202.111:9100/',
            token: 'secret',
            pairedToken: 'secret',
            status: 'offline',
        });

        const active = useActiveHost();

        expect(active.isPaired.value).toBe(true);
        expect(active.isConnected.value).toBe(false);

        expect(active.disconnectActiveHost()).toBe(true);
        expect(cache.state.value.hosts).toEqual([]);
        expect(active.activeHost.value).toBeNull();
        expect(active.isPaired.value).toBe(false);
    });

    it('marks the active host offline when the request cannot reach it', async () => {
        const cache = useLocalCache();
        cache.clearAll();
        cache.updateHost({
            id: 'test',
            name: 'Test Mac',
            baseUrl: 'http://100.82.202.111:9100/',
            token: 'secret',
            status: 'online',
        });

        vi.stubGlobal(
            'fetch',
            vi.fn(async () => {
                throw new Error('network blocked');
            }),
        );

        const api = useOr3Api();
        await expect(api.request('/internal/v1/health')).rejects.toMatchObject({
            code: 'host_unreachable',
        });

        expect(cache.state.value.hosts[0]).toMatchObject({ status: 'offline' });
        expect(useActiveHost().isConnected.value).toBe(false);
    });

    it('marks the active host online after a successful request', async () => {
        const cache = useLocalCache();
        cache.clearAll();
        cache.updateHost({
            id: 'test',
            name: 'Test Mac',
            baseUrl: 'http://100.82.202.111:9100/',
            token: 'secret',
            status: 'offline',
        });

        vi.stubGlobal(
            'fetch',
            vi.fn(
                async () =>
                    new Response(JSON.stringify({ status: 'ok' }), {
                        status: 200,
                        headers: { 'Content-Type': 'application/json' },
                    }),
            ),
        );

        const api = useOr3Api();
        await expect(api.request('/internal/v1/health')).resolves.toEqual({
            status: 'ok',
        });

        expect(cache.state.value.hosts[0]).toMatchObject({ status: 'online' });
        expect(cache.state.value.hosts[0]?.lastSeenAt).toBeTruthy();
        expect(useActiveHost().isConnected.value).toBe(true);
    });

    it('normalizes auth requests and maps JSON responses', async () => {
        const cache = useLocalCache();
        cache.clearAll();
        cache.updateHost({
            id: 'test',
            name: 'Test Mac',
            baseUrl: 'http://127.0.0.1:9100/',
            token: 'secret',
        });

        const fetchMock = vi.fn(
            async (_url: string | URL | Request, init?: RequestInit) => {
                expect(String(_url)).toBe(
                    'http://127.0.0.1:9100/internal/v1/health',
                );
                expect(init?.headers).toMatchObject({
                    Authorization: 'Bearer secret',
                });
                return new Response(JSON.stringify({ status: 'ok' }), {
                    status: 200,
                    headers: { 'Content-Type': 'application/json' },
                });
            },
        );
        vi.stubGlobal('fetch', fetchMock);

        const api = useOr3Api();
        await expect(api.request('/internal/v1/health')).resolves.toEqual({
            status: 'ok',
        });
    });

    it('uses paired bearer tokens and includes the passkey session header when available', async () => {
        const cache = useLocalCache();
        cache.clearAll();
        cache.updateHost({
            id: 'test',
            name: 'Test Mac',
            baseUrl: 'http://127.0.0.1:9100/',
            token: 'session-token',
            pairedToken: 'paired-token',
            sessionToken: 'session-token',
        });

        const fetchMock = vi.fn(
            async (_url: string | URL | Request, init?: RequestInit) => {
                expect(String(_url)).toBe(
                    'http://127.0.0.1:9100/internal/v1/auth/session',
                );
                expect(init?.headers).toMatchObject({
                    Authorization: 'Bearer paired-token',
                    'X-Or3-Session': 'session-token',
                });
                return new Response(
                    JSON.stringify({
                        session: { id: 's1' },
                        user: { id: 'owner' },
                        role: 'operator',
                    }),
                    {
                        status: 200,
                        headers: { 'Content-Type': 'application/json' },
                    },
                );
            },
        );
        vi.stubGlobal('fetch', fetchMock);

        const api = useOr3Api();
        await expect(
            api.request('/internal/v1/auth/session'),
        ).resolves.toMatchObject({ role: 'operator' });
    });

    it('retries once after an auth challenge handler resolves the challenge', async () => {
        const cache = useLocalCache();
        cache.clearAll();
        cache.updateHost({
            id: 'test',
            name: 'Test Mac',
            baseUrl: 'http://127.0.0.1:9100/',
            token: 'paired-token',
            pairedToken: 'paired-token',
        });

        const fetchMock = vi.fn(async () => {
            if (fetchMock.mock.calls.length === 1) {
                return new Response(
                    JSON.stringify({
                        code: 'SESSION_REQUIRED',
                        message: 'session required',
                        retry_after_seconds: 5,
                    }),
                    {
                        status: 401,
                        headers: { 'Content-Type': 'application/json' },
                    },
                );
            }
            return new Response(JSON.stringify({ status: 'ok' }), {
                status: 200,
                headers: { 'Content-Type': 'application/json' },
            });
        });
        vi.stubGlobal('fetch', fetchMock);

        const api = useOr3Api();
        const onAuthChallenge = vi.fn(async () => true);

        await expect(
            api.request('/internal/v1/health', { onAuthChallenge }),
        ).resolves.toEqual({ status: 'ok' });
        expect(onAuthChallenge).toHaveBeenCalledWith(
            expect.objectContaining({
                code: 'SESSION_REQUIRED',
                retryAfterSeconds: 5,
            }),
        );
        expect(fetchMock).toHaveBeenCalledTimes(2);
    });

    it('does not attach auth headers when stored tokens are bound to a different origin', async () => {
        const cache = useLocalCache();
        cache.clearAll();
        cache.updateHost({
            id: 'test',
            name: 'Test Mac',
            baseUrl: 'http://evil.example',
            pairedToken: 'paired-token',
            sessionToken: 'session-token',
            token: 'session-token',
            tokenOrigin: 'http://127.0.0.1:9100',
        });

        const fetchMock = vi.fn(
            async (_url: string | URL | Request, init?: RequestInit) => {
                expect(String(_url)).toBe(
                    'http://evil.example/internal/v1/health',
                );
                expect(init?.headers).not.toMatchObject({
                    Authorization: expect.any(String),
                    'X-Or3-Session': expect.any(String),
                });
                return new Response(JSON.stringify({ status: 'ok' }), {
                    status: 200,
                    headers: { 'Content-Type': 'application/json' },
                });
            },
        );
        vi.stubGlobal('fetch', fetchMock);

        const api = useOr3Api();
        await expect(
            api.request('/internal/v1/health', { requireAuth: false }),
        ).resolves.toEqual({ status: 'ok' });
    });

    it('strips auth headers when baseUrl points to a different origin', async () => {
        const cache = useLocalCache();
        cache.clearAll();
        cache.updateHost({
            id: 'test',
            name: 'Test Mac',
            baseUrl: 'http://127.0.0.1:9100/',
            token: 'session-token',
            pairedToken: 'paired-token',
            sessionToken: 'session-token',
        });

        const fetchMock = vi.fn(
            async (_url: string | URL | Request, init?: RequestInit) => {
                expect(String(_url)).toBe('http://evil.example/internal/v1/health');
                expect(init?.headers).not.toMatchObject({
                    Authorization: expect.any(String),
                    'X-Or3-Session': expect.any(String),
                });
                return new Response(JSON.stringify({ status: 'ok' }), {
                    status: 200,
                    headers: { 'Content-Type': 'application/json' },
                });
            },
        );
        vi.stubGlobal('fetch', fetchMock);

        const api = useOr3Api();
        await expect(
            api.request('/internal/v1/health', {
                baseUrl: 'http://evil.example',
                requireAuth: false,
            }),
        ).resolves.toEqual({ status: 'ok' });
    });

    it('does not attach session header when requireAuth is false', async () => {
        const cache = useLocalCache();
        cache.clearAll();
        cache.updateHost({
            id: 'test',
            name: 'Test Mac',
            baseUrl: 'http://127.0.0.1:9100/',
            token: 'session-token',
            pairedToken: 'paired-token',
            sessionToken: 'session-token',
        });

        const fetchMock = vi.fn(
            async (_url: string | URL | Request, init?: RequestInit) => {
                expect(init?.headers).not.toMatchObject({
                    Authorization: expect.any(String),
                    'X-Or3-Session': expect.any(String),
                });
                return new Response(JSON.stringify({ status: 'ok' }), {
                    status: 200,
                    headers: { 'Content-Type': 'application/json' },
                });
            },
        );
        vi.stubGlobal('fetch', fetchMock);

        const api = useOr3Api();
        await expect(
            api.request('/internal/v1/auth/session', { requireAuth: false }),
        ).resolves.toEqual({ status: 'ok' });
    });

    it('keeps app request payloads snake_case', async () => {
        const cache = useLocalCache();
        cache.clearAll();
        cache.updateHost({
            id: 'test',
            name: 'Test Mac',
            baseUrl: 'http://127.0.0.1:9100/',
            token: 'secret',
        });

        const fetchMock = vi.fn(
            async (_url: string | URL | Request, init?: RequestInit) => {
                expect(String(_url)).toBe(
                    'http://127.0.0.1:9100/internal/v1/runner-runs',
                );
                expect(JSON.parse(String(init?.body))).toEqual({
                    parent_session_key: 'main',
                    runner_id: 'opencode',
                    task: 'summarize',
                    timeout_seconds: 30,
                });
                expect(String(init?.body)).not.toContain('parentSessionKey');
                expect(String(init?.body)).not.toContain('timeoutSeconds');
                return new Response(JSON.stringify({ job_id: 'job_1' }), {
                    status: 200,
                    headers: { 'Content-Type': 'application/json' },
                });
            },
        );
        vi.stubGlobal('fetch', fetchMock);

        const api = useOr3Api();
        await expect(
            api.request('/internal/v1/runner-runs', {
                method: 'POST',
                body: {
                    parent_session_key: 'main',
                    runner_id: 'opencode',
                    task: 'summarize',
                    timeout_seconds: 30,
                },
            }),
        ).resolves.toEqual({ job_id: 'job_1' });
    });

    it('passes structured service error codes through', async () => {
        const cache = useLocalCache();
        cache.clearAll();
        cache.updateHost({
            id: 'test',
            name: 'Test Mac',
            baseUrl: 'http://127.0.0.1:9100/',
            token: 'secret',
        });

        vi.stubGlobal(
            'fetch',
            vi.fn(
                async () =>
                    new Response(
                        JSON.stringify({
                            error: 'token missing',
                            code: 'missing_token',
                            request_id: 'req_1',
                        }),
                        {
                            status: 401,
                            headers: { 'Content-Type': 'application/json' },
                        },
                    ),
            ),
        );

        const api = useOr3Api();
        await expect(api.request('/internal/v1/health')).rejects.toMatchObject({
            code: 'missing_token',
            request_id: 'req_1',
            status: 401,
        });
    });

    it('uses desktop shared-secret tokens for Electron host requests', async () => {
        vi.resetModules();
        const { ref } = await import('vue');
        const activeHost = ref({
            id: 'electron-local-host',
            name: 'This computer',
            baseUrl: 'http://127.0.0.1:9100',
            token: 'electron-local-service-token',
            status: 'online',
        });
        vi.doMock('../../app/composables/useActiveHost', () => ({
            ELECTRON_HOST_PROFILE_ID: 'electron-local-host',
            useActiveHost: () => ({ activeHost, updateHost: vi.fn() }),
        }));
        vi.doMock('../../app/composables/useElectronHostSetup', () => ({
            useElectronHostSetup: () => ({ isElectronHostMode: ref(true) }),
        }));
        vi.stubGlobal('window', {
            or3Desktop: {
                intern: {
                    issueServiceToken: vi.fn(async () => ({ token: 'desktop-token', expiresAt: new Date().toISOString() })),
                },
            },
        });

        const fetchMock = vi.fn(async (_url: string | URL | Request, init?: RequestInit) => {
            expect(String(_url)).toBe('http://127.0.0.1:9100/internal/v1/app/bootstrap');
            expect(init?.headers).toMatchObject({
                Authorization: 'Bearer desktop-token',
                'X-Or3-Auth-Method': 'shared-secret',
            });
            return new Response(JSON.stringify({ status: 'ok' }), {
                status: 200,
                headers: { 'Content-Type': 'application/json' },
            });
        });
        vi.stubGlobal('fetch', fetchMock);

        const { useOr3Api: useMockedOr3Api } = await import('../../app/composables/useOr3Api');
        const api = useMockedOr3Api();
        await expect(api.request('/internal/v1/app/bootstrap')).resolves.toEqual({ status: 'ok' });
    });

    it('locally cools down Electron host requests after auth rate limiting', async () => {
        vi.resetModules();
        const { ref } = await import('vue');
        const activeHost = ref({
            id: 'electron-local-host',
            name: 'This computer',
            baseUrl: 'http://127.0.0.1:9100',
            token: 'electron-local-service-token',
            status: 'online',
        });
        vi.doMock('../../app/composables/useActiveHost', () => ({
            ELECTRON_HOST_PROFILE_ID: 'electron-local-host',
            useActiveHost: () => ({ activeHost, updateHost: vi.fn() }),
        }));
        vi.doMock('../../app/composables/useElectronHostSetup', () => ({
            useElectronHostSetup: () => ({ isElectronHostMode: ref(true) }),
        }));
        vi.stubGlobal('window', {
            or3Desktop: {
                intern: {
                    issueServiceToken: vi.fn(async () => ({ token: 'desktop-token', expiresAt: new Date().toISOString() })),
                },
            },
        });

        const fetchMock = vi.fn(async () => new Response(
            JSON.stringify({ code: 'auth_rate_limited', error: 'too many authentication attempts', retry_after_seconds: 10 }),
            { status: 429, headers: { 'Content-Type': 'application/json' } },
        ));
        vi.stubGlobal('fetch', fetchMock);

        const { useOr3Api: useMockedOr3Api } = await import('../../app/composables/useOr3Api');
        const api = useMockedOr3Api();
        await expect(api.request('/internal/v1/app/bootstrap')).rejects.toMatchObject({ code: 'auth_rate_limited' });
        await expect(api.request('/internal/v1/app/bootstrap')).rejects.toMatchObject({ code: 'auth_rate_limited' });
        expect(fetchMock).toHaveBeenCalledTimes(1);
    });

    it('recognizes lower-case auth service error codes centrally', () => {
        for (const code of [
            'missing_token',
            'invalid_token',
            'token_replay',
            'auth_rate_limited',
        ]) {
            expect(extractErrorCode({ code })).toBe(code);
        }
    });
});
