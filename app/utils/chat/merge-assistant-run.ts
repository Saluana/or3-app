import type { ChatMessage, ChatMessagePart, ChatToolCall } from '~/types/app-state';
import { isSyntheticApprovalContinuationUserMessage } from './approval-continuation';

function uniqueById<T extends { id: string }>(items: T[] | undefined) {
    const next: T[] = [];
    for (const item of items ?? []) {
        if (next.some((existing) => existing.id === item.id)) continue;
        next.push(item);
    }
    return next;
}

function mergeToolCalls(
    left: ChatToolCall[] | undefined,
    right: ChatToolCall[] | undefined,
) {
    const merged = [...(left ?? [])];
    for (const call of right ?? []) {
        const index = merged.findIndex((item) => item.id === call.id);
        if (index === -1) {
            merged.push(call);
            continue;
        }
        merged[index] = { ...merged[index], ...call };
    }
    return merged;
}

function mergeParts(
    left: ChatMessagePart[] | undefined,
    right: ChatMessagePart[] | undefined,
) {
    const merged = [...(left ?? [])];
    for (const part of right ?? []) {
        const index = merged.findIndex((item) => item.id === part.id);
        if (index === -1) {
            merged.push(part);
            continue;
        }
        merged[index] = { ...merged[index], ...part };
    }
    return merged;
}

function mergeContent(left?: string, right?: string) {
    const normalizedLeft = String(left ?? '').trim();
    const normalizedRight = String(right ?? '').trim();
    if (!normalizedLeft) return normalizedRight;
    if (!normalizedRight) return normalizedLeft;
    if (normalizedLeft.includes(normalizedRight)) return normalizedLeft;
    if (normalizedRight.includes(normalizedLeft)) return normalizedRight;
    return `${normalizedLeft}\n\n${normalizedRight}`;
}

function pickStatus(
    left: ChatMessage['status'],
    right: ChatMessage['status'],
): ChatMessage['status'] {
    const rank: Record<ChatMessage['status'], number> = {
        sending: 0,
        streaming: 4,
        attention: 3,
        complete: 2,
        failed: 1,
    };
    return rank[left] >= rank[right] ? left : right;
}

export function mergeAssistantMessages(
    target: ChatMessage,
    source: ChatMessage,
): ChatMessage {
    return {
        ...target,
        content: mergeContent(target.content, source.content),
        status: pickStatus(target.status, source.status),
        reasoningText: mergeContent(target.reasoningText, source.reasoningText),
        toolCalls: mergeToolCalls(target.toolCalls, source.toolCalls),
        parts: mergeParts(target.parts, source.parts),
        activityLog: uniqueById([
            ...(target.activityLog ?? []),
            ...(source.activityLog ?? []),
        ]).slice(-30),
        backendMessageId:
            target.backendMessageId ?? source.backendMessageId ?? undefined,
        backendMessageIds: [
            ...new Set([
                ...(target.backendMessageIds ?? []),
                ...(source.backendMessageIds ?? []),
                ...(target.backendMessageId ? [target.backendMessageId] : []),
                ...(source.backendMessageId ? [source.backendMessageId] : []),
            ]),
        ],
        jobId: source.jobId || target.jobId,
        runnerChatTurnId: source.runnerChatTurnId || target.runnerChatTurnId,
        approvalRequestId:
            target.approvalRequestId ?? source.approvalRequestId ?? undefined,
        approvalState: target.approvalState ?? source.approvalState,
        approvalType: target.approvalType ?? source.approvalType,
        approvalPreview: target.approvalPreview ?? source.approvalPreview,
        retryPayload: target.retryPayload ?? source.retryPayload,
        error: target.error ?? source.error,
        errorCode: target.errorCode ?? source.errorCode,
    };
}

export function shouldMergeAssistantRunMessages(
    previous: ChatMessage | undefined,
    next: ChatMessage,
    betweenWasSyntheticContinuation = false,
) {
    if (!previous || previous.role !== 'assistant' || next.role !== 'assistant') {
        return false;
    }
    if (previous.sessionId !== next.sessionId) return false;
    if (betweenWasSyntheticContinuation) return true;
    if (
        previous.approvalRequestId &&
        !next.approvalRequestId &&
        (previous.status === 'attention' ||
            previous.status === 'streaming' ||
            previous.approvalState === 'pending' ||
            previous.approvalState === 'retrying')
    ) {
        return true;
    }
    const previousHasTools = Boolean(
        previous.toolCalls?.length ||
            previous.parts?.some((part) => part.type === 'tool'),
    );
    const nextHasTools = Boolean(
        next.toolCalls?.length ||
            next.parts?.some((part) => part.type === 'tool'),
    );
    if (
        previousHasTools &&
        nextHasTools &&
        !String(previous.content ?? '').trim() &&
        String(next.content ?? '').trim()
    ) {
        return false;
    }
    if (
        previousHasTools &&
        !String(previous.content ?? '').trim() &&
        (nextHasTools || !String(next.content ?? '').trim())
    ) {
        return true;
    }
    return false;
}

export function compactAssistantRunMessages(messages: ChatMessage[]) {
    const compacted: ChatMessage[] = [];
    let mergeNextAssistantIntoPrevious = false;
    for (const message of messages) {
        if (
            message.role === 'user' &&
            isSyntheticApprovalContinuationUserMessage(message.content)
        ) {
            mergeNextAssistantIntoPrevious = true;
            continue;
        }
        const previous = compacted[compacted.length - 1];
        if (
            message.role === 'assistant' &&
            previous &&
            shouldMergeAssistantRunMessages(
                previous,
                message,
                mergeNextAssistantIntoPrevious,
            )
        ) {
            compacted[compacted.length - 1] = mergeAssistantMessages(
                previous,
                message,
            );
            mergeNextAssistantIntoPrevious = false;
            continue;
        }
        compacted.push(message);
        mergeNextAssistantIntoPrevious = false;
    }
    return compacted;
}
