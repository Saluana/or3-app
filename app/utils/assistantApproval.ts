export interface ApprovalContinuationOptions {
    isStreaming: boolean;
    approvalBusy: boolean;
    allowWhileApprovalBusy?: boolean;
}

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
