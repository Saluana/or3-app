import { ref } from 'vue';
import type { ToolPolicy } from '~/types/or3-api';
import type { AssistantSendPayload } from '~/types/app-state';
import { describeApprovalRequest } from '~/utils/assistant-stream/approval';
import { downgradeToolPolicyForServiceCapability } from '~/utils/assistant-stream/errors';
import {
    fetchAndApplyJobSnapshot,
    handleRunnerExecutionError,
    recoverDirectExecutionError,
} from '~/utils/assistant-stream/execution';
import { normalizeTurnEvent } from '~/utils/assistant-stream/events';
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

const isStreaming = ref(false);
const activeJobId = ref<string | null>(null);
const chatMode = ref<'ask' | 'work' | 'admin'>('work');
const serviceCapabilityCeilingHosts = new Set<string>();
let controller: AbortController | null = null;

function createTraceId() {
    return `turn_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
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
    const { resolveExecutionRoute, routeExecution } = useExecutionRouter({
        chat,
    });

    async function send(message: string | AssistantSendPayload) {
        const payload = normalizePayload(message);
        const traceId = createTraceId();
        const followJobId = payload.followJobId?.trim() || '';
        const followRunnerTurnId = payload.runnerChatTurnId?.trim() || '';
        const text = payload.transportText || payload.text;
        if ((!text && !followJobId && !followRunnerTurnId) || isStreaming.value)
            return;
        setActiveTraceId(traceId);

        const storedRetryPayload = retryPayloadForStorage(payload);

        const session = chat.ensureSession();
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
        const messageState = useAssistantMessageState({
            assistantId: assistant.id,
            chat,
            existingAssistant,
            runtimeLog,
        });
        const executionState = messageState.executionState;
        const { readAssistant, updateAssistant, completeRunningActivity } =
            executionState;
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
            meta: { trace_id: traceId },
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
        const runFetchAndApplyJobSnapshot = (jobId?: string | null) =>
            fetchAndApplyJobSnapshot(jobId, buildExecutionContext());
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

            if (streamedJobId && !useRunnerChat) {
                try {
                    await runFetchAndApplyJobSnapshot(streamedJobId);
                } catch {
                    // Streaming already gave us the best available live state.
                }
            }

            if (streamEndedWithFailure) return;

            const messageAfterSnapshot = readAssistant();
            if (
                !executionState.sawVisibleOutput() &&
                messageAfterSnapshot?.status !== 'streaming'
            ) {
                const emptyMessage = sawStreamEvent
                    ? 'or3-intern finished thinking, but did not return any visible text.'
                    : 'No streaming content was returned.';
                updateAssistant({
                    content: emptyMessage,
                    status: 'attention',
                    error: emptyMessage,
                    errorCode: 'empty_final_text',
                    jobId: streamedJobId ?? undefined,
                });
            }

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
                        error:
                            streamError instanceof Error
                                ? streamError.message
                                : String(streamError),
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
            logger.error('send:error', 'Direct assistant execution failed', {
                sessionKey: session.sessionKey,
                error:
                    streamError instanceof Error
                        ? streamError.message
                        : String(streamError),
            });
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
            isStreaming.value = false;
            if (controller === activeController) controller = null;
            clearActiveTraceId();
        }
    }

    const { installRecoveryWatcher } = useStreamRecovery({
        activeHost,
        cacheState: cache.state,
        isStreaming,
        send,
    });
    const { installApprovalHydrationWatcher } = useApprovalHydration({
        activeHost,
        api,
        chat,
        runtimeLog,
        isStreaming,
    });
    installRecoveryWatcher();
    installApprovalHydrationWatcher();

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
