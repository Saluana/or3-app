import { beforeEach, describe, expect, it } from 'vitest';
import { ref } from 'vue';
import { useChatRuntimeLog } from '../../app/composables/useChatRuntimeLog';
import { createAssistantEventApplier } from '../../app/utils/assistant-stream/event-applier';
import { clearActiveTraceId } from '../../app/utils/logTrace';
import { setDebugLoggingEnabled } from '../../app/utils/logger';
import type {
    ChatActivityEntry,
    ChatMessage,
    ChatMessagePart,
    ChatToolCall,
} from '../../app/types/app-state';

function createApplier() {
    const assistant = ref<ChatMessage>({
        id: 'assistant-1',
        sessionId: 'session-1',
        role: 'assistant',
        content: '',
        status: 'streaming',
        createdAt: '2026-05-14T00:00:00.000Z',
        toolCalls: [],
        parts: [],
        activityLog: [],
        reasoningText: '',
    });

    const upsertPart = (part: ChatMessagePart) => {
        const index = assistant.value.parts.findIndex(
            (item) => item.id === part.id,
        );
        if (index >= 0) assistant.value.parts[index] = part;
        else assistant.value.parts.push(part);
    };

    const upsertActivity = (entry: ChatActivityEntry) => {
        const index = assistant.value.activityLog.findIndex(
            (item) => item.id === entry.id,
        );
        if (index >= 0) assistant.value.activityLog[index] = entry;
        else assistant.value.activityLog.push(entry);
    };

    return createAssistantEventApplier({
        assistantId: assistant.value.id,
        readAssistant: () => assistant.value,
        updateAssistant: (patch) => {
            assistant.value = { ...assistant.value, ...patch };
        },
        appendAssistantContent: (value) => {
            assistant.value.content += value;
        },
        replaceAssistantContent: (value) => {
            assistant.value.content = value;
        },
        upsertPart,
        appendTextPart: (value) => {
            assistant.value.parts.push({
                id: `part-${assistant.value.parts.length + 1}`,
                type: 'text',
                text: value,
                state: 'streaming',
            });
        },
        appendCompleteTextPart: (value) => {
            assistant.value.parts.push({
                id: `part-${assistant.value.parts.length + 1}`,
                type: 'text',
                text: value,
                state: 'complete',
            });
        },
        closeActiveTextPart: () => {
            const activePart = [...assistant.value.parts]
                .reverse()
                .find(
                    (part) =>
                        part.type === 'text' && part.state === 'streaming',
                );
            if (activePart) activePart.state = 'complete';
        },
        hasVisibleTextPart: () =>
            assistant.value.parts.some(
                (part) => part.type === 'text' && Boolean(part.text?.trim()),
            ),
        hasTextPartContent: (content) =>
            assistant.value.parts.some(
                (part) => part.type === 'text' && part.text === content,
            ),
        addActivity: (entry) => {
            assistant.value.activityLog.push(entry);
        },
        upsertActivity,
        updateActivity: (predicate, patch) => {
            assistant.value.activityLog = assistant.value.activityLog.map(
                (entry) => (predicate(entry) ? { ...entry, ...patch } : entry),
            );
        },
        completeRunningActivity: (types) => {
            assistant.value.activityLog = assistant.value.activityLog.map(
                (entry) =>
                    types.includes(entry.type) && entry.status === 'running'
                        ? { ...entry, status: 'complete' }
                        : entry,
            );
        },
        addToolCall: (name, args = '', toolCallId) => {
            assistant.value.toolCalls.push({
                id:
                    toolCallId ||
                    `tool-${assistant.value.toolCalls.length + 1}`,
                name,
                args,
                status: 'pending',
            });
        },
        resolveToolCall: (name, result, error, statusOverride, toolCallId) => {
            assistant.value.toolCalls = assistant.value.toolCalls.map(
                (call) => {
                    const matches = toolCallId
                        ? call.id === toolCallId
                        : call.name === name;
                    if (!matches) return call;
                    return {
                        ...call,
                        result,
                        error,
                        status:
                            statusOverride || (error ? 'error' : 'complete'),
                    } satisfies ChatToolCall;
                },
            );
        },
        findReplayableToolCall: () => undefined,
        setSawVisibleOutput: () => undefined,
        rawAssistantContent: () => assistant.value.content,
    });
}

describe('createAssistantEventApplier', () => {
    beforeEach(() => {
        window.localStorage.clear();
        clearActiveTraceId();
        setDebugLoggingEnabled(true);
        useChatRuntimeLog().clear();
    });

    it('does not emit duplicate-sequence debug logs for snapshot reconciliation', () => {
        const { applyEvent } = createApplier();

        applyEvent(
            {
                event: 'text_delta',
                json: { type: 'text_delta', sequence: 29, delta: 'hello' },
            },
            'stream',
        );
        applyEvent(
            {
                event: 'text_delta',
                json: { type: 'text_delta', sequence: 29, delta: 'hello' },
            },
            'snapshot',
        );

        expect(
            useChatRuntimeLog().entries.value.filter(
                (entry) => entry.event === 'event:skip_sequence',
            ),
        ).toHaveLength(0);
    });

    it('still emits duplicate-sequence debug logs for repeated live events', () => {
        const { applyEvent } = createApplier();

        applyEvent(
            {
                event: 'text_delta',
                json: { type: 'text_delta', sequence: 30, delta: 'hello' },
            },
            'stream',
        );
        applyEvent(
            {
                event: 'text_delta',
                json: { type: 'text_delta', sequence: 30, delta: 'hello' },
            },
            'stream',
        );

        expect(
            useChatRuntimeLog().entries.value.filter(
                (entry) => entry.event === 'event:skip_sequence',
            ),
        ).toHaveLength(1);
    });
});
