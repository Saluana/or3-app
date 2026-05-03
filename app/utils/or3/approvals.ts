import type { ApprovalAllowlist, ApprovalRequest } from '~/types/or3-api';

function pick<T = unknown>(
    source: Record<string, unknown> | null | undefined,
    keys: string[],
): T | undefined {
    if (!source) return undefined;
    for (const key of keys) {
        const value = source[key];
        if (value !== undefined && value !== null && value !== '') {
            return value as T;
        }
    }
    return undefined;
}

function parseJsonObject(value: unknown): Record<string, unknown> | undefined {
    if (!value) return undefined;
    if (typeof value === 'object') {
        if (Array.isArray(value)) return undefined;
        return value as Record<string, unknown>;
    }
    if (typeof value !== 'string') return undefined;
    const trimmed = value.trim();
    if (!trimmed) return undefined;
    try {
        const parsed = JSON.parse(trimmed);
        if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
            return parsed as Record<string, unknown>;
        }
    } catch {
        /* ignore */
    }
    return undefined;
}

function msToIsoString(value: unknown): string | undefined {
    if (typeof value === 'number' && Number.isFinite(value) && value > 0) {
        return new Date(value).toISOString();
    }
    if (typeof value === 'string') {
        const trimmed = value.trim();
        if (!trimmed) return undefined;
        const numeric = Number(trimmed);
        if (Number.isFinite(numeric) && numeric > 0) {
            return new Date(numeric).toISOString();
        }
        return trimmed;
    }
    return undefined;
}

export function normalizeApprovalRequest(input: unknown): ApprovalRequest {
    const source = (input ?? {}) as Record<string, unknown>;
    const idValue = pick<number | string>(source, ['id', 'ID']);
    const subjectRaw =
        pick(source, ['subject']) ??
        parseJsonObject(pick(source, ['subject_json', 'SubjectJSON']));
    const result: ApprovalRequest = {
        id:
            typeof idValue === 'number' || typeof idValue === 'string'
                ? idValue
                : '',
        status: String(pick(source, ['status', 'Status']) ?? ''),
        type: pick<string>(source, ['type', 'Type']),
        domain: pick<string>(source, ['domain', 'Domain']),
        subject: subjectRaw,
        created_at:
            pick<string>(source, ['created_at', 'CreatedAt']) ??
            msToIsoString(pick(source, ['requested_at', 'RequestedAt'])),
        expires_at:
            pick<string>(source, ['expires_at']) ??
            msToIsoString(pick(source, ['ExpiresAt', 'expires_at_ms'])),
    };
    return result;
}

export function normalizeApprovalAllowlist(input: unknown): ApprovalAllowlist {
    const source = (input ?? {}) as Record<string, unknown>;
    const idValue = pick<number | string>(source, ['id', 'ID']);
    return {
        id:
            typeof idValue === 'number' || typeof idValue === 'string'
                ? idValue
                : '',
        domain: pick<string>(source, ['domain', 'Domain']),
        scope:
            parseJsonObject(pick(source, ['scope'])) ??
            parseJsonObject(pick(source, ['scope_json', 'ScopeJSON'])),
        matcher:
            parseJsonObject(pick(source, ['matcher'])) ??
            parseJsonObject(pick(source, ['matcher_json', 'MatcherJSON'])),
        created_at:
            pick<string>(source, ['created_at']) ??
            msToIsoString(pick(source, ['CreatedAt'])),
        expires_at:
            pick<string>(source, ['expires_at']) ??
            msToIsoString(pick(source, ['ExpiresAt'])),
        status: pick<string>(source, ['status', 'Status']),
    };
}
