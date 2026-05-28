export function isApprovalRequiredError(error: unknown) {
    const err = error as {
        status?: number;
        requires_approval?: boolean;
        message?: string;
    };
    if (err?.status !== 409) return false;
    if (err?.requires_approval === true) return true;
    return String(err?.message ?? '')
        .toLowerCase()
        .includes('requires approval');
}

export function approvalIdFromError(error: unknown) {
    const err = error as {
        request_id?: number | string;
        approval_id?: number | string;
        cause?: { request_id?: number | string; approval_id?: number | string };
    };
    const id =
        err?.request_id ??
        err?.approval_id ??
        err?.cause?.request_id ??
        err?.cause?.approval_id;
    if (typeof id === 'number') return id;
    if (typeof id !== 'string' || !id.trim()) return null;
    const numericId = Number(id);
    return Number.isFinite(numericId) ? numericId : null;
}
