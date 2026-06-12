import type { ApprovalActionResponse, ApprovalRequest } from '~/types/or3-api';

export type ApprovalResumeSurface =
    | 'doctor_health'
    | 'chat'
    | 'external_channel';

export interface ApprovalResumeTarget {
    surface: ApprovalResumeSurface;
    path: string;
    sessionKey: string;
    channel?: string;
}

const EXTERNAL_CHANNELS = new Set([
    'telegram',
    'slack',
    'discord',
    'whatsapp',
    'email',
]);

export function isDoctorSessionKey(sessionKey?: string) {
    return String(sessionKey ?? '')
        .trim()
        .startsWith('doctor-app-');
}

export function externalChannelFromSessionKey(sessionKey?: string) {
    const [prefix = ''] = String(sessionKey ?? '')
        .trim()
        .split(':', 1);
    const channel = prefix.toLowerCase();
    return EXTERNAL_CHANNELS.has(channel) ? channel : '';
}

export function isExternalChannelSessionKey(sessionKey?: string) {
    return Boolean(externalChannelFromSessionKey(sessionKey));
}

export function resolveApprovalResumeTarget(input: {
    approval?: ApprovalRequest | null;
    response?: Partial<
        Pick<ApprovalActionResponse, 'session_key' | 'request_id'>
    > | null;
}): ApprovalResumeTarget | null {
    const sessionKey = String(
        input.response?.session_key?.trim() ||
            input.approval?.requester_context?.session_key?.trim() ||
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
    const contextChannel = input.approval?.requester_context?.channel
        ?.trim()
        .toLowerCase();
    const channel = EXTERNAL_CHANNELS.has(contextChannel ?? '')
        ? contextChannel
        : externalChannelFromSessionKey(sessionKey);
    if (channel) {
        return {
            surface: 'external_channel',
            path: '/approvals',
            sessionKey,
            channel,
        };
    }
    return {
        surface: 'chat',
        path: '/',
        sessionKey,
    };
}
