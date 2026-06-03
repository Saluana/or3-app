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
import {
    buildInlineApprovalContent,
    describeApprovalRequest,
    extractApprovalMetadata,
    inferApprovalMetadataFromToolPayload,
    isApprovalRequiredPayload,
} from './approval';
import {
    extractApprovalRequestId,
    extractErrorCode,
    formatUserFacingErrorInline,
} from './errors';
import { EMPTY_FINAL_USER_MESSAGE, userFacingErrorCopy } from './userErrorCopy';
import { eventJobId, eventName, eventPayload, eventSequence } from './events';
import { normalizeRunnerPermissionPayload } from './payload';

function normalizeStreamEventType(type: string) {
    return type.trim().toLowerCase().replace(/_/g, '.');
}

function isTurnTerminalFailureEvent(
    type: string,
    payload: Record<string, unknown> | undefined,
    approvalRequired: boolean,
) {
    if (approvalRequired) return false;

    const normalized = normalizeStreamEventType(type);
    if (
        normalized === 'runtime.error' ||
        normalized === 'runtime.warning' ||
        normalized === 'tool.result'
    ) {
        return false;
    }

    if (normalized === 'error' || normalized === 'failed') {
        return true;
    }

    const streamStatus = String(payload?.status ?? '')
        .trim()
        .toLowerCase();
    if (streamStatus === 'failed' || streamStatus === 'aborted') {
        return (
            normalized === 'completion' ||
            normalized === 'completed' ||
            normalized === 'complete' ||
            normalized === 'done'
        );
    }

    const streamError = String(payload?.error ?? '').trim();
    return (
        Boolean(streamError) &&
        (normalized === 'error' || normalized === 'failed')
    );
}

function turnTerminalFailureText(
    type: string,
    payload: Record<string, unknown> | undefined,
) {
    const normalized = normalizeStreamEventType(type);
    if (normalized === 'error' || normalized === 'failed') {
        return String(payload?.error ?? payload?.message ?? '').trim();
    }
    return String(payload?.error ?? '').trim();
}

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
    appendFinalTextToExistingContent?: boolean;
    rawAssistantContent: () => string;
}

export function createAssistantEventApplier(
    options: AssistantEventApplierOptions,
) {
    const logger = createLogger('stream');
    const appliedEventSequenceKeys = new Set<string>();
    const streamedEventPayloadKeys = new Set<string>();
    const MAX_DEDUPE_KEYS = 512;

    const rememberDedupeKey = (set: Set<string>, key: string) => {
        if (!key) return;
        if (set.size >= MAX_DEDUPE_KEYS) set.clear();
        set.add(key);
    };

    const clearDedupeKeys = () => {
        appliedEventSequenceKeys.clear();
        streamedEventPayloadKeys.clear();
    };
    const completionActivityId = 'activity:completion:final-response';
    const emptyFinalTextWarning = EMPTY_FINAL_USER_MESSAGE;

    const markVisibleOutput = (value: string) => {
        if (sanitizeAssistantText(value)) {
            options.setSawVisibleOutput(true);
        }
    };

    const textPartContent = (part: ChatMessagePart) =>
        part.type === 'text' ? sanitizeAssistantText(part.content ?? '') : '';

    const isEmptyFinalWarningText = (value: string) =>
        sanitizeAssistantText(value) ===
        sanitizeAssistantText(emptyFinalTextWarning);

    const isApprovalPlaceholderText = (value: string) => {
        const normalized = sanitizeAssistantText(value).toLowerCase();
        if (!normalized) return false;
        return (
            normalized.includes(
                'approval is needed before or3-intern can continue',
            ) ||
            normalized.includes('approval is needed before or3 can continue') ||
            normalized.includes('approve to let or3-intern continue') ||
            normalized.includes(
                'approve if this is the command you expected',
            ) ||
            normalized.includes('approve if this matches what you asked for') ||
            normalized.includes('deny to stop here')
        );
    };

    const hasPriorResumeContext = (assistant: ChatMessage | undefined) =>
        Boolean(
            assistant?.parts?.some((part) => {
                if (part.type === 'tool') return true;
                const text = textPartContent(part);
                return Boolean(
                    text &&
                    !isApprovalPlaceholderText(text) &&
                    !isEmptyFinalWarningText(text),
                );
            }),
        );

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
        const normalizedIncoming = sanitizeAssistantText(assistantText);
        const currentText = sanitizeAssistantText(current?.content || '');
        if (
            currentText &&
            normalizedIncoming.length > currentText.length &&
            normalizedIncoming.endsWith(currentText)
        ) {
            // Keep clean streamed assistant text when final_text includes a reasoning prefix.
            if (!options.hasVisibleTextPart()) {
                options.appendCompleteTextPart(currentText);
            }
            return;
        }
        const wasEmptyFinal =
            current?.errorCode === 'empty_final_text' ||
            isEmptyFinalWarningText(current?.content || '') ||
            Boolean(
                current?.parts?.some((part) =>
                    isEmptyFinalWarningText(textPartContent(part)),
                ),
            );
        markVisibleOutput(assistantText);
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

    const appendFinalTextToExistingContent = (assistantText: string) => {
        const normalized = sanitizeAssistantText(assistantText);
        if (!normalized) return;

        const current = options.readAssistant();
        const currentText = sanitizeAssistantText(current?.content || '');
        const wasEmptyFinal =
            current?.errorCode === 'empty_final_text' ||
            isEmptyFinalWarningText(current?.content || '') ||
            Boolean(
                current?.parts?.some((part) =>
                    isEmptyFinalWarningText(textPartContent(part)),
                ),
            );
        const shouldReplace =
            wasEmptyFinal ||
            !currentText ||
            (isApprovalPlaceholderText(currentText) &&
                !hasPriorResumeContext(current));

        markVisibleOutput(normalized);

        if (shouldReplace) {
            options.replaceAssistantContent(normalized);
            if (wasEmptyFinal) removeEmptyFinalWarningParts();
            if (!options.hasTextPartContent(normalized)) {
                options.appendCompleteTextPart(normalized);
            }
            options.updateAssistant({
                error: undefined,
                errorCode: undefined,
            });
            return;
        }

        if (currentText === normalized || currentText.endsWith(normalized)) {
            if (!options.hasVisibleTextPart()) {
                options.appendCompleteTextPart(normalized);
            }
            options.updateAssistant({
                error: undefined,
                errorCode: undefined,
            });
            return;
        }

        options.closeActiveTextPart();
        options.appendAssistantContent(`\n\n${normalized}`);
        if (!options.hasTextPartContent(normalized)) {
            options.appendTextPart(normalized);
        }
        options.closeActiveTextPart();
        options.updateAssistant({
            error: undefined,
            errorCode: undefined,
        });
    };

    const applyFinalText = (assistantText: string) => {
        if (options.appendFinalTextToExistingContent) {
            appendFinalTextToExistingContent(assistantText);
            return;
        }
        recoverEmptyFinalWithText(assistantText);
    };

    const explicitToolCallId = (payload?: Record<string, unknown>) =>
        String(
            payload?.tool_call_id || payload?.call_id || payload?.id || '',
        ).trim();

    const lastRuntimeErrorDetail = () => {
        const activity = options.readAssistant()?.activityLog ?? [];
        for (let index = activity.length - 1; index >= 0; index--) {
            const entry = activity[index];
            if (entry?.type !== 'runtime_error') continue;
            const detail = String(entry.detail ?? '').trim();
            if (detail) return detail;
        }
        return '';
    };

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
        if (type === 'keepalive') {
            return { failed: false, completed: false };
        }

        const seq = eventSequence(event);
        const seqKey = seq !== undefined ? `seq:${seq}` : '';
        const deltaFingerprint = String(
            payload?.delta ??
                payload?.text ??
                payload?.content ??
                payload?.chunk ??
                '',
        ).slice(0, 120);
        const payloadKey = [
            type,
            seq ?? '',
            explicitToolCallId(payload),
            String(payload?.status ?? ''),
            String(payload?.phase ?? ''),
            seq === undefined ? deltaFingerprint : '',
        ].join(':');
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
        if (seqKey) rememberDedupeKey(appliedEventSequenceKeys, seqKey);
        if (source === 'stream')
            rememberDedupeKey(streamedEventPayloadKeys, payloadKey);
        logger.debug('event:apply', 'Stream event applied', {
            type,
            source,
            sequence: seq,
            jobId: eventJobId(event),
        });

        const delta = String(
            payload?.delta ??
                payload?.text ??
                payload?.content ??
                payload?.chunk ??
                '',
        );
        // #region agent log
        if (
            delta &&
            (type === 'text_delta' ||
                type === 'reasoning_delta' ||
                type === 'content.delta')
        ) {
            const rawPayload =
                payload?.raw && typeof payload.raw === 'object'
                    ? (payload.raw as Record<string, unknown>)
                    : undefined;
            const rawPart =
                rawPayload?.part && typeof rawPayload.part === 'object'
                    ? (rawPayload.part as Record<string, unknown>)
                    : undefined;
            fetch(
                'http://127.0.0.1:7845/ingest/f9918b6c-53f1-4b7a-a810-8a4b7fbf8eb8',
                {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'X-Debug-Session-Id': '3fa1b1',
                    },
                    body: JSON.stringify({
                        sessionId: '3fa1b1',
                        runId: 'pre-fix',
                        hypothesisId: 'A-D',
                        location: 'event-applier.ts:stream-delta',
                        message: 'Stream delta event received',
                        data: {
                            sseType: type,
                            payloadType: payload?.type,
                            streamKind: payload?.stream_kind,
                            partKind: rawPart?.kind ?? payload?.kind,
                            deltaPreview: delta.slice(0, 120),
                            hasContentField: typeof payload?.content === 'string',
                            hasDeltaField: typeof payload?.delta === 'string',
                            hasTextField: typeof payload?.text === 'string',
                        },
                        timestamp: Date.now(),
                    }),
                },
            ).catch(() => {});
        }
        // #endregion
        if (type === 'queued' || type === 'started') {
            options.addActivity(
                createActivity(
                    type,
                    type === 'queued' ? 'Queued turn' : 'Started turn',
                ),
            );
        }
        if (type === 'text_delta' && delta) {
            // #region agent log
            fetch(
                'http://127.0.0.1:7845/ingest/f9918b6c-53f1-4b7a-a810-8a4b7fbf8eb8',
                {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'X-Debug-Session-Id': '3fa1b1',
                    },
                    body: JSON.stringify({
                        sessionId: '3fa1b1',
                        runId: 'pre-fix',
                        hypothesisId: 'A',
                        location: 'event-applier.ts:text_delta',
                        message: 'Appending text_delta to assistant content',
                        data: {
                            deltaPreview: delta.slice(0, 120),
                            streamKind: payload?.stream_kind,
                            contentBeforeLen:
                                options.readAssistant()?.content?.length ?? 0,
                        },
                        timestamp: Date.now(),
                    }),
                },
            ).catch(() => {});
            // #endregion
            options.appendAssistantContent(delta);
            options.appendTextPart(delta);
            markVisibleOutput(delta);
        }
        if ((type === 'output' || type === 'output_truncated') && delta) {
            options.closeActiveTextPart();
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
                // #region agent log
                fetch(
                    'http://127.0.0.1:7845/ingest/f9918b6c-53f1-4b7a-a810-8a4b7fbf8eb8',
                    {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                            'X-Debug-Session-Id': '3fa1b1',
                        },
                        body: JSON.stringify({
                            sessionId: '3fa1b1',
                            runId: 'pre-fix',
                            hypothesisId: 'C',
                            location: 'event-applier.ts:content.delta-reasoning',
                            message: 'Routing content.delta to reasoningText',
                            data: {
                                streamKind,
                                deltaPreview: delta.slice(0, 120),
                            },
                            timestamp: Date.now(),
                        }),
                    },
                ).catch(() => {});
                // #endregion
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
            applyFinalText(assistantText);
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
            const toolError = toolResultError(payload);
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
                const baseRetryPayload =
                    current?.retryPayload ??
                    options.readAssistant()?.retryPayload;
                const inferredApproval = inferApprovalMetadataFromToolPayload(
                    toolName,
                    payload,
                );
                const approvalMetadata = {
                    ...extractApprovalMetadata(payload),
                    ...inferredApproval,
                };
                const approvalMessage = buildInlineApprovalContent({
                    approvalType: approvalMetadata.approvalType,
                    approvalPreview: approvalMetadata.approvalPreview,
                    toolName,
                    argsJson: options.findReplayableToolCall(toolName)?.arguments,
                });
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
                    approvalType: approvalMetadata.approvalType,
                    approvalPreview: approvalMetadata.approvalPreview,
                    retryPayload: baseRetryPayload
                        ? {
                              ...baseRetryPayload,
                              continueMessageId: options.assistantId,
                              suppressUserEcho: true,
                          }
                        : undefined,
                    content,
                });
            }
            return { failed: false, completed: false };
        }
        if (
            type === 'reasoning_delta' &&
            (typeof payload?.content === 'string' ||
                typeof payload?.delta === 'string' ||
                typeof payload?.text === 'string')
        ) {
            const reasoningDelta = String(
                payload?.content ?? payload?.delta ?? payload?.text ?? '',
            );
            // #region agent log
            fetch(
                'http://127.0.0.1:7845/ingest/f9918b6c-53f1-4b7a-a810-8a4b7fbf8eb8',
                {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'X-Debug-Session-Id': '3fa1b1',
                    },
                    body: JSON.stringify({
                        sessionId: '3fa1b1',
                        runId: 'post-fix',
                        hypothesisId: 'B-C',
                        location: 'event-applier.ts:reasoning_delta',
                        message: 'Routing reasoning_delta to reasoningText',
                        data: {
                            reasoningDeltaPreview: reasoningDelta.slice(0, 120),
                            streamKind: payload?.stream_kind,
                        },
                        timestamp: Date.now(),
                    }),
                },
            ).catch(() => {});
            // #endregion
            options.updateAssistant({
                reasoningText: `${options.readAssistant()?.reasoningText || ''}${reasoningDelta}`,
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
            return { failed: false, completed: false };
        }

        const streamStatus = String(payload?.status ?? '').trim();
        const approvalRequired = isApprovalRequiredPayload(payload);
        const streamError = turnTerminalFailureText(type, payload);
        if (isTurnTerminalFailureEvent(type, payload, approvalRequired)) {
            const errorCode = extractErrorCode(payload);
            const effectiveStreamError =
                streamError === 'job failed'
                    ? lastRuntimeErrorDetail() || streamError
                    : streamError;
            const failureCopy = userFacingErrorCopy(
                effectiveStreamError
                    ? { message: effectiveStreamError, code: errorCode }
                    : payload,
                errorCode,
            );
            const failureText = formatUserFacingErrorInline(
                effectiveStreamError
                    ? { message: effectiveStreamError, code: errorCode }
                    : payload,
                errorCode,
            );
            options.updateAssistant({
                content: failureText,
                status: 'failed',
                error: failureCopy.message,
                errorCode,
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
            const inferredApproval = inferApprovalMetadataFromToolPayload(
                '',
                payload,
            );
            const approvalMetadata = {
                ...extractApprovalMetadata(payload),
                ...inferredApproval,
            };
            const approvalMessage =
                approvalMetadata.approvalType === 'tool_quota'
                    ? buildInlineApprovalContent({
                          approvalType: approvalMetadata.approvalType,
                          approvalPreview: approvalMetadata.approvalPreview,
                      })
                    : options.readAssistant()?.content ||
                      'Approval is needed before or3-intern can continue.';
            options.updateAssistant({
                content: approvalMessage,
                status: 'attention',
                error: undefined,
                errorCode: 'approval_required',
                approvalRequestId,
                approvalState: approvalRequestId ? 'pending' : undefined,
                approvalType: approvalMetadata.approvalType,
                approvalPreview: approvalMetadata.approvalPreview,
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
            if (finalText) {
                applyFinalText(finalText);
            }
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
                    error: EMPTY_FINAL_USER_MESSAGE,
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

    const applyEventWithCleanup = (
        event: JobEvent | { event?: string; json?: unknown },
        source: 'stream' | 'snapshot' = 'stream',
    ) => {
        const result = applyEvent(event, source);
        if (result.completed) clearDedupeKeys();
        return result;
    };

    return {
        applyEvent: applyEventWithCleanup,
        applyFinalText,
        clearDedupeKeys,
    };
}

function toolResultError(
    payload: Record<string, unknown> | undefined,
): string | undefined {
    const explicit =
        typeof payload?.error === 'string' ? payload.error.trim() : '';
    if (explicit) return explicit;

    const result =
        typeof payload?.result === 'string' ? payload.result.trim() : '';
    if (result) {
        try {
            const parsed = JSON.parse(result) as {
                ok?: boolean;
                summary?: string;
            };
            if (parsed?.ok === false) {
                return parsed.summary?.trim() || 'Tool failed';
            }
        } catch {
            // Non-JSON tool output; fall through to status handling.
        }
    }

    const status = String(payload?.status ?? '')
        .trim()
        .toLowerCase();
    if (status === 'failed' || status === 'error') {
        if (result) return result.slice(0, 500);
        const publicCode =
            typeof payload?.public_code === 'string'
                ? payload.public_code.trim()
                : '';
        return publicCode || 'Tool failed';
    }

    return undefined;
}

export { toolResultError };
