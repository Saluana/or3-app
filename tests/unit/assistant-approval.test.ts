import {
    approvalActionErrorMessage,
    approvalStatusFromError,
    canContinueApprovedRequest,
    resolvedApprovalMessage,
    resolvedApprovalState,
} from '../../app/utils/assistantApproval';

describe('assistant approval helpers', () => {
    it('blocks continuation while approval is busy unless explicitly allowed', () => {
        expect(
            canContinueApprovedRequest({
                isStreaming: false,
                approvalBusy: true,
            }),
        ).toBe(false);

        expect(
            canContinueApprovedRequest({
                isStreaming: false,
                approvalBusy: true,
                allowWhileApprovalBusy: true,
            }),
        ).toBe(true);
    });

    it('still blocks continuation while the assistant is streaming', () => {
        expect(
            canContinueApprovedRequest({
                isStreaming: true,
                approvalBusy: false,
                allowWhileApprovalBusy: true,
            }),
        ).toBe(false);
    });

    it('uses structured api error messages for approval failures', () => {
        expect(
            approvalActionErrorMessage({
                message: 'approval request is not pending',
                status: 400,
            }),
        ).toBe('approval request is not pending');
    });

    it('recognizes resolved approval states from structured errors', () => {
        expect(
            approvalStatusFromError({
                message: 'This approval request was already approved.',
                approval_status: 'approved',
                status: 400,
            }),
        ).toBe('approved');
        expect(resolvedApprovalState('approved')).toBe('approved');
        expect(resolvedApprovalState('expired')).toBe('expired');
        expect(resolvedApprovalState('pending')).toBeUndefined();
    });

    it('explains stale approval states without reusing the generic failure text', () => {
        expect(resolvedApprovalMessage('approved')).toContain(
            'already granted',
        );
        expect(resolvedApprovalMessage('expired')).toContain('expired');
    });
});
