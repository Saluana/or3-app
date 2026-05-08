import { ref, watch } from 'vue';
import type {
    ApprovalRequest,
    JobEvent,
    JobSnapshot,
    RunnerChatSession,
    RunnerChatTurn,
    RunnerChatTurnStartResponse,
    RunnerChatEvent,
    ToolPolicy,
    TurnResponse,
} from '~/types/or3-api';
import type {
    AssistantSendPayload,
    AssistantReplayToolCall,
    ChatActivityEntry,
    ChatMessagePart,
    ChatToolCall,
    Or3AppErrorCode,
} from '~/types/app-state';
import { formatApprovalSubjectPreview } from '~/utils/or3/approval-display';
import { normalizeApprovalRequest } from '~/utils/or3/approvals';
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
    'provider_error',
    'stream_error',
    'validation_error',
    'policy_error',
    'tool_execution_error',
    'tool_loop_limit',
    'aborted',
    'file_not_found',
    'path_forbidden',
    'terminal_unavailable',
    'runner_missing',
    'runner_auth_missing',
    'unsupported_native_session',
    'runner_chat_turn_active',
    'runner_chat_session_not_found',
    'runner_chat_turn_not_found',
    'runner_chat_aborted',
    'chat_session_not_found',
    'invalid_fork_anchor',
    'fork_anchor_incomplete',
    'unsupported_native_fork',
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
    if (
        typeof record.public_code === 'string' &&
        knownErrorCodes.has(record.public_code as Or3AppErrorCode)
    ) {
        return record.public_code as Or3AppErrorCode;
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
    const directApprovalId =
        record.approval_id ?? record.approval_request_id;
    if (
        typeof directApprovalId === 'string' ||
        typeof directApprovalId === 'number'
    ) {
        return directApprovalId;
    }
    const approvalState = String(
        record.code ?? record.status ?? record.approval_status ?? '',
    )
        .trim()
        .toLowerCase();
    const requestId = record.request_id;
    if (
        approvalState === 'approval_required' &&
        (typeof requestId === 'string' || typeof requestId === 'number')
    ) {
        return requestId;
    }
    if (record.cause && typeof record.cause === 'object') {
        return extractApprovalRequestId(record.cause);
    }
    return undefined;
}

function isServiceCapabilityCeilingError(error: unknown) {
    const message = describeRequestError(error).toLowerCase();
    return (
        message.includes('requested tools exceed service capability ceiling') ||
        message.includes('tool exceeds service capability ceiling')
    );
}

function downgradeToolPolicyForServiceCapability(
    policy?: ToolPolicy,
): ToolPolicy | undefined {
    if (!policy) return undefined;
    if (policy.mode === 'admin' || policy.mode === 'work') {
        return { mode: 'ask' };
    }
    return policy;
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
        mode: input.mode,
        toolPolicy: input.toolPolicy,
        approvalToken: input.approvalToken,
        followJobId: input.followJobId,
        replayToolCall: input.replayToolCall,
        continueMessageId: input.continueMessageId,
        suppressUserEcho: input.suppressUserEcho,
        runnerId: input.runnerId,
        runnerLabel: input.runnerLabel,
        runnerChatSessionId: input.runnerChatSessionId,
        runnerChatTurnId: input.runnerChatTurnId,
        runnerContinuationMode: input.runnerContinuationMode,
        runnerModel: input.runnerModel,
        runnerMode: input.runnerMode,
        runnerIsolation: input.runnerIsolation,
        runnerCwd: input.runnerCwd,
        runnerMaxTurns: input.runnerMaxTurns,
    };
}

function retryPayloadForStorage(
    payload: AssistantSendPayload,
): AssistantSendPayload {
    return {
        text: payload.text,
        transportText: payload.transportText,
        attachments: payload.attachments ?? [],
        mode: payload.mode,
        toolPolicy: payload.toolPolicy,
        approvalToken: payload.approvalToken,
        replayToolCall: payload.replayToolCall,
        continueMessageId: payload.continueMessageId,
        suppressUserEcho: payload.suppressUserEcho,
        runnerId: payload.runnerId,
        runnerLabel: payload.runnerLabel,
        runnerChatSessionId: payload.runnerChatSessionId,
        runnerChatTurnId: payload.runnerChatTurnId,
        runnerContinuationMode: payload.runnerContinuationMode,
        runnerModel: payload.runnerModel,
        runnerMode: payload.runnerMode,
        runnerIsolation: payload.runnerIsolation,
        runnerCwd: payload.runnerCwd,
        runnerMaxTurns: payload.runnerMaxTurns,
    };
}

export function modeToolPolicy(
    mode?: AssistantSendPayload['mode'],
): ToolPolicy {
    return { mode: mode || chatMode.value || 'work' };
}

export type NormalizedTurnEvent = {
    type: string;
    payload?: Record<string, unknown>;
    sequence?: number;
    jobId?: string;
};

export function normalizeTurnEvent(
    event: JobEvent | { event?: string; json?: unknown },
): NormalizedTurnEvent {
    const payload = eventPayload(event);
    return {
        type: eventName(event),
        payload,
        sequence: eventSequence(event),
        jobId: eventJobId(event),
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
    const state = String(payload.code ?? payload.status ?? '')
        .trim()
        .toLowerCase();
    if (state === 'approval_required') return true;
    return (
        typeof payload.approval_id === 'string' ||
        typeof payload.approval_id === 'number' ||
        typeof payload.approval_request_id === 'string' ||
        typeof payload.approval_request_id === 'number'
    );
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

function pendingApprovalPlaceholderContent(approval: ApprovalRequest) {
    const preview = formatApprovalSubjectPreview({
        type: approval.type,
        domain: approval.domain,
        subject: approval.subject,
    });
    if (!preview) {
        return 'Approval is needed before or3-intern can continue.';
    }
    return [
        'Approval is needed before or3-intern can continue.',
        '',
        `Requested action: ${preview}`,
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

function normalizeRunnerChatEvent(event: RunnerChatEvent | { event?: string; json?: unknown }) {
    if ('json' in event) return event;
    const runnerEvent = event as RunnerChatEvent;
    const payload =
        runnerEvent.payload && typeof runnerEvent.payload === 'object'
            ? (runnerEvent.payload as Record<string, unknown>)
            : {};
    return {
        event: runnerEvent.type,
        json: {
            ...payload,
            type: runnerEvent.type,
            sequence: runnerEvent.seq,
            job_id: runnerEvent.job_id,
            stream: runnerEvent.stream,
            text: typeof runnerEvent.text === 'string' ? runnerEvent.text : payload.text,
            chunk: typeof runnerEvent.text === 'string' ? runnerEvent.text : payload.chunk,
        },
    };
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
                    (Boolean(message.jobId) || Boolean(message.runnerChatTurnId)) &&
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
        if ((!text && !followJobId && !followRunnerTurnId) || isStreaming.value) return;

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
                      payload.runnerChatSessionId ?? session.runnerChatSessionId,
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
                      payload.runnerChatSessionId ?? session.runnerChatSessionId,
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
                appendTextPart(delta);
                sawVisibleOutput =
                    sawVisibleOutput || !!sanitizeAssistantText(delta);
            }
            if ((type === 'output' || type === 'runner_output') && delta) {
                appendAssistantContent(delta.endsWith('\n') ? delta : `${delta}\n`);
                appendTextPart(delta.endsWith('\n') ? delta : `${delta}\n`);
                sawVisibleOutput = sawVisibleOutput || !!sanitizeAssistantText(delta);
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
                if (!hasVisibleTextPart()) {
                    appendCompleteTextPart(assistantText);
                }
                sawVisibleOutput =
                    sawVisibleOutput || !!sanitizeAssistantText(assistantText);
            }
            if (type === 'tool_call') {
                closeActiveTextPart();
                const toolCallId = String(
                    payload?.tool_call_id ||
                        payload?.id ||
                        `${payload?.name || 'tool'}:${payload?.arguments || ''}`,
                );
                addToolCall(
                    String(payload?.name || 'tool'),
                    typeof payload?.arguments === 'string'
                        ? payload.arguments
                        : undefined,
                );
                upsertPart({
                    id: `tool:${toolCallId}`,
                    type: 'tool',
                    toolCallId,
                    name: String(payload?.name || 'tool'),
                    status: 'running',
                    argumentsPreview: String(
                        payload?.arguments_preview ?? payload?.arguments ?? '',
                    ),
                });
            }
            if (type === 'tool_result') {
                closeActiveTextPart();
                const toolName = String(payload?.name || 'tool');
                const toolCallId = String(
                    payload?.tool_call_id || payload?.id || toolName,
                );
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
                upsertPart({
                    id: `tool:${toolCallId}`,
                    type: 'tool',
                    toolCallId,
                    name: toolName,
                    status: approvalRequired
                        ? 'attention'
                        : toolError
                          ? 'error'
                          : 'complete',
                    resultPreview: String(
                        payload?.result_preview ?? payload?.result ?? '',
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
                    if (!hasTextPartContent(approvalMessage)) {
                        appendCompleteTextPart(approvalMessage);
                    }
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
                            : readAssistant()?.toolCalls?.length
                              ? 'Tool work completed without a final assistant message.'
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
                appendCompleteTextPart(snapshotText);
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
        const fetchAndApplyRunnerTurn = async (sessionId?: string, turnId?: string | null) => {
            if (!sessionId || !turnId) return null;
            const turn = await api.request<RunnerChatTurn>(
                `/internal/v1/runner-chat/sessions/${encodeURIComponent(sessionId)}/turns/${encodeURIComponent(turnId)}`,
                { signal: activeController.signal },
            );
            if (turn.final_text?.trim() && !sawVisibleOutput) {
                replaceAssistantContent(turn.final_text);
                appendCompleteTextPart(turn.final_text);
                sawVisibleOutput = true;
            }
            updateAssistant({
                status:
                    turn.status === 'failed' ||
                    turn.status === 'aborted' ||
                    turn.status === 'timed_out'
                        ? 'failed'
                        : 'complete',
                error: turn.error,
                backendMessageId: turn.assistant_message_id,
                runnerChatTurnId: turn.id,
                runnerChatSessionId: turn.session_id,
                agentCliRunId: turn.agent_cli_run_id,
                jobId: turn.agent_cli_job_id,
            });
            return turn;
        };

        const selectedRunnerId = payload.runnerId || session.runnerId || 'or3-intern';
        const useRunnerChat = selectedRunnerId !== 'or3-intern';
        let runnerChatTurnForRecovery:
            | { sessionId: string; turnId: string }
            | null = null;

        try {
            let sawStreamEvent = false;
            let streamEndedWithFailure = false;
            let streamedJobId: string | null = followJobId || null;

            if (followRunnerTurnId && payload.runnerChatSessionId) {
                updateAssistant({
                    runnerChatTurnId: followRunnerTurnId,
                    runnerChatSessionId: payload.runnerChatSessionId,
                });
                runnerChatTurnForRecovery = {
                    sessionId: payload.runnerChatSessionId,
                    turnId: followRunnerTurnId,
                };
                for await (const event of api.stream(
                    `/internal/v1/runner-chat/sessions/${encodeURIComponent(payload.runnerChatSessionId)}/turns/${encodeURIComponent(followRunnerTurnId)}/stream`,
                    {
                        method: 'GET',
                        signal: activeController.signal,
                    },
                )) {
                    sawStreamEvent = true;
                    const result = applyEvent(normalizeRunnerChatEvent(event as unknown as RunnerChatEvent));
                    streamEndedWithFailure = streamEndedWithFailure || result.failed;
                }
                await fetchAndApplyRunnerTurn(payload.runnerChatSessionId, followRunnerTurnId);
            } else if (followJobId) {
                activeJobId.value = followJobId;
                updateAssistant({ jobId: followJobId });
                for await (const event of api.stream(
                    `/internal/v1/jobs/${encodeURIComponent(followJobId)}/stream`,
                    {
                        method: 'GET',
                        signal: activeController.signal,
                        onOpen(response) {
                            const jobId =
                                responseJobId(response) || followJobId;
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
            } else if (useRunnerChat) {
                const desiredRunnerContinuationMode =
                    payload.runnerContinuationMode ||
                    session.runnerContinuationMode ||
                    'replay';
                const runnerSession = payload.runnerChatSessionId
                    ? await api.request<RunnerChatSession>(
                          `/internal/v1/runner-chat/sessions/${encodeURIComponent(payload.runnerChatSessionId)}`,
                          { signal: activeController.signal },
                      )
                    : await api.request<RunnerChatSession>(
                          '/internal/v1/runner-chat/sessions',
                          {
                              method: 'POST',
                              signal: activeController.signal,
                              body: {
                                  app_session_key: session.sessionKey,
                                  runner_id: selectedRunnerId,
                                  continuation_mode:
                                      desiredRunnerContinuationMode,
                                  model: payload.runnerModel || session.runnerModel,
                                  mode: payload.runnerMode || session.runnerMode,
                                  isolation:
                                      payload.runnerIsolation || session.runnerIsolation,
                                  cwd: payload.runnerCwd || session.runnerCwd,
                                  max_turns:
                                      payload.runnerMaxTurns || undefined,
                              },
                          },
                      );
                const effectiveRunnerContinuationMode =
                    desiredRunnerContinuationMode === 'native' &&
                    !runnerSession.native_session_ref
                        ? 'replay'
                        : desiredRunnerContinuationMode;
                chat.bindRunnerChatSession(session.id, runnerSession.id);
                updateAssistant({
                    runnerId: selectedRunnerId,
                    runnerLabel: payload.runnerLabel ?? session.runnerLabel,
                    runnerChatSessionId: runnerSession.id,
                });
                const started = await api.request<RunnerChatTurnStartResponse>(
                    `/internal/v1/runner-chat/sessions/${encodeURIComponent(runnerSession.id)}/turns`,
                    {
                        method: 'POST',
                        signal: activeController.signal,
                        body: {
                            user_message: text,
                            continuation_mode:
                                effectiveRunnerContinuationMode,
                            model: payload.runnerModel || session.runnerModel,
                            mode: payload.runnerMode || session.runnerMode,
                            isolation:
                                payload.runnerIsolation || session.runnerIsolation,
                            cwd: payload.runnerCwd || session.runnerCwd,
                            max_turns: payload.runnerMaxTurns || undefined,
                        },
                    },
                );
                streamedJobId = started.job_id ?? null;
                if (streamedJobId) activeJobId.value = streamedJobId;
                updateAssistant({
                    jobId: streamedJobId ?? undefined,
                    runnerChatSessionId: runnerSession.id,
                    runnerChatTurnId: started.turn_id,
                });
                runnerChatTurnForRecovery = {
                    sessionId: runnerSession.id,
                    turnId: started.turn_id,
                };
                for await (const event of api.stream(
                    `/internal/v1/runner-chat/sessions/${encodeURIComponent(runnerSession.id)}/turns/${encodeURIComponent(started.turn_id)}/stream`,
                    {
                        method: 'GET',
                        signal: activeController.signal,
                    },
                )) {
                    sawStreamEvent = true;
                    const normalized = normalizeRunnerChatEvent(event as unknown as RunnerChatEvent);
                    const jobId = eventJobId(normalized);
                    if (jobId) {
                        streamedJobId = jobId;
                        activeJobId.value = jobId;
                        updateAssistant({ jobId });
                    }
                    const result = applyEvent(normalized);
                    streamEndedWithFailure = streamEndedWithFailure || result.failed;
                }
                await fetchAndApplyRunnerTurn(runnerSession.id, started.turn_id);
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

            if (streamedJobId && !useRunnerChat) {
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

            if (useRunnerChat) {
                if (runnerChatTurnForRecovery) {
                    try {
                        await fetchAndApplyRunnerTurn(
                            runnerChatTurnForRecovery.sessionId,
                            runnerChatTurnForRecovery.turnId,
                        );
                        updateActivity((entry) => entry.status === 'running', {
                            status: 'error',
                        });
                        const latest = readAssistant();
                        if (latest?.status === 'failed') return;
                    } catch {
                        // Surface the original streaming failure below.
                    }
                }
                const message = describeRequestError(streamError);
                const details = describeRequestErrorDetails(streamError);
                updateActivity((entry) => entry.status === 'running', {
                    status: 'error',
                });
                updateAssistant({
                    content: details ? `${message}\n\n${details}` : message,
                    status: 'failed',
                    error: message,
                    errorCode: extractErrorCode(streamError),
                    runnerChatSessionId:
                        runnerChatTurnForRecovery?.sessionId ||
                        readAssistant()?.runnerChatSessionId,
                    runnerChatTurnId:
                        runnerChatTurnForRecovery?.turnId ||
                        readAssistant()?.runnerChatTurnId,
                });
                showFailureToast(
                    toast,
                    'Runner request failed',
                    streamError,
                );
                return;
            }

            try {
                const fallbackTurnRequest =
                    turnRequest &&
                    !payload.toolPolicy &&
                    isServiceCapabilityCeilingError(streamError)
                        ? buildTurnRequest(
                              downgradeToolPolicyForServiceCapability(
                                  requestedToolPolicy,
                              ),
                          )
                        : turnRequest;
                if (isServiceCapabilityCeilingError(streamError)) {
                    rememberServiceCapabilityCeilingHost(activeHostId);
                }
                if (
                    fallbackTurnRequest !== turnRequest &&
                    fallbackTurnRequest?.tool_policy?.mode === 'ask'
                ) {
                    addActivity(
                        createActivity(
                            'policy_adjusted',
                            'Tool mode adjusted',
                            'This host only allows safe OR3 tools, so the request retried in Ask mode.',
                            'complete',
                        ),
                    );
                }
                const response = await api.request<TurnResponse>(
                    '/internal/v1/turns',
                    {
                        body: fallbackTurnRequest,
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
                                extractApprovalRequestId(response),
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
                        approvalRequestId: extractApprovalRequestId(response),
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
