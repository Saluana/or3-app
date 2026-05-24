import { describe, expect, it } from 'vitest';

import {
    isDoctorSessionKey,
    resolveApprovalResumeTarget,
} from '../../app/utils/or3/approval-resume-target';

describe('approval-resume-target', () => {
    it('detects doctor session keys', () => {
        expect(isDoctorSessionKey('doctor-app-abc')).toBe(true);
        expect(isDoctorSessionKey('or3-app:host:session')).toBe(false);
    });

    it('routes doctor sessions and tool quota approvals to health chat', () => {
        expect(
            resolveApprovalResumeTarget({
                approval: {
                    id: 1,
                    type: 'tool_quota',
                    requester_session_id: 'doctor-app-123',
                },
            }),
        ).toEqual({
            surface: 'doctor_health',
            path: '/settings/health',
            sessionKey: 'doctor-app-123',
        });
    });

    it('keeps tool quota approvals on normal chat sessions in main chat', () => {
        expect(
            resolveApprovalResumeTarget({
                approval: {
                    id: 3,
                    type: 'tool_quota',
                    requester_session_id: 'or3-app:host:session_2',
                },
            }),
        ).toEqual({
            surface: 'chat',
            path: '/',
            sessionKey: 'or3-app:host:session_2',
        });
    });

    it('routes normal chat approvals to the main chat page', () => {
        expect(
            resolveApprovalResumeTarget({
                approval: {
                    id: 2,
                    type: 'exec',
                    requester_session_id: 'or3-app:host:session_1',
                },
                response: {
                    session_key: 'or3-app:host:session_1',
                    resume_job_id: 'job-1',
                },
            }),
        ).toEqual({
            surface: 'chat',
            path: '/',
            sessionKey: 'or3-app:host:session_1',
        });
    });
});
