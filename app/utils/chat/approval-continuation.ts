const APPROVAL_CONTINUATION_PREFIX = 'Approval was granted';

export function isSyntheticApprovalContinuationUserMessage(
    content?: string,
    payload?: Record<string, unknown>,
) {
    const meta =
        payload?.meta && typeof payload.meta === 'object'
            ? (payload.meta as Record<string, unknown>)
            : payload;
    if (
        meta?.approved_tool_replay === true ||
        meta?.approved_tool_quota === true
    ) {
        return true;
    }
    const normalized = String(content ?? '').trim();
    if (!normalized.startsWith(APPROVAL_CONTINUATION_PREFIX)) return false;
    return (
        normalized.includes('Continue the same task') ||
        normalized.includes('continue the same task')
    );
}
