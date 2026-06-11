import { describe, expect, it } from 'vitest';

import { SIMPLE_SETTING_SECTIONS } from '../../app/settings/fieldMappings';

describe('moderator field mappings', () => {
    it('does not expose removed approval autopilot settings', () => {
        const safety = SIMPLE_SETTING_SECTIONS.find(
            (section) => section.key === 'safety',
        );
        expect(safety).toBeTruthy();
        const autopilot = safety?.controls.find(
            (control) => control.key === 'approval-autopilot-enabled',
        );
        expect(autopilot).toBeUndefined();
    });

    it('does not expose legacy runtime profile safety mode', () => {
        const safety = SIMPLE_SETTING_SECTIONS.find(
            (section) => section.key === 'safety',
        );
        expect(safety).toBeTruthy();
        const safetyMode = safety?.controls.find(
            (control) => control.key === 'safety-mode',
        );
        expect(safetyMode).toBeUndefined();
    });
});
