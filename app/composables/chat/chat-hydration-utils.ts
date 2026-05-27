import type {
    ChatActivityEntry,
    ChatMessage,
    ChatMessagePart,
    ChatSession,
    ChatToolCall,
} from '~/types/app-state';
import type { ChatHistoryMessage } from '~/types/or3-api';
import { msToIso } from './chat-session-utils';

export function backendRole(backend: ChatHistoryMessage): ChatMessage['role'] {
    return backend.role === 'user' ||
        backend.role === 'assistant' ||
        backend.role === 'system' ||
        backend.role === 'tool'
        ? backend.role
        : 'assistant';
}

export function normalizeContent(value?: string) {
    return (value ?? '').trim();
}

export function uniqueBackendIds(...values: Array<number | undefined>) {
    return [
        ...new Set(
            values.filter(
                (value): value is number =>
                    typeof value === 'number' && value > 0,
            ),
        ),
    ];
}

export function backendIdsForMessage(message: ChatMessage) {
    return uniqueBackendIds(
        message.backendMessageId,
        ...(message.backendMessageIds ?? []),
    );
}

export function appendBackendId(message: ChatMessage, backendID: number) {
    return uniqueBackendIds(...backendIdsForMessage(message), backendID);
}

function payloadText(payload: Record<string, unknown>, keys: string[]) {
    for (const key of keys) {
        const value = payload[key];
        if (typeof value === 'string' && value.trim()) return value;
    }
    return '';
}

export function previewValue(value: unknown, limit = 2_000) {
    if (value === undefined || value === null) return '';
    const text =
        typeof value === 'string'
            ? value
            : JSON.stringify(value, null, 2) || String(value);
    return text.length > limit ? `${text.slice(0, limit)}\n...` : text;
}

function parseToolResult(content: string) {
    try {
        const parsed = JSON.parse(content) as unknown;
        return parsed && typeof parsed === 'object'
            ? (parsed as Record<string, unknown>)
            : undefined;
    } catch {
        return undefined;
    }
}

export function toolResultPreview(
    content: string,
    payload: Record<string, unknown>,
) {
    const result = parseToolResult(content);
    return (
        payloadText(payload, ['preview', 'summary']) ||
        (result ? payloadText(result, ['summary', 'preview', 'status']) : '') ||
        normalizeContent(content).replace(/\s+/g, ' ').slice(0, 160)
    );
}

export function toolResultStatus(content: string): ChatToolCall['status'] {
    const result = parseToolResult(content);
    if (!result) return 'complete';
    if (result.ok === false) return 'error';
    if (String(result.status ?? '').toLowerCase() === 'approval_required')
        return 'attention';
    return 'complete';
}

export function normalizeToolCall(
    raw: unknown,
    index: number,
    createdAt: string,
): ChatToolCall | null {
    if (!raw || typeof raw !== 'object') return null;
    const record = raw as Record<string, unknown>;
    const fn =
        record.function && typeof record.function === 'object'
            ? (record.function as Record<string, unknown>)
            : undefined;
    const name = String(fn?.name ?? record.name ?? 'tool').trim() || 'tool';
    const id =
        String(record.id ?? record.tool_call_id ?? `tool_${index}`).trim() ||
        `tool_${index}`;
    const args =
        typeof fn?.arguments === 'string'
            ? fn.arguments
            : typeof record.arguments === 'string'
              ? record.arguments
              : undefined;
    return {
        id,
        name,
        status: 'running',
        arguments: args,
        startedAt: createdAt,
    };
}

export function toolPart(call: ChatToolCall): ChatMessagePart {
    return {
        id: `tool:${call.id}`,
        type: 'tool',
        toolCallId: call.id,
        name: call.name,
        status: call.status,
        argumentsPreview: previewValue(call.arguments),
        resultPreview: call.result,
        errorPreview: call.error,
    };
}

export function activityForTool(call: ChatToolCall): ChatActivityEntry {
    return {
        id: `tool:${call.id}`,
        type: 'tool_call',
        label:
            call.status === 'running'
                ? `Running ${call.name}`
                : `Used ${call.name}`,
        detail: call.error || call.result || call.arguments,
        status:
            call.status === 'error' || call.status === 'attention'
                ? call.status
                : call.status === 'complete'
                  ? 'complete'
                  : 'running',
        createdAt: call.completedAt || call.startedAt,
    };
}

export function upsertById<T extends { id: string }>(
    items: T[] | undefined,
    item: T,
) {
    const next = [...(items ?? [])];
    const index = next.findIndex((existing) => existing.id === item.id);
    if (index >= 0) next[index] = { ...next[index], ...item };
    else next.push(item);
    return next;
}

/** Tracks assistant messages touched during hydration for fast reverse lookup. */
export class HydrationAssistantIndex {
    private readonly stack: ChatMessage[] = [];

    constructor(
        private readonly sessionId: string,
        private readonly list: () => ChatMessage[],
    ) {}

    noteAssistant(message: ChatMessage) {
        if (message.sessionId !== this.sessionId || message.role !== 'assistant') {
            return;
        }
        const index = this.stack.findIndex((item) => item.id === message.id);
        if (index >= 0) this.stack[index] = message;
        else this.stack.push(message);
    }

    findReverse(predicate: (message: ChatMessage) => boolean) {
        for (let index = this.stack.length - 1; index >= 0; index--) {
            const message = this.stack[index];
            if (message && predicate(message)) return message;
        }
        const list = this.list();
        for (let index = list.length - 1; index >= 0; index--) {
            const message = list[index];
            if (!message || message.role !== 'assistant') continue;
            if (!predicate(message)) continue;
            this.noteAssistant(message);
            return message;
        }
        return undefined;
    }
}

export function buildHydrationPatch(
    backend: ChatHistoryMessage,
    session: ChatSession,
    toolCalls: ChatToolCall[],
    toolParts: ChatMessagePart[],
    toolActivities: ChatActivityEntry[],
): Partial<ChatMessage> {
    const payload =
        backend.payload && typeof backend.payload === 'object'
            ? (backend.payload as Record<string, unknown>)
            : {};
    const runnerPermissionPayload =
        payload.runner_permission &&
        typeof payload.runner_permission === 'object'
            ? (payload.runner_permission as Record<string, unknown>)
            : undefined;
    const backendID = backend.id;
    const patch: Partial<ChatMessage> = {
        backendMessageId: backendID,
        backendMessageIds: uniqueBackendIds(backendID),
        sourceSessionKey: session.sessionKey,
        runnerId:
            typeof payload.runner_id === 'string'
                ? payload.runner_id
                : session.runnerId,
        runnerChatSessionId:
            typeof payload.runner_chat_session_id === 'string'
                ? payload.runner_chat_session_id
                : session.runnerChatSessionId,
        runnerChatTurnId:
            typeof payload.runner_chat_turn_id === 'string'
                ? payload.runner_chat_turn_id
                : undefined,
        approvalRequestId:
            typeof payload.approval_request_id === 'string' ||
            typeof payload.approval_request_id === 'number'
                ? payload.approval_request_id
                : typeof payload.approval_id === 'string' ||
                    typeof payload.approval_id === 'number'
                  ? payload.approval_id
                  : undefined,
        approvalState:
            payload.approval_state === 'pending' ? 'pending' : undefined,
        retryPayload:
            payload.status === 'approval_required' &&
            typeof payload.user_message === 'string' &&
            payload.user_message.trim()
                ? {
                      text: payload.user_message,
                      transportText: payload.user_message,
                      suppressUserEcho: true,
                      runnerId:
                          typeof payload.runner_id === 'string'
                              ? payload.runner_id
                              : session.runnerId,
                      runnerChatSessionId:
                          typeof payload.runner_chat_session_id === 'string'
                              ? payload.runner_chat_session_id
                              : session.runnerChatSessionId,
                      runnerContinuationMode:
                          typeof payload.continuation_mode === 'string'
                              ? payload.continuation_mode
                              : session.runnerContinuationMode,
                      runnerModel:
                          typeof payload.model === 'string'
                              ? payload.model
                              : session.runnerModel,
                      runnerMode:
                          typeof payload.mode === 'string'
                              ? payload.mode
                              : session.runnerMode,
                      runnerIsolation:
                          typeof payload.isolation === 'string'
                              ? payload.isolation
                              : session.runnerIsolation,
                      runnerCwd:
                          typeof payload.cwd === 'string'
                              ? payload.cwd
                              : session.runnerCwd,
                      runnerPermission: runnerPermissionPayload
                          ? {
                                runnerId:
                                    typeof runnerPermissionPayload.runner_id ===
                                    'string'
                                        ? runnerPermissionPayload.runner_id
                                        : undefined,
                                kind:
                                    typeof runnerPermissionPayload.kind ===
                                    'string'
                                        ? runnerPermissionPayload.kind
                                        : undefined,
                                access:
                                    typeof runnerPermissionPayload.access ===
                                    'string'
                                        ? runnerPermissionPayload.access
                                        : undefined,
                                targetPath:
                                    typeof runnerPermissionPayload.target_path ===
                                    'string'
                                        ? runnerPermissionPayload.target_path
                                        : undefined,
                            }
                          : undefined,
                  }
                : undefined,
        status:
            payload.status === 'approval_required' ? 'attention' : 'complete',
    };
    if (toolCalls.length) {
        patch.toolCalls = toolCalls;
        patch.parts = [
            ...(backend.content.trim()
                ? [
                      {
                          id: `text:${backendID}`,
                          type: 'text' as const,
                          content: backend.content,
                      },
                  ]
                : []),
            ...toolParts,
        ];
        patch.activityLog = toolActivities;
    }
    return patch;
}
