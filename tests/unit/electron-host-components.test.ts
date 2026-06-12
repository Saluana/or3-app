import { mount } from '@vue/test-utils';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { nextTick } from 'vue';
import { navigateTo } from '#app';
import ElectronHostStatusCard from '../../app/components/electron/ElectronHostStatusCard.vue';
import ElectronHostSetupWizard from '../../app/components/electron/ElectronHostSetupWizard.vue';
import ConnectDevicePage from '../../app/pages/computer/connect-device.vue';

const mockHost = vi.hoisted(() => ({
    serviceStatus: null as any,
    isElectronHostMode: null as any,
    shouldShowSetup: null as any,
    ready: null as any,
    setupState: null as any,
    ensureLoaded: vi.fn(() => Promise.resolve()),
    chooseMode: vi.fn(() => Promise.resolve()),
    saveEssentials: vi.fn(() => Promise.resolve()),
    saveSecurity: vi.fn(() => Promise.resolve()),
    persistState: vi.fn(() => Promise.resolve()),
    pickWorkspaceDirectory: vi.fn(() => Promise.resolve({ canceled: true })),
    pickDataDirectory: vi.fn(() => Promise.resolve({ canceled: true })),
    pickInternBinary: vi.fn(() => Promise.resolve({ canceled: true })),
    locateIntern: vi.fn(() => Promise.resolve({ found: true, compatible: true })),
    configureAndStart: vi.fn(() => Promise.resolve({ state: 'online' })),
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
    BrandMark: { template: '<span />' },
    UForm: { template: '<form @submit.prevent="$emit(\'submit\')"><slot /></form>' },
    UFormField: { template: '<label><slot /></label>' },
    UInput: { template: '<input />' },
    UCheckbox: { template: '<input type="checkbox" />' },
    USelect: { template: '<select />' },
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
        mockHost.shouldShowSetup.value = false;
        mockHost.ready.value = true;
        mockHost.setupState.value = { currentStep: 'done', mode: 'host', completed: true };
        mockHost.ensureLoaded.mockClear();
        mockHost.chooseMode.mockClear();
        mockHost.saveEssentials.mockClear();
        mockHost.saveSecurity.mockClear();
        mockHost.persistState.mockClear();
        mockHost.pickWorkspaceDirectory.mockClear();
        mockHost.pickDataDirectory.mockClear();
        mockHost.pickInternBinary.mockClear();
        mockHost.locateIntern.mockClear();
        mockHost.configureAndStart.mockClear();
        mockHost.refreshStatus.mockClear();
        mockHost.startService.mockClear();
        mockHost.restartService.mockClear();
        mockHost.createSecureInvite.mockClear();
        vi.mocked(navigateTo).mockClear();
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

    it('renders Add device secure invite for host mode', async () => {
        const wrapper = mount(ConnectDevicePage, { global: { stubs } });
        await Promise.resolve();
        await Promise.resolve();

        expect(wrapper.text()).toContain('Add device');
        expect(wrapper.text()).toContain('Copy invite');
        expect(wrapper.text()).not.toContain('Compatibility options');
        expect(wrapper.text()).not.toContain('Generate one-time code');
        expect(mockHost.createSecureInvite).toHaveBeenCalled();
    });

    it('dismisses setup overlay before navigating to dashboard', async () => {
        mockHost.shouldShowSetup.value = true;
        mockHost.setupState.value = { currentStep: 'starting', mode: 'host', completed: false };
        mockHost.serviceStatus.value = { state: 'not-installed', message: 'Host setup is not configured yet.' };
        const wrapper = mount(ElectronHostSetupWizard, { global: { stubs } });

        expect(wrapper.text()).toContain('Go to dashboard');
        const dashboard = wrapper
            .findAll('button')
            .find((button) => button.text().includes('Go to dashboard'));
        expect(dashboard).toBeTruthy();
        await dashboard!.trigger('click');
        await nextTick();

        expect(navigateTo).toHaveBeenCalledWith('/computer');
        expect(wrapper.find('[data-testid="electron-host-setup"]').exists()).toBe(false);
    });
});
