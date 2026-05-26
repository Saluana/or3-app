import { describe, expect, it } from 'vitest';
import { formatDoctorPlanOutcomeMessage } from '../../app/utils/or3/doctor-plan-outcome';

describe('formatDoctorPlanOutcomeMessage', () => {
    it('turns default model plan titles into outcome copy', () => {
        expect(
            formatDoctorPlanOutcomeMessage({
                title: 'Change default model to xiaomi/mimo-v2.5-pro',
                changes: [],
            }),
        ).toBe('Model updated to xiaomi/mimo-v2.5-pro');
    });

    it('derives outcome copy from the first plan change when title is generic', () => {
        expect(
            formatDoctorPlanOutcomeMessage({
                title: 'Provider tweak',
                changes: [
                    {
                        section: 'provider',
                        field: 'provider_model',
                        config_path: 'provider.model',
                        new_value: { value: 'deepseek/deepseek-v4-pro' },
                    },
                ],
            }),
        ).toBe('Model updated to deepseek/deepseek-v4-pro');
    });

    it('falls back when no readable change exists', () => {
        expect(
            formatDoctorPlanOutcomeMessage({
                title: '',
                changes: [],
            }),
        ).toBe('Settings updated successfully');
    });
});
