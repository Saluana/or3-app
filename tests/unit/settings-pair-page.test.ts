import { mount } from '@vue/test-utils';
import { afterEach, describe, expect, it, vi } from 'vitest';
import PairPage from '../../app/pages/settings/pair.vue';

vi.mock('vue-router', () => ({
    useRouter: () => ({ push: vi.fn() }),
}));

describe('settings pair page', () => {
    afterEach(() => {
        vi.clearAllMocks();
    });

    it('shows secure QR pairing before secure device approvals', () => {
        const wrapper = mount(PairPage, {
            global: {
                stubs: {
                    AppShell: {
                        template:
                            '<main><slot /><slot name="sidebar" /></main>',
                    },
                    SettingsSidebar: { template: '<aside />' },
                    AppHeader: { template: '<header />' },
                    Icon: { template: '<span />' },
                    SurfaceCard: { template: '<section><slot /></section>' },
                    UButton: {
                        props: ['label'],
                        template: '<button>{{ label }}<slot /></button>',
                    },
                    SecurePairingCard: {
                        template:
                            '<section data-card="secure-pairing">SecurePairingCard</section>',
                    },
                    SecureDeviceApprovalCard: {
                        template:
                            '<section data-card="secure-devices">SecureDeviceApprovalCard</section>',
                    },
                },
            },
        });

        expect(
            wrapper
                .findAll('[data-card]')
                .map((node) => node.attributes('data-card')),
        ).toEqual([
            'secure-pairing',
            'secure-devices',
        ]);
    });
});
