import { describe, expect, it } from 'vitest';
import {
    parseDoctorToolResults,
    parseFindingCard,
    parsePlan,
} from '~/utils/doctor';

describe('doctor validation and structured tool results', () => {
    it('parses finding cards with required fields only', () => {
        expect(
            parseFindingCard({
                id: 'f1',
                what_i_found: 'Provider key missing',
            })?.id,
        ).toBe('f1');
        expect(parseFindingCard({ id: 'f1' })).toBeNull();
    });

    it('prefers doctor_tool_result meta over markdown scraping', () => {
        const results = parseDoctorToolResults('legacy prose only', {
            doctor_tool_result: {
                kind: 'doctor_status',
                ok: true,
                summary: 'All good',
            },
        });
        expect(results).toHaveLength(1);
        expect(results[0]?.summary).toBe('All good');
    });
});
