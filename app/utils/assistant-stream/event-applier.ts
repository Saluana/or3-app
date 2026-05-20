import type {
    AssistantReplayToolCall,
    ChatActivityEntry,
    ChatMessage,
    ChatMessagePart,
    ChatToolCall,
} from '~/types/app-state';
import type { JobEvent } from '~/types/or3-api';
import { createLogger } from '~/utils/logger';
import {
    canonicalActivityDetail,
    canonicalActivityKey,
    canonicalActivityLabel,
    canonicalActivityStatus,
    canonicalToolDisplayName,
    createActivity,
    isStructuredStdoutDiagnostic,
    previewValue,
    sanitizeAssistantText,
    truncateLogDetail,
} from './activity';
import { describeApprovalRequest, isApprovalRequiredPayload } from './approval';
import { extractApprovalRequestId, extractErrorCode } from './errors';
import { eventJobId, eventName, eventPayload, eventSequence } from './events';
import { normalizeRunnerPermissionPayload } from './payload';

interface AssistantEventApplierOptions {
    assistantId: string;
    readAssistant: () => ChatMessage | undefined;
    updateAssistant: (patch: Partial<ChatMessage>) => void;
    appendAssistantContent: (value: string) => void;
    replaceAssistantContent: (value: string) => void;
    upsertPart: (part: ChatMessagePart) => void;
    appendTextPart: (value: string) => void;
    appendCompleteTextPart: (value: string) => void;
    closeActiveTextPart: () => void;
    hasVisibleTextPart: () => boolean;
    hasTextPartContent: (content: string) => boolean;
    addActivity: (entry: ChatActivityEntry) => void;
    upsertActivity: (entry: ChatActivityEntry) => void;
    updateActivity: (
        predicate: (entry: ChatActivityEntry) => boolean,
        patch: Partial<ChatActivityEntry>,
    ) => void;
    completeRunningActivity: (types: string[]) => void;
    addToolCall: (name: string, args?: string, toolCallId?: string) => void;
    resolveToolCall: (
        name: string,
        result?: string,
        error?: string,
        statusOverride?: ChatToolCall['status'],
        toolCallId?: string,
    ) => void;
    findReplayableToolCall: (
        name: string,
    ) => AssistantReplayToolCall | undefined;
    setSawVisibleOutput: (value: boolean) => void;
    rawAssistantContent: () => string;
}

export function createAssistantEventApplier(
    options: AssistantEventApplierOptions,
) {
    const logger = createLogger('stream');
    const appliedEventSequenceKeys = new Set<string>();
    const streamedEventPayloadKeys = new Set<string>();
    const completionActivityId = 'activity:completion:final-response';
    const emptyFinalTextWarning =
        'Tool work completed, but or3-intern did not return a final assistant message. The last tool result is shown above; retry the turn if it still matters.';

    const markVisibleOutput = (value: string) => {
        if (sanitizeAssistantText(value)) {
            options.setSawVisibleOutput(true);
        }
    };

    const textPartContent = (part: ChatMessagePart) =>
        part.type === 'text' ? sanitizeAssistantText(part.content ?? '') : '';

    const isEmptyFinalWarningText = (value: string) =>
        sanitizeAssistantText(value) === sanitizeAssistantText(emptyFinalTextWarning);

    const removeEmptyFinalWarningParts = () => {
        const current = options.readAssistant();
        const parts = current?.parts;
        if (!parts?.length) return;
        const nextParts = parts.filter(
            (part) => !isEmptyFinalWarningText(textPartContent(part)),
        );
        if (nextParts.length !== parts.length) {
            options.updateAssistant({ parts: nextParts });
        }
    };

    const recoverEmptyFinalWithText = (assistantText: string) => {
        const current = options.readAssistant();
        const wasEmptyFinal =
            current?.errorCode === 'empty_final_text' ||
            isEmptyFinalWarningText(current?.content || '') ||
            Boolean(
                current?.parts?.some((part) =>
                    isEmptyFinalWarningText(textPartContent(part)),
                ),
            );
        options.replaceAssistantContent(assistantText);
        if (wasEmptyFinal) {
            removeEmptyFinalWarningParts();
            if (!options.hasTextPartContent(assistantText)) {
                options.appendCompleteTextPart(assistantText);
            }
            options.updateAssistant({
                error: undefined,
                errorCode: undefined,
            });
            return;
        }
        if (!options.hasVisibleTextPart()) {
            options.appendCompleteTextPart(assistantText);
        }
    };

    const explicitToolCallId = (payload?: Record<string, unknown>) =>
        String(
            payload?.tool_call_id || payload?.call_id || payload?.id || '',
        ).trim();

    const toolCallIdentity = (
        payload: Record<string, unknown> | undefined,
        toolName: string,
    ) => explicitToolCallId(payload) || `legacy:${toolName}`;

    const applyEvent = (
        event: JobEvent | { event?: string; json?: unknown },
        source: 'stream' | 'snapshot' = 'stream',
    ) => {
        const payload = eventPayload(event);
        const type = eventName(event);
        if (!type) return { failed: false, completed: false };

        const seq = eventSequence(event);
        const seqKey = seq !== undefined ? `seq:${seq}` : '';
        const payloadKey = `${type}:${JSON.stringify(payload ?? {})}`;
        if (seqKey && appliedEventSequenceKeys.has(seqKey)) {
            if (source !== 'snapshot') {
                logger.debug(
                    'event:skip_sequence',
                    'Duplicate event sequence skipped',
                    {
                        type,
                        sequence: seq,
                    },
                );
            }
            return { failed: false, completed: false };
        }
        if (source === 'snapshot' && streamedEventPayloadKeys.has(payloadKey)) {
            logger.debug('event:skip_replay', 'Snapshot replay event skipped', {
                type,
                sequence: seq,
            });
            return { failed: false, completed: false };
        }
        if (seqKey) appliedEventSequenceKeys.add(seqKey);
        if (source === 'stream') streamedEventPayloadKeys.add(payloadKey);
        logger.debug('event:apply', 'Stream event applied', {
            type,
            source,
            sequence: seq,
            jobId: eventJobId(event),
        });

        const delta = String(
            payload?.delta ?? payload?.text ?? payload?.content ?? '',
        );
        if (type === 'queued' || type === 'started') {
            options.addActivity(
                createActivity(
                    type,
                    type === 'queued' ? 'Queued turn' : 'Started turn',
                ),
            );
        }
        if (type === 'text_delta' && delta) {
            options.appendAssistantContent(delta);
            options.appendTextPart(delta);
            markVisibleOutput(delta);
        }
        if (type === 'output' && delta) {
            const normalized = delta.endsWith('\n') ? delta : `${delta}\n`;
            options.appendAssistantContent(normalized);
            options.appendTextPart(normalized);
            markVisibleOutput(delta);
        }
        if (type === 'runner_output' && delta) {
            if (isStructuredStdoutDiagnostic(payload)) {
                return { failed: false, completed: false };
            }
            options.addActivity(
                createActivity(
                    payload?.stream === 'stderr'
                        ? 'runner_stderr'
                        : 'runner_output',
                    payload?.stream === 'stderr'
                        ? 'Runner warning'
                        : 'Runner output',
                    truncateLogDetail(delta),
                    payload?.stream === 'stderr' ? 'error' : 'complete',
                ),
            );
        }
        if (type === 'content.delta' && delta) {
            const streamKind = String(payload?.stream_kind ?? 'unknown');
            if (streamKind === 'assistant_text') {
                options.appendAssistantContent(delta);
                options.appendTextPart(delta);
                markVisibleOutput(delta);
            } else if (
                streamKind === 'reasoning_text' ||
                streamKind === 'reasoning_summary_text'
            ) {
                options.updateAssistant({
                    reasoningText: `${options.readAssistant()?.reasoningText || ''}${delta}`,
                });
            } else {
                options.closeActiveTextPart();
                options.addActivity(
                    createActivity(
                        streamKind,
                        streamKind === 'command_output'
                            ? 'Command output'
                            : streamKind === 'file_change_output'
                              ? 'File change output'
                              : 'Runner output',
                        truncateLogDetail(delta),
                        'complete',
                    ),
                );
            }
        }
        if (
            type === 'item.started' ||
            type === 'item.updated' ||
            type === 'item.completed'
        ) {
            options.closeActiveTextPart();
            const itemType = String(payload?.item_type ?? 'unknown');
            const status = canonicalActivityStatus(
                payload?.status ??
                    (type === 'item.completed'
                        ? 'completed'
                        : type === 'item.started'
                          ? 'running'
                          : undefined),
            );
            const label = canonicalActivityLabel(itemType, payload?.title);
            const toolDisplayName = canonicalToolDisplayName(itemType, payload);
            const activityId = canonicalActivityKey(
                itemType,
                toolDisplayName,
                payload,
            );
            options.upsertActivity(
                createActivity(
                    itemType,
                    toolDisplayName,
                    canonicalActivityDetail(payload),
                    status,
                    activityId,
                ),
            );
            if (
                itemType !== 'assistant_message' &&
                itemType !== 'reasoning' &&
                itemType !== 'plan'
            ) {
                const data =
                    payload?.data && typeof payload.data === 'object'
                        ? (payload.data as Record<string, unknown>)
                        : {};
                const toolCallId = String(
                    data.callID ||
                        data.id ||
                        payload?.id ||
                        `${itemType}:${label}`,
                );
                options.upsertPart({
                    id: `tool:${toolCallId}`,
                    type: 'tool',
                    toolCallId,
                    name: toolDisplayName,
                    status,
                    argumentsPreview: previewValue(
                        data.command ??
                            data.arguments ??
                            data.input ??
                            (data.state && typeof data.state === 'object'
                                ? (data.state as Record<string, unknown>).input
                                : '') ??
                            '',
                        2_000,
                    ),
                    resultPreview: previewValue(
                        data.result ??
                            data.output ??
                            (data.state && typeof data.state === 'object'
                                ? (data.state as Record<string, unknown>).output
                                : '') ??
                            payload?.detail ??
                            '',
                        4_000,
                    ),
                    errorPreview:
                        status === 'error'
                            ? String(payload?.detail ?? data.error ?? '')
                            : undefined,
                });
            }
        }
        if (type === 'request.opened' || type === 'request.resolved') {
            options.closeActiveTextPart();
            const status =
                type === 'request.opened'
                    ? 'attention'
                    : canonicalActivityStatus(payload?.status);
            options.addActivity(
                createActivity(
                    String(payload?.request_type ?? 'runner_request'),
                    String(
                        payload?.title ||
                            (type === 'request.opened'
                                ? 'Runner needs attention'
                                : 'Runner request resolved'),
                    ),
                    canonicalActivityDetail(payload),
                    status,
                ),
            );
        }
        if (type === 'turn.plan.updated' || type === 'turn.diff.updated') {
            options.closeActiveTextPart();
            options.addActivity(
                createActivity(
                    type,
                    type === 'turn.plan.updated'
                        ? 'Plan updated'
                        : 'Diff updated',
                    canonicalActivityDetail(payload),
                    'complete',
                ),
            );
        }
        if (type === 'runtime.warning') {
            options.addActivity(
                createActivity(
                    'runtime_warning',
                    'Runner warning',
                    canonicalActivityDetail(payload),
                    'attention',
                ),
            );
        }
        if (type === 'runtime.error') {
            options.addActivity(
                createActivity(
                    'runtime_error',
                    'Runner error',
                    canonicalActivityDetail(payload),
                    'error',
                ),
            );
        }
        if (type === 'turn.completed') {
            options.completeRunningActivity([
                'queued',
                'started',
                'tool_call',
                'command_execution',
                'file_change',
                'mcp_tool_call',
                'web_search',
                'collab_agent_tool_call',
                'dynamic_tool_call',
                'unknown',
            ]);
            options.updateAssistant({ status: 'complete' });
            return { failed: false, completed: true };
        }
        const finalText = payload?.final_text;
        const assistantContent =
            typeof payload?.content === 'string' ? payload.content : '';
        const assistantText =
            typeof finalText === 'string' && finalText.trim()
                ? finalText
                : type === 'assistant'
                  ? assistantContent
                  : '';
        if (assistantText.trim()) {
            recoverEmptyFinalWithText(assistantText);
            markVisibleOutput(assistantText);
        }
        if (type === 'tool_call') {
            options.closeActiveTextPart();
            const toolName = String(payload?.name || 'tool');
            const toolCallId = String(toolCallIdentity(payload, toolName));
            options.addToolCall(
                toolName,
                typeof payload?.arguments === 'string'
                    ? payload.arguments
                    : undefined,
                toolCallId,
            );
            options.upsertPart({
                id: `tool:${toolCallId}`,
                type: 'tool',
                toolCallId,
                name: toolName,
                status: 'running',
                argumentsPreview: previewValue(
                    payload?.arguments_preview ?? payload?.arguments ?? '',
                    2_000,
                ),
            });
        }
        if (type === 'tool_result') {
            options.closeActiveTextPart();
            const toolName = String(payload?.name || 'tool');
            const toolCallId = toolCallIdentity(payload, toolName);
            const approvalRequired = isApprovalRequiredPayload(payload);
            const toolError =
                typeof payload?.error === 'string' ? payload.error : undefined;
            options.resolveToolCall(
                toolName,
                typeof payload?.result === 'string'
                    ? payload.result
                    : undefined,
                toolError,
                approvalRequired ? 'attention' : undefined,
                toolCallId,
            );
            options.upsertPart({
                id: `tool:${toolCallId}`,
                type: 'tool',
                toolCallId,
                name: toolName,
                status: approvalRequired
                    ? 'attention'
                    : toolError
                      ? 'error'
                      : 'complete',
                resultPreview: previewValue(
                    payload?.result_preview ?? payload?.result ?? '',
                    4_000,
                ),
                errorPreview: toolError,
                artifactId:
                    typeof payload?.artifact_id === 'string'
                        ? payload.artifact_id
                        : undefined,
                publicCode:
                    typeof payload?.public_code === 'string'
                        ? payload.public_code
                        : typeof payload?.code === 'string'
                          ? payload.code
                          : undefined,
            });
            const approvalRequestId = extractApprovalRequestId(payload);
            if (approvalRequestId) {
                options.setSawVisibleOutput(true);
                const current = options.readAssistant();
                const replayToolCall = options.findReplayableToolCall(toolName);
                const baseRetryPayload =
                    current?.retryPayload ??
                    options.readAssistant()?.retryPayload;
                const approvalMessage = describeApprovalRequest(
                    toolName,
                    replayToolCall?.arguments,
                );
                const content =
                    current?.content?.trim() &&
                    !current.content.includes('**Tool:**')
                        ? `${current.content.trim()}\n\n${approvalMessage}`
                        : approvalMessage;
                if (!options.hasTextPartContent(approvalMessage)) {
                    options.appendCompleteTextPart(approvalMessage);
                }
                options.addActivity(
                    createActivity(
                        'approval_required',
                        'Waiting for approval',
                        approvalMessage,
                        'attention',
                    ),
                );
                options.updateAssistant({
                    status: 'attention',
                    error: undefined,
                    approvalRequestId,
                    approvalState: 'pending',
                    errorCode: 'approval_required',
                    retryPayload: baseRetryPayload
                        ? {
                              ...baseRetryPayload,
                              ...(replayToolCall ? { replayToolCall } : {}),
                              continueMessageId: options.assistantId,
                              suppressUserEcho: true,
                          }
                        : undefined,
                    content,
                });
            }
        }
        if (
            type === 'reasoning_delta' &&
            typeof payload?.content === 'string'
        ) {
            options.updateAssistant({
                reasoningText: `${options.readAssistant()?.reasoningText || ''}${payload.content}`,
            });
        }
        if (type === 'runtime_error') {
            options.addActivity(
                createActivity(
                    'runtime_error',
                    'Runtime error',
                    String(payload?.message || 'Unknown runtime error'),
                    'error',
                ),
            );
        }

        const streamError = String(
            payload?.error ?? payload?.message ?? '',
        ).trim();
        const streamStatus = String(payload?.status ?? '').trim();
        const approvalRequired = isApprovalRequiredPayload(payload);
        if (
            !approvalRequired &&
            (streamError ||
                streamStatus === 'failed' ||
                streamStatus === 'aborted')
        ) {
            const failureText =
                streamError ||
                sanitizeAssistantText(options.rawAssistantContent()) ||
                options.readAssistant()?.content ||
                'or3-intern could not finish this request.';
            options.updateAssistant({
                content: failureText,
                status: 'failed',
                error: streamError || `Turn ${streamStatus || 'failed'}`,
                errorCode: extractErrorCode(payload),
                approvalRequestId: extractApprovalRequestId(payload),
                approvalState: extractApprovalRequestId(payload)
                    ? 'pending'
                    : undefined,
                jobId: eventJobId(event) ?? undefined,
            });
            return { failed: true, completed: false };
        }

        if (streamStatus === 'approval_required') {
            options.completeRunningActivity(['queued', 'started', 'tool_call']);
            const approvalRequestId = extractApprovalRequestId(payload);
            const current = options.readAssistant();
            const baseRetryPayload =
                current?.retryPayload ?? options.readAssistant()?.retryPayload;
            const runnerPermission = normalizeRunnerPermissionPayload(
                payload?.runner_permission,
            );
            options.updateAssistant({
                content:
                    options.readAssistant()?.content ||
                    'Approval is needed before or3-intern can continue.',
                status: 'attention',
                error: undefined,
                errorCode: 'approval_required',
                approvalRequestId,
                approvalState: approvalRequestId ? 'pending' : undefined,
                retryPayload: baseRetryPayload
                    ? {
                          ...baseRetryPayload,
                          ...(runnerPermission ? { runnerPermission } : {}),
                          continueMessageId: options.assistantId,
                          suppressUserEcho: true,
                      }
                    : undefined,
                jobId: eventJobId(event) ?? undefined,
            });
            return { failed: false, completed: true };
        }

        if (
            streamStatus === 'completed' ||
            streamStatus === 'complete' ||
            streamStatus === 'succeeded' ||
            streamStatus === 'success'
        ) {
            const jobId = eventJobId(event) ?? undefined;
            const finalText =
                typeof payload?.final_text === 'string'
                    ? payload.final_text.trim()
                    : '';
            const currentAssistant = options.readAssistant();
            const hasToolWork = Boolean(
                currentAssistant?.toolCalls?.length ||
                currentAssistant?.parts?.some((part) => part.type === 'tool') ||
                currentAssistant?.activityLog?.some((entry) =>
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
            options.completeRunningActivity([
                'queued',
                'started',
                'tool_call',
                'command_execution',
                'file_change',
                'mcp_tool_call',
                'web_search',
                'collab_agent_tool_call',
                'dynamic_tool_call',
                'unknown',
            ]);
            if (!finalText && hasToolWork && source === 'stream' && jobId) {
                options.upsertActivity(
                    createActivity(
                        'completion',
                        'Finalizing response',
                        'Tool work completed. Waiting for the final assistant message…',
                        'running',
                        completionActivityId,
                    ),
                );
                options.updateAssistant({
                    status: 'streaming',
                    error: undefined,
                    errorCode: undefined,
                    jobId,
                });
                return { failed: false, completed: true };
            }
            if (!finalText && hasToolWork) {
                options.upsertActivity(
                    createActivity(
                        'completion',
                        'Completed turn',
                        'Tool work completed without a final assistant message.',
                        'attention',
                        completionActivityId,
                    ),
                );
                if (!sanitizeAssistantText(currentAssistant?.content || '')) {
                    options.replaceAssistantContent(emptyFinalTextWarning);
                    if (!options.hasTextPartContent(emptyFinalTextWarning)) {
                        options.appendCompleteTextPart(emptyFinalTextWarning);
                    }
                }
                options.setSawVisibleOutput(true);
                options.updateAssistant({
                    status: 'attention',
                    error: 'or3-intern completed without a final assistant message.',
                    errorCode: 'empty_final_text',
                    jobId,
                });
                logger.warn(
                    'completion:empty_final_text',
                    'Completion had no final assistant text',
                    {
                        jobId: eventJobId(event),
                        hasToolWork,
                        source,
                    },
                );
                return { failed: false, completed: true };
            }
            options.upsertActivity(
                createActivity(
                    'completion',
                    'Completed turn',
                    finalText
                        ? undefined
                        : options.readAssistant()?.toolCalls?.length
                          ? 'Tool work completed without a final assistant message.'
                          : 'No final text was included in the completion event.',
                    'complete',
                    completionActivityId,
                ),
            );
            options.updateAssistant({ status: 'complete', jobId });
            return { failed: false, completed: true };
        }

        return { failed: false, completed: false };
    };

    return { applyEvent };
}
