import { describe, expect, it } from 'vitest';

import type { ConfigureField } from '../../app/types/or3-api';
import {
    APPROVALS_FIELD_KEYS,
    MODERATOR_FIELD_KEYS,
    applyModeratorPresetSelection,
    buildModeratorPendingChanges,
    moderatorConfigureChangesFromPending,
    shouldApplyModeratorPreset,
    type ModeratorDraftState,
} from '../../app/utils/or3/moderator-settings';

const baseFields: ConfigureField[] = [
    { key: APPROVALS_FIELD_KEYS.enabled, kind: 'toggle', value: false },
    {
        key: MODERATOR_FIELD_KEYS.enabled,
        kind: 'toggle',
        value: false,
    },
    {
        key: MODERATOR_FIELD_KEYS.preset,
        kind: 'choice',
        value: 'balanced',
        choices: ['balanced', 'cautious', 'hands_off', 'manual'],
    },
    {
        key: MODERATOR_FIELD_KEYS.failureAction,
        kind: 'choice',
        value: 'escalate',
        choices: ['escalate', 'deny'],
    },
    {
        key: MODERATOR_FIELD_KEYS.actionLow,
        kind: 'choice',
        value: 'approve',
        choices: ['', 'approve', 'escalate', 'deny'],
    },
    {
        key: MODERATOR_FIELD_KEYS.actionMedium,
        kind: 'choice',
        value: 'approve',
        choices: ['', 'approve', 'escalate', 'deny'],
    },
    {
        key: MODERATOR_FIELD_KEYS.actionHigh,
        kind: 'choice',
        value: 'escalate',
        choices: ['', 'approve', 'escalate', 'deny'],
    },
    {
        key: MODERATOR_FIELD_KEYS.actionExtreme,
        kind: 'choice',
        value: 'deny',
        choices: ['', 'approve', 'escalate', 'deny'],
    },
];

const savedBalanced: ModeratorDraftState = {
    enabled: false,
    preset: 'balanced',
    provider: '',
    model: '',
    timeoutSeconds: 8,
    failureAction: 'escalate',
    userPolicy: '',
    actions: {
        low: 'approve',
        medium: 'approve',
        high: 'escalate',
        extreme: 'deny',
    },
};

describe('moderator save helpers', () => {
    it('enables approvals before turning on the moderator', () => {
        const draft: ModeratorDraftState = {
            ...savedBalanced,
            enabled: true,
        };
        const changes = buildModeratorPendingChanges(
            savedBalanced,
            draft,
            baseFields,
        );
        expect(changes).toEqual([
            {
                section: 'security',
                field: APPROVALS_FIELD_KEYS.enabled,
                value: true,
            },
            {
                section: 'security',
                field: MODERATOR_FIELD_KEYS.enabled,
                value: true,
            },
        ]);
    });

    it('uses choose ops for moderator choice fields', () => {
        const draft: ModeratorDraftState = {
            ...savedBalanced,
            preset: 'cautious',
            failureAction: 'deny',
        };
        const pending = buildModeratorPendingChanges(
            savedBalanced,
            draft,
            baseFields,
        );
        const wire = moderatorConfigureChangesFromPending(pending, baseFields);
        expect(wire).toEqual(
            expect.arrayContaining([
                {
                    section: 'security',
                    field: MODERATOR_FIELD_KEYS.preset,
                    op: 'choose',
                    value: 'cautious',
                },
                {
                    section: 'security',
                    field: MODERATOR_FIELD_KEYS.failureAction,
                    op: 'choose',
                    value: 'deny',
                },
            ]),
        );
        expect(wire).toHaveLength(2);
    });

    it('omits blank per-risk overrides when a preset changes', () => {
        const draft: ModeratorDraftState = {
            ...savedBalanced,
            preset: 'hands_off',
            actions: { low: '', medium: '', high: '', extreme: '' },
        };
        const changes = buildModeratorPendingChanges(
            savedBalanced,
            draft,
            baseFields,
        );
        expect(changes).toEqual([
            {
                section: 'security',
                field: MODERATOR_FIELD_KEYS.preset,
                value: 'hands_off',
            },
        ]);
    });

    it('keeps explicit per-risk overrides after a preset change', () => {
        const draft: ModeratorDraftState = {
            ...savedBalanced,
            preset: 'cautious',
            actions: {
                low: 'approve',
                medium: 'escalate',
                high: '',
                extreme: '',
            },
        };
        const changes = buildModeratorPendingChanges(
            savedBalanced,
            draft,
            baseFields,
        );
        expect(changes).toEqual([
            {
                section: 'security',
                field: MODERATOR_FIELD_KEYS.preset,
                value: 'cautious',
            },
            {
                section: 'security',
                field: MODERATOR_FIELD_KEYS.actionMedium,
                value: 'escalate',
            },
        ]);
    });

    it('blocks hands-off unless the confirmation is accepted', () => {
        expect(shouldApplyModeratorPreset('hands_off', () => false)).toBe(false);
        expect(shouldApplyModeratorPreset('hands_off', () => true)).toBe(true);
        expect(shouldApplyModeratorPreset('balanced', () => false)).toBe(true);
    });

    it('clears draft actions when applying a preset selection', () => {
        const draft: ModeratorDraftState = {
            ...savedBalanced,
            actions: {
                low: 'deny',
                medium: 'deny',
                high: 'deny',
                extreme: 'deny',
            },
        };
        applyModeratorPresetSelection(draft, 'balanced');
        expect(draft.preset).toBe('balanced');
        expect(draft.actions).toEqual({
            low: '',
            medium: '',
            high: '',
            extreme: '',
        });
    });
});
