import { describe, expect, it } from 'vitest';

import {
    buildInlineApprovalContent,
    inferApprovalMetadataFromToolPayload,
} from '../../app/utils/assistant-stream/approval';

describe('approval inference', () => {
    it('detects tool quota approvals from tool_result payloads', () => {
        expect(
            inferApprovalMetadataFromToolPayload('list_dir', {
                error: 'tool quota reached for message: per-message total tool-call limit 17/16 while executing list_dir (approval required)',
            }),
        ).toEqual({
            approvalType: 'tool_quota',
            approvalPreview: 'message tool_calls (17/16)',
        });
    });

    it('builds readable quota approval copy for chat', () => {
        const content = buildInlineApprovalContent({
            approvalType: 'tool_quota',
            approvalPreview: 'message max_tool_calls (17/16)',
        });
        expect(content).toContain('Tool call limit reached');
        expect(content).toContain('message max_tool_calls (17/16)');
        expect(content).toContain('Approve to let or3-intern continue');
    });
});
