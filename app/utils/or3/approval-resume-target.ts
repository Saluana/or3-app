import type { ApprovalActionResponse, ApprovalRequest } from '~/types/or3-api';

export type ApprovalResumeSurface = 'doctor_health' | 'chat';

export interface ApprovalResumeTarget {
    surface: ApprovalResumeSurface;
    path: string;
    sessionKey: string;
}

export function isDoctorSessionKey(sessionKey?: string) {
    return String(sessionKey ?? '')
        .trim()
        .startsWith('doctor-app-');
}

export function resolveApprovalResumeTarget(input: {
    approval?: ApprovalRequest | null;
    response?: Partial<
        Pick<
            ApprovalActionResponse,
            'session_key' | 'request_id' | 'resume_job_id'
        >
    > | null;
}): ApprovalResumeTarget | null {
    const sessionKey = String(
        input.response?.session_key?.trim() ||
            input.approval?.requester_session_id?.trim() ||
            '',
    );
    if (!sessionKey) return null;
    if (isDoctorSessionKey(sessionKey)) {
        return {
            surface: 'doctor_health',
            path: '/settings/health',
            sessionKey,
        };
    }
    return {
        surface: 'chat',
        path: '/',
        sessionKey,
    };
}
