import type { Ref } from 'vue';
import type {
    AssistantSendPayload,
    ChatActivityEntry,
    ChatMessage,
    ChatSession,
    ChatToolCall,
} from '~/types/app-state';
import type {
    JobEvent,
    JobSnapshot,
    RunnerChatEvent,
    RunnerChatSession,
    RunnerChatTurn,
    RunnerChatTurnStartResponse,
} from '~/types/or3-api';
import { toServiceAttachments } from '~/utils/chat/service-attachments';
import { createActivity } from './activity';
import { normalizeResultDisplayText } from '~/utils/or3/result-display';
import {
    describeRequestError,
    extractErrorCode,
    formatUserFacingErrorInline,
    showFailureToast,
    type ToastLike,
} from './errors';
import {
    EMPTY_FINAL_USER_MESSAGE,
    isGenericJobFailureInline,
    userFacingErrorCopy,
} from './userErrorCopy';
import { eventJobId, normalizeRunnerChatEvent, responseJobId } from './events';
import { useChatRuntimeLog } from '~/composables/useChatRuntimeLog';

interface StreamApiLike {
    request<T>(
        path: string,
        options?: {
            method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
            body?: unknown;
            signal?: AbortSignal;
        },
    ): Promise<T>;
    stream(
        path: string,
        options?: {
            method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
            body?: unknown;
            signal?: AbortSignal;
            onOpen?: ((response: Response) => Promise<void> | void) | undefined;
        },
    ): AsyncIterable<unknown>;
}

interface ChatLike {
    bindRunnerChatSession(
        sessionId: string,
        runnerChatSessionId: string,
    ): unknown;
    flushMessage?(id: string): unknown;
    messages: Ref<ChatMessage[]>;
}

interface AssistantExecutionState {
    activeController: AbortController;
    activeJobId: Ref<string | null>;
    readAssistant: () => ChatMessage | undefined;
    updateAssistant: (patch: Partial<ChatMessage>) => void;
    updateActivity: (
        predicate: (entry: ChatActivityEntry) => boolean,
        patch: Partial<ChatActivityEntry>,
    ) => void;
    completeRunningActivity: (types: string[]) => void;
    addActivity: (entry: ChatActivityEntry) => void;
    applyEvent: (
        event: JobEvent | { event?: string; json?: unknown },
        source?: 'stream' | 'snapshot',
    ) => { failed: boolean; completed: boolean };
    applyFinalText?: (value: string) => void;
    appendFinalTextToExistingContent?: boolean;
    replaceAssistantContent: (value: string) => void;
    appendCompleteTextPart: (value: string) => void;
    sawVisibleOutput: () => boolean;
    setSawVisibleOutput: (value: boolean) => void;
    sanitizeAssistantText: (value: string) => string;
    applyRunnerStructuredResult?: (
        value?: string | null,
        runnerId?: string,
    ) => void;
    flushAssistantUpdates?: () => void;
}

interface BaseExecutionContext extends AssistantExecutionState {
    api: StreamApiLike;
}

export interface AssistantExecutionResult {
    sawStreamEvent: boolean;
    streamEndedWithFailure: boolean;
    streamedJobId: string | null;
    runnerChatTurnForRecovery: RunnerChatTurnRef | null;
}

export interface RunnerChatTurnRef {
    sessionId: string;
    turnId: string;
}

interface FollowJobStreamContext extends BaseExecutionContext {
    followJobId: string;
}

interface FollowRunnerTurnStreamContext extends BaseExecutionContext {
    runnerChatSessionId: string;
    runnerChatTurnId: string;
}

interface RunnerChatStreamContext extends BaseExecutionContext {
    chat: ChatLike;
    session: ChatSession;
    payload: AssistantSendPayload;
    text: string;
    selectedRunnerId: string;
}

export interface AssistantSendErrorContext extends BaseExecutionContext {
    toast: ToastLike;
    streamError: unknown;
    runnerChatTurnForRecovery: RunnerChatTurnRef | null;
}

const COMPLETION_ACTIVITY_TYPES = [
    'queued',
    'started',
    'completion',
    'tool_call',
    'command_execution',
    'file_change',
    'mcp_tool_call',
    'web_search',
    'collab_agent_tool_call',
    'dynamic_tool_call',
    'unknown',
];

// Long OpenCode tool runs (writes, shell) may emit no runner_chat_events for minutes.
const STREAM_IDLE_TIMEOUT_MS = 120_000;
const SNAPSHOT_SETTLE_ATTEMPTS = 6;
const SNAPSHOT_SETTLE_DELAY_MS = 350;

function sleep(ms: number) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}
const EMPTY_FINAL_TEXT_WARNING = EMPTY_FINAL_USER_MESSAGE;

function isLiveJobStatus(status: string) {
    return ['queued', 'running', 'started'].includes(
        String(status || '')
            .trim()
            .toLowerCase(),
    );
}

function streamIdleTimeoutError(path: string) {
    return {
        code: 'stream_idle_timeout',
        message:
            'The live stream stopped sending updates. OR3 will reconcile from the job snapshot.',
        path,
    };
}

function assistantHasToolWork(message: ChatMessage | undefined) {
    return Boolean(
        message?.toolCalls?.length ||
        message?.parts?.some((part) => part.type === 'tool') ||
        message?.activityLog?.some((entry) =>
            [
                'tool_call',
                'tool_result',
                'command_execution',
                'file_change',
                'mcp_tool_call',
                'web_search',
                'collab_agent_tool_call',
                'dynamic_tool_call',
            ].includes(entry.type),
        ),
    );
}

function textPartContent(part: NonNullable<ChatMessage['parts']>[number]) {
    return part.type === 'text' ? (part.content ?? '') : '';
}

function hasTextPartContent(
    message: ChatMessage | undefined,
    content: string,
    sanitize: (value: string) => string,
) {
    const normalized = sanitize(content);
    if (!normalized) return false;
    return Boolean(
        message?.parts?.some(
            (part) =>
                part.type === 'text' &&
                sanitize(textPartContent(part)) === normalized,
        ),
    );
}

function removeTextPartsWithContent(
    message: ChatMessage | undefined,
    content: string,
    sanitize: (value: string) => string,
) {
    const normalized = sanitize(content);
    const parts = message?.parts;
    if (!normalized || !parts?.length) return parts;
    const nextParts = parts.filter(
        (part) =>
            part.type !== 'text' ||
            sanitize(textPartContent(part)) !== normalized,
    );
    return nextParts.length === parts.length ? parts : nextParts;
}

function isEmptyFinalTextWarning(
    value: string | undefined,
    sanitize: (value: string) => string,
) {
    return sanitize(value || '') === sanitize(EMPTY_FINAL_TEXT_WARNING);
}

function assistantHasEmptyFinalWarning(
    message: ChatMessage | undefined,
    sanitize: (value: string) => string,
) {
    return Boolean(
        message?.errorCode === 'empty_final_text' ||
        isEmptyFinalTextWarning(message?.content, sanitize) ||
        message?.parts?.some(
            (part) =>
                part.type === 'text' &&
                isEmptyFinalTextWarning(textPartContent(part), sanitize),
        ),
    );
}

function applyRecoveredFinalText(
    displayText: string,
    context: AssistantExecutionState,
) {
    const normalized = context.sanitizeAssistantText(displayText);
    if (!normalized) return false;

    if (context.appendFinalTextToExistingContent && context.applyFinalText) {
        context.applyFinalText(normalized);
        context.updateActivity(
            (entry) =>
                entry.type === 'completion' && entry.status === 'running',
            {
                status: 'complete',
                label: 'Completed turn',
                detail: undefined,
            },
        );
        return true;
    }

    const latest = context.readAssistant();
    const recoveringEmptyFinal = assistantHasEmptyFinalWarning(
        latest,
        context.sanitizeAssistantText,
    );

    const failedWithGenericStub =
        latest?.status === 'failed' &&
        isGenericJobFailureInline(latest.content);

    if (
        !recoveringEmptyFinal &&
        !failedWithGenericStub &&
        context.sawVisibleOutput()
    ) {
        return false;
    }

    const partsWithoutWarning = removeTextPartsWithContent(
        latest,
        EMPTY_FINAL_TEXT_WARNING,
        context.sanitizeAssistantText,
    );
    if (partsWithoutWarning && partsWithoutWarning !== latest?.parts) {
        context.updateAssistant({ parts: partsWithoutWarning });
    }

    context.replaceAssistantContent(displayText);
    if (
        !hasTextPartContent(
            context.readAssistant(),
            displayText,
            context.sanitizeAssistantText,
        )
    ) {
        context.appendCompleteTextPart(displayText);
    }
    context.setSawVisibleOutput(true);
    context.updateAssistant({
        error: undefined,
        errorCode: undefined,
    });
    return true;
}

async function* withStreamWatchdog<T>(
    iterable: AsyncIterable<T>,
    path: string,
    timeoutMs = STREAM_IDLE_TIMEOUT_MS,
) {
    const iterator = iterable[Symbol.asyncIterator]();
    try {
        while (true) {
            let timeout: ReturnType<typeof setTimeout> | undefined;
            const timeoutPromise = new Promise<IteratorResult<T>>(
                (_, reject) => {
                    timeout = setTimeout(
                        () => reject(streamIdleTimeoutError(path)),
                        timeoutMs,
                    );
                },
            );
            const result = await Promise.race([
                iterator.next(),
                timeoutPromise,
            ]).finally(() => {
                if (timeout) clearTimeout(timeout);
            });
            if (result.done) return;
            yield result.value;
        }
    } finally {
        await iterator.return?.();
    }
}

export function applyJobSnapshot(
    snapshot: JobSnapshot,
    context: AssistantExecutionState & { activeJobId: Ref<string | null> },
) {
    const runtimeLog = useChatRuntimeLog();
    context.activeJobId.value = snapshot.job_id;
    context.updateAssistant({ jobId: snapshot.job_id });
    runtimeLog.add('job', 'snapshot:apply', undefined, {
        jobId: snapshot.job_id,
        status: snapshot.status,
        events: snapshot.events?.length ?? 0,
    });
    for (const event of snapshot.events ?? []) {
        context.applyEvent(event, 'snapshot');
    }
    const latest = context.readAssistant();
    const snapshotFinalText = snapshot.final_text?.trim() || '';
    const snapshotText = snapshotFinalText || snapshot.error?.trim() || '';
    if (snapshotFinalText || !context.appendFinalTextToExistingContent) {
        applyRecoveredFinalText(snapshotText, context);
    }
    const hasToolWork = assistantHasToolWork(latest);
    const emptyFinalAfterSnapshot =
        !snapshotText &&
        !snapshot.error &&
        snapshot.status !== 'approval_required' &&
        !isLiveJobStatus(snapshot.status) &&
        hasToolWork;
    if (emptyFinalAfterSnapshot) {
        context.updateActivity(
            (entry) =>
                entry.type === 'completion' && entry.status === 'running',
            {
                status: 'attention',
                label: 'Completed turn',
                detail: 'Tool work completed without a final assistant message.',
            },
        );
        context.addActivity(
            createActivity(
                'completion',
                'Completed turn',
                'Tool work completed without a final assistant message.',
                'attention',
            ),
        );
        if (!context.sanitizeAssistantText(latest?.content || '')) {
            context.replaceAssistantContent(EMPTY_FINAL_TEXT_WARNING);
            if (
                !hasTextPartContent(
                    context.readAssistant(),
                    EMPTY_FINAL_TEXT_WARNING,
                    context.sanitizeAssistantText,
                )
            ) {
                context.appendCompleteTextPart(EMPTY_FINAL_TEXT_WARNING);
            }
        }
        context.setSawVisibleOutput(true);
        context.updateAssistant({
            status: 'attention',
            error: EMPTY_FINAL_USER_MESSAGE,
            errorCode: 'empty_final_text',
            jobId: snapshot.job_id,
        });
        return;
    }
    const preserveEmptyFinalAttention =
        latest?.status === 'attention' &&
        latest.errorCode === 'empty_final_text' &&
        !snapshotText &&
        !snapshot.error &&
        snapshot.status !== 'approval_required';
    const nextStatus =
        snapshot.status === 'approval_required'
            ? 'attention'
            : snapshotText
              ? 'complete'
              : preserveEmptyFinalAttention
                ? 'attention'
                : snapshot.error ||
                    snapshot.status === 'failed' ||
                    snapshot.status === 'aborted'
                  ? 'failed'
                  : isLiveJobStatus(snapshot.status)
                    ? (latest?.status ?? 'streaming')
                    : 'complete';
    context.updateAssistant({
        status: nextStatus,
        error:
            snapshotText || snapshot.status === 'approval_required'
                ? undefined
                : snapshot.error,
        errorCode: snapshotText
            ? undefined
            : snapshot.status === 'approval_required'
              ? 'approval_required'
              : context.readAssistant()?.errorCode,
        approvalState:
            snapshot.status === 'approval_required'
                ? 'pending'
                : context.readAssistant()?.approvalState,
        jobId: snapshot.job_id,
    });
}

export async function fetchAndApplyJobSnapshot(
    jobId: string | null | undefined,
    context: BaseExecutionContext,
    options: { settleAfterStreamFailure?: boolean } = {},
) {
    if (!jobId) return null;

    const attempts = options.settleAfterStreamFailure
        ? SNAPSHOT_SETTLE_ATTEMPTS
        : 1;
    let snapshot: JobSnapshot | null = null;

    for (let attempt = 0; attempt < attempts; attempt++) {
        snapshot = await context.api.request<JobSnapshot>(
            `/internal/v1/jobs/${encodeURIComponent(jobId)}`,
            { signal: context.activeController.signal },
        );
        const hasFinalText = Boolean(snapshot.final_text?.trim());
        const live = isLiveJobStatus(snapshot.status);
        const hardFailedWithoutText =
            (snapshot.status === 'failed' || snapshot.status === 'aborted') &&
            !hasFinalText &&
            !snapshot.error?.trim();

        if ((live || hardFailedWithoutText) && attempt < attempts - 1) {
            await sleep(SNAPSHOT_SETTLE_DELAY_MS);
            continue;
        }
        break;
    }

    if (!snapshot) return null;
    applyJobSnapshot(snapshot, context);
    return snapshot;
}

export async function fetchAndApplyRunnerTurn(
    sessionId: string | undefined,
    turnId: string | null | undefined,
    context: BaseExecutionContext,
) {
    if (!sessionId || !turnId) return null;
    const turn = await context.api.request<RunnerChatTurn>(
        `/internal/v1/runner-chat/sessions/${encodeURIComponent(sessionId)}/turns/${encodeURIComponent(turnId)}`,
        { signal: context.activeController.signal },
    );
    const runnerId =
        (context as { selectedRunnerId?: string }).selectedRunnerId ||
        context.readAssistant()?.runnerId;
    context.applyRunnerStructuredResult?.(turn.final_text, runnerId);
    const turnResultText =
        turn.final_text?.trim() ||
        JSON.stringify({
            assistant_message_id: turn.assistant_message_id,
            error_message: turn.error_message || turn.error || '',
            final_text: turn.final_text || '',
            status: turn.status,
        });
    const displayText = normalizeResultDisplayText(turnResultText, runnerId);
    applyRecoveredFinalText(displayText, context);
    const latest = context.readAssistant();
    const live = isLiveRunnerTurnStatus(turn.status);
    const emptyAfterToolWork =
        !live && !displayText.trim() && assistantHasToolWork(latest);
    if (emptyAfterToolWork) {
        context.updateActivity(
            (entry) =>
                entry.type === 'completion' && entry.status === 'running',
            {
                status: 'attention',
                label: 'Completed turn',
                detail: 'Tool work completed without a final assistant message.',
            },
        );
        if (!context.sanitizeAssistantText(latest?.content || '')) {
            context.replaceAssistantContent(EMPTY_FINAL_TEXT_WARNING);
            if (
                !hasTextPartContent(
                    context.readAssistant(),
                    EMPTY_FINAL_TEXT_WARNING,
                    context.sanitizeAssistantText,
                )
            ) {
                context.appendCompleteTextPart(EMPTY_FINAL_TEXT_WARNING);
            }
        }
        context.updateAssistant({
            status: 'attention',
            error: EMPTY_FINAL_USER_MESSAGE,
            errorCode: 'empty_final_text',
            backendMessageId: turn.assistant_message_id,
            runnerChatTurnId: turn.id,
            runnerChatSessionId: turn.session_id,
            agentCliRunId: turn.agent_cli_run_id,
            jobId: turn.agent_cli_job_id,
        });
        return turn;
    }
    context.updateAssistant({
        status:
            turn.status === 'approval_required'
                ? 'attention'
                : live
                  ? 'streaming'
                  : turn.status === 'failed' ||
                      turn.status === 'aborted' ||
                      turn.status === 'timed_out'
                    ? 'failed'
                    : 'complete',
        error:
            displayText.trim() || turn.status === 'approval_required'
                ? undefined
                : turn.error,
        errorCode: displayText.trim() ? undefined : latest?.errorCode,
        approvalState:
            turn.status === 'approval_required'
                ? 'pending'
                : context.readAssistant()?.approvalState,
        backendMessageId: turn.assistant_message_id,
        runnerChatTurnId: turn.id,
        runnerChatSessionId: turn.session_id,
        agentCliRunId: turn.agent_cli_run_id,
        jobId: turn.agent_cli_job_id,
    });
    return turn;
}

export async function streamFollowRunnerTurn(
    context: FollowRunnerTurnStreamContext,
): Promise<AssistantExecutionResult> {
    let sawStreamEvent = false;
    let streamEndedWithFailure = false;

    context.updateAssistant({
        runnerChatTurnId: context.runnerChatTurnId,
        runnerChatSessionId: context.runnerChatSessionId,
    });

    const path = `/internal/v1/runner-chat/sessions/${encodeURIComponent(context.runnerChatSessionId)}/turns/${encodeURIComponent(context.runnerChatTurnId)}/stream`;
    for await (const event of withStreamWatchdog(
        context.api.stream(path, {
            method: 'GET',
            signal: context.activeController.signal,
        }),
        path,
    )) {
        sawStreamEvent = true;
        const result = context.applyEvent(
            normalizeRunnerChatEvent(event as RunnerChatEvent),
        );
        streamEndedWithFailure = streamEndedWithFailure || result.failed;
    }

    await fetchAndApplyRunnerTurn(
        context.runnerChatSessionId,
        context.runnerChatTurnId,
        context,
    );

    return {
        sawStreamEvent,
        streamEndedWithFailure,
        streamedJobId: null,
        runnerChatTurnForRecovery: {
            sessionId: context.runnerChatSessionId,
            turnId: context.runnerChatTurnId,
        },
    };
}

export async function streamFollowJob(
    context: FollowJobStreamContext,
): Promise<AssistantExecutionResult> {
    let sawStreamEvent = false;
    let streamEndedWithFailure = false;
    let streamedJobId: string | null = context.followJobId;

    context.activeJobId.value = context.followJobId;
    context.updateAssistant({ jobId: context.followJobId });

    const path = `/internal/v1/jobs/${encodeURIComponent(context.followJobId)}/stream`;
    for await (const event of withStreamWatchdog(
        context.api.stream(path, {
            method: 'GET',
            signal: context.activeController.signal,
            onOpen(response) {
                const jobId = responseJobId(response) || context.followJobId;
                streamedJobId = jobId;
                context.activeJobId.value = jobId;
                context.updateAssistant({ jobId });
            },
        }),
        path,
    )) {
        sawStreamEvent = true;
        const result = context.applyEvent(event as JobEvent);
        streamEndedWithFailure = streamEndedWithFailure || result.failed;
    }

    return {
        sawStreamEvent,
        streamEndedWithFailure,
        streamedJobId,
        runnerChatTurnForRecovery: null,
    };
}

export async function streamRunnerChat(
    context: RunnerChatStreamContext,
): Promise<AssistantExecutionResult> {
    let sawStreamEvent = false;
    let streamEndedWithFailure = false;
    let streamedJobId: string | null = null;

    const desiredRunnerContinuationMode =
        context.payload.runnerContinuationMode ||
        context.session.runnerContinuationMode ||
        'replay';
    const runnerSession = context.payload.runnerChatSessionId
        ? await context.api.request<RunnerChatSession>(
              `/internal/v1/runner-chat/sessions/${encodeURIComponent(context.payload.runnerChatSessionId)}`,
              { signal: context.activeController.signal },
          )
        : await context.api.request<RunnerChatSession>(
              '/internal/v1/runner-chat/sessions',
              {
                  method: 'POST',
                  signal: context.activeController.signal,
                  body: {
                      app_session_key: context.session.sessionKey,
                      runner_id: context.selectedRunnerId,
                      continuation_mode: desiredRunnerContinuationMode,
                      model:
                          context.payload.runnerModel ||
                          context.session.runnerModel,
                      mode:
                          context.payload.runnerMode ||
                          context.session.runnerMode,
                      isolation:
                          context.payload.runnerIsolation ||
                          context.session.runnerIsolation,
                      cwd:
                          context.payload.runnerCwd ||
                          context.session.runnerCwd,
                      max_turns: context.payload.runnerMaxTurns || undefined,
                  },
              },
          );

    const effectiveRunnerContinuationMode =
        desiredRunnerContinuationMode === 'native' &&
        !runnerSession.native_session_ref
            ? 'replay'
            : desiredRunnerContinuationMode;

    context.chat.bindRunnerChatSession(context.session.id, runnerSession.id);
    context.updateAssistant({
        runnerId: context.selectedRunnerId,
        runnerLabel: context.payload.runnerLabel ?? context.session.runnerLabel,
        runnerChatSessionId: runnerSession.id,
    });

    const started = await context.api.request<RunnerChatTurnStartResponse>(
        `/internal/v1/runner-chat/sessions/${encodeURIComponent(runnerSession.id)}/turns`,
        {
            method: 'POST',
            signal: context.activeController.signal,
            body: {
                user_message: context.text,
                ...(toServiceAttachments(context.payload.attachments).length
                    ? {
                          attachments: toServiceAttachments(
                              context.payload.attachments,
                          ),
                      }
                    : {}),
                continuation_mode: effectiveRunnerContinuationMode,
                model:
                    context.payload.runnerModel || context.session.runnerModel,
                mode: context.payload.runnerMode || context.session.runnerMode,
                isolation:
                    context.payload.runnerIsolation ||
                    context.session.runnerIsolation,
                cwd: context.payload.runnerCwd || context.session.runnerCwd,
                max_turns: context.payload.runnerMaxTurns || undefined,
                ...(context.payload.runnerThinkingLevel
                    ? {
                          thinking_level: context.payload.runnerThinkingLevel,
                          meta: {
                              runner_thinking_level:
                                  context.payload.runnerThinkingLevel,
                          },
                      }
                    : {}),
                ...(context.payload.approvalToken
                    ? { approval_token: context.payload.approvalToken }
                    : {}),
                ...(context.payload.runnerPermission
                    ? {
                          runner_permission: {
                              runner_id:
                                  context.payload.runnerPermission.runnerId,
                              kind: context.payload.runnerPermission.kind,
                              access: context.payload.runnerPermission.access,
                              target_path:
                                  context.payload.runnerPermission.targetPath,
                          },
                      }
                    : {}),
            },
        },
    );

    streamedJobId = started.job_id ?? null;
    if (streamedJobId) context.activeJobId.value = streamedJobId;
    context.updateAssistant({
        jobId: streamedJobId ?? undefined,
        runnerChatSessionId: runnerSession.id,
        runnerChatTurnId: started.turn_id,
    });
    context.flushAssistantUpdates?.();
    const assistantId = context.readAssistant()?.id;
    if (assistantId) context.chat.flushMessage?.(assistantId);

    const path = `/internal/v1/runner-chat/sessions/${encodeURIComponent(runnerSession.id)}/turns/${encodeURIComponent(started.turn_id)}/stream`;
    for await (const event of withStreamWatchdog(
        context.api.stream(path, {
            method: 'GET',
            signal: context.activeController.signal,
        }),
        path,
    )) {
        sawStreamEvent = true;
        const normalized = normalizeRunnerChatEvent(event as RunnerChatEvent);
        const jobId = eventJobId(normalized);
        if (jobId) {
            streamedJobId = jobId;
            context.activeJobId.value = jobId;
            context.updateAssistant({ jobId });
        }
        const result = context.applyEvent(normalized);
        streamEndedWithFailure = streamEndedWithFailure || result.failed;
    }

    await fetchAndApplyRunnerTurn(runnerSession.id, started.turn_id, context);

    return {
        sawStreamEvent,
        streamEndedWithFailure,
        streamedJobId,
        runnerChatTurnForRecovery: {
            sessionId: runnerSession.id,
            turnId: started.turn_id,
        },
    };
}

function isLiveRunnerTurnStatus(status: string | undefined) {
    const normalized = String(status || '')
        .trim()
        .toLowerCase();
    return normalized === 'queued' || normalized === 'running';
}

export async function handleRunnerExecutionError(
    context: AssistantSendErrorContext,
) {
    const errorCode = extractErrorCode(context.streamError);
    if (
        context.runnerChatTurnForRecovery &&
        errorCode === 'stream_idle_timeout'
    ) {
        try {
            const turn = await context.api.request<RunnerChatTurn>(
                `/internal/v1/runner-chat/sessions/${encodeURIComponent(context.runnerChatTurnForRecovery.sessionId)}/turns/${encodeURIComponent(context.runnerChatTurnForRecovery.turnId)}`,
                { signal: context.activeController.signal },
            );
            if (isLiveRunnerTurnStatus(turn.status)) {
                await fetchAndApplyRunnerTurn(
                    context.runnerChatTurnForRecovery.sessionId,
                    context.runnerChatTurnForRecovery.turnId,
                    context,
                );
                return;
            } else {
                await fetchAndApplyRunnerTurn(
                    context.runnerChatTurnForRecovery.sessionId,
                    context.runnerChatTurnForRecovery.turnId,
                    context,
                );
                const latest = context.readAssistant();
                if (latest?.status !== 'failed') {
                    return;
                }
            }
        } catch {
            // Surface the original streaming failure below.
        }
    } else if (context.runnerChatTurnForRecovery) {
        try {
            await fetchAndApplyRunnerTurn(
                context.runnerChatTurnForRecovery.sessionId,
                context.runnerChatTurnForRecovery.turnId,
                context,
            );
            const latest = context.readAssistant();
            if (latest?.status !== 'failed') {
                return;
            }
        } catch {
            // Surface the original streaming failure below.
        }
    }
    const friendlyErrorCode = extractErrorCode(context.streamError);
    const friendly = formatUserFacingErrorInline(
        context.streamError,
        friendlyErrorCode,
    );
    context.updateActivity((entry) => entry.status === 'running', {
        status: 'error',
    });
    context.updateAssistant({
        content: friendly,
        status: 'failed',
        error: userFacingErrorCopy(context.streamError, friendlyErrorCode)
            .message,
        errorCode: friendlyErrorCode,
        runnerChatSessionId:
            context.runnerChatTurnForRecovery?.sessionId ||
            context.readAssistant()?.runnerChatSessionId,
        runnerChatTurnId:
            context.runnerChatTurnForRecovery?.turnId ||
            context.readAssistant()?.runnerChatTurnId,
    });
    showFailureToast(
        context.toast,
        'Runner request failed',
        context.streamError,
    );
}

export async function handleAssistantSendError(
    context: AssistantSendErrorContext,
) {
    const jobId =
        context.activeJobId.value?.trim() ||
        context.readAssistant()?.jobId?.trim() ||
        '';
    if (jobId) {
        try {
            await fetchAndApplyJobSnapshot(jobId, context, {
                settleAfterStreamFailure: true,
            });
            if (context.readAssistant()?.status !== 'failed') {
                return;
            }
        } catch {
            // Fall through to user-facing error handling.
        }
    }
    const errorCode = extractErrorCode(context.streamError);
    const friendly = formatUserFacingErrorInline(
        context.streamError,
        errorCode,
    );
    context.updateActivity(
        (entry: ChatActivityEntry) => entry.status === 'running',
        { status: 'error' },
    );
    context.updateAssistant({
        content: friendly,
        status: 'failed',
        error: userFacingErrorCopy(context.streamError, errorCode).message,
        errorCode,
    });
    showFailureToast(
        context.toast,
        'Could not send message',
        context.streamError,
    );
}
