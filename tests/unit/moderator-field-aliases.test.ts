import { describe, expect, it } from 'vitest';

import { SIMPLE_SETTING_SECTIONS } from '../../app/settings/fieldMappings';

describe('moderator field mappings', () => {
    it('registers approval autopilot under the safety section', () => {
        const safety = SIMPLE_SETTING_SECTIONS.find(
            (section) => section.key === 'safety',
        );
        expect(safety).toBeTruthy();
        const autopilot = safety?.controls.find(
            (control) => control.key === 'approval-autopilot-enabled',
        );
        expect(autopilot?.fieldRefs[0]).toEqual({
            section: 'security',
            field: 'approvals.moderator.enabled',
        });
        expect(autopilot?.toggle?.on).toEqual([
            {
                section: 'security',
                field: 'security_approvals_enabled',
                value: true,
            },
            {
                section: 'security',
                field: 'approvals.moderator.enabled',
                value: true,
            },
        ]);
    });
});
