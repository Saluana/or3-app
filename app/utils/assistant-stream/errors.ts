import type { Or3AppErrorCode } from '~/types/app-state';
import type { ToolPolicy } from '~/types/or3-api';

const knownErrorCodes = new Set<Or3AppErrorCode>([
    'host_unreachable',
    'auth_required',
    'missing_token',
    'invalid_token',
    'token_replay',
    'auth_rate_limited',
    'session_required',
    'session_expired',
    'passkey_required',
    'step_up_required',
    'auth_unsupported',
    'forbidden',
    'rate_limited',
    'validation_failed',
    'capability_unavailable',
    'approval_required',
    'stream_failed',
    'provider_error',
    'stream_error',
    'empty_final_text',
    'validation_error',
    'policy_error',
    'tool_execution_error',
    'tool_loop_limit',
    'aborted',
    'file_not_found',
    'path_forbidden',
    'terminal_unavailable',
    'runner_missing',
    'runner_auth_missing',
    'unsupported_native_session',
    'runner_chat_turn_active',
    'runner_chat_session_not_found',
    'runner_chat_turn_not_found',
    'runner_chat_aborted',
    'chat_session_not_found',
    'invalid_fork_anchor',
    'fork_anchor_incomplete',
    'unsupported_native_fork',
    'unknown',
]);

export interface ToastLike {
    add(payload: unknown): unknown;
}

export function describeRequestError(error: unknown) {
    if (error instanceof Error && error.message.trim()) return error.message;
    if (error && typeof error === 'object' && 'message' in error) {
        const message = String(
            (error as { message?: unknown }).message ?? '',
        ).trim();
        if (message) return message;
    }
    return 'Request failed';
}

export function describeRequestErrorDetails(error: unknown) {
    if (!error || typeof error !== 'object') return '';
    const record = error as Record<string, unknown>;
    const details = [
        typeof record.code === 'string' ? `Code: ${record.code}` : '',
        typeof record.status === 'number' ? `HTTP: ${record.status}` : '',
        typeof record.request_id === 'string' ||
        typeof record.request_id === 'number'
            ? `Request: ${record.request_id}`
            : '',
    ].filter(Boolean);

    if (record.cause instanceof Error && record.cause.message.trim()) {
        details.push(`Cause: ${record.cause.message}`);
    }

    return details.join(' · ');
}

export function extractErrorCode(error: unknown): Or3AppErrorCode | undefined {
    if (!error || typeof error !== 'object') return undefined;
    const record = error as Record<string, unknown>;
    if (
        typeof record.code === 'string' &&
        knownErrorCodes.has(record.code as Or3AppErrorCode)
    ) {
        return record.code as Or3AppErrorCode;
    }
    if (
        typeof record.public_code === 'string' &&
        knownErrorCodes.has(record.public_code as Or3AppErrorCode)
    ) {
        return record.public_code as Or3AppErrorCode;
    }
    if (record.cause && typeof record.cause === 'object') {
        const nestedCode: Or3AppErrorCode | undefined = extractErrorCode(
            record.cause,
        );
        if (nestedCode) return nestedCode;
    }
    return undefined;
}

export function extractApprovalRequestId(
    error: unknown,
): string | number | undefined {
    if (!error || typeof error !== 'object') return undefined;
    const record = error as Record<string, unknown>;
    const directApprovalId = record.approval_id ?? record.approval_request_id;
    if (
        typeof directApprovalId === 'string' ||
        typeof directApprovalId === 'number'
    ) {
        return directApprovalId;
    }
    const approvalState = String(
        record.code ?? record.status ?? record.approval_status ?? '',
    )
        .trim()
        .toLowerCase();
    const requestId = record.request_id;
    if (
        approvalState === 'approval_required' &&
        (typeof requestId === 'string' || typeof requestId === 'number')
    ) {
        return requestId;
    }
    if (record.cause && typeof record.cause === 'object') {
        return extractApprovalRequestId(record.cause);
    }
    return undefined;
}

export function isServiceCapabilityCeilingError(error: unknown) {
    const message = describeRequestError(error).toLowerCase();
    return (
        message.includes('requested tools exceed service capability ceiling') ||
        message.includes('tool exceeds service capability ceiling')
    );
}

export function downgradeToolPolicyForServiceCapability(
    policy?: ToolPolicy,
): ToolPolicy | undefined {
    if (!policy) return undefined;
    if (policy.mode === 'admin' || policy.mode === 'work') {
        return { mode: 'ask' };
    }
    return policy;
}

export function showFailureToast(
    toast: ToastLike,
    title: string,
    error: unknown,
) {
    const message = describeRequestError(error);
    const details = describeRequestErrorDetails(error);

    toast.add({
        title,
        description: details ? `${message}\n${details}` : message,
        color: 'error',
        icon: 'i-pixelarticons-warning-box',
    });
}
