import type {
    AssistantReplayToolCall,
    ChatActivityEntry,
    ChatMessage,
    ChatMessagePart,
    ChatToolCall,
} from '~/types/app-state';
import {
    createActivity,
    createToolCall,
    now,
    sanitizeAssistantText,
    truncateLogDetail,
} from '~/utils/assistant-stream/activity';
import { createAssistantEventApplier } from '~/utils/assistant-stream/event-applier';
import { parseStructuredResultPayload } from '~/utils/or3/result-display';
import type { useChatRuntimeLog } from '../useChatRuntimeLog';
import type { useChatSessions } from '../useChatSessions';

type ChatStore = ReturnType<typeof useChatSessions>;
type RuntimeLogStore = ReturnType<typeof useChatRuntimeLog>;

interface UseAssistantMessageStateOptions {
    assistantId: string;
    chat: ChatStore;
    existingAssistant?: ChatMessage | null;
    appendFinalTextToExistingContent?: boolean;
    runtimeLog: RuntimeLogStore;
}

function objectRecord(value: unknown): Record<string, unknown> | null {
    return value && typeof value === 'object' && !Array.isArray(value)
        ? (value as Record<string, unknown>)
        : null;
}

function numberValue(value: unknown) {
    return typeof value === 'number' && Number.isFinite(value) ? value : 0;
}

function compactJson(value: unknown) {
    if (!value || typeof value !== 'object') return undefined;
    return JSON.stringify(value);
}

function stableHash(value: string) {
    let hash = 2166136261;
    for (let index = 0; index < value.length; index++) {
        hash ^= value.charCodeAt(index);
        hash = Math.imul(hash, 16777619);
    }
    return (hash >>> 0).toString(36);
}

function stableToolCallId(name: string, args?: string, toolCallId?: string) {
    const explicit = toolCallId?.trim();
    if (explicit) return `tool:${explicit}`;
    return `tool:legacy:${stableHash(`${name}\u0000${args ?? ''}`)}`;
}

export function useAssistantMessageState(
    options: UseAssistantMessageStateOptions,
) {
    const initialAssistant =
        options.existingAssistant ??
        options.chat.findMessageById(options.assistantId) ??
        null;
    let assistantDraft: ChatMessage | null = initialAssistant
        ? {
              ...initialAssistant,
              toolCalls: initialAssistant.toolCalls
                  ? [...initialAssistant.toolCalls]
                  : undefined,
              parts: initialAssistant.parts
                  ? [...initialAssistant.parts]
                  : undefined,
              activityLog: initialAssistant.activityLog
                  ? [...initialAssistant.activityLog]
                  : undefined,
          }
        : null;
    let pendingAssistantPatch: Partial<ChatMessage> | null = null;
    let scheduledFrame: number | null = null;
    let scheduledMicrotask = false;
    let rawAssistantContent = options.existingAssistant?.content || '';
    let activeTextPartId: string | null = null;
    let activeTextPartRaw = '';
    let textPartIndex =
        options.existingAssistant?.parts?.filter((part) => part.type === 'text')
            .length ?? 0;
    let sawVisibleOutput = Boolean(
        sanitizeAssistantText(options.existingAssistant?.content || '') ||
        options.existingAssistant?.parts?.some(
            (part) =>
                part.type === 'text' &&
                Boolean(sanitizeAssistantText(part.content ?? '')),
        ),
    );

    const commitAssistantPatch = () => {
        if (
            scheduledFrame !== null &&
            typeof cancelAnimationFrame === 'function'
        ) {
            cancelAnimationFrame(scheduledFrame);
        }
        scheduledFrame = null;
        scheduledMicrotask = false;
        if (!pendingAssistantPatch) return;
        const target = options.chat.findMessageById(options.assistantId);
        if (target) {
            options.chat.updateMessageRecord(target, pendingAssistantPatch, {
                persist: false,
                touch: false,
                syncSummary: false,
            });
        }
        pendingAssistantPatch = null;
    };
    const scheduleAssistantCommit = () => {
        if (typeof requestAnimationFrame === 'function') {
            if (scheduledFrame !== null) return;
            scheduledFrame = requestAnimationFrame(commitAssistantPatch);
            return;
        }
        if (scheduledMicrotask) return;
        scheduledMicrotask = true;
        queueMicrotask(commitAssistantPatch);
    };
    const readAssistant = () => assistantDraft ?? undefined;
    const updateAssistant = (
        patch: Parameters<ChatStore['updateMessage']>[1],
    ) => {
        const current = readAssistant();
        if (!current) return;
        assistantDraft = { ...current, ...patch };
        pendingAssistantPatch = {
            ...(pendingAssistantPatch ?? {}),
            ...patch,
        };
        scheduleAssistantCommit();
    };
    const appendAssistantContent = (value: string) => {
        rawAssistantContent += value;
        updateAssistant({
            content: sanitizeAssistantText(rawAssistantContent),
        });
    };
    const replaceAssistantContent = (value: string) => {
        rawAssistantContent = value;
        const content = sanitizeAssistantText(rawAssistantContent);
        const current = readAssistant();
        if (!content) {
            updateAssistant({ content });
            return;
        }
        updateAssistant({
            content,
            parts: mergeReplacementTextIntoParts(
                current?.parts,
                content,
                current?.content,
            ),
        });
    };
    const upsertPart = (part: ChatMessagePart) => {
        const current = readAssistant();
        const parts = [...(current?.parts ?? [])];
        const index = parts.findIndex((item) => item.id === part.id);
        if (index === -1) {
            const legacyIndex =
                part.type === 'tool' &&
                part.toolCallId &&
                !part.toolCallId.startsWith('legacy:')
                    ? parts.findIndex(
                          (item) =>
                              item.type === 'tool' &&
                              item.id.startsWith('tool:legacy:') &&
                              item.name === part.name &&
                              (part.argumentsPreview === undefined ||
                                  item.argumentsPreview ===
                                      part.argumentsPreview) &&
                              (item.status === 'running' ||
                                  item.status === 'attention'),
                      )
                    : -1;
            if (legacyIndex !== -1) {
                parts[legacyIndex] = {
                    ...parts[legacyIndex],
                    ...part,
                };
                updateAssistant({ parts });
                return;
            }
            parts.push(part);
        } else {
            parts[index] = { ...parts[index], ...part };
        }
        updateAssistant({ parts });
    };
    const hasVisibleTextPart = () =>
        Boolean(
            readAssistant()?.parts?.some(
                (part) => part.type === 'text' && part.content?.trim(),
            ),
        );
    const textPartsContentFromParts = (parts: ChatMessagePart[] | undefined) =>
        sanitizeAssistantText(
            (parts ?? [])
                .filter((part) => part.type === 'text')
                .map((part) => part.content ?? '')
                .join(''),
        );
    const textPartsContent = (assistant: ChatMessage | null | undefined) =>
        textPartsContentFromParts(assistant?.parts);

    const hasTextPartContent = (content: string) => {
        const normalized = sanitizeAssistantText(content);
        if (!normalized) return false;
        const assistant = readAssistant();
        if (!assistant) return false;
        if (sanitizeAssistantText(assistant.content ?? '') === normalized) {
            return true;
        }
        if (textPartsContent(assistant) === normalized) {
            return true;
        }
        return Boolean(
            assistant.parts?.some(
                (part) =>
                    part.type === 'text' &&
                    sanitizeAssistantText(part.content ?? '') === normalized,
            ),
        );
    };

    const nextTextPartId = () => {
        textPartIndex += 1;
        return `text:${textPartIndex}`;
    };
    const replacementTextPart = (
        content: string,
        existingId?: string,
    ): ChatMessagePart => ({
        id: existingId ?? nextTextPartId(),
        type: 'text',
        content,
    });
    const mergeReplacementTextIntoParts = (
        parts: ChatMessagePart[] | undefined,
        content: string,
        existingContent?: string,
    ) => {
        const normalized = sanitizeAssistantText(content);
        const existingParts = parts ?? [];
        const toolParts = existingParts.filter((part) => part.type === 'tool');
        if (!normalized) return toolParts.length ? toolParts : undefined;

        const firstTextPart = existingParts.find(
            (part) => part.type === 'text',
        );
        if (!toolParts.length) {
            return [replacementTextPart(normalized, firstTextPart?.id)];
        }
        if (
            sanitizeAssistantText(existingContent ?? '') === normalized &&
            existingParts.some((part) => part.type === 'text')
        ) {
            return existingParts;
        }

        const existingText = textPartsContentFromParts(existingParts);
        if (existingText === normalized) return existingParts;
        if (existingText && normalized.startsWith(existingText)) {
            const suffix = normalized.slice(existingText.length);
            if (!suffix) return existingParts;
            const reversedTextIndex = [...existingParts]
                .reverse()
                .findIndex((part) => part.type === 'text');
            if (reversedTextIndex === -1) {
                return [...existingParts, replacementTextPart(normalized)];
            }
            const index = existingParts.length - 1 - reversedTextIndex;
            return existingParts.map((part, itemIndex) =>
                itemIndex === index && part.type === 'text'
                    ? { ...part, content: `${part.content ?? ''}${suffix}` }
                    : part,
            );
        }

        return [
            ...existingParts.filter((part) => part.type !== 'text'),
            replacementTextPart(normalized, firstTextPart?.id),
        ];
    };
    const closeActiveTextPart = () => {
        activeTextPartId = null;
        activeTextPartRaw = '';
    };
    const ensureActiveTextPart = () => {
        if (activeTextPartId) return activeTextPartId;
        activeTextPartId = nextTextPartId();
        activeTextPartRaw = '';
        return activeTextPartId;
    };
    const appendTextPart = (value: string) => {
        const partId = ensureActiveTextPart();
        activeTextPartRaw += value;
        const content = sanitizeAssistantText(activeTextPartRaw);
        if (!content) return;
        upsertPart({
            id: partId,
            type: 'text',
            content,
        });
    };
    const appendCompleteTextPart = (value: string) => {
        if (hasTextPartContent(value)) return;
        const normalized = sanitizeAssistantText(value);
        if (!normalized) return;
        closeActiveTextPart();
        const current = readAssistant();
        updateAssistant({
            parts: mergeReplacementTextIntoParts(current?.parts, normalized),
        });
        closeActiveTextPart();
    };
    const setToolCalls = (toolCalls: ChatToolCall[]) =>
        updateAssistant({ toolCalls });
    const addActivity = (entry: ChatActivityEntry) => {
        const current = readAssistant();
        updateAssistant({
            activityLog: [...(current?.activityLog ?? []), entry].slice(-30),
        });
    };
    const upsertActivity = (entry: ChatActivityEntry) => {
        const current = readAssistant();
        const activityLog = [...(current?.activityLog ?? [])];
        const index = activityLog.findIndex((item) => item.id === entry.id);
        if (index === -1) {
            updateAssistant({
                activityLog: [...activityLog, entry].slice(-30),
            });
            return;
        }
        const existing = activityLog[index];
        activityLog[index] = {
            ...existing,
            ...entry,
            detail: entry.detail || existing?.detail,
            createdAt: existing?.createdAt || entry.createdAt,
        };
        updateAssistant({ activityLog });
    };
    const updateActivity = (
        predicate: (entry: ChatActivityEntry) => boolean,
        patch: Partial<ChatActivityEntry>,
    ) => {
        const current = readAssistant();
        const activityLog = current?.activityLog;
        if (!activityLog?.length) return;
        updateAssistant({
            activityLog: activityLog.map((entry) =>
                predicate(entry) ? { ...entry, ...patch } : entry,
            ),
        });
    };
    const completeRunningActivity = (types: string[]) => {
        updateActivity(
            (entry) => types.includes(entry.type) && entry.status === 'running',
            { status: 'complete' },
        );
    };
    const addToolCall = (name: string, args?: string, toolCallId?: string) => {
        const current = readAssistant();
        const id = stableToolCallId(name, args, toolCallId);
        const hasExplicitId = Boolean(toolCallId?.trim());
        const existingCalls = [...(current?.toolCalls ?? [])];
        const existing = current?.toolCalls?.find(
            (call) =>
                call.id === id ||
                (call.name === name &&
                    call.status === 'running' &&
                    (args === undefined || call.arguments === args)),
        );
        if (existing) return;
        if (hasExplicitId) {
            const legacyIndex = existingCalls.findIndex(
                (call) =>
                    call.id.startsWith('tool:legacy:') &&
                    call.name === name &&
                    (args === undefined || call.arguments === args) &&
                    (call.status === 'running' || call.status === 'attention'),
            );
            if (legacyIndex !== -1) {
                const legacyCall = existingCalls[legacyIndex];
                if (!legacyCall) return;
                existingCalls[legacyIndex] = {
                    ...legacyCall,
                    id,
                    arguments: args ?? legacyCall.arguments,
                    status: 'running',
                };
                setToolCalls(existingCalls);
                options.runtimeLog.add('tool', 'call:merge_legacy', undefined, {
                    toolCallId: id,
                    name,
                });
                return;
            }
        }
        const toolCalls = [
            ...(current?.toolCalls ?? []),
            createToolCall(name, args, id),
        ];
        setToolCalls(toolCalls);
        upsertActivity(
            createActivity(
                'tool_call',
                `Tool call: ${name}`,
                args ? truncateLogDetail(args) : undefined,
                'running',
                `activity:${id}:call`,
            ),
        );
        options.runtimeLog.add('tool', 'call:upsert', undefined, {
            toolCallId: id,
            name,
        });
    };
    const resolveToolCall = (
        name: string,
        result?: string,
        error?: string,
        statusOverride?: ChatToolCall['status'],
        toolCallId?: string,
    ) => {
        const current = readAssistant();
        const toolCalls = [...(current?.toolCalls ?? [])];
        const id = stableToolCallId(name, undefined, toolCallId);
        const status: ChatToolCall['status'] =
            statusOverride || (error ? 'error' : 'complete');
        const explicitIndex = toolCalls.findIndex((call) => call.id === id);
        const hasExplicitId = Boolean(toolCallId?.trim());
        const legacyIndex =
            explicitIndex === -1 && hasExplicitId
                ? toolCalls.findIndex(
                      (call) =>
                          call.id.startsWith('tool:legacy:') &&
                          call.name === name &&
                          (call.status === 'running' ||
                              call.status === 'attention'),
                  )
                : -1;
        const targetIndex =
            explicitIndex === -1 && legacyIndex === -1
                ? [...toolCalls]
                      .reverse()
                      .findIndex(
                          (call) =>
                              call.name === name && call.status === 'running',
                      )
                : -1;
        const resolvedIndex =
            explicitIndex !== -1
                ? explicitIndex
                : legacyIndex !== -1
                  ? legacyIndex
                  : targetIndex === -1
                    ? -1
                    : toolCalls.length - 1 - targetIndex;
        if (resolvedIndex === -1) {
            const existingCompletedIndex = toolCalls.findIndex(
                (call) =>
                    call.id === id ||
                    (call.name === name &&
                        call.status !== 'running' &&
                        call.result === result &&
                        call.error === error),
            );
            if (existingCompletedIndex !== -1) return;
            toolCalls.push({
                ...createToolCall(name, undefined, id),
                status,
                result,
                error,
                completedAt: now(),
            });
        } else {
            const call = toolCalls[resolvedIndex];
            if (call) {
                toolCalls[resolvedIndex] = {
                    ...call,
                    id: hasExplicitId ? id : call.id,
                    status,
                    result: result ?? call.result,
                    error: error ?? call.error,
                    completedAt: now(),
                };
            }
        }
        setToolCalls(toolCalls);
        updateActivity(
            (entry) =>
                entry.id === `activity:${id}:call` ||
                (entry.type === 'tool_call' &&
                    entry.status === 'running' &&
                    entry.label === `Tool call: ${name}`),
            { status },
        );
        upsertActivity(
            createActivity(
                'tool_result',
                `Tool result: ${name}`,
                error || (result ? truncateLogDetail(result) : undefined),
                status,
                `activity:${id}:result`,
            ),
        );
        options.runtimeLog.add('tool', 'result:upsert', undefined, {
            toolCallId: id,
            name,
            status,
        });
    };
    const applyRunnerStructuredResult = (
        value?: string | null,
        runnerId?: string,
    ) => {
        const payload = parseStructuredResultPayload(value);
        if (!payload) return;

        const stats = objectRecord(payload.stats);
        const modelStats = objectRecord(stats?.models);
        const tools = objectRecord(stats?.tools);
        const toolsByName = objectRecord(tools?.byName);

        if (modelStats && Object.keys(modelStats).length) {
            const details = Object.entries(modelStats)
                .map(([model, entry]) => {
                    const record = objectRecord(entry);
                    const api = objectRecord(record?.api);
                    const tokens = objectRecord(record?.tokens);
                    const requests = numberValue(api?.totalRequests);
                    const errors = numberValue(api?.totalErrors);
                    const totalTokens = numberValue(tokens?.total);
                    return `${model}: ${requests} request${requests === 1 ? '' : 's'}, ${errors} error${errors === 1 ? '' : 's'}, ${totalTokens.toLocaleString()} tokens`;
                })
                .join('\n');
            addActivity(
                createActivity(
                    'runner_stats',
                    `${runnerId === 'gemini' ? 'Gemini' : 'Runner'} model usage`,
                    details || undefined,
                    'complete',
                ),
            );
        }

        if (!toolsByName) return;

        const current = readAssistant();
        const existing = current?.toolCalls ?? [];
        const nextToolCalls = [...existing];

        for (const [name, entry] of Object.entries(toolsByName)) {
            const record = objectRecord(entry);
            if (!record) continue;
            const failCount = numberValue(record.fail);
            const successCount = numberValue(record.success);
            const count = numberValue(record.count);
            const status: ChatToolCall['status'] =
                failCount > 0 ? 'error' : 'complete';
            const args = compactJson({
                calls: count,
                decisions: record.decisions,
            });
            const result =
                status === 'complete'
                    ? `${successCount || count} successful call${(successCount || count) === 1 ? '' : 's'}`
                    : undefined;
            const error =
                status === 'error'
                    ? `${failCount} failed call${failCount === 1 ? '' : 's'}`
                    : undefined;
            const id = `runner-tool:${runnerId || 'runner'}:${name}`;
            const existingIndex = nextToolCalls.findIndex(
                (call) => call.id === id,
            );
            const call: ChatToolCall = {
                id,
                name,
                status,
                arguments: args,
                result,
                error,
                startedAt: now(),
                completedAt: now(),
            };
            if (existingIndex === -1) {
                nextToolCalls.push(call);
            } else {
                nextToolCalls[existingIndex] = {
                    ...nextToolCalls[existingIndex],
                    ...call,
                };
            }
            addActivity(
                createActivity(
                    'tool_result',
                    `Tool result: ${name}`,
                    error || result,
                    status,
                ),
            );
        }

        setToolCalls(nextToolCalls);
    };
    const findReplayableToolCall = (
        name: string,
    ): AssistantReplayToolCall | undefined => {
        const current = readAssistant();
        const match = [...(current?.toolCalls ?? [])]
            .reverse()
            .find((call) => call.name === name);
        if (!match) return undefined;
        return { name: match.name, arguments: match.arguments };
    };
    const { applyEvent, applyFinalText } = createAssistantEventApplier({
        assistantId: options.assistantId,
        readAssistant,
        updateAssistant,
        appendAssistantContent,
        replaceAssistantContent,
        upsertPart,
        appendTextPart,
        appendCompleteTextPart,
        closeActiveTextPart,
        hasVisibleTextPart,
        hasTextPartContent,
        addActivity,
        upsertActivity,
        updateActivity,
        completeRunningActivity,
        addToolCall,
        resolveToolCall,
        findReplayableToolCall,
        setSawVisibleOutput(value) {
            sawVisibleOutput = value;
        },
        appendFinalTextToExistingContent:
            options.appendFinalTextToExistingContent,
        rawAssistantContent: () => rawAssistantContent,
    });

    return {
        executionState: {
            readAssistant,
            updateAssistant,
            updateActivity,
            completeRunningActivity,
            addActivity,
            applyEvent,
            applyFinalText,
            appendFinalTextToExistingContent:
                options.appendFinalTextToExistingContent,
            replaceAssistantContent,
            appendCompleteTextPart,
            sawVisibleOutput: () => sawVisibleOutput,
            setSawVisibleOutput(value: boolean) {
                sawVisibleOutput = value;
            },
            sanitizeAssistantText,
            applyRunnerStructuredResult,
            flushAssistantUpdates: commitAssistantPatch,
        },
    };
}
