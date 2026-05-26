import type {
    DoctorFindingCard,
    DoctorSettingsChangePlan,
} from '~/types/or3-api';

function isRecord(value: unknown): value is Record<string, unknown> {
    return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function nonEmptyString(value: unknown) {
    const text = String(value ?? '').trim();
    return text || undefined;
}

function configDiffValue(value: unknown): string | undefined {
    if (value === undefined || value === null) return undefined;
    if (typeof value === 'string') return value;
    if (typeof value === 'boolean' || typeof value === 'number') {
        return String(value);
    }
    try {
        return JSON.stringify(value);
    } catch {
        return String(value);
    }
}

export function parseFindingCard(value: unknown): DoctorFindingCard | null {
    if (!isRecord(value)) return null;
    const id = nonEmptyString(value.id);
    const what = nonEmptyString(value.what_i_found);
    if (!id || !what) return null;
    const card: DoctorFindingCard = {
        id,
        what_i_found: what,
    };
    const risk = nonEmptyString(value.risk_level);
    if (risk) card.risk_level = risk;
    const meaning = nonEmptyString(value.what_this_means);
    if (meaning) card.what_this_means = meaning;
    const fix = nonEmptyString(value.recommended_fix);
    if (fix) card.recommended_fix = fix;
    return card;
}

export function parsePlan(value: unknown): DoctorSettingsChangePlan | null {
    if (!isRecord(value)) return null;
    const title = nonEmptyString(value.title);
    const changes = Array.isArray(value.changes) ? value.changes : undefined;
    if (!title || !changes) return null;
    const plan: DoctorSettingsChangePlan = {
        title,
        changes: changes.filter(isRecord).map((change) => ({
            section: nonEmptyString(change.section) ?? '',
            field: nonEmptyString(change.field) ?? '',
            impact: nonEmptyString(change.impact),
        })),
    };
    const id = nonEmptyString(value.id);
    if (id) plan.id = id;
    const summary = nonEmptyString(value.summary);
    if (summary) plan.summary = summary;
    const risk = nonEmptyString(value.risk_level);
    if (risk) plan.risk_level = risk;
    if (typeof value.requires_approval === 'boolean') {
        plan.requires_approval = value.requires_approval;
    }
    if (typeof value.requires_step_up_auth === 'boolean') {
        plan.requires_step_up_auth = value.requires_step_up_auth;
    }
    if (typeof value.restart_required === 'boolean') {
        plan.restart_required = value.restart_required;
    }
    if (Array.isArray(value.exact_config_diff)) {
        plan.exact_config_diff = value.exact_config_diff.filter(isRecord).map(
            (row) => ({
                path: nonEmptyString(row.path) ?? '',
                old_value: configDiffValue(row.old_value),
                new_value: configDiffValue(row.new_value),
            }),
        );
    }
    if (Array.isArray(value.post_apply_checks)) {
        plan.post_apply_checks = value.post_apply_checks
            .filter(isRecord)
            .map((item) => ({
                id: nonEmptyString(item.id) ?? '',
                description: nonEmptyString(item.description) ?? '',
                ...(typeof item.timeout_seconds === 'number'
                    ? { timeout_seconds: item.timeout_seconds }
                    : {}),
            }))
            .filter((item) => item.id && item.description);
    }
    return plan;
}
