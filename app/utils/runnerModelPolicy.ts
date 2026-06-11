/**
 * Runner model policy for the runner-first chat flow.
 *
 * Runners (OpenCode, Codex, Claude, Gemini, …) own their own model catalogue;
 * the or3-app composer surfaces those runners' `default_model` and tracks the
 * user's override per session. The legacy "intern" agent loop is gone, so
 * there is no longer a special case for it.
 */

/** Whether the composer should adopt a runner's default model on switch. */
export function shouldApplyRunnerDefaultModel(): boolean {
    return true;
}

export function defaultRunnerModelForSelection(
    _runnerId: string,
    runnerDefault?: string | null,
): string {
    return String(runnerDefault ?? '').trim();
}

/** Value stored on session metadata when creating or updating a session. */
export function resolveSessionRunnerModel(options: {
    selected: string;
    runnerDefault?: string | null;
}): string | undefined {
    const selected = String(options.selected ?? '').trim();
    return (
        selected || String(options.runnerDefault ?? '').trim() || undefined
    );
}

/** Model sent on the next user message. */
export function resolveRunnerModelForSend(options: {
    selected: string;
    runnerDefault?: string | null;
    payloadModel?: string | null;
}): string | undefined {
    const payload = String(options.payloadModel ?? '').trim();
    if (payload) return payload;
    const selected = String(options.selected ?? '').trim();
    return (
        selected || String(options.runnerDefault ?? '').trim() || undefined
    );
}
