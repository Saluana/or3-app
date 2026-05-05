import { ref, watch } from 'vue';
import type { JobEvent, JobSnapshot, TurnResponse } from '~/types/or3-api';
import type {
    AssistantSendPayload,
    AssistantReplayToolCall,
    ChatActivityEntry,
    ChatToolCall,
    Or3AppErrorCode,
} from '~/types/app-state';
import { useChatSessions } from './useChatSessions';
import { useActiveHost } from './useActiveHost';
import { useLocalCache } from './useLocalCache';
import { useOr3Api } from './useOr3Api';

const isStreaming = ref(false);
const activeJobId = ref<string | null>(null);
let controller: AbortController | null = null;
let recoveryWatcherInstalled = false;
const recoveryAttempted = new Set<string>();

function describeRequestError(error: unknown) {
    if (error instanceof Error && error.message.trim()) return error.message;
    if (error && typeof error === 'object' && 'message' in error) {
        const message = String(
            (error as { message?: unknown }).message ?? '',
        ).trim();
        if (message) return message;
    }
    return 'Request failed';
}

function describeRequestErrorDetails(error: unknown) {
    if (!error || typeof error !== 'object') return '';
    const record = error as Record<string, unknown>;
    const details = [
        typeof record.code === 'string' ? `Code: ${record.code}` : '',
        typeof record.status === 'number' ? `HTTP: ${record.status}` : '',
        typeof record.request_id === 'string' ||
        typeof record.request_id === 'number'
            ? `Request: ${record.request_id}`
            : '',
    ].filter(Boolean);

    if (record.cause instanceof Error && record.cause.message.trim()) {
        details.push(`Cause: ${record.cause.message}`);
    }

    return details.join(' · ');
}

const knownErrorCodes = new Set<Or3AppErrorCode>([
    'host_unreachable',
    'auth_required',
    'session_required',
    'session_expired',
    'passkey_required',
    'step_up_required',
    'auth_unsupported',
    'forbidden',
    'rate_limited',
    'validation_failed',
    'capability_unavailable',
    'approval_required',
    'stream_failed',
    'file_not_found',
    'path_forbidden',
    'terminal_unavailable',
    'unknown',
]);

function extractErrorCode(error: unknown): Or3AppErrorCode | undefined {
    if (!error || typeof error !== 'object') return undefined;
    const record = error as Record<string, unknown>;
    if (
        typeof record.code === 'string' &&
        knownErrorCodes.has(record.code as Or3AppErrorCode)
    ) {
        return record.code as Or3AppErrorCode;
    }
    if (record.cause && typeof record.cause === 'object') {
        const nestedCode: Or3AppErrorCode | undefined = extractErrorCode(
            record.cause,
        );
        if (nestedCode) return nestedCode;
    }
    return undefined;
}

function extractApprovalRequestId(error: unknown): string | number | undefined {
    if (!error || typeof error !== 'object') return undefined;
    const record = error as Record<string, unknown>;
    const directId =
        record.request_id ?? record.approval_id ?? record.approval_request_id;
    if (typeof directId === 'string' || typeof directId === 'number') {
        return directId;
    }
    if (record.cause && typeof record.cause === 'object') {
        return extractApprovalRequestId(record.cause);
    }
    return undefined;
}

function showFailureToast(
    toast: ReturnType<typeof useToast>,
    title: string,
    error: unknown,
) {
    const message = describeRequestError(error);
    const details = describeRequestErrorDetails(error);

    toast.add({
        title,
        description: details ? `${message}\n${details}` : message,
        color: 'error',
        icon: 'i-pixelarticons-warning-box',
    });
}

function now() {
    return new Date().toISOString();
}

function createToolCall(name: string, args?: string): ChatToolCall {
    return {
        id: `tool_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`,
        name,
        status: 'running',
        arguments: args,
        startedAt: now(),
    };
}

function createActivity(
    type: string,
    label: string,
    detail?: string,
    status: ChatActivityEntry['status'] = 'running',
): ChatActivityEntry {
    return {
        id: `activity_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`,
        type,
        label,
        detail,
        status,
        createdAt: now(),
    };
}

function normalizePayload(
    input: string | AssistantSendPayload,
): AssistantSendPayload {
    if (typeof input === 'string')
        return {
            text: input.trim(),
            transportText: input.trim(),
            attachments: [],
        };
    return {
        text: input.text.trim(),
        transportText: (input.transportText || input.text).trim(),
        attachments: input.attachments ?? [],
        approvalToken: input.approvalToken,
        followJobId: input.followJobId,
        replayToolCall: input.replayToolCall,
        continueMessageId: input.continueMessageId,
        suppressUserEcho: input.suppressUserEcho,
    };
}

function retryPayloadForStorage(
    payload: AssistantSendPayload,
): AssistantSendPayload {
    return {
        text: payload.text,
        transportText: payload.transportText,
        attachments: payload.attachments ?? [],
        approvalToken: payload.approvalToken,
        replayToolCall: payload.replayToolCall,
        continueMessageId: payload.continueMessageId,
        suppressUserEcho: payload.suppressUserEcho,
    };
}

function sanitizeAssistantText(text: string) {
    if (!text) return '';

    return text
        .replace(/<tool_call>[\s\S]*?<\/tool_call>/gi, '')
        .replace(/<tool_call[\s\S]*$/i, '')
        .replace(/<\/tool_call>/gi, '')
        .replace(/<function=[^>]*>/gi, '')
        .replace(/<parameter=[^>]*>/gi, '')
        .replace(/<function=[\s\S]*$/i, '')
        .replace(/<parameter=[\s\S]*$/i, '')
        .replace(
            /<\s*[|｜]\s*DSML\s*[|｜]\s*tool_calls\s*>[\s\S]*?<\s*\/\s*[|｜]\s*DSML\s*[|｜]\s*tool_calls\s*>/gi,
            '',
        )
        .replace(/<\s*[|｜]\s*DSML\s*[|｜]\s*tool_calls[\s\S]*$/i, '')
        .replace(
            /<\s*\/?\s*[|｜]\s*DSML\s*[|｜]\s*(?:invoke|parameter)[^>]*>/gi,
            '',
        )
        .trim();
}

function truncateLogDetail(value: string, limit = 500) {
    return value.length > limit ? `${value.slice(0, limit)}\n...` : value;
}

function isApprovalRequiredPayload(payload?: Record<string, unknown>) {
    if (!payload) return false;
    if (String(payload.code ?? '').trim() === 'approval_required') return true;
    return extractApprovalRequestId(payload) !== undefined;
}

function parseJsonRecord(value?: string) {
    if (!value) return undefined;
    try {
        const parsed = JSON.parse(value);
        return parsed && typeof parsed === 'object'
            ? (parsed as Record<string, unknown>)
            : undefined;
    } catch {
        return undefined;
    }
}

function quoteCommandPart(value: string) {
    return /^[\w./:@%+=,-]+$/.test(value) ? value : JSON.stringify(value);
}

function formatCommandPreview(parts: unknown[]) {
    const normalized = parts
        .map((part) =>
            typeof part === 'string' || typeof part === 'number'
                ? String(part)
                : typeof part === 'boolean'
                  ? String(part)
                  : '',
        )
        .filter(Boolean)
        .map(quoteCommandPart);
    return truncateLogDetail(normalized.join(' '), 180);
}

function firstNonEmptyString(
    record: Record<string, unknown> | undefined,
    ...keys: string[]
) {
    if (!record) return '';
    for (const key of keys) {
        const value = record[key];
        if (typeof value === 'string' && value.trim()) return value.trim();
    }
    return '';
}

export function describeApprovalRequest(toolName: string, argsJson?: string) {
    const args = parseJsonRecord(argsJson);
    const normalizedTool = toolName.trim() || 'tool';
    const cwd = firstNonEmptyString(args, 'cwd');

    if (normalizedTool === 'exec') {
        const program = firstNonEmptyString(args, 'program');
        const command = firstNonEmptyString(args, 'command');
        const rawArgs = Array.isArray(args?.args) ? args?.args : [];
        const commandPreview = program
            ? formatCommandPreview([program, ...rawArgs])
            : command
              ? rawArgs.length
                  ? formatCommandPreview([command, ...rawArgs])
                  : truncateLogDetail(command, 180)
              : '';
        const location = cwd ? `\n**Working directory:** \`${cwd}\`` : '';
        return [
            'Approval is needed before or3-intern can continue.',
            '',
            '**Tool:** `exec`',
            commandPreview
                ? `**Requested action:** Run the local command \`${commandPreview}\``
                : '**Requested action:** Run a local command on this machine.',
            location,
            '',
            'Approve if this is the command you expected. Deny it if you do not want this command to run.',
        ]
            .join('\n')
            .replace(/\n{3,}/g, '\n\n');
    }

    if (normalizedTool === 'run_skill_script') {
        const skillName = firstNonEmptyString(args, 'skillName', 'skill_name');
        const commandName = firstNonEmptyString(
            args,
            'commandName',
            'command_name',
            'entrypoint',
            'path',
        );
        return [
            'Approval is needed before or3-intern can continue.',
            '',
            '**Tool:** `run_skill_script`',
            `**Requested action:** Run ${
                skillName ? `the skill \`${skillName}\`` : 'a skill script'
            }${commandName ? ` using \`${commandName}\`` : ''}.`,
            '',
            'Approve if this is the skill action you expected. Deny it if it looks wrong.',
        ].join('\n');
    }

    const path =
        firstNonEmptyString(args, 'path', 'file', 'artifact_id') ||
        firstNonEmptyString(args, 'url');
    return [
        'Approval is needed before or3-intern can continue.',
        '',
        `**Tool:** \`${normalizedTool}\``,
        path
            ? `**Requested action:** Use this tool with \`${truncateLogDetail(path, 140)}\`.`
            : `**Requested action:** Use the \`${normalizedTool}\` tool with the current request.`,
        '',
        'Approve if this matches what you asked for. Deny it if it looks unexpected.',
    ].join('\n');
}

function eventPayload(event: JobEvent | { event?: string; json?: unknown }) {
    const json = 'json' in event ? event.json : undefined;
    const data = 'data' in event ? event.data : undefined;
    if (json && typeof json === 'object')
        return json as Record<string, unknown>;
    if (data && typeof data === 'object')
        return data as Record<string, unknown>;
    return undefined;
}

function eventName(event: JobEvent | { event?: string; json?: unknown }) {
    const payload = eventPayload(event);
    return String(
        ('event' in event ? event.event : '') ||
            ('type' in event ? event.type : '') ||
            payload?.type ||
            '',
    );
}

function eventSequence(event: JobEvent | { event?: string; json?: unknown }) {
    if ('sequence' in event && typeof event.sequence === 'number')
        return event.sequence;
    const payload = eventPayload(event);
    return typeof payload?.sequence === 'number' ? payload.sequence : undefined;
}

function eventJobId(event: JobEvent | { event?: string; json?: unknown }) {
    const payload = eventPayload(event);
    return typeof payload?.job_id === 'string' ? payload.job_id : undefined;
}

function responseJobId(response: Response) {
    const header = response.headers.get('X-Or3-Job-Id')?.trim();
    return header || null;
}

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
                    Boolean(message.jobId) &&
                    sessionIds.has(message.sessionId),
            )
            .sort(
                (left, right) =>
                    Date.parse(left.createdAt || '') -
                    Date.parse(right.createdAt || ''),
            )[0];

        if (!pendingMessage?.jobId) return;

        const recoveryKey = `${hostId}:${pendingMessage.id}:${pendingMessage.jobId}`;
        if (recoveryAttempted.has(recoveryKey)) return;

        recoveryAttempted.add(recoveryKey);
        try {
            await send({
                text: pendingMessage.retryPayload?.text || pendingMessage.content,
                transportText:
                    pendingMessage.retryPayload?.transportText ||
                    pendingMessage.retryPayload?.text ||
                    pendingMessage.content,
                attachments: pendingMessage.retryPayload?.attachments || [],
                followJobId: pendingMessage.jobId,
                continueMessageId: pendingMessage.id,
                suppressUserEcho: true,
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
                            Boolean(message.jobId) &&
                            sessionIds.has(message.sessionId),
                    )
                    .map((message) => `${message.id}:${message.jobId}:${message.status}`)
                    .join('|');
                return `${hostId}:${tokenState}:${pending}`;
            },
            () => {
                void recoverPendingMessages();
            },
            { immediate: true },
        );
    }

    async function send(message: string | AssistantSendPayload) {
        const payload = normalizePayload(message);
        const followJobId = payload.followJobId?.trim() || '';
        const text = payload.transportText || payload.text;
        if ((!text && !followJobId) || isStreaming.value) return;

        const storedRetryPayload = retryPayloadForStorage(payload);

        const session = chat.ensureSession();
        if (!payload.suppressUserEcho) {
            chat.addMessage({
                sessionId: session.id,
                role: 'user',
                content: payload.text,
                attachments: payload.attachments,
                status: 'complete',
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
                  activityLog: [],
              });
        isStreaming.value = true;
        const activeController = new AbortController();
        controller = activeController;
        let rawAssistantContent = existingAssistant?.content || '';
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
        const turnRequest = followJobId
            ? null
            : {
                  session_key: session.sessionKey,
                  message: text,
                  tool_policy: { mode: 'allow_all' as const },
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
              };
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
            if (seqKey && appliedEventSequenceKeys.has(seqKey))
                return { failed: false, completed: false };
            if (
                source === 'snapshot' &&
                streamedEventPayloadKeys.has(payloadKey)
            )
                return { failed: false, completed: false };
            if (seqKey) appliedEventSequenceKeys.add(seqKey);
            if (source === 'stream') streamedEventPayloadKeys.add(payloadKey);

            const delta = String(
                payload?.delta ?? payload?.text ?? payload?.content ?? '',
            );
            if (type === 'queued' || type === 'started') {
                addActivity(
                    createActivity(
                        type,
                        type === 'queued' ? 'Queued turn' : 'Started turn',
                    ),
                );
            }
            if (type === 'text_delta' && delta) {
                appendAssistantContent(delta);
                sawVisibleOutput =
                    sawVisibleOutput ||
                    !!sanitizeAssistantText(rawAssistantContent);
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
                replaceAssistantContent(assistantText);
                sawVisibleOutput =
                    sawVisibleOutput || !!sanitizeAssistantText(assistantText);
            }
            if (type === 'tool_call') {
                addToolCall(
                    String(payload?.name || 'tool'),
                    typeof payload?.arguments === 'string'
                        ? payload.arguments
                        : undefined,
                );
            }
            if (type === 'tool_result') {
                const toolName = String(payload?.name || 'tool');
                const approvalRequired = isApprovalRequiredPayload(payload);
                const toolError =
                    typeof payload?.error === 'string'
                        ? payload.error
                        : undefined;
                resolveToolCall(
                    toolName,
                    typeof payload?.result === 'string'
                        ? payload.result
                        : undefined,
                    toolError,
                    approvalRequired ? 'attention' : undefined,
                );
                const approvalRequestId = extractApprovalRequestId(payload);
                if (approvalRequestId) {
                    sawVisibleOutput = true;
                    const current = readAssistant();
                    const replayToolCall = findReplayableToolCall(toolName);
                    const baseRetryPayload =
                        current?.retryPayload ?? readAssistant()?.retryPayload;
                    const approvalMessage = describeApprovalRequest(
                        toolName,
                        replayToolCall?.arguments,
                    );
                    const content =
                        current?.content?.trim() &&
                        !current.content.includes('**Tool:**')
                            ? `${current.content.trim()}\n\n${approvalMessage}`
                            : approvalMessage;
                    addActivity(
                        createActivity(
                            'approval_required',
                            'Waiting for approval',
                            approvalMessage,
                            'attention',
                        ),
                    );
                    updateAssistant({
                        status: 'attention',
                        error: undefined,
                        approvalRequestId,
                        approvalState: 'pending',
                        errorCode: 'approval_required',
                        retryPayload: baseRetryPayload
                            ? {
                                  ...baseRetryPayload,
                                  ...(replayToolCall ? { replayToolCall } : {}),
                                  continueMessageId: assistant.id,
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
                updateAssistant({
                    reasoningText: `${readAssistant()?.reasoningText || ''}${payload.content}`,
                });
            }
            if (type === 'runtime_error') {
                addActivity(
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
                    sanitizeAssistantText(rawAssistantContent) ||
                    readAssistant()?.content ||
                    'or3-intern could not finish this request.';
                updateAssistant({
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
                completeRunningActivity(['queued', 'started', 'tool_call']);
                const approvalRequestId = extractApprovalRequestId(payload);
                updateAssistant({
                    content:
                        readAssistant()?.content ||
                        'Approval is needed before or3-intern can continue.',
                    status: 'attention',
                    error: undefined,
                    errorCode: 'approval_required',
                    approvalRequestId,
                    approvalState: approvalRequestId ? 'pending' : undefined,
                    jobId: eventJobId(event) ?? undefined,
                });
                return { failed: false, completed: true };
            }

            if (streamStatus === 'completed') {
                completeRunningActivity(['queued', 'started', 'tool_call']);
                addActivity(
                    createActivity(
                        'completion',
                        'Completed turn',
                        typeof payload?.final_text === 'string' &&
                            payload.final_text.trim()
                            ? undefined
                            : 'No final text was included in the completion event.',
                        'complete',
                    ),
                );
                updateAssistant({ status: 'complete' });
                return { failed: false, completed: true };
            }

            return { failed: false, completed: false };
        };
        const applyJobSnapshot = (snapshot: JobSnapshot) => {
            activeJobId.value = snapshot.job_id;
            updateAssistant({ jobId: snapshot.job_id });
            for (const event of snapshot.events ?? [])
                applyEvent(event, 'snapshot');
            const snapshotText =
                snapshot.final_text?.trim() || snapshot.error?.trim() || '';
            if (snapshotText && !sawVisibleOutput) {
                replaceAssistantContent(snapshotText);
                sawVisibleOutput =
                    sawVisibleOutput || !!sanitizeAssistantText(snapshotText);
            }
            updateAssistant({
                status:
                    snapshot.status === 'approval_required'
                        ? 'attention'
                        : snapshot.error ||
                            snapshot.status === 'failed' ||
                            snapshot.status === 'aborted'
                          ? 'failed'
                          : 'complete',
                error:
                    snapshot.status === 'approval_required'
                        ? undefined
                        : snapshot.error,
                errorCode:
                    snapshot.status === 'approval_required'
                        ? 'approval_required'
                        : readAssistant()?.errorCode,
                approvalState:
                    snapshot.status === 'approval_required'
                        ? 'pending'
                        : readAssistant()?.approvalState,
                jobId: snapshot.job_id,
            });
        };
        const fetchAndApplyJobSnapshot = async (jobId?: string | null) => {
            if (!jobId) return null;
            const snapshot = await api.request<JobSnapshot>(
                `/internal/v1/jobs/${encodeURIComponent(jobId)}`,
                {
                    signal: activeController.signal,
                },
            );
            applyJobSnapshot(snapshot);
            return snapshot;
        };

        try {
            let sawStreamEvent = false;
            let streamEndedWithFailure = false;
            let streamedJobId: string | null = followJobId || null;

            if (followJobId) {
                activeJobId.value = followJobId;
                updateAssistant({ jobId: followJobId });
                for await (const event of api.stream(
                    `/internal/v1/jobs/${encodeURIComponent(followJobId)}/stream`,
                    {
                        method: 'GET',
                        signal: activeController.signal,
                        onOpen(response) {
                            const jobId = responseJobId(response) || followJobId;
                            activeJobId.value = jobId;
                            updateAssistant({ jobId });
                        },
                    },
                )) {
                    sawStreamEvent = true;
                    const result = applyEvent(event);
                    streamEndedWithFailure =
                        streamEndedWithFailure || result.failed;
                }
            } else {
                for await (const event of api.stream('/internal/v1/turns', {
                    body: turnRequest,
                    signal: activeController.signal,
                    onOpen(response) {
                        const jobId = responseJobId(response);
                        if (!jobId) return;
                        streamedJobId = jobId;
                        activeJobId.value = jobId;
                        updateAssistant({ jobId });
                    },
                })) {
                    sawStreamEvent = true;
                    const jobId = eventJobId(event);
                    if (jobId) {
                        streamedJobId = jobId;
                        activeJobId.value = jobId;
                        updateAssistant({ jobId });
                    }
                    const result = applyEvent(event);
                    streamEndedWithFailure =
                        streamEndedWithFailure || result.failed;
                }
            }

            if (streamedJobId) {
                try {
                    await fetchAndApplyJobSnapshot(streamedJobId);
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

            try {
                const response = await api.request<TurnResponse>(
                    '/internal/v1/turns',
                    {
                        body: turnRequest,
                        signal: activeController.signal,
                    },
                );
                activeJobId.value = response.job_id;
                if (response.job_id) {
                    try {
                        await fetchAndApplyJobSnapshot(response.job_id);
                    } catch {
                        replaceAssistantContent(
                            response.final_text ||
                                response.error ||
                                'The turn completed without text.',
                        );
                        updateAssistant({
                            status:
                                response.status === 'approval_required'
                                    ? 'attention'
                                    : response.error
                                      ? 'failed'
                                      : 'complete',
                            error:
                                response.status === 'approval_required'
                                    ? undefined
                                    : response.error,
                            errorCode:
                                response.status === 'approval_required'
                                    ? 'approval_required'
                                    : response.error
                                      ? 'unknown'
                                      : undefined,
                            approvalRequestId:
                                response.request_id ?? response.approval_id,
                            approvalState:
                                response.status === 'approval_required'
                                    ? 'pending'
                                    : undefined,
                            jobId: response.job_id,
                        });
                    }
                } else {
                    replaceAssistantContent(
                        response.final_text ||
                            response.error ||
                            'The turn completed without text.',
                    );
                    updateAssistant({
                        status:
                            response.status === 'approval_required'
                                ? 'attention'
                                : response.error
                                  ? 'failed'
                                  : 'complete',
                        error:
                            response.status === 'approval_required'
                                ? undefined
                                : response.error,
                        errorCode:
                            response.status === 'approval_required'
                                ? 'approval_required'
                                : response.error
                                  ? 'unknown'
                                  : undefined,
                        approvalRequestId:
                            response.request_id ?? response.approval_id,
                        approvalState:
                            response.status === 'approval_required'
                                ? 'pending'
                                : undefined,
                        jobId: response.job_id,
                    });
                }
                completeRunningActivity(['queued', 'started', 'tool_call']);
            } catch (error) {
                const primaryError = error || streamError;
                const message = describeRequestError(primaryError);
                const details = describeRequestErrorDetails(primaryError);
                const approvalRequestId =
                    extractApprovalRequestId(primaryError);
                updateActivity((entry) => entry.status === 'running', {
                    status: 'error',
                });
                updateAssistant({
                    content: details ? `${message}\n\n${details}` : message,
                    status: 'failed',
                    error: message,
                    errorCode: extractErrorCode(primaryError),
                    approvalRequestId,
                    approvalState: approvalRequestId ? 'pending' : undefined,
                });
                showFailureToast(
                    toast,
                    'or3-intern request failed',
                    primaryError,
                );
            }
        } finally {
            isStreaming.value = false;
            if (controller === activeController) controller = null;
        }
    }

    function stop() {
        controller?.abort();
        isStreaming.value = false;
    }

    return { isStreaming, activeJobId, send, stop };
}
