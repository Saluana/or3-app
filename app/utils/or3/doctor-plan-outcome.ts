import type {
    DoctorRedactedValue,
    DoctorSettingsChangePlan,
} from '~/types/or3-api';

export const DOCTOR_PLAN_OUTCOME_STRIP_MS = 30_000;

function planChangeValueLabel(value: DoctorRedactedValue | undefined) {
    if (!value) return '';
    if (value.summary?.trim()) return value.summary.trim();
    if (value.redacted) return value.present ? 'configured' : '';
    if (value.value === null || value.value === undefined || value.value === '') {
        return '';
    }
    if (typeof value.value === 'boolean') return value.value ? 'On' : 'Off';
    if (typeof value.value === 'object') return JSON.stringify(value.value);
    return String(value.value).trim();
}

/** Short past-tense line for the post-apply outcome strip. */
export function formatDoctorPlanOutcomeMessage(
    plan: Pick<DoctorSettingsChangePlan, 'title' | 'changes'>,
): string {
    const title = plan.title?.trim();
    if (title) {
        const changeDefaultModel = title.match(
            /^change\s+(?:the\s+)?default\s+model\s+to\s+(.+)$/i,
        );
        if (changeDefaultModel) {
            return `Model updated to ${changeDefaultModel[1]!.trim()}`;
        }

        const changeModel = title.match(/^change\s+(?:the\s+)?model\s+to\s+(.+)$/i);
        if (changeModel) {
            return `Model updated to ${changeModel[1]!.trim()}`;
        }

        const changeTo = title.match(/^change\s+(.+?)\s+to\s+(.+)$/i);
        if (changeTo) {
            const subject = changeTo[1]!.trim();
            const value = changeTo[2]!.trim();
            if (/model/i.test(subject)) {
                return `Model updated to ${value}`;
            }
            return `${subject} updated to ${value}`;
        }

        if (/^update(d)?\s+/i.test(title)) {
            return title.replace(/^update(d)?\s+/i, 'Updated ');
        }
    }

    const primary =
        plan.changes?.find((change) => planChangeValueLabel(change.new_value)) ??
        plan.changes?.[0];
    if (primary) {
        const label =
            primary.config_path?.trim() ||
            [primary.section, primary.field].filter(Boolean).join('.');
        const newValue = planChangeValueLabel(primary.new_value);
        if (label && newValue) {
            if (/model/i.test(label)) {
                return `Model updated to ${newValue}`;
            }
            return `${label} updated to ${newValue}`;
        }
    }

    return 'Settings updated successfully';
}
