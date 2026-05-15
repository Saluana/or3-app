let activeTraceId = '';

export function setActiveTraceId(traceId?: string | null) {
    activeTraceId = traceId?.trim() || '';
}

export function clearActiveTraceId() {
    activeTraceId = '';
}

export function getActiveTraceId() {
    return activeTraceId || undefined;
}
