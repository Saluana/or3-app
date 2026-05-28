import { describe, expect, it } from 'vitest';

import {
    MODERATOR_FIELD_KEYS,
    actionsMatchPreset,
    cloneModeratorDraft,
    detectUiPreset,
    effectiveActions,
    hasModeratorConfigureFields,
    moderatorPresetSummary,
    presetById,
    readModeratorActions,
    statusHeadline,
} from '../../app/utils/or3/moderator-settings';

describe('moderator settings helpers', () => {
    it('detects moderator configure field availability', () => {
        expect(hasModeratorConfigureFields([])).toBe(false);
        expect(
            hasModeratorConfigureFields([
                { key: MODERATOR_FIELD_KEYS.enabled, value: true },
            ]),
        ).toBe(true);
    });

    it('maps backend preset to UI preset when overrides are empty', () => {
        expect(
            detectUiPreset({
                preset: 'balanced',
                actions: { low: '', medium: '', high: '', extreme: '' },
            }),
        ).toBe('balanced');
    });

    it('detects matching preset from explicit overrides', () => {
        expect(
            detectUiPreset({
                preset: 'balanced',
                actions: presetById('hands_off')!.actions,
            }),
        ).toBe('hands_off');
    });

    it('shows custom when overrides match no preset', () => {
        expect(
            detectUiPreset({
                preset: 'balanced',
                actions: {
                    low: 'deny',
                    medium: 'deny',
                    high: 'deny',
                    extreme: 'deny',
                },
            }),
        ).toBe('custom');
    });

    it('summarizes balanced preset behavior', () => {
        const balanced = presetById('balanced')!;
        expect(moderatorPresetSummary('balanced')).toContain('Balanced');
        expect(actionsMatchPreset(balanced.actions, balanced)).toBe(true);
    });

    it('fills effective actions from preset fallback', () => {
        expect(
            effectiveActions({
                preset: 'manual',
                actions: { low: '', medium: '', high: '', extreme: '' },
            }),
        ).toEqual(presetById('manual')!.actions);
    });

    it('reads per-risk overrides from configure fields', () => {
        expect(
            readModeratorActions([
                { key: MODERATOR_FIELD_KEYS.actionLow, value: 'approve' },
                { key: MODERATOR_FIELD_KEYS.actionHigh, value: 'escalate' },
            ]),
        ).toEqual({
            low: 'approve',
            medium: '',
            high: 'escalate',
            extreme: '',
        });
    });

    it('builds status headline for enabled balanced mode', () => {
        expect(statusHeadline(true, 'balanced')).toContain(
            'normal approval requests',
        );
    });

    it('clones moderator draft snapshots without sharing nested state', () => {
        const source = {
            enabled: true,
            preset: 'balanced',
            provider: '',
            model: '',
            timeoutSeconds: 40,
            failureAction: 'escalate',
            userPolicy: 'Ask before installs.',
            actions: {
                low: 'approve',
                medium: '',
                high: 'escalate',
                extreme: 'deny',
            },
        };
        const copy = cloneModeratorDraft(source);
        copy.actions.low = 'deny';
        expect(source.actions.low).toBe('approve');
        expect(copy).not.toBe(source);
        expect(copy.actions).not.toBe(source.actions);
    });
});
