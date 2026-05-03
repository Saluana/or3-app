export interface ApprovalContinuationOptions {
    isStreaming: boolean;
    approvalBusy: boolean;
    allowWhileApprovalBusy?: boolean;
}

export type ResolvedApprovalState =
    | 'approved'
    | 'denied'
    | 'canceled'
    | 'expired';

export function canContinueApprovedRequest(
    options: ApprovalContinuationOptions,
) {
    if (options.isStreaming) return false;
    if (options.approvalBusy && !options.allowWhileApprovalBusy) {
        return false;
    }
    return true;
}

export function approvalActionErrorMessage(
    error: unknown,
    fallback = 'Could not approve or retry this request.',
) {
    if (error instanceof Error && error.message.trim()) {
        return error.message.trim();
    }
    if (error && typeof error === 'object' && 'message' in error) {
        const message = String(
            (error as { message?: unknown }).message ?? '',
        ).trim();
        if (message) return message;
    }
    return fallback;
}

export function approvalStatusFromError(error: unknown) {
    if (!error || typeof error !== 'object') return '';
    const record = error as Record<string, unknown>;
    const status = record.approval_status ?? record.status;
    return typeof status === 'string' ? status.trim().toLowerCase() : '';
}

export function resolvedApprovalState(
    status?: string,
): ResolvedApprovalState | undefined {
    switch (
        String(status ?? '')
            .trim()
            .toLowerCase()
    ) {
        case 'approved':
            return 'approved';
        case 'denied':
            return 'denied';
        case 'canceled':
        case 'cancelled':
            return 'canceled';
        case 'expired':
            return 'expired';
        default:
            return undefined;
    }
}

export function resolvedApprovalMessage(status?: string) {
    switch (resolvedApprovalState(status)) {
        case 'approved':
            return 'This approval was already granted. The task may have continued in the background.';
        case 'denied':
            return 'This approval was already denied.';
        case 'canceled':
            return 'This approval was already canceled.';
        case 'expired':
            return 'This approval expired before it could be used. Start the request again if it is still needed.';
        default:
            return 'This approval is no longer waiting for action.';
    }
}
