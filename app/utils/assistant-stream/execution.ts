import type { Ref } from "vue";
import type {
    AssistantSendPayload,
    ChatActivityEntry,
    ChatMessage,
    ChatSession,
    ChatToolCall,
} from "~/types/app-state";
import type {
    JobEvent,
    JobSnapshot,
    RunnerChatEvent,
    RunnerChatSession,
    RunnerChatTurn,
    RunnerChatTurnStartResponse,
    ToolPolicy,
    TurnResponse,
} from "~/types/or3-api";
import { createActivity } from "./activity";
import { normalizeResultDisplayText } from "~/utils/or3/result-display";
import {
    describeRequestError,
    describeRequestErrorDetails,
    downgradeToolPolicyForServiceCapability,
    extractApprovalRequestId,
    extractErrorCode,
    isServiceCapabilityCeilingError,
    showFailureToast,
    type ToastLike,
} from "./errors";
import { eventJobId, normalizeRunnerChatEvent, responseJobId } from "./events";
import { useChatRuntimeLog } from "~/composables/useChatRuntimeLog";

interface StreamApiLike {
    request<T>(
        path: string,
        options?: {
            method?: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
            body?: unknown;
            signal?: AbortSignal;
        },
    ): Promise<T>;
    stream(
        path: string,
        options?: {
            method?: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
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
        source?: "stream" | "snapshot",
    ) => { failed: boolean; completed: boolean };
    replaceAssistantContent: (value: string) => void;
    appendCompleteTextPart: (value: string) => void;
    sawVisibleOutput: () => boolean;
    setSawVisibleOutput: (value: boolean) => void;
    sanitizeAssistantText: (value: string) => string;
    applyRunnerStructuredResult?: (
        value?: string | null,
        runnerId?: string,
    ) => void;
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

interface DirectStreamContext extends BaseExecutionContext {
    turnRequest: Record<string, unknown> | null;
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

interface RunnerErrorContext extends BaseExecutionContext {
    toast: ToastLike;
    streamError: unknown;
    runnerChatTurnForRecovery: RunnerChatTurnRef | null;
}

interface DirectRecoveryContext extends BaseExecutionContext {
    api: StreamApiLike;
    toast: ToastLike;
    streamError: unknown;
    payload: AssistantSendPayload;
    turnRequest: Record<string, unknown> | null;
    requestedToolPolicy?: ToolPolicy;
    activeHostId: string;
    rememberServiceCapabilityCeilingHost: (hostId?: string | null) => void;
    buildTurnRequest: (toolPolicy?: ToolPolicy) => Record<string, unknown>;
    fetchAndApplyJobSnapshot: (
        jobId?: string | null,
    ) => Promise<JobSnapshot | null>;
}

const COMPLETION_ACTIVITY_TYPES = [
    "queued",
    "started",
    "completion",
    "tool_call",
    "command_execution",
    "file_change",
    "mcp_tool_call",
    "web_search",
    "collab_agent_tool_call",
    "dynamic_tool_call",
    "unknown",
];

const STREAM_IDLE_TIMEOUT_MS = 45_000;

function isLiveJobStatus(status: string) {
    return ["queued", "running", "started"].includes(
        String(status || "")
            .trim()
            .toLowerCase(),
    );
}

function streamIdleTimeoutError(path: string) {
    return {
        code: "stream_idle_timeout",
        message:
            "The live stream stopped sending updates. OR3 will reconcile from the job snapshot.",
        path,
    };
}

function assistantHasToolWork(message: ChatMessage | undefined) {
    return Boolean(
        message?.toolCalls?.length ||
            message?.parts?.some((part) => part.type === "tool") ||
            message?.activityLog?.some((entry) =>
                [
                    "tool_call",
                    "tool_result",
                    "command_execution",
                    "file_change",
                    "mcp_tool_call",
                    "web_search",
                    "collab_agent_tool_call",
                    "dynamic_tool_call",
                ].includes(entry.type),
            ),
    );
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
    runtimeLog.add("job", "snapshot:apply", undefined, {
        jobId: snapshot.job_id,
        status: snapshot.status,
        events: snapshot.events?.length ?? 0,
    });
    for (const event of snapshot.events ?? []) {
        context.applyEvent(event, "snapshot");
    }
    const latest = context.readAssistant();
    const snapshotText =
        snapshot.final_text?.trim() || snapshot.error?.trim() || "";
    if (
        snapshotText &&
        (!context.sawVisibleOutput() || latest?.errorCode === "empty_final_text")
    ) {
        context.replaceAssistantContent(snapshotText);
        context.appendCompleteTextPart(snapshotText);
        context.setSawVisibleOutput(
            Boolean(context.sanitizeAssistantText(snapshotText)),
        );
    }
    const hasToolWork = assistantHasToolWork(latest);
    const emptyFinalAfterSnapshot =
        !snapshotText &&
        !snapshot.error &&
        snapshot.status !== "approval_required" &&
        !isLiveJobStatus(snapshot.status) &&
        hasToolWork;
    if (emptyFinalAfterSnapshot) {
        context.updateActivity(
            (entry) =>
                entry.type === "completion" && entry.status === "running",
            {
                status: "attention",
                label: "Completed turn",
                detail: "Tool work completed without a final assistant message.",
            },
        );
        const warning =
            "Tool work completed, but or3-intern did not return a final assistant message. The last tool result is shown above; retry the turn if it still matters.";
        context.addActivity(
            createActivity(
                "completion",
                "Completed turn",
                "Tool work completed without a final assistant message.",
                "attention",
            ),
        );
        if (!context.sanitizeAssistantText(latest?.content || "")) {
            context.replaceAssistantContent(warning);
            context.appendCompleteTextPart(warning);
        }
        context.setSawVisibleOutput(true);
        context.updateAssistant({
            status: "attention",
            error: "or3-intern completed without a final assistant message.",
            errorCode: "empty_final_text",
            jobId: snapshot.job_id,
        });
        return;
    }
    const preserveEmptyFinalAttention =
        latest?.status === "attention" &&
        latest.errorCode === "empty_final_text" &&
        !snapshotText &&
        !snapshot.error &&
        snapshot.status !== "approval_required";
    const nextStatus =
        snapshot.status === "approval_required"
            ? "attention"
            : preserveEmptyFinalAttention
              ? "attention"
            : snapshot.error ||
                snapshot.status === "failed" ||
                snapshot.status === "aborted"
              ? "failed"
              : isLiveJobStatus(snapshot.status)
                ? (latest?.status ?? "streaming")
                : "complete";
    context.updateAssistant({
        status: nextStatus,
        error:
            snapshot.status === "approval_required"
                ? undefined
                : snapshot.error,
        errorCode:
            snapshot.status === "approval_required"
                ? "approval_required"
                : context.readAssistant()?.errorCode,
        approvalState:
            snapshot.status === "approval_required"
                ? "pending"
                : context.readAssistant()?.approvalState,
        jobId: snapshot.job_id,
    });
}

export async function fetchAndApplyJobSnapshot(
    jobId: string | null | undefined,
    context: BaseExecutionContext,
) {
    if (!jobId) return null;
    const snapshot = await context.api.request<JobSnapshot>(
        `/internal/v1/jobs/${encodeURIComponent(jobId)}`,
        { signal: context.activeController.signal },
    );
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
    const displayText = normalizeResultDisplayText(turn.final_text, runnerId);
    if (displayText.trim() && !context.sawVisibleOutput()) {
        context.replaceAssistantContent(displayText);
        context.appendCompleteTextPart(displayText);
        context.setSawVisibleOutput(true);
    }
    context.updateAssistant({
        status:
            turn.status === "approval_required"
                ? "attention"
                : turn.status === "failed" ||
                    turn.status === "aborted" ||
                    turn.status === "timed_out"
                  ? "failed"
                  : "complete",
        error: turn.status === "approval_required" ? undefined : turn.error,
        approvalState:
            turn.status === "approval_required"
                ? "pending"
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
            method: "GET",
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
            method: "GET",
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
        "replay";
    const runnerSession = context.payload.runnerChatSessionId
        ? await context.api.request<RunnerChatSession>(
              `/internal/v1/runner-chat/sessions/${encodeURIComponent(context.payload.runnerChatSessionId)}`,
              { signal: context.activeController.signal },
          )
        : await context.api.request<RunnerChatSession>(
              "/internal/v1/runner-chat/sessions",
              {
                  method: "POST",
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
        desiredRunnerContinuationMode === "native" &&
        !runnerSession.native_session_ref
            ? "replay"
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
            method: "POST",
            signal: context.activeController.signal,
            body: {
                user_message: context.text,
                continuation_mode: effectiveRunnerContinuationMode,
                model:
                    context.payload.runnerModel || context.session.runnerModel,
                mode: context.payload.runnerMode || context.session.runnerMode,
                isolation:
                    context.payload.runnerIsolation ||
                    context.session.runnerIsolation,
                cwd: context.payload.runnerCwd || context.session.runnerCwd,
                max_turns: context.payload.runnerMaxTurns || undefined,
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

    const path = `/internal/v1/runner-chat/sessions/${encodeURIComponent(runnerSession.id)}/turns/${encodeURIComponent(started.turn_id)}/stream`;
    for await (const event of withStreamWatchdog(
        context.api.stream(path, {
            method: "GET",
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

export async function streamDirectTurn(
    context: DirectStreamContext,
): Promise<AssistantExecutionResult> {
    let sawStreamEvent = false;
    let streamEndedWithFailure = false;
    let streamedJobId: string | null = null;

    const path = "/internal/v1/turns";
    for await (const event of withStreamWatchdog(
        context.api.stream(path, {
            body: context.turnRequest,
            signal: context.activeController.signal,
            onOpen(response) {
                const jobId = responseJobId(response);
                if (!jobId) return;
                streamedJobId = jobId;
                context.activeJobId.value = jobId;
                context.updateAssistant({ jobId });
            },
        }),
        path,
    )) {
        sawStreamEvent = true;
        const jobId = eventJobId(event as JobEvent);
        if (jobId) {
            streamedJobId = jobId;
            context.activeJobId.value = jobId;
            context.updateAssistant({ jobId });
        }
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

export async function handleRunnerExecutionError(context: RunnerErrorContext) {
    if (context.runnerChatTurnForRecovery) {
        try {
            await fetchAndApplyRunnerTurn(
                context.runnerChatTurnForRecovery.sessionId,
                context.runnerChatTurnForRecovery.turnId,
                context,
            );
            context.updateActivity((entry) => entry.status === "running", {
                status: "error",
            });
            const latest = context.readAssistant();
            if (latest?.status === "failed") return;
        } catch {
            // Surface the original streaming failure below.
        }
    }
    const message = describeRequestError(context.streamError);
    const details = describeRequestErrorDetails(context.streamError);
    context.updateActivity((entry) => entry.status === "running", {
        status: "error",
    });
    context.updateAssistant({
        content: details ? `${message}\n\n${details}` : message,
        status: "failed",
        error: message,
        errorCode: extractErrorCode(context.streamError),
        runnerChatSessionId:
            context.runnerChatTurnForRecovery?.sessionId ||
            context.readAssistant()?.runnerChatSessionId,
        runnerChatTurnId:
            context.runnerChatTurnForRecovery?.turnId ||
            context.readAssistant()?.runnerChatTurnId,
    });
    showFailureToast(
        context.toast,
        "Runner request failed",
        context.streamError,
    );
}

export async function recoverDirectExecutionError(
    context: DirectRecoveryContext,
) {
    if (context.activeJobId.value) {
        try {
            const snapshot = await context.fetchAndApplyJobSnapshot(
                context.activeJobId.value,
            );
            if (snapshot) {
                if (isLiveJobStatus(snapshot.status)) {
                    context.updateAssistant({
                        status: "streaming",
                        error: "Live stream was interrupted. Reconnecting to the running job.",
                    });
                }
                return;
            }
        } catch {
            // Fall back to the existing non-stream recovery path.
        }
    }
    try {
        const capabilityCeilingError = isServiceCapabilityCeilingError(
            context.streamError,
        );
        const fallbackTurnRequest =
            context.turnRequest &&
            !context.payload.toolPolicy &&
            capabilityCeilingError
                ? context.buildTurnRequest(
                      downgradeToolPolicyForServiceCapability(
                          context.requestedToolPolicy,
                      ),
                  )
                : context.turnRequest;

        if (capabilityCeilingError) {
            context.rememberServiceCapabilityCeilingHost(context.activeHostId);
        }
        if (
            fallbackTurnRequest !== context.turnRequest &&
            (fallbackTurnRequest as { tool_policy?: { mode?: string } })
                ?.tool_policy?.mode === "ask"
        ) {
            context.addActivity(
                createActivity(
                    "policy_adjusted",
                    "Tool mode adjusted",
                    "This host only allows safe OR3 tools, so the request retried in Ask mode.",
                    "complete",
                ),
            );
        }

        const response = await context.api.request<TurnResponse>(
            "/internal/v1/turns",
            {
                body: fallbackTurnRequest,
                signal: context.activeController.signal,
            },
        );
        context.activeJobId.value = response.job_id;
        if (response.job_id) {
            try {
                await context.fetchAndApplyJobSnapshot(response.job_id);
            } catch {
                const emptyFinalText = !response.final_text && !response.error;
                const responseText =
                    response.final_text ||
                    response.error ||
                    "The turn completed without text.";
                context.replaceAssistantContent(responseText);
                context.updateAssistant({
                    status:
                        response.status === "approval_required"
                            ? "attention"
                            : emptyFinalText
                              ? "attention"
                            : response.error
                              ? "failed"
                              : "complete",
                    error:
                        response.status === "approval_required"
                            ? undefined
                            : response.error,
                    errorCode:
                        response.status === "approval_required"
                            ? "approval_required"
                            : emptyFinalText
                              ? "empty_final_text"
                            : response.error
                              ? "unknown"
                              : undefined,
                    approvalRequestId: extractApprovalRequestId(response),
                    approvalState:
                        response.status === "approval_required"
                            ? "pending"
                            : undefined,
                    jobId: response.job_id,
                });
            }
        } else {
            const emptyFinalText = !response.final_text && !response.error;
            const responseText =
                response.final_text ||
                response.error ||
                "The turn completed without text.";
            context.replaceAssistantContent(responseText);
            context.updateAssistant({
                status:
                    response.status === "approval_required"
                        ? "attention"
                        : emptyFinalText
                          ? "attention"
                        : response.error
                          ? "failed"
                          : "complete",
                error:
                    response.status === "approval_required"
                        ? undefined
                        : response.error,
                errorCode:
                    response.status === "approval_required"
                        ? "approval_required"
                        : emptyFinalText
                          ? "empty_final_text"
                        : response.error
                          ? "unknown"
                          : undefined,
                approvalRequestId: extractApprovalRequestId(response),
                approvalState:
                    response.status === "approval_required"
                        ? "pending"
                        : undefined,
                jobId: response.job_id,
            });
        }
        context.completeRunningActivity(COMPLETION_ACTIVITY_TYPES);
    } catch (error) {
        const primaryError = error || context.streamError;
        const message = describeRequestError(primaryError);
        const details = describeRequestErrorDetails(primaryError);
        const approvalRequestId = extractApprovalRequestId(primaryError);
        context.updateActivity(
            (entry: ChatActivityEntry) => entry.status === "running",
            {
                status: "error",
            },
        );
        context.updateAssistant({
            content: details ? `${message}\n\n${details}` : message,
            status: "failed",
            error: message,
            errorCode: extractErrorCode(primaryError),
            approvalRequestId,
            approvalState: approvalRequestId ? "pending" : undefined,
        });
        showFailureToast(
            context.toast,
            "or3-intern request failed",
            primaryError,
        );
    }
}
