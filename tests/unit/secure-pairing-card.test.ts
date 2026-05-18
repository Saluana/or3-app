import { mount } from '@vue/test-utils';
import { afterEach, describe, expect, it, vi } from 'vitest';
import SecurePairingCard from '../../app/components/app/SecurePairingCard.vue';
import { encodePairingInviteV2, type PairingInviteV2 } from '../../app/utils/or3/secure-connections';

const pairingMocks = vi.hoisted(() => {
    const upgradeInputs: unknown[] = [];
    return {
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
    useActiveHost: () => ({ activeHost: { value: null } }),
}));

vi.mock('@nuxt/ui/composables', () => ({
    useToast: () => ({ add: vi.fn() }),
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
        pairingMocks.upgradeInputs.length = 0;
        history.replaceState(null, '', '/');
    });

    it('uses the current-origin app proxy for pasted v2 invites opened from localhost', async () => {
        history.replaceState(null, '', '/settings/pair');
        Object.defineProperty(globalThis, 'isSecureContext', { value: true, configurable: true });
        Object.defineProperty(globalThis, 'crypto', {
            value: { subtle: { generateKey: vi.fn() } },
            configurable: true,
        });
        const wrapper = mount(SecurePairingCard, { global: { stubs } });
        const link = `http://192.168.1.78:3060/pair#invite=${encodePairingInviteV2(invite())}`;

        await wrapper.find('textarea').setValue(link);
        await wrapper.findAll('button')[1]?.trigger('click');
        await vi.waitFor(() => expect(pairingMocks.upgradeSecurePairingPayload).toHaveBeenCalled());

        expect(pairingMocks.upgradeInputs.at(0)).toMatchObject({
            baseUrl: 'http://localhost:3000/api/or3',
        });
        expect((wrapper.find('textarea').element as HTMLTextAreaElement).value).toBe('');
        expect(wrapper.text()).toContain('Connected. This device can now use this computer.');
    });
});
