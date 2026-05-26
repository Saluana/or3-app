import { describe, expect, it } from 'vitest';

import { normalizeApprovalRequest } from '../../app/utils/or3/approvals';
import {
    formatModeratorCardSummary,
    formatModeratorStatusLabel,
    parseModeratorAlternative,
} from '../../app/utils/or3/moderator-display';

describe('moderator display helpers', () => {
    it('parses moderator alternative from reason text', () => {
        expect(
            parseModeratorAlternative(
                'never use grep; alternative: try ripgrep (rg)',
            ),
        ).toEqual({
            reason: 'never use grep',
            alternative: 'try ripgrep (rg)',
        });
    });

    it('formats auto-denied status label', () => {
        expect(
            formatModeratorStatusLabel({
                status: 'reviewed',
                action: 'deny',
                risk: 'high',
            }),
        ).toBe('Auto-denied');
    });

    it('normalizes nested moderator metadata on approvals', () => {
        const approval = normalizeApprovalRequest({
            id: 7,
            status: 'denied',
            moderator: {
                risk: 'high',
                action: 'deny',
                reason: 'policy blocked',
                alternative: 'use rg instead',
            },
        });
        expect(approval.moderator?.risk).toBe('high');
        expect(approval.moderator?.alternative).toBe('use rg instead');
        expect(formatModeratorCardSummary(approval.moderator)).toContain(
            'High risk',
        );
    });

    it('leaves approvals unchanged when moderator metadata is missing', () => {
        const approval = normalizeApprovalRequest({
            id: 8,
            status: 'pending',
            type: 'exec',
        });
        expect(approval.moderator).toBeUndefined();
    });
});
