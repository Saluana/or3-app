import type { AppBootstrapWarning, ReadinessResponse } from '~/types/or3-api';

export type ComputerCalloutKind = 'readiness' | 'bootstrap' | 'connecting';

const STORAGE_PREFIX = 'or3-computer-callout-dismiss';

function storageKey(hostId: string, kind: ComputerCalloutKind) {
    return `${STORAGE_PREFIX}:${hostId}:${kind}`;
}

export function readinessCalloutFingerprint(
    readiness: ReadinessResponse | null | undefined,
    connectionNote = '',
): string {
    if (!readiness || readiness.ready) return '';

    const summary = readiness.summary;
    const findings = readiness.findings ?? [];

    return [
        'readiness',
        String(summary?.blockCount ?? 0),
        String(summary?.errorCount ?? 0),
        String(summary?.warnCount ?? 0),
        String(summary?.infoCount ?? 0),
        ...findings
            .map((finding) =>
                [
                    finding.id,
                    finding.area,
                    finding.severity,
                    finding.summary,
                    finding.detail,
                    finding.fixHint,
                ]
                    .filter(Boolean)
                    .join(':'),
            )
            .sort(),
        connectionNote.trim(),
    ].join('|');
}

export function bootstrapCalloutFingerprint(
    warning: AppBootstrapWarning | null | undefined,
): string {
    if (!warning) return '';
    return [
        'bootstrap',
        warning.code ?? '',
        warning.severity ?? '',
        warning.message ?? '',
    ].join('|');
}

export function connectingCalloutFingerprint() {
    return 'connecting-help';
}

export function readDismissedCalloutFingerprint(
    hostId: string,
    kind: ComputerCalloutKind,
): string | null {
    if (!import.meta.client) return null;
    try {
        return localStorage.getItem(storageKey(hostId, kind));
    } catch {
        return null;
    }
}

export function writeDismissedCalloutFingerprint(
    hostId: string,
    kind: ComputerCalloutKind,
    fingerprint: string,
) {
    if (!import.meta.client || !fingerprint) return;
    try {
        localStorage.setItem(storageKey(hostId, kind), fingerprint);
    } catch {
        /* ignore */
    }
}

export function isComputerCalloutDismissed(
    hostId: string,
    kind: ComputerCalloutKind,
    fingerprint: string,
    dismissedFingerprint: string | null | undefined,
): boolean {
    if (!fingerprint) return false;
    const stored =
        dismissedFingerprint ?? readDismissedCalloutFingerprint(hostId, kind);
    return stored === fingerprint;
}
