import { mount } from '@vue/test-utils';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import HostConnectionCard from '../../app/components/app/HostConnectionCard.vue';

const mockState = vi.hoisted(() => ({
    pendingPairing: null as any,
    pairingError: null as any,
    pairingFailureDetails: null as any,
    activeHost: null as any,
    isConnected: null as any,
    isPaired: null as any,
    startPairing: vi.fn(),
    exchangeExistingPairing: vi.fn(),
    exchangeCode: vi.fn(),
    verifyActiveHost: vi.fn(),
    disconnectActiveHost: vi.fn(() => false),
    toastAdd: vi.fn(),
}));

vi.mock('../../app/composables/usePairing', async () => {
    const { ref } = await import('vue');

    if (!mockState.pendingPairing) {
        mockState.pendingPairing = ref(null);
        mockState.pairingError = ref<string | null>(null);
        mockState.pairingFailureDetails = ref(null);
    }

    return {
        PairingRequestError: class PairingRequestError extends Error {},
        usePairing: () => ({
            pendingPairing: mockState.pendingPairing,
            pairingError: mockState.pairingError,
            pairingFailureDetails: mockState.pairingFailureDetails,
            startPairing: mockState.startPairing,
            exchangeExistingPairing: mockState.exchangeExistingPairing,
            exchangeCode: mockState.exchangeCode,
            verifyActiveHost: mockState.verifyActiveHost,
        }),
    };
});

vi.mock('../../app/composables/useActiveHost', async () => {
    const { computed, ref } = await import('vue');

    if (!mockState.activeHost) {
        mockState.activeHost = ref(null);
        mockState.isPaired = computed(() =>
            Boolean(mockState.activeHost.value?.token),
        );
        mockState.isConnected = computed(
            () =>
                mockState.isPaired.value &&
                mockState.activeHost.value?.status === 'online',
        );
    }

    return {
        useActiveHost: () => ({
            activeHost: mockState.activeHost,
            isConnected: mockState.isConnected,
            isPaired: mockState.isPaired,
            disconnectActiveHost: mockState.disconnectActiveHost,
        }),
    };
});

vi.mock('@nuxt/ui/composables', () => ({
    useToast: () => ({ add: mockState.toastAdd }),
}));

function mountCard() {
    return mount(HostConnectionCard, {
        global: {
            stubs: {
                SurfaceCard: { template: '<section><slot /></section>' },
                RetroIcon: { template: '<span />' },
                Icon: { template: '<span />' },
                DangerCallout: {
                    props: ['title', 'tone'],
                    template:
                        '<div><p>{{ title }}</p><slot /><slot name="actions" /></div>',
                },
                UForm: {
                    template:
                        '<form @submit.prevent="$emit(\'submit\', $event)"><slot /></form>',
                },
                UFormField: {
                    props: ['label', 'name', 'description'],
                    template:
                        '<label><span>{{ label }}</span><span>{{ description }}</span><slot /></label>',
                },
                UInput: {
                    props: ['modelValue'],
                    emits: ['update:modelValue'],
                    template:
                        '<input :value="modelValue" @input="$emit(\'update:modelValue\', $event.target.value)" />',
                },
                UButton: {
                    props: ['label'],
                    template:
                        '<button type="button">{{ label }}<slot /></button>',
                },
            },
        },
    });
}

describe('HostConnectionCard', () => {
    beforeEach(() => {
        mockState.pendingPairing.value = null;
        mockState.pairingError.value = null;
        mockState.pairingFailureDetails.value = null;
        mockState.activeHost.value = null;
        mockState.startPairing.mockReset();
        mockState.exchangeExistingPairing.mockReset();
        mockState.exchangeCode.mockReset();
        mockState.verifyActiveHost.mockReset();
        mockState.disconnectActiveHost.mockReset();
        mockState.disconnectActiveHost.mockReturnValue(false);
        mockState.toastAdd.mockReset();
    });

    afterEach(() => {
        vi.clearAllMocks();
    });

    it('shows the CLI code section before the legacy fallback', () => {
        const wrapper = mountCard();
        const text = wrapper.text();

        expect(text.indexOf('Connect with a CLI code')).toBeGreaterThanOrEqual(
            0,
        );
        expect(
            text.indexOf('Legacy compatibility fallback'),
        ).toBeGreaterThanOrEqual(0);
        expect(text.indexOf('Connect with a CLI code')).toBeLessThan(
            text.indexOf('Legacy compatibility fallback'),
        );
        expect(text.indexOf('Get legacy pairing code')).toBeGreaterThan(
            text.indexOf('Legacy compatibility fallback'),
        );
    });
});
