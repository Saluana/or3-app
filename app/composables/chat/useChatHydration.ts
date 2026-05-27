import type { ChatMessage, ChatSession, ChatToolCall } from '~/types/app-state';
import type { ChatHistoryMessage } from '~/types/or3-api';
import { isSyntheticApprovalContinuationUserMessage } from '~/utils/chat/approval-continuation';
import {
    mergeAssistantMessages,
    shouldMergeAssistantRunMessages,
} from '~/utils/chat/merge-assistant-run';
import { HYDRATE_MUTATION_OPTIONS } from './chat-message-mutation';
import {
    HydrationAssistantIndex,
    activityForTool,
    appendBackendId,
    backendIdsForMessage,
    backendRole,
    buildHydrationPatch,
    normalizeContent,
    normalizeToolCall,
    previewValue,
    toolPart,
    toolResultPreview,
    toolResultStatus,
    upsertById,
} from './chat-hydration-utils';
import { msToIso } from './chat-session-utils';
import type { sessionMessagesFor as SessionMessagesFor } from './useChatMessageIndex';

export interface ChatHydrationDeps {
    cache: {
        state: { value: { messages: ChatMessage[] } };
        persistNow: () => void;
    };
    sessionMessagesFor: typeof SessionMessagesFor;
    addMessage: (
        message: Omit<ChatMessage, 'id' | 'createdAt'> &
            Partial<Pick<ChatMessage, 'id' | 'createdAt'>>,
        options?: typeof HYDRATE_MUTATION_OPTIONS,
    ) => ChatMessage;
    updateMessage: (
        id: string,
        patch: Partial<ChatMessage>,
        options?: typeof HYDRATE_MUTATION_OPTIONS,
    ) => ChatMessage | undefined;
    removeMessageFromIndex: (message: ChatMessage) => void;
    reindexMessagesFromCache: (messages: ChatMessage[]) => void;
    bumpActiveSessionMessagesView: (sessionId?: string | null) => void;
    touchSession: (sessionId: string) => void;
    syncSessionMessageSummary: (sessionId: string) => void;
    compactSessionMessages: (sessionId: string) => void;
}

export function hydrateBackendMessages(
    deps: ChatHydrationDeps,
    session: ChatSession,
    backendMessages: ChatHistoryMessage[],
) {
    let mergeNextAssistantIntoPrevious = false;
    const backendIdMap = new Map<number, ChatMessage>();
    const listForSession = () => deps.sessionMessagesFor(session.id);
    const assistantIndex = new HydrationAssistantIndex(session.id, listForSession);

    for (const message of listForSession()) {
        for (const id of backendIdsForMessage(message)) {
            backendIdMap.set(id, message);
        }
        if (message.role === 'assistant') {
            assistantIndex.noteAssistant(message);
        }
    }

    const indexBackendIds = (message: ChatMessage) => {
        for (const id of backendIdsForMessage(message)) {
            backendIdMap.set(id, message);
        }
        assistantIndex.noteAssistant(message);
    };

    const claimedLocalMessageIds = new Set<string>();

    const attachToolResultToAssistant = (
        backend: ChatHistoryMessage,
        payload: Record<string, unknown>,
    ) => {
        const toolCallId = String(
            payload.tool_call_id ?? payload.call_id ?? '',
        ).trim();
        const toolName =
            String(payload.tool ?? payload.name ?? 'tool').trim() || 'tool';
        const assistant = assistantIndex.findReverse((message) => {
            if (message.role !== 'assistant') return false;
            if (!toolCallId)
                return Boolean(
                    message.toolCalls?.length ||
                        message.parts?.some((part) => part.type === 'tool'),
                );
            return Boolean(
                message.toolCalls?.some((call) => call.id === toolCallId) ||
                    message.parts?.some(
                        (part) => part.toolCallId === toolCallId,
                    ),
            );
        });
        if (!assistant) return false;

        const status = toolResultStatus(backend.content);
        const result =
            status === 'complete'
                ? toolResultPreview(backend.content, payload)
                : undefined;
        const error =
            status !== 'complete'
                ? toolResultPreview(backend.content, payload)
                : undefined;
        const existingCall = assistant.toolCalls?.find(
            (call) => call.id === toolCallId,
        );
        const call: ChatToolCall = {
            id:
                toolCallId ||
                existingCall?.id ||
                `tool_backend_${backend.id}`,
            name: existingCall?.name || toolName,
            status,
            arguments:
                existingCall?.arguments ||
                previewValue(payload.args ?? payload.arguments),
            result,
            error,
            startedAt: existingCall?.startedAt || msToIso(backend.created_at),
            completedAt: msToIso(backend.created_at),
        };
        const updated = deps.updateMessage(
            assistant.id,
            {
                backendMessageIds: appendBackendId(assistant, backend.id),
                toolCalls: upsertById(assistant.toolCalls, call),
                parts: upsertById(assistant.parts, toolPart(call)),
                activityLog: upsertById(
                    assistant.activityLog,
                    activityForTool(call),
                ).slice(-30),
            },
            HYDRATE_MUTATION_OPTIONS,
        );
        if (updated) indexBackendIds(updated);
        deps.cache.state.value.messages = deps.cache.state.value.messages.filter(
            (message) => {
                const keep =
                    message.id === assistant.id ||
                    !backendIdsForMessage(message).includes(backend.id);
                if (!keep) deps.removeMessageFromIndex(message);
                return keep;
            },
        );
        return true;
    };

    for (const backend of backendMessages) {
        const backendID = backend.id;
        const role = backendRole(backend);
        const payload =
            backend.payload && typeof backend.payload === 'object'
                ? (backend.payload as Record<string, unknown>)
                : {};
        if (
            role === 'user' &&
            isSyntheticApprovalContinuationUserMessage(
                backend.content,
                payload,
            )
        ) {
            mergeNextAssistantIntoPrevious = true;
            continue;
        }
        if (role === 'tool' && attachToolResultToAssistant(backend, payload)) {
            continue;
        }
        const toolCalls = Array.isArray(payload.tool_calls)
            ? payload.tool_calls
                  .map((item, index) =>
                      normalizeToolCall(
                          item,
                          index,
                          msToIso(backend.created_at),
                      ),
                  )
                  .filter((item): item is ChatToolCall => Boolean(item))
            : [];
        const toolParts = toolCalls.map(toolPart);
        const toolActivities = toolCalls.map((call) => activityForTool(call));
        const patch = buildHydrationPatch(
            backend,
            session,
            toolCalls,
            toolParts,
            toolActivities,
        );

        const existing = backendIdMap.get(backendID);
        if (existing) {
            const updated = deps.updateMessage(
                existing.id,
                patch,
                HYDRATE_MUTATION_OPTIONS,
            );
            if (updated) indexBackendIds(updated);
            mergeNextAssistantIntoPrevious = false;
            continue;
        }
        if (role === 'assistant' && mergeNextAssistantIntoPrevious) {
            const previousAssistant = assistantIndex.findReverse(
                (message) => message.role === 'assistant',
            );
            if (previousAssistant) {
                const merged = mergeAssistantMessages(previousAssistant, {
                    ...previousAssistant,
                    ...patch,
                    id: previousAssistant.id,
                    sessionId: session.id,
                    role: 'assistant',
                    content: previousAssistant.content || backend.content,
                    createdAt:
                        previousAssistant.createdAt ||
                        msToIso(backend.created_at),
                });
                const updated = deps.updateMessage(
                    previousAssistant.id,
                    merged,
                    HYDRATE_MUTATION_OPTIONS,
                );
                if (updated) indexBackendIds(updated);
                mergeNextAssistantIntoPrevious = false;
                continue;
            }
        }
        const localMatch = listForSession().find(
            (message) =>
                !message.backendMessageId &&
                !claimedLocalMessageIds.has(message.id) &&
                message.role === role &&
                normalizeContent(message.content) ===
                    normalizeContent(backend.content),
        );
        if (localMatch) {
            claimedLocalMessageIds.add(localMatch.id);
            const updated = deps.updateMessage(
                localMatch.id,
                {
                    ...patch,
                    backendMessageIds: appendBackendId(localMatch, backendID),
                    content: localMatch.content || backend.content,
                    createdAt:
                        localMatch.createdAt || msToIso(backend.created_at),
                },
                HYDRATE_MUTATION_OPTIONS,
            );
            if (updated) indexBackendIds(updated);
            continue;
        }
        const nextMessage = {
            id: `backend_${backendID}`,
            sessionId: session.id,
            role,
            content: backend.content,
            status: 'complete' as const,
            createdAt: msToIso(backend.created_at),
            ...patch,
        };
        const previousAssistant = assistantIndex.findReverse(
            (message) => message.role === 'assistant',
        );
        if (
            role === 'assistant' &&
            shouldMergeAssistantRunMessages(
                previousAssistant,
                nextMessage as ChatMessage,
                mergeNextAssistantIntoPrevious,
            ) &&
            previousAssistant
        ) {
            const updated = deps.updateMessage(
                previousAssistant.id,
                mergeAssistantMessages(
                    previousAssistant,
                    nextMessage as ChatMessage,
                ),
                HYDRATE_MUTATION_OPTIONS,
            );
            if (updated) indexBackendIds(updated);
        } else {
            const added = deps.addMessage(
                nextMessage,
                HYDRATE_MUTATION_OPTIONS,
            );
            indexBackendIds(added);
        }
        mergeNextAssistantIntoPrevious = false;
    }
    deps.touchSession(session.id);
    deps.syncSessionMessageSummary(session.id);
    deps.compactSessionMessages(session.id);
    deps.reindexMessagesFromCache(deps.cache.state.value.messages);
    deps.bumpActiveSessionMessagesView(session.id);
    deps.cache.persistNow();
}
