import { describe, expect, it } from 'vitest';

import {
    externalChannelFromSessionKey,
    isDoctorSessionKey,
    isExternalChannelSessionKey,
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

    it('detects external channel session keys', () => {
        expect(externalChannelFromSessionKey('telegram:123')).toBe('telegram');
        expect(isExternalChannelSessionKey('slack:C1:U1')).toBe(true);
        expect(isExternalChannelSessionKey('or3-app:host:session')).toBe(false);
    });

    it('routes external channel approvals away from web chat', () => {
        expect(
            resolveApprovalResumeTarget({
                approval: {
                    id: 4,
                    type: 'exec',
                    requester_session_id: 'telegram:123',
                },
                response: {
                    session_key: 'telegram:123',
                    resume_job_id: 'job-2',
                },
            }),
        ).toEqual({
            surface: 'external_channel',
            path: '/approvals',
            sessionKey: 'telegram:123',
            channel: 'telegram',
        });
    });

    it('uses requester context when the session key is not channel-prefixed', () => {
        expect(
            resolveApprovalResumeTarget({
                approval: {
                    id: 5,
                    type: 'exec',
                    requester_session_id: 'shared-session',
                    requester_context: {
                        channel: 'slack',
                        session_key: 'shared-session',
                    },
                },
            }),
        ).toEqual({
            surface: 'external_channel',
            path: '/approvals',
            sessionKey: 'shared-session',
            channel: 'slack',
        });
    });
});
