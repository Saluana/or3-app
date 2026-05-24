import { mount } from '@vue/test-utils';
import { afterEach, describe, expect, it, vi } from 'vitest';
import SecurePairingCard from '../../app/components/app/SecurePairingCard.vue';
import { encodePairingInviteV2, type PairingInviteV2 } from '../../app/utils/or3/secure-connections';

const pairingMocks = vi.hoisted(() => {
    const upgradeInputs: unknown[] = [];
    const toastAdds: unknown[] = [];
    const activeHost = { value: null as null | { baseUrl?: string } };
    return {
        activeHost,
        toastAdds,
        upgradeInputs,
        securePairingStatus: { value: 'idle' },
        exchangeSecurePairingPayload: vi.fn(),
        exchangeSecurePairingQR: vi.fn(),
        upgradeLegacyDeviceToSecure: vi.fn(),
        upgradeSecurePairingPayload: vi.fn(async (input: unknown) => {
            upgradeInputs.push(input);
        }),
    };
});

vi.mock('../../app/composables/usePairing', () => ({
    usePairing: () => pairingMocks,
}));

vi.mock('../../app/composables/useActiveHost', () => ({
    useActiveHost: () => ({ activeHost: pairingMocks.activeHost }),
}));

vi.mock('@nuxt/ui/composables', () => ({
    useToast: () => ({ add: vi.fn((input: unknown) => pairingMocks.toastAdds.push(input)) }),
}));

const stubs = {
    SurfaceCard: { template: '<section><slot /></section>' },
    RetroIcon: { template: '<span />' },
    UTextarea: {
        props: ['modelValue'],
        emits: ['update:modelValue'],
        methods: {
            update(event: Event) {
                this.$emit('update:modelValue', (event.target as HTMLTextAreaElement).value);
            },
        },
        template: '<textarea :value="modelValue" @input="update" />',
    },
    UButton: {
        props: ['label'],
        template: '<button type="button" @click="$emit(\'click\')">{{ label }}<slot /></button>',
    },
    UBadge: { template: '<span><slot /></span>' },
};

async function clickUseText(wrapper: ReturnType<typeof mount>) {
    const button = wrapper.findAll('button').find((node) => node.text().includes('Use text'));
    expect(button).toBeTruthy();
    await button?.trigger('click');
}

const validSecret = 'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA';

function healthyJSON() {
    return new Response(JSON.stringify({ status: 'ok' }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
    });
}

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
        capabilities: ['chat'],
        routes: [
            { kind: 'app-proxy', baseUrl: 'http://192.168.1.78:3060/api/or3', priority: 10 },
            { kind: 'direct', baseUrl: 'http://192.168.1.78:9100', priority: 20 },
        ],
        signature: 'sha256:test',
    };
}

describe('SecurePairingCard', () => {
    afterEach(() => {
        vi.clearAllMocks();
        vi.unstubAllGlobals();
        pairingMocks.toastAdds.length = 0;
        pairingMocks.upgradeInputs.length = 0;
        pairingMocks.activeHost.value = null;
        history.replaceState(null, '', '/');
    });

    it('uses the same-host service route for pasted v2 invites opened from localhost', async () => {
        history.replaceState(null, '', '/settings/pair');
        Object.defineProperty(globalThis, 'isSecureContext', { value: true, configurable: true });
        Object.defineProperty(globalThis, 'crypto', {
            value: { subtle: { generateKey: vi.fn() } },
            configurable: true,
        });
        vi.stubGlobal('fetch', vi.fn(async () => healthyJSON()));
        const wrapper = mount(SecurePairingCard, { global: { stubs } });
        const link = `http://192.168.1.78:3060/pair#invite=${encodePairingInviteV2(invite())}`;

        await wrapper.find('textarea').setValue(link);
        await clickUseText(wrapper);
        await vi.waitFor(() => expect(pairingMocks.upgradeSecurePairingPayload).toHaveBeenCalled());

        expect(pairingMocks.upgradeInputs.at(0)).toMatchObject({
            baseUrl: 'http://localhost:9100',
        });
        expect((wrapper.find('textarea').element as HTMLTextAreaElement).value).toBe('');
        expect(wrapper.text()).toContain('Connected securely. This device now has an enrollment certificate.');
    });

    it('uses the same-host service route when the invite only has a direct LAN route', async () => {
        history.replaceState(null, '', '/settings/pair');
        pairingMocks.activeHost.value = { baseUrl: ':9100' };
        Object.defineProperty(globalThis, 'isSecureContext', { value: true, configurable: true });
        Object.defineProperty(globalThis, 'crypto', {
            value: { subtle: { generateKey: vi.fn() } },
            configurable: true,
        });
        vi.stubGlobal('fetch', vi.fn(async () => healthyJSON()));
        const wrapper = mount(SecurePairingCard, { global: { stubs } });
        const parsedInvite = {
            ...invite(),
            routes: [
                { kind: 'direct' as const, baseUrl: 'http://192.168.1.78:9100', priority: 20 },
            ],
        };

        await wrapper.find('textarea').setValue(`or3pair:v2:${encodePairingInviteV2(parsedInvite)}`);
        await clickUseText(wrapper);
        await vi.waitFor(() => expect(pairingMocks.upgradeSecurePairingPayload).toHaveBeenCalled());

        expect(pairingMocks.upgradeInputs.at(0)).toMatchObject({
            baseUrl: 'http://localhost:9100',
        });
    });

    it('falls back to the invite route when the same-host route is unavailable', async () => {
        history.replaceState(null, '', '/settings/pair');
        Object.defineProperty(globalThis, 'isSecureContext', { value: true, configurable: true });
        Object.defineProperty(globalThis, 'crypto', {
            value: { subtle: { generateKey: vi.fn() } },
            configurable: true,
        });
        vi.stubGlobal('fetch', vi.fn(async (url: string | URL | Request) => {
            if (String(url).startsWith('http://localhost:9100/')) {
                return new Response('<html>fallback</html>', {
                    status: 200,
                    headers: { 'Content-Type': 'text/html' },
                });
            }
            return healthyJSON();
        }));
        const wrapper = mount(SecurePairingCard, { global: { stubs } });

        await wrapper.find('textarea').setValue(`or3pair:v2:${encodePairingInviteV2(invite())}`);
        await clickUseText(wrapper);
        await vi.waitFor(() => expect(pairingMocks.upgradeSecurePairingPayload).toHaveBeenCalled());

        expect(pairingMocks.upgradeInputs.at(0)).toMatchObject({
            baseUrl: 'http://192.168.1.78:9100',
        });
    });

    it('does not continue pairing when every candidate route is unhealthy', async () => {
        history.replaceState(null, '', '/settings/pair');
        Object.defineProperty(globalThis, 'isSecureContext', { value: true, configurable: true });
        Object.defineProperty(globalThis, 'crypto', {
            value: { subtle: { generateKey: vi.fn() } },
            configurable: true,
        });
        vi.stubGlobal('fetch', vi.fn(async () => {
            throw new Error('connection refused');
        }));
        const wrapper = mount(SecurePairingCard, { global: { stubs } });

        await wrapper.find('textarea').setValue(`or3pair:v2:${encodePairingInviteV2(invite())}`);
        await clickUseText(wrapper);

        expect(pairingMocks.upgradeSecurePairingPayload).not.toHaveBeenCalled();
        await vi.waitFor(() => {
            expect(pairingMocks.toastAdds).toContainEqual(expect.objectContaining({
                description: 'Could not determine the computer address for this QR code.',
            }));
        });
    });
});
