import type { SimpleSettingChange } from '~/settings/simpleSettings';
import type { ConfigureChange, ConfigureField } from '~/types/or3-api';

export type ModeratorBackendPreset =
    | 'balanced'
    | 'cautious'
    | 'hands_off'
    | 'manual'
    | string;

export type ModeratorRiskLevel = 'low' | 'medium' | 'high' | 'extreme';

export type ModeratorAction = 'approve' | 'escalate' | 'deny' | '';

export interface ModeratorActionMap {
    low: ModeratorAction;
    medium: ModeratorAction;
    high: ModeratorAction;
    extreme: ModeratorAction;
}

export interface ModeratorUiPreset {
    id: ModeratorBackendPreset;
    label: string;
    description: string;
    recommended?: boolean;
    actions: ModeratorActionMap;
}

export const APPROVALS_FIELD_KEYS = {
    enabled: 'security_approvals_enabled',
} as const;

export const MODERATOR_FIELD_KEYS = {
    enabled: 'security_approval_moderator_enabled',
    preset: 'security_approval_moderator_preset',
    provider: 'security_approval_moderator_provider',
    model: 'security_approval_moderator_model',
    timeout: 'security_approval_moderator_timeout',
    failureAction: 'security_approval_moderator_failure_action',
    userPolicy: 'security_approval_moderator_user_policy',
    actionLow: 'security_approval_moderator_action_low',
    actionMedium: 'security_approval_moderator_action_medium',
    actionHigh: 'security_approval_moderator_action_high',
    actionExtreme: 'security_approval_moderator_action_extreme',
} as const;

export const MODERATOR_STARTER_POLICY = `# My approval rules

- Never use grep. Use rg instead.
- Ask me before downloading large uncached content.
- Ask me before installing or upgrading packages.
- Block anything that might expose secrets or credentials.
`;

export const MODERATOR_POLICY_EXAMPLES = [
    'Never use grep. Use rg instead.',
    'Ask me before downloading large uncached content.',
    'Ask me before installing or upgrading packages.',
    'Block anything that might expose secrets or credentials.',
];

export const MODERATOR_UI_PRESETS: ModeratorUiPreset[] = [
    {
        id: 'manual',
        label: 'Ask me every time',
        description: 'OR3 sends every approval to you. Best when you want full control.',
        actions: {
            low: 'escalate',
            medium: 'escalate',
            high: 'escalate',
            extreme: 'escalate',
        },
    },
    {
        id: 'cautious',
        label: 'Careful helper',
        description:
            'OR3 handles small routine work, asks before bigger changes, and blocks extreme risk.',
        actions: {
            low: 'approve',
            medium: 'escalate',
            high: 'escalate',
            extreme: 'deny',
        },
    },
    {
        id: 'balanced',
        label: 'Balanced',
        description:
            'OR3 handles normal day-to-day work, asks before high-risk actions, and blocks extreme risk.',
        recommended: true,
        actions: {
            low: 'approve',
            medium: 'approve',
            high: 'escalate',
            extreme: 'deny',
        },
    },
    {
        id: 'hands_off',
        label: 'Hands-off',
        description:
            'OR3 handles most routine work on its own. Extreme actions still do not run automatically.',
        actions: {
            low: 'approve',
            medium: 'approve',
            high: 'approve',
            extreme: 'escalate',
        },
    },
];

export const MODERATOR_RISK_ROWS: Array<{
    level: ModeratorRiskLevel;
    label: string;
    examples: string;
}> = [
    {
        level: 'low',
        label: 'Low',
        examples: 'Tests, small reads, routine checks',
    },
    {
        level: 'medium',
        label: 'Medium',
        examples: 'Normal file edits, bounded workspace work',
    },
    {
        level: 'high',
        label: 'High',
        examples: 'Package installs, network-heavy pulls, secret access',
    },
    {
        level: 'extreme',
        label: 'Extreme',
        examples: 'Destructive commands, security changes, broad weakening',
    },
];

export function hasModeratorConfigureFields(
    fields: readonly ConfigureField[] | undefined,
): boolean {
    if (!fields?.length) return false;
    return fields.some(
        (field) =>
            field.key === MODERATOR_FIELD_KEYS.enabled ||
            field.key === MODERATOR_FIELD_KEYS.preset,
    );
}

export function readConfigureBoolean(
    fields: readonly ConfigureField[],
    key: string,
    fallback = false,
): boolean {
    const raw = fields.find((field) => field.key === key)?.value;
    if (typeof raw === 'boolean') return raw;
    if (typeof raw === 'number') return raw !== 0;
    if (typeof raw === 'string') {
        const normalized = raw.trim().toLowerCase();
        return ['true', '1', 'on', 'yes'].includes(normalized);
    }
    return fallback;
}

export function readConfigureString(
    fields: readonly ConfigureField[],
    key: string,
    fallback = '',
): string {
    const raw = fields.find((field) => field.key === key)?.value;
    if (raw === undefined || raw === null) return fallback;
    return String(raw).trim();
}

export function readConfigureNumber(
    fields: readonly ConfigureField[],
    key: string,
    fallback: number,
): number {
    const raw = fields.find((field) => field.key === key)?.value;
    const next = Number(raw);
    return Number.isFinite(next) && next > 0 ? next : fallback;
}

export function normalizeModeratorAction(value: unknown): ModeratorAction {
    const normalized = String(value ?? '').trim().toLowerCase();
    if (
        normalized === 'approve' ||
        normalized === 'escalate' ||
        normalized === 'deny'
    ) {
        return normalized;
    }
    return '';
}

export function readModeratorActions(
    fields: readonly ConfigureField[],
): ModeratorActionMap {
    return {
        low: normalizeModeratorAction(
            fields.find((field) => field.key === MODERATOR_FIELD_KEYS.actionLow)
                ?.value,
        ),
        medium: normalizeModeratorAction(
            fields.find(
                (field) => field.key === MODERATOR_FIELD_KEYS.actionMedium,
            )?.value,
        ),
        high: normalizeModeratorAction(
            fields.find((field) => field.key === MODERATOR_FIELD_KEYS.actionHigh)
                ?.value,
        ),
        extreme: normalizeModeratorAction(
            fields.find(
                (field) => field.key === MODERATOR_FIELD_KEYS.actionExtreme,
            )?.value,
        ),
    };
}

export function actionsExplicitlySet(actions: ModeratorActionMap): boolean {
    return Boolean(
        actions.low || actions.medium || actions.high || actions.extreme,
    );
}

export function presetById(id: string): ModeratorUiPreset | undefined {
    return MODERATOR_UI_PRESETS.find((preset) => preset.id === id);
}

export function actionsMatchPreset(
    actions: ModeratorActionMap,
    preset: ModeratorUiPreset,
): boolean {
    return (
        actions.low === preset.actions.low &&
        actions.medium === preset.actions.medium &&
        actions.high === preset.actions.high &&
        actions.extreme === preset.actions.extreme
    );
}

export function detectUiPreset(input: {
    preset: string;
    actions: ModeratorActionMap;
}): ModeratorBackendPreset | 'custom' {
    const normalizedPreset = String(input.preset || '').trim().toLowerCase();
    if (!actionsExplicitlySet(input.actions)) {
        const fromPreset = presetById(normalizedPreset);
        if (fromPreset) return fromPreset.id;
        return 'custom';
    }
    for (const candidate of MODERATOR_UI_PRESETS) {
        if (actionsMatchPreset(input.actions, candidate)) {
            return candidate.id;
        }
    }
    return 'custom';
}

export function effectiveActions(input: {
    preset: string;
    actions: ModeratorActionMap;
}): ModeratorActionMap {
    const uiPreset = presetById(String(input.preset || '').trim().toLowerCase());
    if (!actionsExplicitlySet(input.actions) && uiPreset) {
        return { ...uiPreset.actions };
    }
    const fallback =
        presetById(String(input.preset || '').trim().toLowerCase()) ??
        presetById('balanced')!;
    return {
        low: input.actions.low || fallback.actions.low,
        medium: input.actions.medium || fallback.actions.medium,
        high: input.actions.high || fallback.actions.high,
        extreme: input.actions.extreme || fallback.actions.extreme,
    };
}

export function moderatorActionLabel(action: ModeratorAction): string {
    switch (action) {
        case 'approve':
            return 'OR3 handles this';
        case 'escalate':
            return 'OR3 asks you first';
        case 'deny':
            return 'OR3 blocks this';
        default:
            return 'Uses preset default';
    }
}

export function moderatorActionBadge(action: ModeratorAction): string {
    switch (action) {
        case 'approve':
            return 'Handles';
        case 'escalate':
            return 'Asks';
        case 'deny':
            return 'Blocks';
        default:
            return 'Preset';
    }
}

export function moderatorPresetSummary(presetId: string): string {
    const preset = presetById(presetId);
    if (!preset) return 'Custom approval autopilot settings.';
    const actions = preset.actions;
    return `${preset.label}: ${summarizeActionMap(actions)}`;
}

export function summarizeActionMap(actions: ModeratorActionMap): string {
    const parts = MODERATOR_RISK_ROWS.map((row) => {
        const action = actions[row.level];
        const verb =
            action === 'approve'
                ? 'handles'
                : action === 'deny'
                  ? 'blocks'
                  : 'asks for';
        return `${verb} ${row.label.toLowerCase()} risk`;
    });
    return parts.join(', ');
}

export function statusHeadline(enabled: boolean, presetId: string): string {
    if (!enabled) {
        return 'Approval autopilot is off. OR3 will use your normal approval modes without an automatic reviewer.';
    }
    const preset = presetById(presetId);
    if (!preset || presetId === 'custom') {
        return 'OR3 can review approval requests automatically using your custom risk rules.';
    }
    if (preset.id === 'manual') {
        return 'OR3 still reviews requests, but it will ask you before most actions proceed.';
    }
    return 'OR3 can handle normal approval requests automatically. You still stay in charge of dangerous actions.';
}

export function handsOffConfirmationCopy(): string {
    return 'Hands-off lets OR3 approve more routine work on its own. Extreme-risk actions still will not run automatically—they are blocked or escalated to you.';
}

export interface ModeratorDraftState {
    enabled: boolean;
    preset: string;
    provider: string;
    model: string;
    timeoutSeconds: number;
    failureAction: string;
    userPolicy: string;
    actions: ModeratorActionMap;
}

/** Plain snapshot for saved draft state (safe with Vue deep refs). */
export function cloneModeratorDraft(state: ModeratorDraftState): ModeratorDraftState {
    return {
        enabled: state.enabled,
        preset: state.preset,
        provider: state.provider,
        model: state.model,
        timeoutSeconds: state.timeoutSeconds,
        failureAction: state.failureAction,
        userPolicy: state.userPolicy,
        actions: {
            low: state.actions.low,
            medium: state.actions.medium,
            high: state.actions.high,
            extreme: state.actions.extreme,
        },
    };
}

const MODERATOR_CHOICE_FIELD_KEYS = new Set<string>([
    MODERATOR_FIELD_KEYS.preset,
    MODERATOR_FIELD_KEYS.failureAction,
    MODERATOR_FIELD_KEYS.actionLow,
    MODERATOR_FIELD_KEYS.actionMedium,
    MODERATOR_FIELD_KEYS.actionHigh,
    MODERATOR_FIELD_KEYS.actionExtreme,
]);

function configureFieldValue(
    fields: readonly ConfigureField[],
    key: string,
): unknown {
    return fields.find((field) => field.key === key)?.value;
}

function valuesDiffer(current: unknown, next: unknown): boolean {
    if (typeof current === 'number' || typeof next === 'number') {
        return Number(current) !== Number(next);
    }
    if (typeof current === 'boolean' || typeof next === 'boolean') {
        return Boolean(current) !== Boolean(next);
    }
    return String(current ?? '') !== String(next ?? '');
}

export function shouldApplyModeratorPreset(
    preset: ModeratorBackendPreset,
    confirm: (message: string) => boolean = () => true,
): boolean {
    if (preset === 'hands_off' && !confirm(handsOffConfirmationCopy())) {
        return false;
    }
    return true;
}

export function applyModeratorPresetSelection(
    draft: ModeratorDraftState,
    preset: ModeratorBackendPreset,
): void {
    draft.preset = preset;
    draft.actions.low = '';
    draft.actions.medium = '';
    draft.actions.high = '';
    draft.actions.extreme = '';
}

export function buildModeratorPendingChanges(
    saved: ModeratorDraftState,
    draft: ModeratorDraftState,
    fields: readonly ConfigureField[],
): SimpleSettingChange[] {
    const changes: SimpleSettingChange[] = [];
    const push = (field: string, value: unknown) => {
        if (!fields.some((candidate) => candidate.key === field)) {
            return;
        }
        if (!valuesDiffer(configureFieldValue(fields, field), value)) {
            return;
        }
        changes.push({ section: 'security', field, value });
    };

    if (draft.enabled !== saved.enabled) {
        if (
            draft.enabled &&
            !readConfigureBoolean(fields, APPROVALS_FIELD_KEYS.enabled)
        ) {
            push(APPROVALS_FIELD_KEYS.enabled, true);
        }
        push(MODERATOR_FIELD_KEYS.enabled, draft.enabled);
    }

    const presetChanged = draft.preset !== saved.preset;
    push(MODERATOR_FIELD_KEYS.preset, draft.preset);
    push(MODERATOR_FIELD_KEYS.provider, draft.provider);
    push(MODERATOR_FIELD_KEYS.model, draft.model);
    push(MODERATOR_FIELD_KEYS.timeout, draft.timeoutSeconds);
    push(MODERATOR_FIELD_KEYS.failureAction, draft.failureAction);
    push(MODERATOR_FIELD_KEYS.userPolicy, draft.userPolicy);

    if (!presetChanged || actionsExplicitlySet(draft.actions)) {
        const actionFields: Array<[keyof ModeratorActionMap, string]> = [
            ['low', MODERATOR_FIELD_KEYS.actionLow],
            ['medium', MODERATOR_FIELD_KEYS.actionMedium],
            ['high', MODERATOR_FIELD_KEYS.actionHigh],
            ['extreme', MODERATOR_FIELD_KEYS.actionExtreme],
        ];
        for (const [key, field] of actionFields) {
            if (presetChanged && !draft.actions[key]) {
                continue;
            }
            if (draft.actions[key] !== saved.actions[key]) {
                push(field, draft.actions[key]);
            }
        }
    }

    return changes;
}

export function moderatorConfigureChangesFromPending(
    changes: readonly SimpleSettingChange[],
    fields: readonly ConfigureField[],
): ConfigureChange[] {
    return changes.map((change) => {
        const backendField = fields.find((field) => field.key === change.field);
        const op =
            backendField?.kind === 'choice' ||
            MODERATOR_CHOICE_FIELD_KEYS.has(change.field)
                ? ('choose' as const)
                : ('set' as const);
        return {
            section: change.section,
            field: change.field,
            channel: change.channel,
            op,
            value: change.value,
        };
    });
}
