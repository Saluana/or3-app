/**
 * Pick the runner id the chat composer should use by default.
 *
 * Order: the host's `default_runner`, then the first `opencode` entry, then
 * the first selectable entry.
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
