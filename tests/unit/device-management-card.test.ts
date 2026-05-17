import { flushPromises, mount } from '@vue/test-utils';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import DeviceManagementCard from '../../app/components/app/DeviceManagementCard.vue';

const mockState = vi.hoisted(() => ({
    activeHost: null as any,
    isPaired: null as any,
    isConnected: null as any,
    listDevices: vi.fn(async () => []),
    revokeDevice: vi.fn(async () => ({
        device_id: 'device-1',
        status: 'revoked',
    })),
}));

vi.mock('../../app/composables/useActiveHost', async () => {
    const { computed, ref } = await import('vue');

    if (!mockState.activeHost) {
        mockState.activeHost = ref({
            id: 'host-1',
            token: 'paired-token',
            status: 'online',
            lastSeenAt: '2026-05-17T00:00:00.000Z',
        });
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
            isPaired: mockState.isPaired,
            isConnected: mockState.isConnected,
        }),
    };
});

vi.mock('../../app/composables/usePairing', () => ({
    usePairing: () => ({
        listDevices: mockState.listDevices,
        revokeDevice: mockState.revokeDevice,
    }),
}));

function mountCard() {
    return mount(DeviceManagementCard, {
        global: {
            stubs: {
                SurfaceCard: { template: '<section><slot /></section>' },
                RetroIcon: { template: '<span />' },
                Icon: { template: '<span />' },
                UButton: {
                    template:
                        '<button type="button" @click="$emit(\'click\')"><slot />{{ label }}</button>',
                    props: ['label'],
                },
                UModal: {
                    template: '<div><slot name="content" /></div>',
                    props: ['modelValue', 'ui'],
                },
                DangerCallout: {
                    template: '<div><slot /></div>',
                    props: ['tone', 'title'],
                },
            },
        },
    });
}

describe('DeviceManagementCard', () => {
    beforeEach(() => {
        mockState.activeHost.value = {
            id: 'host-1',
            token: 'paired-token',
            status: 'online',
            lastSeenAt: '2026-05-17T00:00:00.000Z',
        };
        mockState.listDevices.mockClear();
        mockState.listDevices.mockResolvedValue([]);
        mockState.revokeDevice.mockClear();
    });

    afterEach(() => {
        vi.clearAllMocks();
    });

    it('does not reload devices when only active host metadata changes', async () => {
        const wrapper = mountCard();
        await flushPromises();

        expect(mockState.listDevices).toHaveBeenCalledTimes(1);

        mockState.activeHost.value = {
            ...mockState.activeHost.value,
            lastSeenAt: '2026-05-17T00:00:05.000Z',
        };
        await flushPromises();

        expect(mockState.listDevices).toHaveBeenCalledTimes(1);
        wrapper.unmount();
    });

    it('reloads devices when the active host changes', async () => {
        const wrapper = mountCard();
        await flushPromises();

        expect(mockState.listDevices).toHaveBeenCalledTimes(1);

        mockState.activeHost.value = {
            id: 'host-2',
            token: 'paired-token',
            status: 'online',
            lastSeenAt: '2026-05-17T00:00:10.000Z',
        };
        await flushPromises();

        expect(mockState.listDevices).toHaveBeenCalledTimes(2);
        wrapper.unmount();
    });
});
