import type {
    ApprovalAllowlist,
    ApprovalModeratorMetadata,
    ApprovalRequest,
} from '~/types/or3-api';
import { parseModeratorAlternative } from '~/utils/or3/moderator-display';

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
    const moderatorRaw =
        normalizeModeratorMetadata(
            parseJsonObject(pick(source, ['moderator', 'Moderator'])),
        ) ?? normalizeModeratorMetadataFromFlat(source);
    const result: ApprovalRequest = {
        id:
            typeof idValue === 'number' || typeof idValue === 'string'
                ? idValue
                : '',
        status: String(pick(source, ['status', 'Status']) ?? ''),
        type: pick<string>(source, ['type', 'Type']),
        domain: pick<string>(source, ['domain', 'Domain']),
        preview: pick<string>(source, ['preview', 'Preview']),
        subject: subjectRaw,
        created_at:
            pick<string>(source, ['created_at', 'CreatedAt']) ??
            msToIsoString(pick(source, ['requested_at', 'RequestedAt'])),
        expires_at:
            pick<string>(source, ['expires_at']) ??
            msToIsoString(pick(source, ['ExpiresAt', 'expires_at_ms'])),
        requester_session_id: pick<string>(source, [
            'requester_session_id',
            'RequesterSessionID',
        ]),
        requester_context:
            parseJsonObject(pick(source, ['requester_context'])) ??
            parseJsonObject(
                pick(source, [
                    'requester_context_json',
                    'RequesterContextJSON',
                ]),
            ),
        moderator: moderatorRaw,
    };
    return result;
}

function normalizeModeratorMetadataFromFlat(
    source: Record<string, unknown>,
): ApprovalModeratorMetadata | undefined {
    const status = pick<string>(source, [
        'moderator_status',
        'ModeratorStatus',
    ]);
    const risk = pick<string>(source, ['moderator_risk', 'ModeratorRisk']);
    const action = pick<string>(source, [
        'moderator_action',
        'ModeratorAction',
    ]);
    const reason = pick<string>(source, [
        'moderator_reason',
        'ModeratorReason',
    ]);
    if (!status && !risk && !action && !reason) {
        return undefined;
    }
    const parsed = parseModeratorAlternative(reason);
    return {
        status,
        risk,
        action,
        reason: parsed.reason,
        alternative: parsed.alternative,
        model: pick<string>(source, ['moderator_model', 'ModeratorModel']),
        policy_hash: pick<string>(source, [
            'moderator_policy_hash',
            'ModeratorPolicyHash',
        ]),
        reviewed_at: pick<number>(source, [
            'moderator_reviewed_at',
            'ModeratorReviewedAt',
        ]),
        latency_ms: pick<number>(source, [
            'moderator_latency_ms',
            'ModeratorLatencyMS',
        ]),
    };
}

function normalizeModeratorMetadata(
    input: Record<string, unknown> | undefined,
): ApprovalModeratorMetadata | undefined {
    if (!input) return undefined;
    const reason = pick<string>(input, ['reason', 'Reason']);
    const parsed = parseModeratorAlternative(reason);
    const metadata: ApprovalModeratorMetadata = {
        status: pick<string>(input, ['status', 'Status']),
        risk: pick<string>(input, ['risk', 'Risk']),
        action: pick<string>(input, ['action', 'Action']),
        reason: parsed.reason,
        alternative:
            pick<string>(input, ['alternative', 'Alternative']) ??
            parsed.alternative,
        model: pick<string>(input, ['model', 'Model']),
        policy_hash: pick<string>(input, ['policy_hash', 'policyHash']),
        reviewed_at: pick<number>(input, ['reviewed_at', 'reviewedAt']),
        latency_ms: pick<number>(input, ['latency_ms', 'latencyMs']),
    };
    if (
        !metadata.status &&
        !metadata.risk &&
        !metadata.action &&
        !metadata.reason
    ) {
        return undefined;
    }
    return metadata;
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
