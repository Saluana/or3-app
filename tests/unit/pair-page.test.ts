import { mount } from '@vue/test-utils';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { encodePairingInviteV2, type PairingInviteV2 } from '../../app/utils/or3/secure-connections';

const pairingMocks = vi.hoisted(() => {
    const exchangeInputs: unknown[] = [];
    const upgradeInputs: unknown[] = [];
    return {
        exchangeInputs,
        upgradeInputs,
        exchangeSecurePairingPayload: vi.fn<(input: unknown) => Promise<void>>(async (input) => {
            exchangeInputs.push(input);
        }),
        upgradeSecurePairingPayload: vi.fn<(input: unknown) => Promise<void>>(async (input) => {
            upgradeInputs.push(input);
        }),
    };
});
const routerPush = vi.hoisted(() => vi.fn());

vi.mock('~/composables/usePairing', () => ({
    usePairing: () => pairingMocks,
}));

vi.mock('../../app/composables/usePairing', () => ({
    usePairing: () => pairingMocks,
}));

vi.mock('vue-router', () => ({
    useRouter: () => ({ push: routerPush }),
}));

const stubs = {
    AppShell: { template: '<main><slot name="sidebar" /><slot /></main>' },
    SettingsSidebar: { template: '<aside />' },
    AppHeader: { template: '<header />' },
    SurfaceCard: { template: '<section><slot /></section>' },
    RetroIcon: { template: '<span />' },
    UButton: {
        props: ['label', 'to'],
        template: '<button type="button" @click="$emit(\'click\')">{{ label }}<slot /></button>',
    },
};

const validSecret = 'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA';

function invite(): PairingInviteV2 {
    return {
        version: 2,
        kind: 'or3.pair.invite',
        inviteId: 'invite-1',
        issuedAtUnixMs: Date.now(),
        expiresAtUnixMs: Date.now() + 60_000,
        host: {
            id: 'host-1',
            displayName: 'Studio Mac',
            signingPublicKey: 'signing-public-key',
            noisePublicKey: 'noise-public-key',
        },
        pairing: {
            rendezvousId: 'rv-1',
            pairingSecret: validSecret,
            qrNonce: 'nonce-1',
        },
        capabilities: ['chat', 'files', 'terminal'],
        routes: [
            { kind: 'direct', baseUrl: 'http://192.168.1.78:9100', priority: 20 },
            { kind: 'app-proxy', baseUrl: 'http://192.168.1.78:3060/api/or3', priority: 10 },
        ],
        signature: 'sha256:test',
    };
}

describe('/pair page', () => {
    afterEach(() => {
        vi.clearAllMocks();
        pairingMocks.exchangeInputs.length = 0;
        pairingMocks.upgradeInputs.length = 0;
        vi.unstubAllGlobals();
        history.replaceState(null, '', '/');
    });

    it('prefers same-origin app proxy before direct service', async () => {
        history.replaceState(null, '', `/pair#invite=${encodePairingInviteV2(invite())}`);
        Object.defineProperty(globalThis, 'isSecureContext', { value: true, configurable: true });
        Object.defineProperty(globalThis, 'crypto', {
            value: { subtle: { generateKey: vi.fn() } },
            configurable: true,
        });
        const fetchMock = vi.fn(async (_url: string | URL | Request) => new Response(JSON.stringify({ status: 'ok' }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
        }));
        vi.stubGlobal('fetch', fetchMock);
        const PairPage = (await import('../../app/pages/pair.vue')).default;

        mount(PairPage, { global: { stubs } });
        await vi.waitFor(() => expect(pairingMocks.upgradeSecurePairingPayload).toHaveBeenCalled());

        const secureCall = pairingMocks.upgradeInputs.at(0);
        expect(secureCall).toMatchObject({
            baseUrl: 'http://localhost:3000/api/or3',
        });
    });

    it('uses compatibility exchange when WebCrypto is unavailable', async () => {
        history.replaceState(null, '', `/pair#invite=${encodePairingInviteV2(invite())}`);
        Object.defineProperty(globalThis, 'isSecureContext', { value: false, configurable: true });
        Object.defineProperty(globalThis, 'crypto', { value: {}, configurable: true });
        vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({ status: 'ok' }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
        })));
        const PairPage = (await import('../../app/pages/pair.vue')).default;

        mount(PairPage, { global: { stubs } });
        await vi.waitFor(() => expect(pairingMocks.exchangeSecurePairingPayload).toHaveBeenCalled());

        expect(pairingMocks.upgradeSecurePairingPayload).not.toHaveBeenCalled();
        const compatibilityCall = pairingMocks.exchangeInputs.at(0);
        expect(compatibilityCall).toMatchObject({
            baseUrl: 'http://localhost:3000/api/or3',
        });
    });

    it('tries the current app proxy even when the invite only lists direct service routes', async () => {
        const directOnly = {
            ...invite(),
            routes: [
                { kind: 'direct' as const, baseUrl: 'http://192.168.1.78:9100', priority: 20 },
            ],
        };
        history.replaceState(null, '', `/pair#invite=${encodePairingInviteV2(directOnly)}`);
        Object.defineProperty(globalThis, 'isSecureContext', { value: true, configurable: true });
        Object.defineProperty(globalThis, 'crypto', {
            value: { subtle: { generateKey: vi.fn() } },
            configurable: true,
        });
        vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({ status: 'ok' }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
        })));
        const PairPage = (await import('../../app/pages/pair.vue')).default;

        mount(PairPage, { global: { stubs } });
        await vi.waitFor(() => expect(pairingMocks.upgradeSecurePairingPayload).toHaveBeenCalled());

        expect(pairingMocks.upgradeInputs.at(0)).toMatchObject({
            baseUrl: 'http://localhost:3000/api/or3',
        });
    });

    it('skips same-origin app proxy when health returns HTML fallback', async () => {
        history.replaceState(null, '', `/pair#invite=${encodePairingInviteV2(invite())}`);
        Object.defineProperty(globalThis, 'isSecureContext', { value: true, configurable: true });
        Object.defineProperty(globalThis, 'crypto', {
            value: { subtle: { generateKey: vi.fn() } },
            configurable: true,
        });
        vi.stubGlobal('fetch', vi.fn(async (url: string | URL | Request) => {
            if (String(url).startsWith('http://localhost:3000/api/or3/')) {
                return new Response('<html>fallback</html>', {
                    status: 200,
                    headers: { 'Content-Type': 'text/html' },
                });
            }
            return new Response(JSON.stringify({ status: 'ok' }), {
                status: 200,
                headers: { 'Content-Type': 'application/json' },
            });
        }));
        const PairPage = (await import('../../app/pages/pair.vue')).default;

        mount(PairPage, { global: { stubs } });
        await vi.waitFor(() => expect(pairingMocks.upgradeSecurePairingPayload).toHaveBeenCalled());

        expect(pairingMocks.upgradeInputs.at(0)).toMatchObject({
            baseUrl: 'http://192.168.1.78:3060/api/or3',
        });
    });
});
