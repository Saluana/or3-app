import type { ApprovalModeratorMetadata } from '~/types/or3-api';
import {
    moderatorActionBadge,
    moderatorActionLabel,
    type ModeratorAction,
} from '~/utils/or3/moderator-settings';

export function formatModeratorRiskLabel(risk?: string): string {
    const normalized = String(risk ?? '').trim().toLowerCase();
    switch (normalized) {
        case 'low':
            return 'Low risk';
        case 'medium':
            return 'Medium risk';
        case 'high':
            return 'High risk';
        case 'extreme':
            return 'Extreme risk';
        default:
            return normalized ? `${normalized} risk` : '';
    }
}

export function formatModeratorActionLabel(action?: string): string {
    const normalized = String(action ?? '').trim().toLowerCase();
    return moderatorActionLabel(normalized as ModeratorAction);
}

export function formatModeratorStatusLabel(
    metadata: ApprovalModeratorMetadata | undefined,
): string {
    if (!metadata) return '';
    const status = String(metadata.status ?? '').trim().toLowerCase();
    const action = String(metadata.action ?? '').trim().toLowerCase();
    if (status === 'hard_deny' || action === 'deny') {
        return 'Auto-denied';
    }
    if (action === 'approve') {
        return 'Auto-approved';
    }
    if (action === 'escalate' || status === 'failure') {
        return 'Sent to you';
    }
    if (status === 'reviewed') {
        return 'Reviewed';
    }
    return status ? status.replaceAll('_', ' ') : '';
}

export function formatModeratorBadgeTone(
    metadata: ApprovalModeratorMetadata | undefined,
): 'green' | 'amber' | 'danger' | 'neutral' {
    const action = String(metadata?.action ?? '').trim().toLowerCase();
    if (action === 'approve') return 'green';
    if (action === 'deny') return 'danger';
    if (action === 'escalate') return 'amber';
    return 'neutral';
}

export function formatModeratorMatrixBadge(action: ModeratorAction): string {
    return moderatorActionBadge(action);
}

export function parseModeratorAlternative(reason?: string): {
    reason: string;
    alternative?: string;
} {
    const text = String(reason ?? '').trim();
    if (!text) return { reason: '' };
    const marker = '; alternative:';
    const index = text.toLowerCase().indexOf(marker);
    if (index < 0) {
        const tryMarker = '. try:';
        const tryIndex = text.toLowerCase().indexOf(tryMarker);
        if (tryIndex >= 0) {
            return {
                reason: text.slice(0, tryIndex).trim(),
                alternative: text.slice(tryIndex + tryMarker.length).trim(),
            };
        }
        return { reason: text };
    }
    return {
        reason: text.slice(0, index).trim(),
        alternative: text.slice(index + marker.length).trim(),
    };
}

export function formatModeratorCardSummary(
    metadata: ApprovalModeratorMetadata | undefined,
): string {
    if (!metadata) return '';
    const parts: string[] = [];
    const risk = formatModeratorRiskLabel(metadata.risk);
    const status = formatModeratorStatusLabel(metadata);
    if (risk) parts.push(risk);
    if (status) parts.push(status);
    return parts.join(' · ');
}
