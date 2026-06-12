import type { ApprovalActionResponse, ApprovalRequest } from '~/types/or3-api';

function approvalToolName(approval?: ApprovalRequest | null) {
    const subject = approval?.subject as Record<string, unknown> | undefined;
    const tool = subject?.tool_name ?? subject?.ToolName;
    return typeof tool === 'string' ? tool.trim() : '';
}

type ApprovalResumeResponse = Pick<
    ApprovalActionResponse,
    'request_id' | 'token'
>;

export async function resumeApprovalOperation(input: {
    response?: Partial<ApprovalResumeResponse> | null;
    approval?: ApprovalRequest | null;
    consumeToken: (id: number | string) => string | undefined;
    resumeTerminal?: (approvalId: number | string, token: string) => Promise<void>;
    resumeRestart?: (approvalId: number | string, token: string) => Promise<void>;
}) {
    const approvalId = input.response?.request_id ?? input.approval?.id;
    if (approvalId === undefined || approvalId === null || approvalId === '') {
        return false;
    }
    const token =
        input.response?.token?.trim() ||
        input.consumeToken(approvalId)?.trim() ||
        '';
    if (!token) return false;

    const tool = approvalToolName(input.approval);
    if (tool === 'terminal' && input.resumeTerminal) {
        await input.resumeTerminal(approvalId, token);
        return true;
    }
    if (tool === 'restart-service' && input.resumeRestart) {
        await input.resumeRestart(approvalId, token);
        return true;
    }
    return false;
}
