import { describe, expect, it, vi } from 'vitest';

import { resumeApprovalOperation } from '../../app/utils/or3/approval-operation-resume';

describe('resumeApprovalOperation', () => {
    it('resumes terminal sessions when only an approval token is issued', async () => {
        const resumeTerminal = vi.fn(async () => {});
        const resumed = await resumeApprovalOperation({
            response: { request_id: 7, token: 'tok-7' },
            approval: {
                id: 7,
                status: 'pending',
                subject: { tool_name: 'terminal' },
            },
            consumeToken: () => 'tok-7',
            resumeTerminal,
        });

        expect(resumed).toBe(true);
        expect(resumeTerminal).toHaveBeenCalledWith(7, 'tok-7');
    });

    it('resumes restart actions when only an approval token is issued', async () => {
        const resumeRestart = vi.fn(async () => {});
        const resumed = await resumeApprovalOperation({
            response: { request_id: 9, token: 'tok-9' },
            approval: {
                id: 9,
                status: 'pending',
                subject: { tool_name: 'restart-service' },
            },
            consumeToken: () => 'tok-9',
            resumeRestart,
        });

        expect(resumed).toBe(true);
        expect(resumeRestart).toHaveBeenCalledWith(9, 'tok-9');
    });
});
