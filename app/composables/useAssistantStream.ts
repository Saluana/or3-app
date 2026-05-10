import { ref, watch } from 'vue';
import type { ToolPolicy } from '~/types/or3-api';
import type {
    AssistantSendPayload,
    AssistantReplayToolCall,
    ChatActivityEntry,
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
import {
    pendingApprovalPlaceholderContent,
} from '~/utils/assistant-stream/approval';
import { createAssistantEventApplier } from '~/utils/assistant-stream/event-applier';
import { downgradeToolPolicyForServiceCapability } from '~/utils/assistant-stream/errors';
import {
    fetchAndApplyJobSnapshot,
    handleRunnerExecutionError,
    recoverDirectExecutionError,
    streamDirectTurn,
    streamFollowJob,
    streamFollowRunnerTurn,
    streamRunnerChat,
} from '~/utils/assistant-stream/execution';
import { normalizeTurnEvent } from '~/utils/assistant-stream/events';
import { normalizeApprovalRequest } from '~/utils/or3/approvals';
import { normalizePayload, retryPayloadForStorage } from '~/utils/assistant-stream/payload';
import { parseStructuredResultPayload } from '~/utils/or3/result-display';
import { useChatSessions } from './useChatSessions';
import { useActiveHost } from './useActiveHost';
import { useLocalCache } from './useLocalCache';
import { useOr3Api } from './useOr3Api';

const isStreaming = ref(false);
const activeJobId = ref<string | null>(null);
const chatMode = ref<'ask' | 'work' | 'admin'>('work');
const serviceCapabilityCeilingHosts = new Set<string>();
let controller: AbortController | null = null;
let recoveryWatcherInstalled = false;
let approvalHydrationWatcherInstalled = false;
const recoveryAttempted = new Set<string>();
const approvalHydrationInFlight = new Set<string>();

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

function rememberServiceCapabilityCeilingHost(hostId?: string | null) {
    const normalized = hostId?.trim();
    if (!normalized) return;
    serviceCapabilityCeilingHosts.add(normalized);
}

function shouldPreemptivelyDowngradeToolPolicy(hostId?: string | null) {
    const normalized = hostId?.trim();
    if (!normalized) return false;
    return serviceCapabilityCeilingHosts.has(normalized);
}

export function modeToolPolicy(
    mode?: AssistantSendPayload['mode'],
): ToolPolicy {
    return { mode: mode || chatMode.value || 'work' };
}
export { normalizeTurnEvent };
export type { NormalizedTurnEvent } from '~/utils/assistant-stream/events';

export function useAssistantStream() {
    const api = useOr3Api();
    const chat = useChatSessions();
    const cache = useLocalCache();
    const { activeHost } = useActiveHost();
    const toast = useToast();

    const recoverPendingMessages = async () => {
        if (!import.meta.client || isStreaming.value) return;
        const hostId = activeHost.value?.id?.trim();
        const authToken = activeHost.value?.token?.trim();
        if (!hostId || !authToken) return;

        const sessionIds = new Set(
            cache.state.value.sessions
                .filter((session) => session.hostId === hostId)
                .map((session) => session.id),
        );
        if (!sessionIds.size) return;

        const pendingMessage = [...cache.state.value.messages]
            .filter(
                (message) =>
                    message.role === 'assistant' &&
                    message.status === 'streaming' &&
                    (Boolean(message.jobId) ||
                        Boolean(message.runnerChatTurnId)) &&
                    sessionIds.has(message.sessionId),
            )
            .sort(
                (left, right) =>
                    Date.parse(left.createdAt || '') -
                    Date.parse(right.createdAt || ''),
            )[0];

        if (!pendingMessage?.jobId && !pendingMessage?.runnerChatTurnId) return;

        const recoveryKey = `${hostId}:${pendingMessage.id}:${pendingMessage.jobId || pendingMessage.runnerChatTurnId}`;
        if (recoveryAttempted.has(recoveryKey)) return;

        recoveryAttempted.add(recoveryKey);
        try {
            await send({
                ...(pendingMessage.retryPayload ?? {
                    text: pendingMessage.content,
                    transportText: pendingMessage.content,
                }),
                text:
                    pendingMessage.retryPayload?.text || pendingMessage.content,
                transportText:
                    pendingMessage.retryPayload?.transportText ||
                    pendingMessage.retryPayload?.text ||
                    pendingMessage.content,
                attachments: pendingMessage.retryPayload?.attachments || [],
                followJobId: pendingMessage.jobId,
                continueMessageId: pendingMessage.id,
                suppressUserEcho: true,
                runnerChatSessionId: pendingMessage.runnerChatSessionId,
                runnerChatTurnId: pendingMessage.runnerChatTurnId,
                runnerId: pendingMessage.runnerId,
            });
        } finally {
            recoveryAttempted.delete(recoveryKey);
            if (!isStreaming.value) {
                queueMicrotask(() => {
                    void recoverPendingMessages();
                });
            }
        }
    };

    const hydratePendingApprovalsForActiveSession = async () => {
        if (!import.meta.client || isStreaming.value) return;
        const hostId = activeHost.value?.id?.trim();
        const authToken = activeHost.value?.token?.trim();
        const sessionKey = chat.activeSession.value?.sessionKey?.trim();
        if (!hostId || !authToken || !sessionKey) return;

        const hydrationKey = `${hostId}:${sessionKey}`;
        if (approvalHydrationInFlight.has(hydrationKey)) return;

        approvalHydrationInFlight.add(hydrationKey);
        try {
            const response = await api.request<{ items: unknown[] }>(
                '/internal/v1/approvals?status=pending',
            );
            const approvals = (response.items ?? [])
                .map(normalizeApprovalRequest)
                .filter(
                    (approval) =>
                        approval.requester_session_id?.trim() === sessionKey,
                );

            for (const approval of approvals) {
                if (
                    chat.findAssistantMessageForApproval(
                        approval.id,
                        sessionKey,
                    )
                ) {
                    continue;
                }
                chat.ensureApprovalMessage({
                    approvalRequestId: approval.id,
                    sessionKey,
                    content: pendingApprovalPlaceholderContent(approval),
                    createdAt: approval.created_at,
                    status: 'attention',
                    approvalState: 'pending',
                });
            }
        } catch {
            // Ignore opportunistic hydration failures; the approvals view remains the fallback.
        } finally {
            approvalHydrationInFlight.delete(hydrationKey);
        }
    };

    if (import.meta.client && !recoveryWatcherInstalled) {
        recoveryWatcherInstalled = true;
        watch(
            () => {
                const hostId = activeHost.value?.id ?? '';
                const tokenState = activeHost.value?.token ? 'ready' : 'none';
                const sessionIds = new Set(
                    cache.state.value.sessions
                        .filter((session) => session.hostId === hostId)
                        .map((session) => session.id),
                );
                const pending = cache.state.value.messages
                    .filter(
                        (message) =>
                            message.role === 'assistant' &&
                            message.status === 'streaming' &&
                            (Boolean(message.jobId) ||
                                Boolean(message.runnerChatTurnId)) &&
                            sessionIds.has(message.sessionId),
                    )
                    .map(
                        (message) =>
                            `${message.id}:${message.jobId || message.runnerChatTurnId}:${message.status}`,
                    )
                    .join('|');
                return `${hostId}:${tokenState}:${pending}`;
            },
            () => {
                void recoverPendingMessages();
            },
            { immediate: true },
        );
    }

    if (import.meta.client && !approvalHydrationWatcherInstalled) {
        approvalHydrationWatcherInstalled = true;
        watch(
            () => ({
                hostId: activeHost.value?.id ?? '',
                token: activeHost.value?.token ? 'ready' : 'none',
                sessionKey: chat.activeSession.value?.sessionKey ?? '',
                streaming: isStreaming.value,
            }),
            () => {
                void hydratePendingApprovalsForActiveSession();
            },
            { immediate: true },
        );
    }

    async function send(message: string | AssistantSendPayload) {
        const payload = normalizePayload(message);
        const followJobId = payload.followJobId?.trim() || '';
        const followRunnerTurnId = payload.runnerChatTurnId?.trim() || '';
        const text = payload.transportText || payload.text;
        if ((!text && !followJobId && !followRunnerTurnId) || isStreaming.value)
            return;

        const storedRetryPayload = retryPayloadForStorage(payload);

        const session = chat.ensureSession();
        if (!payload.suppressUserEcho) {
            chat.addMessage({
                sessionId: session.id,
                role: 'user',
                content: payload.text,
                attachments: payload.attachments,
                status: 'complete',
                runnerId: payload.runnerId ?? session.runnerId,
                runnerLabel: payload.runnerLabel ?? session.runnerLabel,
                runnerChatSessionId:
                    payload.runnerChatSessionId ?? session.runnerChatSessionId,
                sourceSessionKey: session.sessionKey,
            });
        }
        const existingAssistant = payload.continueMessageId
            ? chat.messages.value.find(
                  (item) =>
                      item.id === payload.continueMessageId &&
                      item.role === 'assistant',
              ) || null
            : null;
        const assistant = existingAssistant
            ? (chat.updateMessage(existingAssistant.id, {
                  status: 'streaming',
                  error: undefined,
                  errorCode: undefined,
                  approvalRequestId: undefined,
                  approvalState: undefined,
                  jobId: undefined,
                  retryPayload: storedRetryPayload,
                  runnerId: payload.runnerId ?? session.runnerId,
                  runnerLabel: payload.runnerLabel ?? session.runnerLabel,
                  runnerChatSessionId:
                      payload.runnerChatSessionId ??
                      session.runnerChatSessionId,
                  sourceSessionKey: session.sessionKey,
              }),
              existingAssistant)
            : chat.addMessage({
                  sessionId: session.id,
                  role: 'assistant',
                  content: '',
                  status: 'streaming',
                  retryPayload: storedRetryPayload,
                  reasoningText: '',
                  toolCalls: [],
                  parts: [],
                  activityLog: [],
                  runnerId: payload.runnerId ?? session.runnerId,
                  runnerLabel: payload.runnerLabel ?? session.runnerLabel,
                  runnerChatSessionId:
                      payload.runnerChatSessionId ??
                      session.runnerChatSessionId,
                  sourceSessionKey: session.sessionKey,
              });
        isStreaming.value = true;
        const activeController = new AbortController();
        controller = activeController;
        let rawAssistantContent = existingAssistant?.content || '';
        let activeTextPartId: string | null = null;
        let activeTextPartRaw = '';
        let textPartIndex =
            existingAssistant?.parts?.filter((part) => part.type === 'text')
                .length ?? 0;
        let sawVisibleOutput = false;
        const appliedEventSequenceKeys = new Set<string>();
        const streamedEventPayloadKeys = new Set<string>();

        const readAssistant = () =>
            chat.messages.value.find((item) => item.id === assistant.id);
        const updateAssistant = (
            patch: Parameters<typeof chat.updateMessage>[1],
        ) => chat.updateMessage(assistant.id, patch);
        const appendAssistantContent = (value: string) => {
            rawAssistantContent += value;
            updateAssistant({
                content: sanitizeAssistantText(rawAssistantContent),
            });
        };
        const replaceAssistantContent = (value: string) => {
            rawAssistantContent = value;
            updateAssistant({
                content: sanitizeAssistantText(rawAssistantContent),
            });
        };
        const upsertPart = (part: ChatMessagePart) => {
            const current = readAssistant();
            const parts = [...(current?.parts ?? [])];
            const index = parts.findIndex((item) => item.id === part.id);
            if (index === -1) {
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
        const hasTextPartContent = (content: string) => {
            const normalized = sanitizeAssistantText(content);
            if (!normalized) return false;
            return Boolean(
                readAssistant()?.parts?.some(
                    (part) =>
                        part.type === 'text' &&
                        sanitizeAssistantText(part.content ?? '') ===
                            normalized,
                ),
            );
        };
        const closeActiveTextPart = () => {
            activeTextPartId = null;
            activeTextPartRaw = '';
        };
        const ensureActiveTextPart = () => {
            if (activeTextPartId) return activeTextPartId;
            textPartIndex += 1;
            activeTextPartId = `text:${textPartIndex}`;
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
            closeActiveTextPart();
            appendTextPart(value);
            closeActiveTextPart();
        };
        const activeHostId = activeHost.value?.id?.trim() || '';
        const requestedToolPolicy =
            payload.toolPolicy ?? modeToolPolicy(payload.mode);
        const effectiveRequestedToolPolicy =
            !payload.toolPolicy &&
            shouldPreemptivelyDowngradeToolPolicy(activeHostId)
                ? downgradeToolPolicyForServiceCapability(requestedToolPolicy)
                : requestedToolPolicy;
        const buildTurnRequest = (toolPolicy = requestedToolPolicy) => ({
            session_key: session.sessionKey,
            message: text,
            ...(toolPolicy ? { tool_policy: toolPolicy } : {}),
            ...(payload.approvalToken
                ? { approval_token: payload.approvalToken }
                : {}),
            ...(payload.replayToolCall
                ? {
                      replay_tool_call: {
                          name: payload.replayToolCall.name,
                          arguments_json:
                              payload.replayToolCall.arguments || '{}',
                      },
                  }
                : {}),
        });
        const turnRequest = followJobId
            ? null
            : buildTurnRequest(effectiveRequestedToolPolicy);
        const setToolCalls = (toolCalls: ChatToolCall[]) =>
            updateAssistant({ toolCalls });
        const addActivity = (entry: ChatActivityEntry) => {
            const current = readAssistant();
            updateAssistant({
                activityLog: [...(current?.activityLog ?? []), entry].slice(
                    -30,
                ),
            });
        };
        const upsertActivity = (entry: ChatActivityEntry) => {
            const current = readAssistant();
            const activityLog = [...(current?.activityLog ?? [])];
            const index = activityLog.findIndex((item) => item.id === entry.id);
            if (index === -1) {
                updateAssistant({ activityLog: [...activityLog, entry].slice(-30) });
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
                (entry) =>
                    types.includes(entry.type) && entry.status === 'running',
                { status: 'complete' },
            );
        };
        const addToolCall = (name: string, args?: string) => {
            const current = readAssistant();
            const existing = current?.toolCalls?.find(
                (call) =>
                    call.name === name &&
                    call.status === 'running' &&
                    (args === undefined || call.arguments === args),
            );
            if (existing) return;
            const toolCalls = [
                ...(current?.toolCalls ?? []),
                createToolCall(name, args),
            ];
            setToolCalls(toolCalls);
            addActivity(
                createActivity(
                    'tool_call',
                    `Tool call: ${name}`,
                    args ? truncateLogDetail(args) : undefined,
                    'running',
                ),
            );
        };
        const resolveToolCall = (
            name: string,
            result?: string,
            error?: string,
            statusOverride?: ChatToolCall['status'],
        ) => {
            const current = readAssistant();
            const toolCalls = [...(current?.toolCalls ?? [])];
            const status: ChatToolCall['status'] =
                statusOverride || (error ? 'error' : 'complete');
            const targetIndex = [...toolCalls]
                .reverse()
                .findIndex(
                    (call) => call.name === name && call.status === 'running',
                );
            const resolvedIndex =
                targetIndex === -1 ? -1 : toolCalls.length - 1 - targetIndex;
            if (resolvedIndex === -1) {
                const existingCompletedIndex = [...toolCalls]
                    .reverse()
                    .findIndex(
                        (call) =>
                            call.name === name &&
                            call.status !== 'running' &&
                            call.result === result &&
                            call.error === error,
                    );
                if (existingCompletedIndex !== -1) return;
                toolCalls.push({
                    ...createToolCall(name),
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
                    entry.type === 'tool_call' &&
                    entry.status === 'running' &&
                    entry.label === `Tool call: ${name}`,
                { status },
            );
            addActivity(
                createActivity(
                    'tool_result',
                    `Tool result: ${name}`,
                    error || (result ? truncateLogDetail(result) : undefined),
                    status,
                ),
            );
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
        const { applyEvent } = createAssistantEventApplier({
            assistantId: assistant.id,
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
            rawAssistantContent: () => rawAssistantContent,
        });
        const runFetchAndApplyJobSnapshot = (jobId?: string | null) =>
            fetchAndApplyJobSnapshot(jobId, {
                api,
                activeController,
                activeJobId,
                readAssistant,
                updateAssistant,
                updateActivity,
                completeRunningActivity,
                addActivity,
                applyEvent,
                replaceAssistantContent,
                appendCompleteTextPart,
                sawVisibleOutput: () => sawVisibleOutput,
                setSawVisibleOutput(value: boolean) {
                    sawVisibleOutput = value;
                },
                sanitizeAssistantText,
                applyRunnerStructuredResult,
            });

        const selectedRunnerId =
            payload.runnerId || session.runnerId || 'or3-intern';
        const useRunnerChat = selectedRunnerId !== 'or3-intern';
        let runnerChatTurnForRecovery: {
            sessionId: string;
            turnId: string;
        } | null = null;

        try {
            const executionContext = {
                api,
                activeController,
                activeJobId,
                readAssistant,
                updateAssistant,
                updateActivity,
                completeRunningActivity,
                addActivity,
                applyEvent,
                replaceAssistantContent,
                appendCompleteTextPart,
                sawVisibleOutput: () => sawVisibleOutput,
                setSawVisibleOutput(value: boolean) {
                    sawVisibleOutput = value;
                },
                sanitizeAssistantText,
                applyRunnerStructuredResult,
            };

            const execution = followRunnerTurnId && payload.runnerChatSessionId
                ? await streamFollowRunnerTurn({
                      ...executionContext,
                      runnerChatSessionId: payload.runnerChatSessionId,
                      runnerChatTurnId: followRunnerTurnId,
                  })
                : followJobId
                  ? await streamFollowJob({
                        ...executionContext,
                        followJobId,
                    })
                  : useRunnerChat
                    ? await streamRunnerChat({
                          ...executionContext,
                          chat,
                          session,
                          payload,
                          text,
                          selectedRunnerId,
                      })
                    : await streamDirectTurn({
                          ...executionContext,
                          turnRequest,
                      });

            const {
                sawStreamEvent,
                streamEndedWithFailure,
                streamedJobId,
                runnerChatTurnForRecovery: executionRecoveryRef,
            } = execution;
            runnerChatTurnForRecovery = executionRecoveryRef;

            if (streamedJobId && !useRunnerChat) {
                try {
                    await runFetchAndApplyJobSnapshot(streamedJobId);
                } catch {
                    // Streaming already gave us the best available live state.
                }
            }

            if (streamEndedWithFailure) return;

            if (!sawVisibleOutput) {
                updateAssistant({
                    content: sawStreamEvent
                        ? 'or3-intern finished thinking, but did not return any visible text.'
                        : 'No streaming content was returned.',
                    status: 'complete',
                    jobId: streamedJobId ?? undefined,
                });
            }

            const finalMessage = chat.messages.value.find(
                (item) => item.id === assistant.id,
            );
            if (
                finalMessage?.status !== 'failed' &&
                finalMessage?.status !== 'attention'
            )
                updateAssistant({ status: 'complete' });
        } catch (streamError) {
            if (activeController.signal.aborted) {
                completeRunningActivity(['queued', 'started', 'tool_call']);
                updateAssistant({
                    content: readAssistant()?.content || 'Stopped.',
                    status: 'complete',
                });
                return;
            }

            if (useRunnerChat) {
                await handleRunnerExecutionError({
                    api,
                    activeController,
                    activeJobId,
                    readAssistant,
                    updateAssistant,
                    updateActivity,
                    completeRunningActivity,
                    addActivity,
                    applyEvent,
                    replaceAssistantContent,
                    appendCompleteTextPart,
                    sawVisibleOutput: () => sawVisibleOutput,
                    setSawVisibleOutput(value) {
                        sawVisibleOutput = value;
                    },
                    sanitizeAssistantText,
                    applyRunnerStructuredResult,
                    toast,
                    streamError,
                    runnerChatTurnForRecovery,
                });
                return;
            }

            await recoverDirectExecutionError({
                api,
                activeController,
                activeJobId,
                readAssistant,
                updateAssistant,
                updateActivity,
                completeRunningActivity,
                addActivity,
                applyEvent,
                replaceAssistantContent,
                appendCompleteTextPart,
                sawVisibleOutput: () => sawVisibleOutput,
                setSawVisibleOutput(value) {
                    sawVisibleOutput = value;
                },
                sanitizeAssistantText,
                toast,
                streamError,
                payload,
                turnRequest,
                requestedToolPolicy,
                activeHostId,
                rememberServiceCapabilityCeilingHost,
                buildTurnRequest,
                fetchAndApplyJobSnapshot: runFetchAndApplyJobSnapshot,
            });
        } finally {
            isStreaming.value = false;
            if (controller === activeController) controller = null;
        }
    }

    async function stop() {
        const jobId = activeJobId.value;
        const assistant = chat.messages.value.find(
            (message) =>
                message.role === 'assistant' && message.status === 'streaming',
        );
        if (assistant?.runnerChatTurnId) {
            try {
                await api.request(
                    `/internal/v1/runner-chat/sessions/${encodeURIComponent(assistant.runnerChatSessionId || '')}/turns/${encodeURIComponent(assistant.runnerChatTurnId)}/abort`,
                    { method: 'POST' },
                );
            } catch {
                // Local abort below is still the authoritative UI fallback.
            }
        }
        if (jobId) {
            try {
                await api.request(
                    `/internal/v1/jobs/${encodeURIComponent(jobId)}/abort`,
                    { method: 'POST' },
                );
            } catch {
                // Local abort below is still the authoritative UI fallback.
            }
        }
        controller?.abort();
        isStreaming.value = false;
    }

    return { isStreaming, activeJobId, chatMode, send, stop };
}
