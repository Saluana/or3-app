import { mount } from '@vue/test-utils';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import ElectronHostStatusCard from '../../app/components/electron/ElectronHostStatusCard.vue';
import ConnectDevicePage from '../../app/pages/computer/connect-device.vue';

const mockHost = vi.hoisted(() => ({
    serviceStatus: null as any,
    isElectronHostMode: null as any,
    shouldShowSetup: null as any,
    ready: null as any,
    setupState: null as any,
    ensureLoaded: vi.fn(() => Promise.resolve()),
    refreshStatus: vi.fn(() => Promise.resolve()),
    startService: vi.fn(() => Promise.resolve()),
    restartService: vi.fn(() => Promise.resolve()),
    createSecureInvite: vi.fn(() =>
        Promise.resolve({
            id: 'qr-1',
            kind: 'secure-qr',
            qrText: 'or3-secure://qr',
            expiresAt: '2026-05-17T12:00:00.000Z',
            serviceBaseUrl: 'http://127.0.0.1:9100',
            instructions: [],
            status: 'created',
        }),
    ),
    createCliInvite: vi.fn(() =>
        Promise.resolve({
            id: 'cli-1',
            kind: 'cli-code',
            requestId: 42,
            code: '123456',
            expiresAt: '2026-05-17T12:00:00.000Z',
            serviceBaseUrl: 'http://127.0.0.1:9100',
            instructions: [],
            status: 'created',
        }),
    ),
}));

vi.mock('../../app/composables/useElectronHostSetup', async () => {
    const { ref } = await import('vue');
    mockHost.serviceStatus ||= ref({
        state: 'online',
        baseUrl: 'http://127.0.0.1:9100',
        deviceCount: 2,
    });
    mockHost.isElectronHostMode ||= ref(true);
    mockHost.shouldShowSetup ||= ref(false);
    mockHost.ready ||= ref(true);
    mockHost.setupState ||= ref({ currentStep: 'done', mode: 'host', completed: true });

    return { useElectronHostSetup: () => mockHost };
});

const stubs = {
    Icon: { template: '<span />' },
    UButton: {
        props: ['label', 'to'],
        template: '<button type="button" @click="$emit(\'click\')">{{ label }}<slot /></button>',
    },
    AppShell: { template: '<main><slot name="sidebar" /><slot /></main>' },
    AppHeader: { template: '<header />' },
    ComputerSidebar: { template: '<aside />' },
    SurfaceCard: { template: '<section><slot /></section>' },
    RetroIcon: { template: '<span />' },
};

describe('Electron host components', () => {
    beforeEach(() => {
        mockHost.serviceStatus.value = {
            state: 'online',
            baseUrl: 'http://127.0.0.1:9100',
            deviceCount: 2,
        };
        mockHost.isElectronHostMode.value = true;
        mockHost.ensureLoaded.mockClear();
        mockHost.refreshStatus.mockClear();
        mockHost.startService.mockClear();
        mockHost.restartService.mockClear();
        mockHost.createSecureInvite.mockClear();
        mockHost.createCliInvite.mockClear();
    });

    it('shows online host status and connect-device action', () => {
        const wrapper = mount(ElectronHostStatusCard, { global: { stubs } });

        expect(wrapper.text()).toContain('This computer');
        expect(wrapper.text()).toContain('Online');
        expect(wrapper.text()).toContain('Connect device');
        expect(wrapper.text()).toContain('http://127.0.0.1:9100');
    });

    it('shows start action for stopped service', async () => {
        mockHost.serviceStatus.value = { state: 'stopped' };
        const wrapper = mount(ElectronHostStatusCard, { global: { stubs } });

        expect(wrapper.text()).toContain('Offline');
        await wrapper.find('button').trigger('click');
        expect(mockHost.startService).toHaveBeenCalled();
    });

    it('gates connect-device page outside Electron host mode', () => {
        mockHost.isElectronHostMode.value = false;
        const wrapper = mount(ConnectDevicePage, { global: { stubs } });

        expect(wrapper.text()).toContain('only for Electron');
        expect(wrapper.text()).toContain('Open pairing');
    });

    it('renders QR primary, CLI fallback, and compatibility section for host mode', async () => {
        const wrapper = mount(ConnectDevicePage, { global: { stubs } });
        await Promise.resolve();
        await Promise.resolve();

        expect(wrapper.text()).toContain('Scan secure QR');
        expect(wrapper.text()).toContain('Use a code instead');
        expect(wrapper.text()).toContain('Compatibility options');
        expect(mockHost.createSecureInvite).toHaveBeenCalled();
    });
});
