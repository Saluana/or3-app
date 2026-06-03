/** Built-in OR3 agent runner — legacy read-only, not selectable for new work. */
export const LEGACY_INTERN_RUNNER_ID = 'or3-intern';

export const LEGACY_RUNNER_LABEL = 'OR3 Intern (legacy)';

export function isLegacyRunnerId(id?: string | null): boolean {
    return String(id ?? '').trim() === LEGACY_INTERN_RUNNER_ID;
}

export function isSelectableRunnerId(id?: string | null): boolean {
    const trimmed = String(id ?? '').trim();
    return trimmed !== '' && !isLegacyRunnerId(trimmed);
}

export function legacyRunnerDisplayLabel(id?: string | null): string {
    return isLegacyRunnerId(id) ? LEGACY_RUNNER_LABEL : String(id ?? '').trim();
}

export function pickDefaultRunnerId<T extends { id: string }>(
    runners: T[],
    serviceDefault?: string | null,
): string {
    const selectable = runners.filter((r) => isSelectableRunnerId(r.id));
    if (serviceDefault && selectable.some((r) => r.id === serviceDefault)) {
        return serviceDefault;
    }
    const openCode = selectable.find((r) => r.id === 'opencode');
    if (openCode) return openCode.id;
    return selectable[0]?.id ?? '';
}
