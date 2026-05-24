import { describe, expect, it } from 'vitest';
import type { ChatMessage } from '../../app/types/app-state';
import { isSyntheticApprovalContinuationUserMessage } from '../../app/utils/chat/approval-continuation';
import { compactAssistantRunMessages } from '../../app/utils/chat/merge-assistant-run';

function assistant(id: string, patch: Partial<ChatMessage> = {}): ChatMessage {
    return {
        id,
        sessionId: 'session_1',
        role: 'assistant',
        content: '',
        status: 'complete',
        createdAt: '2026-05-24T00:00:00.000Z',
        toolCalls: [],
        parts: [],
        activityLog: [],
        ...patch,
    };
}

function user(content: string): ChatMessage {
    return {
        id: `user_${content.length}`,
        sessionId: 'session_1',
        role: 'user',
        content,
        status: 'complete',
        createdAt: '2026-05-24T00:00:00.000Z',
    };
}

describe('chat run merge helpers', () => {
    it('detects synthetic approval continuation user messages', () => {
        expect(
            isSyntheticApprovalContinuationUserMessage(
                'Approval was granted for the previously requested continuation. Continue the same task from the existing conversation state.',
            ),
        ).toBe(true);
        expect(isSyntheticApprovalContinuationUserMessage('hello')).toBe(false);
    });

    it('merges assistant runs split by synthetic continuation user messages', () => {
        const compacted = compactAssistantRunMessages([
            assistant('a1', {
                status: 'attention',
                approvalRequestId: 42,
                toolCalls: [
                    {
                        id: 'tool_1',
                        name: 'list_dir',
                        status: 'complete',
                        startedAt: '2026-05-24T00:00:00.000Z',
                    },
                ],
            }),
            user(
                'Approval was granted for the previously requested continuation. Continue the same task from the existing conversation state.',
            ),
            assistant('a2', {
                content: 'Here is the final answer.',
                jobId: 'job_resume',
            }),
        ]);

        expect(compacted).toHaveLength(1);
        expect(compacted[0]?.toolCalls).toHaveLength(1);
        expect(compacted[0]?.content).toContain('final answer');
        expect(compacted[0]?.jobId).toBe('job_resume');
    });
});
