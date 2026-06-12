import { beforeEach, describe, expect, it } from 'vitest';
import { ref } from 'vue';
import { useChatRuntimeLog } from '../../app/composables/useChatRuntimeLog';
import { createAssistantEventApplier } from '../../app/utils/assistant-stream/event-applier';
import { EMPTY_FINAL_USER_MESSAGE } from '../../app/utils/assistant-stream/userErrorCopy';
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

    const applier = createAssistantEventApplier({
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
                content: value,
            });
        },
        appendCompleteTextPart: (value) => {
            assistant.value.parts.push({
                id: `part-${assistant.value.parts.length + 1}`,
                type: 'text',
                content: value,
            });
        },
        closeActiveTextPart: () => undefined,
        hasVisibleTextPart: () =>
            assistant.value.parts.some(
                (part) => part.type === 'text' && Boolean(part.content?.trim()),
            ),
        hasTextPartContent: (content) =>
            assistant.value.parts.some(
                (part) => part.type === 'text' && part.content === content,
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
        setSawVisibleOutput: () => undefined,
        rawAssistantContent: () => assistant.value.content,
    });

    return {
        assistant,
        ...applier,
    };
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

    it('preserves streamed assistant text when a terminal runner failure follows', () => {
        const { applyEvent, assistant } = createApplier();

        applyEvent(
            {
                event: 'text_delta',
                json: {
                    type: 'text_delta',
                    sequence: 1,
                    delta: 'Hey whatsup?',
                },
            },
            'stream',
        );
        applyEvent(
            {
                event: 'completion',
                json: {
                    type: 'completion',
                    sequence: 2,
                    status: 'failed',
                    error_message:
                        'Codex authentication failed while refreshing its login token. Run `codex login` to reconnect Codex, then retry the runner turn.',
                },
            },
            'stream',
        );

        expect(assistant.value.content).toBe('Hey whatsup?');
        expect(assistant.value.status).toBe('failed');
        expect(assistant.value.error).toContain('codex login');
    });

    it('reuses finalizing completion activity and resolves it on final text', () => {
        const { applyEvent, assistant } = createApplier();

        assistant.value.activityLog.push({
            id: 'tool-1',
            type: 'tool_call',
            label: 'Web search',
            detail: 'Searching docs',
            status: 'running',
            createdAt: '2026-05-14T00:00:00.000Z',
        });

        applyEvent(
            {
                event: 'completed',
                json: {
                    type: 'completed',
                    sequence: 31,
                    status: 'completed',
                    job_id: 'job-1',
                    final_text: '',
                },
            },
            'stream',
        );
        applyEvent(
            {
                event: 'completed',
                json: {
                    type: 'completed',
                    sequence: 32,
                    status: 'completed',
                    job_id: 'job-1',
                    final_text: '',
                },
            },
            'stream',
        );

        let completionEntries = assistant.value.activityLog.filter(
            (entry) => entry.type === 'completion',
        );
        expect(completionEntries).toHaveLength(1);
        expect(completionEntries[0]).toMatchObject({
            label: 'Finalizing response',
            status: 'running',
        });

        applyEvent(
            {
                event: 'completed',
                json: {
                    type: 'completed',
                    sequence: 33,
                    status: 'completed',
                    job_id: 'job-1',
                    final_text: 'All done.',
                },
            },
            'stream',
        );

        completionEntries = assistant.value.activityLog.filter(
            (entry) => entry.type === 'completion',
        );
        expect(completionEntries).toHaveLength(1);
        expect(completionEntries[0]).toMatchObject({
            label: 'Completed turn',
            status: 'complete',
        });
    });

    it('keeps raw output events out of assistant prose', () => {
        const { applyEvent, assistant } = createApplier();

        applyEvent({
            event: 'output',
            json: {
                type: 'output',
                stream: 'stdout',
                content: 'running lots of logs\n',
            },
        });

        expect(assistant.value.content).toBe('');
        expect(assistant.value.parts).toHaveLength(0);
        expect(assistant.value.activityLog).toHaveLength(1);
        expect(assistant.value.activityLog[0]).toMatchObject({
            type: 'runner_output',
            label: 'Runner output',
        });
    });

    it('removes the empty-final warning when a late final text event arrives', () => {
        const { applyEvent, assistant } = createApplier();
        const warning = EMPTY_FINAL_USER_MESSAGE;
        assistant.value.content = warning;
        assistant.value.status = 'attention';
        assistant.value.error =
            'or3-intern completed without a final assistant message.';
        assistant.value.errorCode = 'empty_final_text';
        assistant.value.parts = [
            {
                id: 'part-warning',
                type: 'text',
                content: warning,
            },
        ];

        applyEvent(
            {
                event: 'done',
                json: {
                    type: 'done',
                    sequence: 40,
                    status: 'completed',
                    job_id: 'job-2',
                    final_text: 'Recovered answer.',
                },
            },
            'stream',
        );
        applyEvent(
            {
                event: 'done',
                json: {
                    type: 'done',
                    sequence: 41,
                    status: 'completed',
                    job_id: 'job-2',
                    final_text: 'Recovered answer.',
                },
            },
            'stream',
        );

        expect(assistant.value.content).toBe('Recovered answer.');
        expect(assistant.value.error).toBeUndefined();
        expect(assistant.value.errorCode).toBeUndefined();
        expect(assistant.value.parts).toEqual([
            {
                id: 'part-1',
                type: 'text',
                content: 'Recovered answer.',
            },
        ]);
    });

    it('keeps streamed assistant text when final_text adds a reasoning prefix', () => {
        const { applyEvent, assistant } = createApplier();
        const streamed = 'I can help with code.';

        applyEvent(
            {
                event: 'text_delta',
                json: {
                    type: 'text_delta',
                    sequence: 1,
                    text: streamed,
                    delta: streamed,
                },
            },
            'stream',
        );
        applyEvent(
            {
                event: 'completion',
                json: {
                    type: 'completion',
                    sequence: 2,
                    status: 'completed',
                    final_text:
                        'The user wants help with code.I can help with code.',
                },
            },
            'stream',
        );

        expect(assistant.value.content).toBe(streamed);
    });

    it('routes reasoning_delta payloads with delta text to reasoningText', () => {
        const { applyEvent, assistant } = createApplier();

        applyEvent(
            {
                event: 'reasoning_delta',
                json: {
                    type: 'content.delta',
                    sequence: 3,
                    stream_kind: 'reasoning_text',
                    delta: 'The user wants a brief overview.',
                    text: 'The user wants a brief overview.',
                },
            },
            'stream',
        );

        expect(assistant.value.reasoningText).toBe(
            'The user wants a brief overview.',
        );
        expect(assistant.value.content).toBe('');
    });

    it('does not fail the turn on runtime_error events', () => {
        const { applyEvent, assistant } = createApplier();

        applyEvent(
            {
                event: 'runtime_error',
                json: {
                    type: 'runtime_error',
                    message: 'job failed',
                    status: 'failed',
                },
            },
            'stream',
        );

        expect(assistant.value.status).toBe('streaming');
        expect(assistant.value.content).toBe('');
        expect(assistant.value.activityLog).toHaveLength(1);
        expect(assistant.value.activityLog[0]?.type).toBe('runtime_error');
    });

    it('maps native runner observability events into activity entries', () => {
        const { applyEvent, assistant } = createApplier();

        for (const json of [
            {
                type: 'config.warning',
                message: 'OpenAI key missing',
            },
            {
                type: 'model.reroute',
                from: 'gpt-5',
                to: 'gpt-5-mini',
            },
            {
                type: 'skill.invoked',
                name: 'code-review',
            },
            {
                type: 'token.usage',
                usage: {
                    input_tokens: 10,
                    output_tokens: 5,
                    total_tokens: 15,
                },
            },
            {
                type: 'approval_response',
                route: 'native',
                native_continued: true,
            },
        ]) {
            applyEvent({ event: String(json.type), json }, 'stream');
        }

        expect(assistant.value.activityLog.map((entry) => entry.type)).toEqual([
            'config_warning',
            'model_reroute',
            'skill_invoked',
            'token_usage',
            'approval_response',
        ]);
        expect(assistant.value.activityLog[1]?.label).toBe(
            'Switched model to gpt-5-mini',
        );
        expect(assistant.value.activityLog[4]?.label).toBe(
            'Approval accepted; runner resumed',
        );
    });

    it('does not fail the turn when an individual tool_result fails', () => {
        const { applyEvent, assistant } = createApplier();

        applyEvent(
            {
                event: 'tool_result',
                json: {
                    name: 'write_file',
                    tool_call_id: 'call_write',
                    status: 'failed',
                    result: JSON.stringify({
                        ok: false,
                        summary: 'write_file failed',
                    }),
                },
            },
            'stream',
        );

        expect(assistant.value.status).toBe('streaming');
        expect(assistant.value.content).not.toContain('job failed');
    });

    it('fails the turn on terminal job error events', () => {
        const { applyEvent, assistant } = createApplier();

        applyEvent(
            {
                event: 'error',
                json: {
                    type: 'error',
                    status: 'failed',
                    message: 'job failed',
                },
            },
            'stream',
        );

        expect(assistant.value.status).toBe('failed');
        expect(assistant.value.content).toContain('job failed');
    });

    it('uses prior runtime error detail when terminal error is generic', () => {
        const { applyEvent, assistant } = createApplier();

        applyEvent(
            {
                event: 'runtime_error',
                json: {
                    type: 'runtime_error',
                    message:
                        'provider stream read error: context deadline exceeded',
                    public_code: 'stream_error',
                },
            },
            'stream',
        );
        applyEvent(
            {
                event: 'error',
                json: {
                    type: 'error',
                    status: 'failed',
                    message: 'job failed',
                },
            },
            'stream',
        );

        expect(assistant.value.status).toBe('failed');
        expect(assistant.value.content).toContain(
            'provider stream read error: context deadline exceeded',
        );
    });

    it('marks tool_result failed lifecycle events as errors', () => {
        const { assistant, applyEvent } = createApplier();

        applyEvent(
            {
                event: 'tool_call',
                json: {
                    name: 'write_file',
                    tool_call_id: 'call_write',
                    arguments: '{"path":"test.md"}',
                },
            },
            'stream',
        );
        applyEvent(
            {
                event: 'tool_result',
                json: {
                    name: 'write_file',
                    tool_call_id: 'call_write',
                    status: 'failed',
                    result: JSON.stringify({
                        ok: false,
                        summary:
                            'write_file failed: tool not available in this turn',
                    }),
                },
            },
            'stream',
        );

        const toolPart = assistant.value.parts?.find(
            (part) => part.type === 'tool',
        );
        expect(toolPart?.status).toBe('error');
        expect(assistant.value.toolCalls[0]?.status).toBe('error');
    });
});
