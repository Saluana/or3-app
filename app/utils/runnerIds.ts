/**
 * Pick the runner id the chat composer should use by default.
 *
 * Order: the host's `default_runner`, then the first `opencode` entry, then
 * the first selectable entry. The legacy built-in `or3-intern` agent is no
 * longer a selectable runner — chat work is always handed off to a runner
 * (OpenCode, Codex, Claude, Gemini, …) via the runner-first flow.
 */
export function pickDefaultRunnerId<T extends { id: string }>(
    runners: T[],
    serviceDefault?: string | null,
): string {
    const trimmedServiceDefault = String(serviceDefault ?? '').trim();
    if (
        trimmedServiceDefault &&
        runners.some((r) => r.id === trimmedServiceDefault)
    ) {
        return trimmedServiceDefault;
    }
    const openCode = runners.find((r) => r.id === 'opencode');
    if (openCode) return openCode.id;
    return runners[0]?.id ?? '';
}
