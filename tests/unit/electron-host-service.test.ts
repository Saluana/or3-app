import { chmod, mkdir, mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
    buildInviteRoutes,
    configureService,
    createSecureInvite,
    installInternPlaceholder,
    issueServiceToken,
    locateInternBinary,
    setHostServiceUserDataPath,
    startService,
    serviceStatus,
    stopService,
} from '../../electron/host-service.js';

function decodeServiceTokenPayload(token: string) {
    const [payload] = token.split('.');
    return JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
}

async function makeFakeIntern(dir: string) {
    const file = join(dir, 'or3-intern');
    await writeFile(
        file,
        `#!/bin/sh\nif [ "$1" = "--version" ]; then echo "or3-intern test"; exit 0; fi\nif [ "$1" = "service" ]; then sleep 30; exit 0; fi\nexit 1\n`,
    );
    await chmod(file, 0o755);
    return file;
}

async function makeFakeInternWithVersionSubcommand(dir: string) {
    const file = join(dir, 'or3-intern');
    await writeFile(
        file,
        `#!/bin/sh\nif [ "$1" = "version" ]; then echo "or3-intern v1"; exit 0; fi\nif [ "$1" = "help" ]; then echo "or3-intern help"; exit 0; fi\nexit 1\n`,
    );
    await chmod(file, 0o755);
    return file;
}

describe('Electron host service manager', () => {
    let dir: string;

    beforeEach(async () => {
        dir = await mkdtemp(join(tmpdir(), 'or3-electron-host-'));
        setHostServiceUserDataPath(dir);
        await stopService().catch(() => null);
    });

    afterEach(() => {
        vi.unstubAllGlobals();
    });

    it('reports recoverable installer fallback when no bundled installer exists', async () => {
        const result = await installInternPlaceholder();

        expect(result.state).toBe('failed');
        expect(result.recoverable).toBe(true);
    });

    it('validates a manual intern binary with version check', async () => {
        const binary = await makeFakeIntern(dir);
        const status: any = await locateInternBinary({ manualPath: binary });

        expect(status.found).toBe(true);
        expect(status.compatible).toBe(true);
        expect(status.binary?.source).toBe('manual');
    });

    it('accepts intern binaries that expose version as a subcommand', async () => {
        const binary = await makeFakeInternWithVersionSubcommand(dir);
        const status: any = await locateInternBinary({ manualPath: binary });

        expect(status.found).toBe(true);
        expect(status.compatible).toBe(true);
        expect(status.binary?.version).toBe('or3-intern v1');
    });

    it('finds a sibling dev or3-intern binary when PATH does not contain one', async () => {
        const appPath = join(dir, 'or3-app');
        const siblingIntern = join(dir, 'or3-intern');
        await mkdir(appPath, { recursive: true });
        await mkdir(siblingIntern, { recursive: true });
        await makeFakeIntern(siblingIntern);

        const status: any = await locateInternBinary({ appPath, resourcesPath: join(dir, 'missing') });

        expect(status.found).toBe(true);
        expect(status.compatible).toBe(true);
        expect(status.binary?.source).toBe('bundled');
        expect(status.binary?.path).toBe(join(siblingIntern, 'or3-intern'));
    });

    it('configures and starts a local service process without shell command strings', async () => {
        const binary = await makeFakeIntern(dir);
        const workspace = await mkdtemp(join(tmpdir(), 'or3-workspace-'));
        const configured = await configureService({
            machineName: 'Desk',
            workspaceDir: workspace,
            listenHost: '127.0.0.1',
            listenPort: 65530,
            securityPreset: 'private',
            autostartEnabled: false,
            serviceBehavior: 'stop-with-app',
            internBinaryPath: binary,
        });

        expect(configured.ok).toBe(true);
        expect(configured.serviceBaseUrl).toBe('http://127.0.0.1:65530');
        const token: any = await issueServiceToken({ method: 'GET', path: '/internal/v1/health' });
        expect(token.token).toMatch(/^[A-Za-z0-9_-]+\.[a-f0-9]{64}$/);
        const status: any = await startService();
        expect(['starting', 'online']).toContain(status.state);
        expect(status.processId).toBeTypeOf('number');
        await stopService();
    });

    it('binds desktop service tokens to the decoded Go request path', async () => {
        const workspace = await mkdtemp(join(tmpdir(), 'or3-workspace-'));
        await configureService({
            machineName: 'Desk',
            workspaceDir: workspace,
            listenHost: '127.0.0.1',
            listenPort: 65530,
            securityPreset: 'private',
            autostartEnabled: false,
            serviceBehavior: 'stop-with-app',
        });

        const token: any = await issueServiceToken({
            method: 'GET',
            path: '/internal/v1/chat-sessions/or3-app%3Alocal%3Asession/messages?limit=100',
        });
        const payload = decodeServiceTokenPayload(token.token);

        expect(payload).toMatchObject({
            method: 'GET',
            path: '/internal/v1/chat-sessions/or3-app:local:session/messages',
        });
    });

    it('does not report a reachable service as online until desktop auth works', async () => {
        const workspace = await mkdtemp(join(tmpdir(), 'or3-workspace-'));
        await configureService({
            machineName: 'Desk',
            workspaceDir: workspace,
            listenHost: '127.0.0.1',
            listenPort: 65531,
            securityPreset: 'private',
            autostartEnabled: false,
            serviceBehavior: 'stop-with-app',
        });
        const fetchMock = vi.fn(async (url: string | URL, init?: RequestInit) => {
            if (String(url).endsWith('/internal/v1/health')) {
                return new Response(JSON.stringify({ status: 'ok', processId: 12345 }), {
                    status: 200,
                    headers: { 'Content-Type': 'application/json' },
                });
            }
            return new Response(JSON.stringify({ code: 'invalid_token', error: 'unauthorized' }), {
                status: 401,
                headers: { 'Content-Type': 'application/json' },
            });
        });
        vi.stubGlobal('fetch', fetchMock);

        const status: any = await serviceStatus();

        expect(status.state).toBe('unhealthy');
        expect(status.authMismatch).toBe(true);
        expect(status.processId).toBe(12345);
        expect(fetchMock.mock.calls[1]?.[1]?.headers).toMatchObject({
            'X-Or3-Auth-Method': 'shared-secret',
        });
    });

    it('serializes concurrent config writes from status and invite refreshes', async () => {
        const workspace = await mkdtemp(join(tmpdir(), 'or3-workspace-'));
        await configureService({
            machineName: 'Desk',
            workspaceDir: workspace,
            listenHost: '127.0.0.1',
            listenPort: 65532,
            securityPreset: 'home',
            autostartEnabled: false,
            serviceBehavior: 'stop-with-app',
        });
        vi.stubGlobal('fetch', vi.fn(async (url: string | URL) => {
            const text = String(url);
            if (text.endsWith('/internal/v1/health')) {
                return new Response(JSON.stringify({ status: 'ok', processId: 12345 }), {
                    status: 200,
                    headers: { 'Content-Type': 'application/json' },
                });
            }
            if (text.endsWith('/internal/v1/app/bootstrap')) {
                return new Response(JSON.stringify({ status: { health: 'ok' } }), {
                    status: 200,
                    headers: { 'Content-Type': 'application/json' },
                });
            }
            if (text.endsWith('/internal/v1/secure-connections/pairing/intents')) {
                return new Response(JSON.stringify({ id: 'invite-1', qr: 'qr-text' }), {
                    status: 201,
                    headers: { 'Content-Type': 'application/json' },
                });
            }
            return new Response('{}', { status: 404 });
        }));

        await Promise.all([
            serviceStatus(),
            serviceStatus(),
            createSecureInvite(),
            createSecureInvite(),
        ]);

        const persisted = JSON.parse(await readFile(join(dir, 'or3-electron-host.json'), 'utf8'));
        expect(persisted.lastServiceStatus.state).toBe('online');
        expect(persisted.serviceAuth.secret).toBeTypeOf('string');
    });

    it('does not emit app-proxy routes for packaged app origins', () => {
        const routes = buildInviteRoutes(
            { baseUrl: 'http://127.0.0.1:9100' },
            'app://or3',
            { hostService: { listenPort: 9100 } },
        );

        expect(routes.some((route) => route.kind === 'app-proxy')).toBe(false);
        expect(routes.some((route) => route.kind === 'loopback')).toBe(true);
    });

    it('keeps dev localhost app-proxy routes when an HTTP app origin exists', () => {
        const routes = buildInviteRoutes(
            { baseUrl: 'http://127.0.0.1:9100' },
            'http://localhost:3060',
            { hostService: { listenPort: 9100 } },
        );

        expect(routes).toContainEqual({
            kind: 'app-proxy',
            baseUrl: 'http://localhost:3060/api/or3',
            priority: 10,
        });
    });

    it('forwards selected invite permissions to the pairing intent', async () => {
        const workspace = await mkdtemp(join(tmpdir(), 'or3-workspace-'));
        await configureService({
            machineName: 'Desk',
            workspaceDir: workspace,
            listenHost: '127.0.0.1',
            listenPort: 65532,
            securityPreset: 'home',
            autostartEnabled: false,
            serviceBehavior: 'stop-with-app',
        });
        let intentBody: any = null;
        vi.stubGlobal('fetch', vi.fn(async (url: string | URL, init?: RequestInit) => {
            const text = String(url);
            if (text.endsWith('/internal/v1/health')) {
                return new Response(JSON.stringify({ status: 'ok', processId: 12345 }), {
                    status: 200,
                    headers: { 'Content-Type': 'application/json' },
                });
            }
            if (text.endsWith('/internal/v1/app/bootstrap')) {
                return new Response(JSON.stringify({ status: { health: 'ok' } }), {
                    status: 200,
                    headers: { 'Content-Type': 'application/json' },
                });
            }
            if (text.endsWith('/internal/v1/secure-connections/pairing/intents')) {
                intentBody = JSON.parse(String(init?.body || '{}'));
                return new Response(JSON.stringify({ id: 'invite-1', qr: 'qr-text' }), {
                    status: 201,
                    headers: { 'Content-Type': 'application/json' },
                });
            }
            return new Response('{}', { status: 404 });
        }));

        await createSecureInvite({ requestedRole: 'viewer', capabilities: ['chat'] });

        expect(intentBody).toMatchObject({
            requested_role: 'viewer',
            capabilities: ['chat'],
        });
    });
});
