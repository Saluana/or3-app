import {
    approvalActionErrorMessage,
    canContinueApprovedRequest,
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
});
