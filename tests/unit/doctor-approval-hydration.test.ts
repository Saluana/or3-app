import { beforeEach, describe, expect, it } from 'vitest';

import { useDoctorChatStore } from '../../app/composables/doctor/doctorChatStore';
import {
    ensureDoctorApprovalMessage,
    isDoctorApprovalResolved,
    markDoctorApprovalResolved,
} from '../../app/composables/doctor/useDoctorApprovalHydration';

describe('doctor approval hydration', () => {
    beforeEach(() => {
        const store = useDoctorChatStore();
        store.sessionKey.value = 'doctor-app-test';
        store.messages.value = [];
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
});
