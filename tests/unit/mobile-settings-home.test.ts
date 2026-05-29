import { mount } from '@vue/test-utils';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import MobileSettingsHome from '../../app/components/settings/MobileSettingsHome.vue';

const mockState = vi.hoisted(() => ({
    isPaired: null as any,
    isConnected: null as any,
    activeHost: null as any,
    isElectronHostMode: null as any,
    capabilities: null as any,
    passkeys: null as any,
}));

vi.mock('../../app/composables/useActiveHost', async () => {
    const { ref } = await import('vue');
    if (!mockState.isPaired) {
        mockState.isPaired = ref(true);
        mockState.isConnected = ref(true);
        mockState.activeHost = ref({ id: 'host-1', name: 'Mac Studio' });
    }
    return {
        useActiveHost: () => ({
            activeHost: mockState.activeHost,
            isPaired: mockState.isPaired,
            isConnected: mockState.isConnected,
        }),
    };
});

vi.mock('../../app/composables/useAuthSession', async () => {
    const { computed, ref } = await import('vue');
    if (!mockState.capabilities) {
        mockState.capabilities = ref({
            passkeysEnabled: true,
            passkeyMode: 'enforce-sensitive',
        });
    }
    return {
        useAuthSession: () => ({
            capabilities: computed(() => mockState.capabilities.value),
            loadCapabilities: vi.fn(async () => mockState.capabilities.value),
        }),
    };
});

vi.mock('../../app/composables/usePasskeys', async () => {
    const { computed, ref } = await import('vue');
    if (!mockState.passkeys) {
        mockState.passkeys = ref([] as Array<{ id: string; revoked_at?: number | null }>);
    }
    return {
        usePasskeys: () => ({
            passkeys: computed(() => mockState.passkeys.value),
            listPasskeys: vi.fn(async () => mockState.passkeys.value),
        }),
    };
});

vi.mock('../../app/composables/useElectronHostSetup', async () => {
    const { ref } = await import('vue');
    if (!mockState.isElectronHostMode) {
        mockState.isElectronHostMode = ref(false);
    }
    return {
        useElectronHostSetup: () => ({
            isElectronHostMode: mockState.isElectronHostMode,
            ensureLoaded: vi.fn(async () => undefined),
        }),
    };
});

function mountHome() {
    return mount(MobileSettingsHome, {
        global: {
            stubs: {
                NuxtLink: {
                    template: '<a :href="to"><slot /></a>',
                    props: ['to'],
                },
                SurfaceCard: { template: '<section><slot /></section>' },
                SettingsActionCard: {
                    template:
                        '<a class="action-card" :href="to">{{ title }} — {{ description }}</a>',
                    props: ['title', 'description', 'icon', 'to', 'disabled', 'badge'],
                },
                PinLockSettings: { template: '<div>PIN lock</div>' },
                StatusPill: { template: '<span>{{ label }}</span>', props: ['label', 'tone'] },
                Icon: { template: '<span />' },
                UButton: {
                    template: '<a :href="to">{{ label }}</a>',
                    props: ['label', 'to', 'color', 'size', 'block'],
                },
            },
        },
    });
}

describe('MobileSettingsHome', () => {
    beforeEach(() => {
        mockState.isPaired.value = true;
        mockState.isConnected.value = true;
        mockState.activeHost.value = { id: 'host-1', name: 'Mac Studio' };
        mockState.passkeys.value = [];
        mockState.capabilities.value = {
            passkeysEnabled: true,
            passkeyMode: 'enforce-sensitive',
        };
    });

    it('renders connected Doctor hero and essential actions', () => {
        const wrapper = mountHome();
        expect(wrapper.text()).toContain('Ask Doctor to change settings.');
        expect(wrapper.text()).toContain('Devices & pairing');
        expect(wrapper.text()).toContain('Add-ons (MCP)');
        expect(wrapper.text()).toContain('Skills');
        expect(wrapper.text()).toContain('Advanced Settings');
    });

    it('shows unpaired guidance when no computer is saved', () => {
        mockState.isPaired.value = false;
        mockState.isConnected.value = false;
        const wrapper = mountHome();
        expect(wrapper.text()).toContain('Pair a computer first.');
        expect(wrapper.text()).toContain('Pair computer');
    });

    it('shows disconnected guidance when pairing exists but host is offline', () => {
        mockState.isPaired.value = true;
        mockState.isConnected.value = false;
        const wrapper = mountHome();
        expect(wrapper.text()).toContain('Reconnect to use Doctor.');
        expect(wrapper.text()).toContain('Open pairing');
    });

    it('marks passkeys as recommended when none are registered', () => {
        const wrapper = mountHome();
        expect(wrapper.text()).toContain('Add a passkey so sensitive changes');
    });

    it('marks passkeys as ready when at least one active passkey exists', () => {
        mockState.passkeys.value = [{ id: 'pk-1' }];
        const wrapper = mountHome();
        expect(wrapper.text()).toContain('Passkey set up');
    });
});
