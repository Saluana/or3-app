/** Runner id for the built-in intern chat path (per-session chat model override). */
export const INTERN_RUNNER_ID = 'or3-intern';

export function isInternChatModelRunner(runnerId?: string | null): boolean {
    return String(runnerId ?? '').trim() === INTERN_RUNNER_ID;
}

/** Whether switching runners should reset the composer model from runner defaults. */
export function shouldApplyRunnerDefaultModel(runnerId?: string | null): boolean {
    return !isInternChatModelRunner(runnerId);
}

export function defaultRunnerModelForSelection(
    runnerId: string,
    runnerDefault?: string | null,
): string {
    if (isInternChatModelRunner(runnerId)) return '';
    return String(runnerDefault ?? '').trim();
}

/** Value stored on session metadata when creating or updating a session. */
export function resolveSessionRunnerModel(options: {
    runnerId: string;
    selected: string;
    runnerDefault?: string | null;
}): string | undefined {
    const selected = String(options.selected ?? '').trim();
    if (isInternChatModelRunner(options.runnerId)) {
        return selected || undefined;
    }
    return selected || String(options.runnerDefault ?? '').trim() || undefined;
}

/** Model sent on the next user message. */
export function resolveRunnerModelForSend(options: {
    runnerId: string;
    selected: string;
    runnerDefault?: string | null;
    payloadModel?: string | null;
}): string | undefined {
    const payload = String(options.payloadModel ?? '').trim();
    if (payload) return payload;
    const selected = String(options.selected ?? '').trim();
    if (isInternChatModelRunner(options.runnerId)) {
        return selected || undefined;
    }
    return selected || String(options.runnerDefault ?? '').trim() || undefined;
}

/** `model` field for intern service turn requests (empty means provider default). */
export function internTurnModelRequestField(options: {
    runnerId: string;
    payloadModel?: string | null;
    sessionModel?: string | null;
}): { model?: string } {
    if (!isInternChatModelRunner(options.runnerId)) return {};
    const model = String(
        options.payloadModel || options.sessionModel || '',
    ).trim();
    if (!model) return {};
    return { model };
}
