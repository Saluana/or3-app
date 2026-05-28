import { useState } from '#app';
import { computed, ref, watch, type Ref } from 'vue';
import type { ToolPolicy } from '~/types/or3-api';
import type { AssistantSendPayload } from '~/types/app-state';
import { describeApprovalRequest } from '~/utils/assistant-stream/approval';
import {
    isServiceCapabilityCeilingError,
    serializeErrorForLog,
} from '~/utils/assistant-stream/errors';
import {
    clearServiceCapabilityCeilingHost,
    effectiveToolPolicyForHost,
    loadPersistedServiceCapabilityCeilingHosts,
    persistServiceCapabilityCeilingHost,
} from '~/utils/assistant-stream/tool-policy-host';
import {
    EMPTY_FINAL_USER_MESSAGE,
    EMPTY_STREAM_USER_MESSAGE,
} from '~/utils/assistant-stream/userErrorCopy';
import {
    fetchAndApplyJobSnapshot,
    handleRunnerExecutionError,
    recoverDirectExecutionError,
} from '~/utils/assistant-stream/execution';
import { normalizeTurnEvent } from '~/utils/assistant-stream/events';
import { toServiceAttachments } from '~/utils/chat/service-attachments';
import { createLogger } from '~/utils/logger';
import { clearActiveTraceId, setActiveTraceId } from '~/utils/logTrace';
import {
    normalizePayload,
    retryPayloadForStorage,
} from '~/utils/assistant-stream/payload';
import { useApprovalHydration } from './assistant-stream/useApprovalHydration';
import { useAssistantMessageState } from './assistant-stream/useAssistantMessageState';
import { useExecutionRouter } from './assistant-stream/useExecutionRouter';
import { useStreamRecovery } from './assistant-stream/useStreamRecovery';
import { useChatSessions } from './useChatSessions';
import { useActiveHost } from './useActiveHost';
import { useChatRuntimeLog } from './useChatRuntimeLog';
import { useLocalCache } from './useLocalCache';
import { useOr3Api } from './useOr3Api';

interface AssistantStreamRuntime {
    isStreaming: boolean;
    activeJobId: string | null;
    chatMode: 'ask' | 'work' | 'admin';
    controller: AbortController | null;
    initialized: boolean;
}

function createAssistantStreamRuntimeState(): AssistantStreamRuntime {
    return {
        isStreaming: false,
        activeJobId: null,
        chatMode: 'work',
        controller: null,
        initialized: false,
    };
}

function useAssistantStreamRuntime(): Ref<AssistantStreamRuntime> {
    return useState<AssistantStreamRuntime>(
        'or3-assistant-stream-runtime',
        createAssistantStreamRuntimeState,
    );
}

/** Test-only reset for assistant stream runtime state. */
export function resetAssistantStreamRuntimeForTests() {
    useAssistantStreamRuntime().value = createAssistantStreamRuntimeState();
}

const serviceCapabilityCeilingHosts =
    loadPersistedServiceCapabilityCeilingHosts();

function createTraceId() {
    return `turn_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
}

function rememberServiceCapabilityCeilingHost(hostId?: string | null) {
    const normalized = hostId?.trim();
    if (!normalized) return;
    serviceCapabilityCeilingHosts.add(normalized);
    persistServiceCapabilityCeilingHost(normalized);
}

export function forgetServiceCapabilityCeilingHost(hostId?: string | null) {
    const normalized = hostId?.trim();
    if (!normalized) return;
    serviceCapabilityCeilingHosts.delete(normalized);
    clearServiceCapabilityCeilingHost(normalized);
}

export function modeToolPolicy(
    mode?: AssistantSendPayload['mode'],
): ToolPolicy {
    const runtime = useAssistantStreamRuntime();
    return { mode: mode || runtime.value.chatMode || 'work' };
}
export { describeApprovalRequest };
export { normalizeTurnEvent };
export type { NormalizedTurnEvent } from '~/utils/assistant-stream/events';

export function useAssistantStream() {
    const api = useOr3Api();
    const chat = useChatSessions();
    const cache = useLocalCache();
    const runtimeLog = useChatRuntimeLog();
    const logger = createLogger('turn');
    const { activeHost } = useActiveHost();
    const toast = useToast();
    const runtime = useAssistantStreamRuntime();
    const isStreaming = computed({
        get: () => runtime.value.isStreaming,
        set: (value: boolean) => {
            runtime.value.isStreaming = value;
        },
    });
    const activeJobId = computed({
        get: () => runtime.value.activeJobId,
        set: (value: string | null) => {
            runtime.value.activeJobId = value;
        },
    });
    const chatMode = computed({
        get: () => runtime.value.chatMode,
        set: (value: 'ask' | 'work' | 'admin') => {
            runtime.value.chatMode = value;
        },
    });
    const { resolveExecutionRoute, routeExecution } = useExecutionRouter({
        chat,
    });

    async function send(message: string | AssistantSendPayload) {
        const payload = normalizePayload(message);
        const traceId = createTraceId();
        const followJobId = payload.followJobId?.trim() || '';
        const followRunnerTurnId = payload.runnerChatTurnId?.trim() || '';
        const text = payload.transportText || payload.text;
        if (!text && !followJobId && !followRunnerTurnId) return;

        if (isStreaming.value) {
            toast.add({
                title: 'Please wait',
                description:
                    'OR3 is still working on your last message. Wait for it to finish or tap Stop.',
                color: 'warning',
                icon: 'i-pixelarticons-clock',
            });
            return;
        }

        setActiveTraceId(traceId);

        const storedRetryPayload = retryPayloadForStorage(payload);

        if (payload.continueMessageId) {
            const continueTarget = cache.state.value.messages.find(
                (item) =>
                    item.id === payload.continueMessageId &&
                    item.role === 'assistant',
            );
            if (continueTarget) {
                const sessionForMessage = cache.state.value.sessions.find(
                    (item) => item.id === continueTarget.sessionId,
                );
                if (sessionForMessage) {
                    chat.promoteSession(sessionForMessage.id);
                }
            }
        }

        const session = chat.activeSession.value ?? chat.ensureSession();
        runtimeLog.add('turn', 'send:start', undefined, {
            traceId,
            sessionKey: session.sessionKey,
            followJobId: followJobId || undefined,
            followRunnerTurnId: followRunnerTurnId || undefined,
            runnerId: payload.runnerId ?? session.runnerId,
        });
        logger.info('send:start', 'Assistant turn submitted', {
            sessionKey: session.sessionKey,
            followJobId: followJobId || undefined,
            followRunnerTurnId: followRunnerTurnId || undefined,
            runnerId: payload.runnerId ?? session.runnerId,
        });
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
            ? cache.state.value.messages.find(
                  (item) =>
                      item.id === payload.continueMessageId &&
                      item.role === 'assistant',
              ) || null
            : null;
        const isApprovalContinuation = Boolean(
            existingAssistant &&
            (existingAssistant.approvalRequestId ||
                existingAssistant.approvalState === 'retrying' ||
                existingAssistant.errorCode === 'approval_required'),
        );
        const isApprovalResumeContinuation = Boolean(
            isApprovalContinuation && followJobId,
        );
        const shouldResetApprovalContinuation =
            isApprovalContinuation && !isApprovalResumeContinuation;
        const assistant = existingAssistant
            ? (chat.updateMessage(existingAssistant.id, {
                  status: 'streaming',
                  content: shouldResetApprovalContinuation
                      ? ''
                      : existingAssistant.content,
                  parts: shouldResetApprovalContinuation
                      ? []
                      : existingAssistant.parts,
                  reasoningText: shouldResetApprovalContinuation
                      ? ''
                      : existingAssistant.reasoningText,
                  toolCalls: shouldResetApprovalContinuation
                      ? []
                      : existingAssistant.toolCalls,
                  activityLog: shouldResetApprovalContinuation
                      ? []
                      : existingAssistant.activityLog,
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
              }) ?? existingAssistant)
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
        runtime.value.controller = activeController;
        const messageState = useAssistantMessageState({
            assistantId: assistant.id,
            chat,
            existingAssistant: assistant,
            appendFinalTextToExistingContent: isApprovalResumeContinuation,
            runtimeLog,
        });
        const executionState = messageState.executionState;
        const {
            readAssistant,
            updateAssistant,
            completeRunningActivity,
            flushAssistantUpdates,
        } = executionState;
        const activeHostId = activeHost.value?.id?.trim() || '';
        const requestedToolPolicy =
            payload.toolPolicy ?? modeToolPolicy(payload.mode);
        const effectiveRequestedToolPolicy = payload.toolPolicy
            ? requestedToolPolicy
            : effectiveToolPolicyForHost({
                  hostId: activeHostId,
                  host: activeHost.value,
                  sessionKey: session.sessionKey,
                  rememberedHosts: serviceCapabilityCeilingHosts,
                  policy: requestedToolPolicy,
              });
        const serviceAttachments = toServiceAttachments(payload.attachments);
        const buildTurnRequest = (toolPolicy = requestedToolPolicy) => ({
            session_key: session.sessionKey,
            message: text,
            meta: { trace_id: traceId },
            ...(serviceAttachments.length
                ? { attachments: serviceAttachments }
                : {}),
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
        const buildExecutionContext = () => ({
            api,
            activeController,
            activeJobId,
            ...executionState,
        });
        const runFetchAndApplyJobSnapshot = (
            jobId?: string | null,
            snapshotOptions?: { settleAfterStreamFailure?: boolean },
        ) =>
            fetchAndApplyJobSnapshot(
                jobId,
                buildExecutionContext(),
                snapshotOptions,
            );
        const { selectedRunnerId, useRunnerChat } = resolveExecutionRoute(
            payload,
            session,
        );
        let runnerChatTurnForRecovery: {
            sessionId: string;
            turnId: string;
        } | null = null;

        try {
            const execution = await routeExecution({
                executionContext: buildExecutionContext(),
                followJobId,
                followRunnerTurnId,
                payload,
                selectedRunnerId,
                session,
                text,
                turnRequest,
                useRunnerChat,
            });

            const {
                sawStreamEvent,
                streamEndedWithFailure,
                streamedJobId,
                runnerChatTurnForRecovery: executionRecoveryRef,
            } = execution;
            runnerChatTurnForRecovery = executionRecoveryRef;

            let snapshotRecovered = false;
            if (streamedJobId && !useRunnerChat) {
                try {
                    await runFetchAndApplyJobSnapshot(streamedJobId, {
                        settleAfterStreamFailure: streamEndedWithFailure,
                    });
                    snapshotRecovered = true;
                } catch {
                    // Streaming already gave us the best available live state.
                }
            }

            flushAssistantUpdates();
            const messageAfterSnapshot = readAssistant();
            if (
                streamEndedWithFailure &&
                !(
                    snapshotRecovered &&
                    messageAfterSnapshot?.status !== 'failed'
                )
            ) {
                return;
            }
            if (
                !executionState.sawVisibleOutput() &&
                messageAfterSnapshot?.status !== 'streaming' &&
                messageAfterSnapshot?.status !== 'attention' &&
                messageAfterSnapshot?.status !== 'failed'
            ) {
                const emptyMessage = sawStreamEvent
                    ? EMPTY_FINAL_USER_MESSAGE
                    : EMPTY_STREAM_USER_MESSAGE;
                updateAssistant({
                    content: emptyMessage,
                    status: 'attention',
                    error: emptyMessage,
                    errorCode: 'empty_final_text',
                    jobId: streamedJobId ?? undefined,
                });
            }

            flushAssistantUpdates();
            const finalMessage = chat.messages.value.find(
                (item) => item.id === assistant.id,
            );
            if (
                finalMessage?.status !== 'failed' &&
                finalMessage?.status !== 'attention' &&
                finalMessage?.status !== 'streaming'
            )
                updateAssistant({ status: 'complete' });
            logger.info('send:complete', 'Assistant turn completed', {
                sessionKey: session.sessionKey,
                jobId: streamedJobId ?? undefined,
            });
        } catch (streamError) {
            if (activeController.signal.aborted) {
                logger.info('send:aborted', 'Assistant turn was stopped', {
                    sessionKey: session.sessionKey,
                });
                completeRunningActivity(['queued', 'started', 'tool_call']);
                updateAssistant({
                    content: readAssistant()?.content || 'Stopped.',
                    status: 'complete',
                });
                return;
            }

            if (useRunnerChat) {
                logger.error(
                    'send:runner_error',
                    'Runner chat execution failed',
                    {
                        sessionKey: session.sessionKey,
                        ...serializeErrorForLog(streamError),
                    },
                );
                const executionContext = buildExecutionContext();
                await handleRunnerExecutionError({
                    ...executionContext,
                    toast,
                    streamError,
                    runnerChatTurnForRecovery,
                });
                return;
            }

            const executionContext = buildExecutionContext();
            const capabilityCeiling =
                isServiceCapabilityCeilingError(streamError);
            const logPayload = {
                sessionKey: session.sessionKey,
                ...serializeErrorForLog(streamError),
            };
            if (capabilityCeiling) {
                logger.info(
                    'send:policy_retry',
                    'Work mode exceeded this host service limit; retrying in Ask mode',
                    logPayload,
                );
            } else {
                logger.error(
                    'send:error',
                    'Direct assistant execution failed',
                    logPayload,
                );
            }
            await recoverDirectExecutionError({
                ...executionContext,
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
            flushAssistantUpdates();
            chat.flushMessage(assistant.id);
            isStreaming.value = false;
            if (runtime.value.controller === activeController) {
                runtime.value.controller = null;
            }
            clearActiveTraceId();
        }
    }

    async function stop() {
        const jobId = activeJobId.value;
        const hostId = activeHost.value?.id?.trim();
        const sessionIds = hostId
            ? new Set(
                  cache.state.value.sessions
                      .filter((session) => session.hostId === hostId)
                      .map((session) => session.id),
              )
            : null;
        const assistant =
            cache.state.value.messages.find(
                (message) =>
                    message.role === 'assistant' &&
                    message.status === 'streaming' &&
                    (!sessionIds || sessionIds.has(message.sessionId)),
            ) ?? null;
        let remoteAbortFailed = false;
        if (assistant?.runnerChatTurnId) {
            try {
                await api.request(
                    `/internal/v1/runner-chat/sessions/${encodeURIComponent(assistant.runnerChatSessionId || '')}/turns/${encodeURIComponent(assistant.runnerChatTurnId)}/abort`,
                    { method: 'POST' },
                );
            } catch {
                remoteAbortFailed = true;
            }
        }
        if (jobId) {
            try {
                await api.request(
                    `/internal/v1/jobs/${encodeURIComponent(jobId)}/abort`,
                    { method: 'POST' },
                );
            } catch {
                remoteAbortFailed = true;
            }
        }
        runtime.value.controller?.abort();
        isStreaming.value = false;
        if (remoteAbortFailed) {
            toast.add({
                title: 'Stopped on this device',
                description:
                    'The task may still be running on your computer. Check Activity if it keeps going.',
                color: 'warning',
                icon: 'i-pixelarticons-warning-box',
            });
        }
    }

    return { isStreaming, activeJobId, chatMode, send, stop };
}

export function installChatStreamSideEffects(
    send: (message: string | AssistantSendPayload) => Promise<void>,
) {
    const runtime = useAssistantStreamRuntime();
    if (!import.meta.client || runtime.value.initialized) return;
    runtime.value.initialized = true;

    const api = useOr3Api();
    const chat = useChatSessions();
    const cache = useLocalCache();
    const runtimeLog = useChatRuntimeLog();
    const { activeHost } = useActiveHost();
    const { isStreaming, chatMode } = useAssistantStream();

    useStreamRecovery({
        activeHost,
        cacheState: cache.state,
        isStreaming,
        send,
    }).installRecoveryWatcher();

    useApprovalHydration({
        activeHost,
        api,
        chat,
        runtimeLog,
        isStreaming,
    }).installApprovalHydrationWatcher();

    watch(
        () => activeHost.value?.id,
        (hostId, previousHostId) => {
            if (!hostId || hostId === previousHostId) return;
            chatMode.value = 'work';
        },
    );
}
