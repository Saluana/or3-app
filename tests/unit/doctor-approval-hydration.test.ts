import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { nextTick } from 'vue';

vi.mock('../../app/composables/useActiveHost', async () => {
    const { ref } = await import('vue');

    const activeHost = ref({
        id: 'test-host',
        name: 'Test Host',
        baseUrl: 'http://127.0.0.1:9100',
        token: 'secret',
    });

    return {
        __activeHost: activeHost,
        useActiveHost: () => ({ activeHost }),
    };
});

vi.mock('../../app/composables/useOr3Api', () => {
    const request = vi.fn();

    return {
        __request: request,
        useOr3Api: () => ({ request }),
    };
});

import { __activeHost } from '../../app/composables/useActiveHost';
import { __request } from '../../app/composables/useOr3Api';

import { useDoctorChatStore } from '../../app/composables/doctor/doctorChatStore';
import {
    ensureDoctorApprovalMessage,
    isDoctorApprovalResolved,
    markDoctorApprovalResolved,
    useDoctorApprovalHydration,
} from '../../app/composables/doctor/useDoctorApprovalHydration';

describe('doctor approval hydration', () => {
    beforeEach(() => {
        __activeHost.value = {
            id: 'test-host',
            name: 'Test Host',
            baseUrl: 'http://127.0.0.1:9100',
            token: 'secret',
        };
        __request.mockReset();
        __request.mockResolvedValue({ items: [] });

        const store = useDoctorChatStore();
        store.sessionKey.value = 'doctor-app-test';
        store.loading.value = false;
        store.messages.value = [];
    });

    afterEach(() => {
        vi.clearAllMocks();
    });

    it('inserts a pending approval placeholder for the active doctor session', () => {
        const store = useDoctorChatStore();
        const message = ensureDoctorApprovalMessage(store, {
            approvalRequestId: 99,
            sessionKey: 'doctor-app-test',
            content: 'Approval is needed before or3-intern can continue.',
        });
        expect(message?.approvalRequestId).toBe(99);
        expect(message?.approvalState).toBe('pending');
        expect(store.messages.value).toHaveLength(1);
    });

    it('skips duplicate placeholders and respects resolved state', () => {
        const store = useDoctorChatStore();
        ensureDoctorApprovalMessage(store, {
            approvalRequestId: 100,
            sessionKey: 'doctor-app-test',
            content: 'first',
        });
        ensureDoctorApprovalMessage(store, {
            approvalRequestId: 100,
            sessionKey: 'doctor-app-test',
            content: 'second',
        });
        expect(store.messages.value).toHaveLength(1);

        markDoctorApprovalResolved(100, 'approved', 'doctor-app-test');
        expect(isDoctorApprovalResolved(100, 'doctor-app-test')).toBe(true);

        const skipped = ensureDoctorApprovalMessage(store, {
            approvalRequestId: 100,
            sessionKey: 'doctor-app-test',
            content: 'third',
        });
        expect(skipped).toBeUndefined();
        expect(store.messages.value).toHaveLength(1);
    });

    it('bounds resolved approval memory', () => {
        for (let index = 0; index < 550; index += 1) {
            markDoctorApprovalResolved(index, 'approved', 'doctor-app-test');
        }

        expect(isDoctorApprovalResolved(0, 'doctor-app-test')).toBe(false);
        expect(isDoctorApprovalResolved(549, 'doctor-app-test')).toBe(true);
    });

    it('does not rehydrate when the active host ref churns without relevant changes', async () => {
        const { installDoctorApprovalHydrationWatcher } =
            useDoctorApprovalHydration({ isClient: true });
        const stop = installDoctorApprovalHydrationWatcher();

        await nextTick();
        await Promise.resolve();
        await Promise.resolve();

        expect(__request).toHaveBeenCalledTimes(1);

        __activeHost.value = {
            ...__activeHost.value,
        };

        await nextTick();
        await Promise.resolve();
        await Promise.resolve();

        expect(__request).toHaveBeenCalledTimes(1);

        stop();
    });
});
