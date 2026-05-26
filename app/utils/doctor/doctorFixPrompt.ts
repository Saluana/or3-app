import type { DoctorFindingCard } from '~/types/or3-api';

export function doctorFindingPayload(card: DoctorFindingCard) {
    const payload: Record<string, unknown> = {
        id: card.id,
        what_i_found: card.what_i_found,
    };
    if (card.what_this_means) payload.what_this_means = card.what_this_means;
    if (card.recommended_fix) payload.recommended_fix = card.recommended_fix;
    if (card.risk_level) payload.risk_level = card.risk_level;
    if (card.approval_needed !== undefined) {
        payload.approval_needed = card.approval_needed;
    }
    if (card.restart_needed !== undefined) {
        payload.restart_needed = card.restart_needed;
    }
    if (card.advanced_details !== undefined) {
        payload.advanced_details = card.advanced_details;
    }
    return payload;
}

export function buildDoctorInvestigationPrompt(card: DoctorFindingCard) {
    const json = JSON.stringify(doctorFindingPayload(card), null, 2);
    return [
        'Please investigate this doctor warning and create a plan to fix it.',
        '',
        '```json',
        json,
        '```',
    ].join('\n');
}
