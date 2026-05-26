import { describe, expect, it } from 'vitest';
import { buildDoctorInvestigationPrompt } from '../../app/utils/doctor/doctorFixPrompt';

describe('doctor fix prompt', () => {
    it('includes the full finding payload and investigation request', () => {
        const prompt = buildDoctorInvestigationPrompt({
            id: 'exec.public_ingress_reachable',
            what_i_found:
                'public or webhook-facing ingress can reach privileged exec posture unless profiles deny it',
            what_this_means:
                'public or webhook-facing ingress can reach privileged exec posture unless profiles deny it',
            recommended_fix:
                "Review this setting in `or3-intern status --advanced`, then run `or3-intern doctor --fix` when a safe repair is available.",
            risk_level: 'warning',
            advanced_details: {
                id: 'exec.public_ingress_reachable',
                severity: 'warn',
            },
        });

        expect(prompt).toContain(
            'Please investigate this doctor warning and create a plan to fix it.',
        );
        expect(prompt).toContain('```json');
        expect(prompt).toContain('"id": "exec.public_ingress_reachable"');
        expect(prompt).toContain('"advanced_details"');
        expect(prompt).not.toContain('Please prepare an Apply button');
    });
});
