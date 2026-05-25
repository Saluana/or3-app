import { computed, watch } from 'vue';
import { useActiveHost } from './useActiveHost';
import { useDoctorChatStore } from './doctor/doctorChatStore';
import type {
    AssistantReplayToolCall,
    ChatActivityEntry,
    ChatMessage,
    ChatMessagePart,
    ChatToolCall,
    Or3AppErrorCode,
} from '~/types/app-state';
import type {
    DoctorAdminBrainProvider,
    DoctorChatSessionResponse,
    DoctorFindingCard,
    JobSnapshot,
    DoctorPlanApplyResponse,
    DoctorPlanResponse,
    DoctorPostCheckResponse,
    DoctorSettingsChangePlan,
    DoctorStatusResponse,
} from '~/types/or3-api';
import { createAssistantEventApplier } from '~/utils/assistant-stream/event-applier';
import { isEmptyFinalUserMessage } from '~/utils/assistant-stream/userErrorCopy';
import { suppressOr3ApiNetworkErrorLogsFor, useOr3Api } from './useOr3Api';
import { useAuthSession } from './useAuthSession';
import { useApprovals } from './useApprovals';
import {
    ensureDoctorApprovalMessage,
    markDoctorApprovalResolved,
} from './doctor/useDoctorApprovalHydration';
import { pendingApprovalPlaceholderContent } from '~/utils/assistant-stream/approval';
import type { ApprovalRequest } from '~/types/or3-api';

type RawDoctorChatMessage = NonNullable<
    DoctorChatSessionResponse['messages']
>[number];
type DoctorStreamingMessageState = Partial<
    Pick<
        ChatMessage,
        | 'status'
        | 'parts'
        | 'toolCalls'
        | 'activityLog'
        | 'reasoningText'
        | 'error'
        | 'errorCode'
        | 'jobId'
        | 'approvalRequestId'
        | 'approvalState'
        | 'retryPayload'
    >
>;
type DoctorMessageState = RawDoctorChatMessage & DoctorStreamingMessageState;

function store() {
    return useDoctorChatStore();
}

function doctorSessionStorageKey() {
    const { activeHost } = useActiveHost();
    const hostId = String(activeHost.value?.id ?? 'default').trim() || 'default';
    return `or3-doctor-session:${hostId}`;
}

function persistSessionKey(key: string | null) {
    if (!import.meta.client) return;
    try {
        const storageKey = doctorSessionStorageKey();
        if (key) localStorage.setItem(storageKey, key);
        else localStorage.removeItem(storageKey);
    } catch {
        /* ignore */
    }
}

function readPersistedSessionKey() {
    if (!import.meta.client) return null;
    try {
        return localStorage.getItem(doctorSessionStorageKey());
    } catch {
        return null;
    }
}

export * from '~/utils/doctor';
import {
    DOCTOR_EMPTY_FINAL_TEXT_WARNING,
    doctorLastUserMessageBefore,
    doctorSynthesizeFinalSummary,
    doctorVisibleTextForMessage,
    isDoctorEmptyFinalTextWarning,
    isGenericEmptyFinalRecovery,
    mergeDoctorSessionWithLocal,
    normalizeDoctorMessage,
    parseRecordJSON,
    resolveDoctorMessageRef,
    sortDoctorMessages,
    type DoctorChatMessage,
} from '~/utils/doctor';

function isAbortLikeError(value: unknown) {
    const record = value as { code?: unknown; cause?: unknown; name?: unknown };
    const cause = record?.cause as { name?: unknown } | undefined;
    return (
        record?.code === 'aborted' ||
        record?.name === 'AbortError' ||
        cause?.name === 'AbortError'
    );
}

function errorMessage(value: unknown) {
    if (value instanceof Error && value.message) return value.message;
    if (value && typeof value === 'object') {
        const record = value as Record<string, unknown>;
        for (const key of ['message', 'error', 'code']) {
            const message = record[key];
            if (typeof message === 'string' && message.trim())
                return message.trim();
        }
        if (typeof record.status === 'number')
            return `Doctor request failed with status ${record.status}.`;
    }
    if (typeof value === 'string' && value.trim()) return value.trim();
    return 'Unable to complete Doctor request.';
}

function newSessionKey() {
    if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
        return `doctor-app-${crypto.randomUUID()}`;
    }
    return `doctor-app-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

function doctorAdminBrainUsesExternalRunner(
    provider: DoctorAdminBrainProvider | null,
) {
    const runnerID = String(provider?.runner_id ?? '').trim();
    return (
        String(provider?.kind ?? '').trim() === 'runner' ||
        Boolean(provider?.available && runnerID && runnerID !== 'or3-intern')
    );
}

function normalizeDoctorMessages(raw: unknown) {
    if (!Array.isArray(raw)) return [];
    const normalized = raw
        .map((message) => normalizeDoctorMessage(message))
        .filter((message): message is DoctorChatMessage => Boolean(message));
    const deduped = normalized.filter((message, index) => {
        const previous = normalized[index - 1];
        const content = String(message.content ?? '').trim();
        const previousContent = String(previous?.content ?? '').trim();
        return !(
            message.role === 'user' &&
            previous?.role === 'user' &&
            content &&
            content === previousContent
        );
    });
    return sortDoctorMessages(deduped);
}

function maxMessageID(items = store().messages.value) {
    return items.reduce((max, message) => {
        const id = typeof message.id === 'number' ? message.id : 0;
        return id > max ? id : max;
    }, 0);
}

function hasAssistantAfter(items: DoctorChatMessage[], afterID: number) {
    return items.some(
        (message) =>
            message.role === 'assistant' &&
            (message.id ?? 0) > afterID &&
            message.content?.trim(),
    );
}

type PlaceholderID = number | string;

function messageIdKey(id: PlaceholderID) {
    return String(id);
}

function appendOrUpdateStreamingAssistant(
    id: PlaceholderID,
    content: string,
    status: ChatMessage['status'],
) {
    const key = messageIdKey(id);
    const existing = store().messages.value.findIndex(
        (message) => messageIdKey(message.id ?? '') === key,
    );
    const current = existing >= 0 ? store().messages.value[existing] : null;
    const latestCreatedAt = store().messages.value.reduce((max, item) => {
        const created = item.created_at ?? 0;
        return created > max ? created : max;
    }, 0);
    const createdAt =
        current?.created_at ??
        (latestCreatedAt > 0
            ? latestCreatedAt + 1
            : Math.floor(Date.now() / 1000));
    const message = {
        ...(current ?? {}),
        id,
        role: 'assistant',
        content,
        created_at: createdAt,
        meta: { ...(parseRecordJSON(current?.meta) ?? {}), status },
        status,
    } as DoctorChatMessage;
    if (existing >= 0) {
        store().messages.value = store().messages.value.map((item, index) =>
            index === existing ? message : item,
        );
        return;
    }
    store().messages.value = sortDoctorMessages([...store().messages.value, message]);
}

function patchStreamingAssistant(
    id: number | string,
    patch: Partial<DoctorMessageState>,
) {
    const key = String(id);
    store().messages.value = store().messages.value.map((message) => {
        if (String(message.id ?? '') !== key) return message;
        return {
            ...message,
            ...patch,
            meta: {
                ...(parseRecordJSON(message.meta) ?? {}),
                ...(parseRecordJSON(patch.meta) ?? {}),
            },
        };
    });
}

function mutateStreamingAssistant(
    id: PlaceholderID,
    mutate: (message: DoctorMessageState) => DoctorMessageState,
) {
    const key = messageIdKey(id);
    store().messages.value = store().messages.value.map((message) =>
        messageIdKey(message.id ?? '') === key ? mutate(message) : message,
    );
}

function readStreamingAssistant(id: PlaceholderID) {
    const key = messageIdKey(id);
    return store().messages.value.find(
        (message) => messageIdKey(message.id ?? '') === key,
    );
}

function doctorMessageToChatMessage(
    message: DoctorMessageState | undefined,
): ChatMessage | undefined {
    if (!message) return undefined;
    const role = message.role === 'user' ? 'user' : 'assistant';
    return {
        id: String(message.id ?? ''),
        sessionId: store().sessionKey.value ?? 'doctor',
        role,
        content: String(message.content ?? ''),
        status: message.status ?? 'streaming',
        createdAt: message.created_at
            ? new Date(message.created_at * 1000).toISOString()
            : new Date().toISOString(),
        reasoningText: message.reasoningText,
        toolCalls: message.toolCalls,
        parts: message.parts,
        activityLog: message.activityLog,
        error: message.error,
        errorCode: message.errorCode,
        jobId: message.jobId,
        approvalRequestId: message.approvalRequestId,
        approvalState: message.approvalState,
        retryPayload: message.retryPayload,
    };
}

function upsertById<T extends { id: string }>(items: T[] | undefined, item: T) {
    const list = items ?? [];
    const index = list.findIndex((current) => current.id === item.id);
    if (index < 0) return [...list, item];
    return list.map((current, currentIndex) =>
        currentIndex === index ? { ...current, ...item } : current,
    );
}

function createDoctorStreamApplier(placeholderID: PlaceholderID) {
    let activeTextPartID = '';
    const now = () => new Date().toISOString();
    const readDoctorMessage = () => readStreamingAssistant(placeholderID);
    const updateAssistant = (patch: Partial<ChatMessage>) => {
        const next: Partial<DoctorMessageState> = {};
        if ('content' in patch) next.content = patch.content;
        if ('status' in patch) next.status = patch.status;
        if ('parts' in patch) next.parts = patch.parts;
        if ('toolCalls' in patch) next.toolCalls = patch.toolCalls;
        if ('activityLog' in patch) next.activityLog = patch.activityLog;
        if ('reasoningText' in patch) next.reasoningText = patch.reasoningText;
        if ('error' in patch) next.error = patch.error;
        if ('errorCode' in patch)
            next.errorCode = patch.errorCode as Or3AppErrorCode;
        if ('jobId' in patch) next.jobId = patch.jobId;
        if ('approvalRequestId' in patch)
            next.approvalRequestId = patch.approvalRequestId;
        if ('approvalState' in patch) next.approvalState = patch.approvalState;
        if ('retryPayload' in patch) next.retryPayload = patch.retryPayload;
        patchStreamingAssistant(placeholderID, next);
    };
    const upsertPart = (part: ChatMessagePart) =>
        mutateStreamingAssistant(placeholderID, (message) => ({
            ...message,
            parts: upsertById(message.parts, part),
        }));
    const appendTextPart = (value: string) => {
        if (!value) return;
        mutateStreamingAssistant(placeholderID, (message) => {
            const parts = message.parts ?? [];
            const activeIndex = activeTextPartID
                ? parts.findIndex((part) => part.id === activeTextPartID)
                : -1;
            if (activeIndex >= 0 && parts[activeIndex]?.type === 'text') {
                return {
                    ...message,
                    parts: parts.map((part, index) =>
                        index === activeIndex
                            ? {
                                  ...part,
                                  content: `${part.content ?? ''}${value}`,
                              }
                            : part,
                    ),
                };
            }
            activeTextPartID = `text:${Date.now()}:${Math.random().toString(36).slice(2)}`;
            return {
                ...message,
                parts: [
                    ...parts,
                    { id: activeTextPartID, type: 'text', content: value },
                ],
            };
        });
    };
    const addActivity = (entry: ChatActivityEntry) =>
        mutateStreamingAssistant(placeholderID, (message) => ({
            ...message,
            activityLog: [...(message.activityLog ?? []), entry].slice(-30),
        }));
    const upsertActivity = (entry: ChatActivityEntry) =>
        mutateStreamingAssistant(placeholderID, (message) => ({
            ...message,
            activityLog: upsertById(message.activityLog, entry).slice(-30),
        }));
    const updateActivity = (
        predicate: (entry: ChatActivityEntry) => boolean,
        patch: Partial<ChatActivityEntry>,
    ) =>
        mutateStreamingAssistant(placeholderID, (message) => ({
            ...message,
            activityLog: (message.activityLog ?? []).map((entry) =>
                predicate(entry) ? { ...entry, ...patch } : entry,
            ),
        }));
    const completeRunningActivity = (types: string[]) =>
        updateActivity(
            (entry) => entry.status === 'running' && types.includes(entry.type),
            { status: 'complete' },
        );
    const addToolCall = (name: string, args?: string, toolCallId?: string) => {
        const id = toolCallId || `legacy:${name}`;
        mutateStreamingAssistant(placeholderID, (message) => ({
            ...message,
            toolCalls: upsertById(message.toolCalls, {
                id,
                name,
                status: 'running',
                arguments: args,
                startedAt: now(),
            }),
        }));
    };
    const resolveToolCall = (
        name: string,
        result?: string,
        toolError?: string,
        statusOverride?: ChatToolCall['status'],
        toolCallId?: string,
    ) => {
        const id = toolCallId || `legacy:${name}`;
        mutateStreamingAssistant(placeholderID, (message) => {
            const existing = message.toolCalls?.find((call) => call.id === id);
            return {
                ...message,
                toolCalls: upsertById(message.toolCalls, {
                    id,
                    name,
                    status:
                        statusOverride ?? (toolError ? 'error' : 'complete'),
                    arguments: existing?.arguments,
                    result,
                    error: toolError,
                    startedAt: existing?.startedAt ?? now(),
                    completedAt: now(),
                }),
            };
        });
    };

    return createAssistantEventApplier({
        assistantId: String(placeholderID),
        readAssistant: () => doctorMessageToChatMessage(readDoctorMessage()),
        updateAssistant,
        appendAssistantContent: (value) =>
            mutateStreamingAssistant(placeholderID, (message) => ({
                ...message,
                content: `${message.content ?? ''}${value}`,
            })),
        replaceAssistantContent: (value) =>
            patchStreamingAssistant(placeholderID, { content: value }),
        upsertPart,
        appendTextPart,
        appendCompleteTextPart: (value) => {
            activeTextPartID = '';
            appendTextPart(value);
            activeTextPartID = '';
        },
        closeActiveTextPart: () => {
            activeTextPartID = '';
        },
        hasVisibleTextPart: () =>
            Boolean(
                readDoctorMessage()?.parts?.some(
                    (part) => part.type === 'text' && part.content?.trim(),
                ),
            ),
        hasTextPartContent: (content) =>
            Boolean(
                readDoctorMessage()?.parts?.some(
                    (part) =>
                        part.type === 'text' &&
                        String(part.content ?? '').trim() === content.trim(),
                ),
            ),
        addActivity,
        upsertActivity,
        updateActivity,
        completeRunningActivity,
        addToolCall,
        resolveToolCall,
        findReplayableToolCall: (name): AssistantReplayToolCall | undefined => {
            const call = readDoctorMessage()?.toolCalls?.find(
                (item) => item.name === name,
            );
            return call
                ? { name: call.name, arguments: call.arguments }
                : undefined;
        },
        setSawVisibleOutput: () => undefined,
        rawAssistantContent: () => String(readDoctorMessage()?.content ?? ''),
    });
}

function appendOptimisticUser(id: number, content: string) {
    const latestCreatedAt = store().messages.value.reduce((max, message) => {
        const created = message.created_at ?? 0;
        return created > max ? created : max;
    }, 0);
    const createdAt =
        latestCreatedAt > 0 ? latestCreatedAt + 1 : Math.floor(Date.now() / 1000);
    store().messages.value = [
        ...store().messages.value,
        {
            id,
            role: 'user',
            content,
            created_at: createdAt,
            meta: { status: 'pending' },
        },
    ];
}

function removeMessage(id: number) {
    store().messages.value = store().messages.value.filter((message) => message.id !== id);
}

function removeStreamingAssistant(id: PlaceholderID) {
    const key = messageIdKey(id);
    store().messages.value = store().messages.value.filter(
        (message) => messageIdKey(message.id ?? '') !== key,
    );
}

function applyDoctorRecoveredFinalText(
    placeholderID: PlaceholderID,
    displayText: string,
) {
    const normalized = displayText.trim();
    if (!normalized) return false;

    const message = readStreamingAssistant(placeholderID);
    const recoveringEmptyFinal =
        message?.errorCode === 'empty_final_text' ||
        isDoctorEmptyFinalTextWarning(message?.content) ||
        isEmptyFinalUserMessage(message?.content) ||
        Boolean(
            message?.parts?.some(
                (part) =>
                    part.type === 'text' &&
                    (isDoctorEmptyFinalTextWarning(part.content) ||
                        isEmptyFinalUserMessage(part.content)),
            ),
        );

    if (message?.parts?.length) {
        const nextParts = message.parts.filter(
            (part) =>
                !(
                    part.type === 'text' &&
                    (isDoctorEmptyFinalTextWarning(part.content) ||
                        isEmptyFinalUserMessage(part.content))
                ),
        );
        if (nextParts.length !== message.parts.length) {
            patchStreamingAssistant(placeholderID, { parts: nextParts });
        }
    }

    const existing = String(message?.content ?? '').trim();
    if (
        !recoveringEmptyFinal &&
        existing &&
        existing !== 'Working…' &&
        !isGenericEmptyFinalRecovery(existing)
    ) {
        return false;
    }

    patchStreamingAssistant(placeholderID, {
        content: normalized,
        error: undefined,
        errorCode: undefined,
        status:
            message?.status === 'attention' || message?.status === 'streaming'
                ? 'complete'
                : message?.status,
    });

    const latest = readStreamingAssistant(placeholderID);
    const hasTextPart = Boolean(
        latest?.parts?.some(
            (part) => part.type === 'text' && part.content?.trim(),
        ),
    );
    if (!hasTextPart) {
        mutateStreamingAssistant(placeholderID, (current) => ({
            ...current,
            parts: [
                ...(current.parts ?? []),
                {
                    id: `text:recovered:${Date.now()}`,
                    type: 'text',
                    content: normalized,
                },
            ],
        }));
    }
    return true;
}

function doctorResolveFinalSummary(
    placeholderID: PlaceholderID,
    snapshotText: string,
) {
    const message = readStreamingAssistant(placeholderID);
    const userMessage = doctorLastUserMessageBefore(
        store().messages.value,
        typeof placeholderID === 'number' ? placeholderID : undefined,
    );
    const synthesized = doctorSynthesizeFinalSummary(message, { userMessage });
    const snapshot = snapshotText.trim();
    if (synthesized) return synthesized;
    if (snapshot && !isGenericEmptyFinalRecovery(snapshot)) return snapshot;
    return snapshot || synthesized;
}

function hasMeaningfulDoctorStreamingState(
    message: DoctorMessageState | undefined | null,
) {
    if (!message || message.role !== 'assistant') return false;
    return Boolean(
        String(message.content ?? '').trim() ||
            String(message.reasoningText ?? '').trim() ||
            message.status === 'failed' ||
            message.status === 'attention' ||
            message.error ||
            message.errorCode ||
            message.approvalRequestId ||
            message.approvalState ||
            message.retryPayload ||
            message.parts?.length ||
            message.toolCalls?.length ||
            message.activityLog?.length,
    );
}

function doctorHasToolWork(message: DoctorMessageState | undefined | null) {
    if (!message) return false;
    return Boolean(
        message.toolCalls?.length ||
            message.parts?.some((part) => part.type === 'tool') ||
            message.activityLog?.some((entry) =>
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

function isDoctorLiveJobStatus(status: string | undefined) {
    return ['queued', 'running', 'started'].includes(
        String(status || '')
            .trim()
            .toLowerCase(),
    );
}

function isDoctorTerminalJobStatus(status: string | undefined) {
    const normalized = String(status || '')
        .trim()
        .toLowerCase();
    return [
        'completed',
        'complete',
        'succeeded',
        'success',
        'failed',
        'aborted',
        'approval_required',
    ].includes(normalized);
}

async function reconcileDoctorJobSnapshot(
    jobID: string,
    placeholderID: PlaceholderID,
    requestJobSnapshot: (jobID: string) => Promise<JobSnapshot>,
) {
    const snapshot = await requestJobSnapshot(jobID);
    if (
        !snapshot ||
        typeof snapshot !== 'object' ||
        String(snapshot.job_id || '').trim() !== jobID ||
        !String(snapshot.status || '').trim()
    ) {
        return null;
    }
    const applier = createDoctorStreamApplier(placeholderID);
    for (const event of snapshot.events ?? []) {
        applier.applyEvent(event, 'snapshot');
    }

    const snapshotText = String(
        snapshot.final_text || snapshot.error || '',
    ).trim();
    const resolvedSummary = doctorResolveFinalSummary(
        placeholderID,
        snapshotText,
    );
    if (resolvedSummary) {
        applyDoctorRecoveredFinalText(placeholderID, resolvedSummary);
    }

    const latest = readStreamingAssistant(placeholderID);
    const effectiveText =
        doctorVisibleTextForMessage(latest ?? { role: 'assistant' }) ||
        resolvedSummary;
    const hasMeaningfulSummary = Boolean(
        effectiveText.trim() &&
            !isDoctorEmptyFinalTextWarning(effectiveText) &&
            !isGenericEmptyFinalRecovery(effectiveText) &&
            !isEmptyFinalUserMessage(effectiveText),
    );
    const hasToolWork = doctorHasToolWork(latest);
    const emptyFinalAfterSnapshot =
        !hasMeaningfulSummary &&
        !snapshot.error &&
        snapshot.status !== 'approval_required' &&
        !isDoctorLiveJobStatus(snapshot.status) &&
        hasToolWork;

    if (hasMeaningfulSummary && latest?.errorCode === 'empty_final_text') {
        patchStreamingAssistant(placeholderID, {
            error: undefined,
            errorCode: undefined,
        });
    }

    if (emptyFinalAfterSnapshot) {
        const currentContent = String(
            readStreamingAssistant(placeholderID)?.content ?? '',
        ).trim();
        if (
            !currentContent ||
            currentContent === 'Working…' ||
            isEmptyFinalUserMessage(currentContent)
        ) {
            patchStreamingAssistant(placeholderID, {
                content: DOCTOR_EMPTY_FINAL_TEXT_WARNING,
            });
        }
        patchStreamingAssistant(placeholderID, {
            status: 'attention',
            error: 'or3-intern completed without a final assistant message.',
            errorCode: 'empty_final_text',
            jobId: snapshot.job_id,
        });
        return snapshot;
    }

    const nextStatus: DoctorMessageState['status'] =
        snapshot.status === 'approval_required'
            ? 'attention'
            : snapshot.error ||
                snapshot.status === 'failed' ||
                  snapshot.status === 'aborted'
              ? 'failed'
              : isDoctorLiveJobStatus(snapshot.status)
                ? (latest?.status ?? 'streaming')
                : 'complete';

    patchStreamingAssistant(placeholderID, {
        status: nextStatus,
        error:
            snapshotText || snapshot.status === 'approval_required'
                ? undefined
                : snapshot.error,
        errorCode:
            snapshotText
                ? undefined
                : snapshot.status === 'approval_required'
                  ? 'approval_required'
                  : readStreamingAssistant(placeholderID)?.errorCode,
        approvalState:
            snapshot.status === 'approval_required'
                ? 'pending'
                : readStreamingAssistant(placeholderID)?.approvalState,
        jobId: snapshot.job_id,
    });
    return snapshot;
}

function doctorMessagesContainEquivalentAssistant(
    items: DoctorMessageState[],
    message: DoctorMessageState,
) {
    const content = String(message.content ?? '').trim();
    const error = String(message.error ?? '').trim();
    const approvalRequestId = Number(message.approvalRequestId ?? 0);
    return items.some((item) => {
        if (item.role !== 'assistant') return false;
        const itemContent = String(item.content ?? '').trim();
        const itemError = String(item.error ?? '').trim();
        const itemApprovalRequestId = Number(item.approvalRequestId ?? 0);
        if (content && itemContent && itemContent === content) return true;
        if (error && itemError && itemError === error) return true;
        if (
            approvalRequestId > 0 &&
            itemApprovalRequestId > 0 &&
            itemApprovalRequestId === approvalRequestId
        ) {
            return true;
        }
        return false;
    });
}

async function reloadSessionPreservingStreamingAssistant(
    placeholderID: PlaceholderID,
    reloadSession: () => Promise<unknown>,
) {
    const placeholder = readStreamingAssistant(placeholderID);
    const localSnapshot = store().messages.value;
    try {
        const response = (await reloadSession()) as
            | DoctorChatSessionResponse
            | null
            | undefined;
        const serverMessages = normalizeDoctorMessages(
            response?.messages ?? localSnapshot,
        );
        store().messages.value = mergeDoctorSessionWithLocal(
            serverMessages,
            localSnapshot,
            placeholder,
        );
        return response;
    } catch (err) {
        store().messages.value = mergeDoctorSessionWithLocal(
            localSnapshot,
            localSnapshot,
            placeholder,
        );
        throw err;
    }
}

function eventPayload(event: unknown) {
    if (!event || typeof event !== 'object') return {};
    const record = event as { json?: unknown; data?: unknown };
    if (record.json && typeof record.json === 'object') {
        return record.json as Record<string, unknown>;
    }
    if (typeof record.data === 'string') {
        try {
            const parsed = JSON.parse(record.data);
            if (parsed && typeof parsed === 'object')
                return parsed as Record<string, unknown>;
        } catch {
            return {};
        }
    }
    return {};
}

function eventName(event: unknown) {
    if (!event || typeof event !== 'object') return '';
    const name = (event as { event?: unknown }).event;
    return typeof name === 'string' ? name : '';
}

function stopStreaming() {
    store().activeStreamController.value?.abort();
    store().activeStreamController.value = null;
}

async function streamDoctorEvents(
    input: {
        path: string;
        placeholderID: PlaceholderID;
        requestOptions?: Record<string, unknown>;
    },
    streamEvents: (path: string, options: any) => AsyncIterable<unknown>,
) {
    const applier = createDoctorStreamApplier(input.placeholderID);
    for await (const event of streamEvents(input.path, input.requestOptions)) {
        if (eventName(event) === 'done') {
            const payload = eventPayload(event);
            applier.applyEvent({
                event: 'completion',
                json: {
                    status: 'completed',
                    final_text:
                        typeof payload.final_text === 'string'
                            ? payload.final_text
                            : '',
                },
            });
            break;
        }
        applier.applyEvent(event as { event?: string; json?: unknown });
    }
}

async function followRunnerStream(
    input: {
        sessionID: string;
        turnID: string;
        placeholderID: number;
    },
    streamEvents: (path: string, options: any) => AsyncIterable<unknown>,
    reloadSession: () => Promise<unknown>,
) {
    stopStreaming();
    const controller = new AbortController();
    store().activeStreamController.value = controller;
    store().activeRunnerTurn.value = {
        sessionID: input.sessionID,
        turnID: input.turnID,
    };
    appendOrUpdateStreamingAssistant(input.placeholderID, '', 'streaming');
    try {
        await streamDoctorEvents(
            {
                path: `/internal/v1/runner-chat/sessions/${encodeURIComponent(input.sessionID)}/turns/${encodeURIComponent(input.turnID)}/stream`,
                placeholderID: input.placeholderID,
                requestOptions: { method: 'GET', signal: controller.signal },
            },
            streamEvents,
        );
    } catch (err) {
        if (controller.signal.aborted || isAbortLikeError(err)) return;
        throw err;
    } finally {
        if (store().activeStreamController.value === controller) {
            store().activeStreamController.value = null;
        }
        if (
            store().activeRunnerTurn.value?.sessionID === input.sessionID &&
            store().activeRunnerTurn.value?.turnID === input.turnID
        ) {
            store().activeRunnerTurn.value = null;
        }
    }
    await reloadSessionPreservingStreamingAssistant(
        input.placeholderID,
        reloadSession,
    );
    if (
        !hasMeaningfulDoctorStreamingState(
            readStreamingAssistant(input.placeholderID),
        )
    ) {
        removeStreamingAssistant(input.placeholderID);
    }
}

async function followJobStream(
    input: {
        jobID: string;
        placeholderID: number | string;
    },
    streamEvents: (path: string, options: any) => AsyncIterable<unknown>,
    requestJobSnapshot: (jobID: string) => Promise<JobSnapshot>,
    reloadSession: () => Promise<unknown>,
) {
    stopStreaming();
    const controller = new AbortController();
    let completedBySnapshot = false;
    let snapshotPollTimer: ReturnType<typeof setInterval> | null = null;
    store().activeStreamController.value = controller;
    store().activeJobID.value = input.jobID;
    appendOrUpdateStreamingAssistant(input.placeholderID, '', 'streaming');
    patchStreamingAssistant(input.placeholderID, { jobId: input.jobID });
    try {
        await streamDoctorEvents(
            {
                path: `/internal/v1/jobs/${encodeURIComponent(input.jobID)}/stream`,
                placeholderID: input.placeholderID,
                requestOptions: { method: 'GET', signal: controller.signal },
            },
            streamEvents,
        );
    } catch (err) {
        if (
            !completedBySnapshot &&
            (controller.signal.aborted || isAbortLikeError(err))
        ) {
            return;
        }
        if (
            completedBySnapshot &&
            (controller.signal.aborted || isAbortLikeError(err))
        ) {
            // The job reached a terminal state, but the SSE response did not
            // close promptly. Continue through snapshot reconciliation so UI
            // state and approval buttons resolve.
        } else {
            throw err;
        }
    } finally {
        if (store().activeStreamController.value === controller) {
            store().activeStreamController.value = null;
        }
        if (store().activeJobID.value === input.jobID) {
            store().activeJobID.value = null;
        }
    }
    await reconcileDoctorJobSnapshot(
        input.jobID,
        input.placeholderID,
        requestJobSnapshot,
    ).catch(() => undefined);
    await reloadSessionPreservingStreamingAssistant(
        input.placeholderID,
        reloadSession,
    );
    if (
        !hasMeaningfulDoctorStreamingState(
            readStreamingAssistant(input.placeholderID),
        )
    ) {
        removeStreamingAssistant(input.placeholderID);
    }
}

function approvalFor(plan: DoctorSettingsChangePlan, rememberForMinutes = 0) {
    return {
        plan_id: plan.id ?? '',
        approved: true,
        remember_for_minutes: rememberForMinutes,
    };
}

export function useDoctorAdminChat() {
    const api = useOr3Api();
    const authSession = useAuthSession();
    const approvals = useApprovals();
    const { activeHost } = useActiveHost();

    watch(
        () => activeHost.value?.id ?? 'default',
        (hostId, previousHostId) => {
            if (!previousHostId || hostId === previousHostId) return;
            store().bumpMessageGeneration();
            store().activeSendPromise = null;
            stopStreaming();
            store().sessionKey.value = null;
            store().messages.value = [];
            store().activePlan.value = null;
            store().applyResult.value = null;
            store().postCheckResult.value = null;
            store().planApplyResults.value = {};
            store().planApplyFailures.value = {};
            store().planPostCheckResults.value = {};
            void hydratePersistedSession().catch(() => undefined);
        },
    );

    async function hydratePersistedSession() {
        const persisted = readPersistedSessionKey();
        if (!persisted) return null;
        if (store().sessionKey.value && store().sessionKey.value !== persisted) {
            store().sessionKey.value = null;
            store().messages.value = [];
        }
        try {
            return await loadSession(persisted);
        } catch {
            persistSessionKey(null);
            return null;
        }
    }

    async function loadStatus() {
        store().loading.value = true;
        store().error.value = null;
        try {
            store().status.value = await api.request<DoctorStatusResponse>(
                '/internal/v1/doctor/status',
            );
            store().adminBrain.value =
                store().status.value?.admin_brain ?? null;
            return store().status.value;
        } catch (err) {
            store().error.value = errorMessage(err);
            throw err;
        } finally {
            store().loading.value = false;
        }
    }

    async function loadAdminBrain() {
        store().adminBrain.value = await api.request<DoctorAdminBrainProvider>(
            '/internal/v1/doctor/admin-brain',
        );
        return store().adminBrain.value;
    }

    async function createSession(
        title = 'Doctor Session',
        options: {
            runnerId?: string;
            runnerModel?: string;
            signal?: AbortSignal;
        } = {},
    ) {
        store().loading.value = true;
        store().error.value = null;
        try {
            const key = store().sessionKey.value ?? newSessionKey();
            const baseBody = { session_key: key, title };
            const extendedBody = {
                ...baseBody,
                runner_id: options.runnerId,
                model: options.runnerModel,
            };
            let response: DoctorChatSessionResponse;
            try {
                response = await api.request<DoctorChatSessionResponse>(
                    '/internal/v1/doctor/sessions',
                    {
                        method: 'POST',
                        body:
                            options.runnerId || options.runnerModel
                                ? extendedBody
                                : baseBody,
                        signal: options.signal,
                    },
                );
            } catch (err) {
                const record = err as { status?: number; code?: string };
                if (
                    (options.runnerId || options.runnerModel) &&
                    (record?.status === 400 ||
                        record?.code === 'validation_failed')
                ) {
                    response = await api.request<DoctorChatSessionResponse>(
                        '/internal/v1/doctor/sessions',
                        {
                            method: 'POST',
                            body: baseBody,
                            signal: options.signal,
                        },
                    );
                } else {
                    throw err;
                }
            }
            store().sessionKey.value = key;
            persistSessionKey(key);
            const nextMessages = normalizeDoctorMessages(response.messages);
            store().messages.value = nextMessages;
            store().adminBrain.value = response.admin_brain ?? store().adminBrain.value;
            return response;
        } catch (err) {
            store().error.value = errorMessage(err);
            throw err;
        } finally {
            store().loading.value = false;
        }
    }

    async function loadSession(key = store().sessionKey.value) {
        if (!key) return null;
        const response = await api.request<DoctorChatSessionResponse>(
            `/internal/v1/doctor/sessions/${encodeURIComponent(key)}`,
        );
        store().sessionKey.value = key;
        persistSessionKey(key);
        const placeholderID = store().activeOptimisticTurn.value?.placeholderID ?? 0;
        const placeholder =
            placeholderID !== 0
                ? readStreamingAssistant(placeholderID)
                : null;
        store().messages.value = mergeDoctorSessionWithLocal(
            normalizeDoctorMessages(response.messages),
            store().messages.value,
            placeholder,
        );
        store().adminBrain.value = response.admin_brain ?? store().adminBrain.value;
        return response;
    }

    async function performSendMessage(
        content: string,
        options: {
            runnerId?: string;
            runnerModel?: string;
            runnerThinkingLevel?: string;
        } = {},
    ) {
        const generation = store().messageGeneration;
        const controller = new AbortController();
        store().activeRequestController.value = controller;
        let previousMaxID = 0;
        let placeholderID = 0;
        let optimisticUserID = 0;
        try {
            if (!store().sessionKey.value)
                await createSession('Doctor Session', {
                    runnerId: options.runnerId,
                    runnerModel: options.runnerModel,
                    signal: controller.signal,
                });
            if (!store().sessionKey.value)
                throw new Error('Doctor session was not created.');
            const activeSessionKey = store().sessionKey.value as string;
            store().loading.value = true;
            store().error.value = null;
            previousMaxID = maxMessageID();
            optimisticUserID = store().nextOptimisticMessageID();
            placeholderID = store().nextOptimisticMessageID();
            appendOptimisticUser(optimisticUserID, content);
            appendOrUpdateStreamingAssistant(
                placeholderID,
                'Working…',
                'streaming',
            );
            store().activeOptimisticTurn.value = {
                userID: optimisticUserID,
                placeholderID,
            };
            const baseBody = { content, stream: true };
            const extendedBody = {
                ...baseBody,
                runner_id: options.runnerId,
                model: options.runnerModel,
                thinking_level: options.runnerThinkingLevel,
            };
            let response: DoctorChatSessionResponse;
            try {
                response = await api.request<DoctorChatSessionResponse>(
                    `/internal/v1/doctor/sessions/${encodeURIComponent(activeSessionKey)}/messages`,
                    {
                        method: 'POST',
                        body:
                            options.runnerId ||
                            options.runnerModel ||
                            options.runnerThinkingLevel
                                ? extendedBody
                                : baseBody,
                        signal: controller.signal,
                    },
                );
            } catch (err) {
                const record = err as { status?: number; code?: string };
                if (
                    (options.runnerModel || options.runnerThinkingLevel) &&
                    (record?.status === 400 ||
                        record?.code === 'validation_failed')
                ) {
                    response = await api.request<DoctorChatSessionResponse>(
                        `/internal/v1/doctor/sessions/${encodeURIComponent(activeSessionKey)}/messages`,
                        {
                            method: 'POST',
                            body: baseBody,
                            signal: controller.signal,
                        },
                    );
                } else {
                    throw err;
                }
            }
            if (generation !== store().messageGeneration) return response;
            const nextMessages = normalizeDoctorMessages(response.messages);
            store().adminBrain.value = response.admin_brain ?? store().adminBrain.value;
            const runnerChat = response.runner_chat;
            if (response.job_id) {
                await followJobStream(
                    {
                        jobID: response.job_id,
                        placeholderID,
                    },
                    (path, requestOptions) => api.stream(path, requestOptions),
                    (jobID) =>
                        api.request<JobSnapshot>(
                            `/internal/v1/jobs/${encodeURIComponent(jobID)}`,
                        ),
                    () => loadSession(store().sessionKey.value),
                );
            } else if (runnerChat?.session_id && runnerChat.turn_id) {
                await followRunnerStream(
                    {
                        sessionID: runnerChat.session_id,
                        turnID: runnerChat.turn_id,
                        placeholderID,
                    },
                    (path, requestOptions) => api.stream(path, requestOptions),
                    () => loadSession(store().sessionKey.value),
                );
            } else {
                if (nextMessages.length) store().messages.value = nextMessages;
                if (!hasAssistantAfter(store().messages.value, previousMaxID)) {
                    appendOrUpdateStreamingAssistant(
                        placeholderID,
                        'Doctor accepted the message, but no response was returned.',
                        'complete',
                    );
                }
            }
            return response;
        } catch (err) {
            if (isAbortLikeError(err)) {
                if (placeholderID !== 0)
                    removeStreamingAssistant(placeholderID);
                store().error.value = null;
                return {
                    messages: store().messages.value,
                    admin_brain: store().adminBrain.value ?? undefined,
                } as DoctorChatSessionResponse;
            }
            if (generation !== store().messageGeneration) throw err;
            if (
                placeholderID !== 0 &&
                !hasMeaningfulDoctorStreamingState(
                    readStreamingAssistant(placeholderID),
                )
            ) {
                removeStreamingAssistant(placeholderID);
            }
            if (
                optimisticUserID !== 0 &&
                !store().messages.value.some(
                    (message) =>
                        message.role === 'user' &&
                        String(message.content ?? '').trim() === content,
                )
            ) {
                removeMessage(optimisticUserID);
            }
            store().error.value = errorMessage(err);
            throw err;
        } finally {
            if (store().activeRequestController.value === controller) {
                store().activeRequestController.value = null;
            }
            if (store().activeOptimisticTurn.value?.placeholderID === placeholderID) {
                store().activeOptimisticTurn.value = null;
            }
            if (generation === store().messageGeneration) store().loading.value = false;
        }
    }

    function sendMessage(
        content: string,
        options: {
            runnerId?: string;
            runnerModel?: string;
            runnerThinkingLevel?: string;
        } = {},
    ) {
        const normalizedContent = content.trim();
        if (!normalizedContent) {
            return Promise.reject(
                new Error('Doctor message content is required.'),
            );
        }
        if (store().activeSendPromise) {
            const busyMessage =
                'Wait for the current Doctor reply before sending another message.';
            store().error.value = busyMessage;
            return Promise.reject(new Error(busyMessage));
        }
        const promise = performSendMessage(normalizedContent, options);
        store().activeSendPromise = promise;
        void promise
            .finally(() => {
                if (store().activeSendPromise === promise) store().activeSendPromise = null;
            })
            .catch(() => undefined);
        return promise;
    }

    async function createPlan(
        plan: DoctorSettingsChangePlan,
        options: {
            conversationID?: string;
            acceptedCardID?: string;
            approvedAuthority?: string;
        } = {},
    ) {
        const response = await api.request<DoctorPlanResponse>(
            '/internal/v1/doctor/plans',
            {
                method: 'POST',
                body: {
                    conversation_id:
                        options.conversationID ?? store().sessionKey.value ?? '',
                    accepted_card_id: options.acceptedCardID ?? '',
                    plan,
                },
            },
        );
        store().activePlan.value = response;
        return response;
    }

    async function validatePlan(planID = store().activePlan.value?.plan?.id) {
        if (!planID) throw new Error('No Doctor plan selected.');
        store().activePlan.value = await api.request<DoctorPlanResponse>(
            `/internal/v1/doctor/plans/${encodeURIComponent(planID)}/validate`,
            { method: 'POST', body: {} },
        );
        return store().activePlan.value;
    }

    async function applyPlan(
        plan = store().activePlan.value?.plan,
        options: {
            rememberForMinutes?: number;
            approvedAuthority?: string;
        } = {},
    ) {
        if (!plan?.id) throw new Error('No Doctor plan selected.');
        store().applying.value = true;
        store().error.value = null;
        try {
            store().applyResult.value = await authSession.retryWithAuth(
                (onAuthChallenge) =>
                    api.request<DoctorPlanApplyResponse>(
                        `/internal/v1/doctor/plans/${encodeURIComponent(plan.id!)}/apply`,
                        {
                            method: 'POST',
                            body: {
                                approval: approvalFor(
                                    plan,
                                    options.rememberForMinutes ?? 0,
                                ),
                            },
                            onAuthChallenge,
                        },
                    ),
                'doctor-plan-apply',
            );
            if (store().applyResult.value?.restart_required) {
                suppressOr3ApiNetworkErrorLogsFor(65000);
            }
            return store().applyResult.value;
        } catch (err) {
            store().error.value = errorMessage(err);
            throw err;
        } finally {
            store().applying.value = false;
        }
    }

    async function rollbackPlan(planID = store().activePlan.value?.plan?.id) {
        if (!planID) throw new Error('No Doctor plan selected.');
        store().applying.value = true;
        store().error.value = null;
        try {
            const result = await authSession.retryWithAuth(
                (onAuthChallenge) =>
                    api.request<DoctorPlanApplyResponse>(
                        `/internal/v1/doctor/plans/${encodeURIComponent(planID)}/rollback`,
                        {
                            method: 'POST',
                            body: {
                                approval: {
                                    plan_id: planID,
                                    approved: true,
                                    approved_at: Date.now(),
                                },
                            },
                            onAuthChallenge,
                        },
                    ),
                'doctor-plan-rollback',
            );
            if (result.restart_required)
                suppressOr3ApiNetworkErrorLogsFor(65000);
            return result;
        } catch (err) {
            store().error.value = errorMessage(err);
            throw err;
        } finally {
            store().applying.value = false;
        }
    }

    async function runPostChecks(planID = store().activePlan.value?.plan?.id) {
        if (!planID) throw new Error('No Doctor plan selected.');
        store().postCheckResult.value = await api.request<DoctorPostCheckResponse>(
            `/internal/v1/doctor/plans/${encodeURIComponent(planID)}/post-checks`,
            { method: 'POST', body: {} },
        );
        return store().postCheckResult.value;
    }

    async function approvePendingApproval(
        messageID: number | string,
        remember = false,
    ) {
        const message = resolveDoctorMessageRef(
            store().messages.value,
            messageID,
        );
        const approvalRequestId = message?.approvalRequestId;
        if (!message || !approvalRequestId) return false;
        const id = typeof message.id === 'number' ? message.id : messageID;
        patchStreamingAssistant(id, {
            approvalState: 'retrying',
            status: 'attention',
            error: undefined,
        });
        try {
            const response = await approvals.approve(
                approvalRequestId,
                remember,
                remember
                    ? 'approved and remembered from doctor chat'
                    : 'approved from doctor chat',
            );
            if (response.resume_job_id) {
                await followJobStream(
                    {
                        jobID: response.resume_job_id,
                        placeholderID: id,
                    },
                    (path, requestOptions) => api.stream(path, requestOptions),
                    (jobID) =>
                        api.request<JobSnapshot>(
                            `/internal/v1/jobs/${encodeURIComponent(jobID)}`,
                        ),
                    () => loadSession(store().sessionKey.value),
                );
                return true;
            }
            patchStreamingAssistant(id, {
                approvalState: 'approved',
                status: 'complete',
                error: undefined,
                approvalRequestId: undefined,
            });
            markDoctorApprovalResolved(
                approvalRequestId,
                'approved',
                store().sessionKey.value ?? undefined,
            );
            await loadSession().catch(() => undefined);
            return true;
        } catch (err) {
            patchStreamingAssistant(id, {
                approvalState: 'failed',
                status: 'failed',
                error: errorMessage(err),
            });
            throw err;
        }
    }

    async function denyPendingApproval(messageID: number | string) {
        const message = resolveDoctorMessageRef(
            store().messages.value,
            messageID,
        );
        const approvalRequestId = message?.approvalRequestId;
        if (!message || !approvalRequestId) return false;
        const id = typeof message.id === 'number' ? message.id : messageID;
        await approvals.deny(approvalRequestId, 'denied from doctor chat');
        patchStreamingAssistant(id, {
            approvalState: 'denied',
            status: 'complete',
            error: undefined,
            approvalRequestId: undefined,
        });
        markDoctorApprovalResolved(
            approvalRequestId,
            'denied',
            store().sessionKey.value ?? undefined,
        );
        await loadSession().catch(() => undefined);
        return true;
    }

    async function resumeApprovedApprovalFromDesk(
        options: {
            resumeJobId: string;
            approvalRequestId?: number | string;
            sessionKey?: string;
            approval?: ApprovalRequest | null;
        },
    ) {
        const resumeJobId = String(options.resumeJobId ?? '').trim();
        const sessionKey = String(
            options.sessionKey?.trim() || store().sessionKey.value || '',
        ).trim();
        if (!resumeJobId || !sessionKey) return false;

        if (store().sessionKey.value !== sessionKey) {
            await loadSession(sessionKey);
        }

        const approvalRequestId = options.approvalRequestId;
        let message = approvalRequestId
            ? resolveDoctorMessageRef(store().messages.value, approvalRequestId)
            : undefined;
        if (!message && approvalRequestId) {
            message = ensureDoctorApprovalMessage(store(), {
                approvalRequestId,
                sessionKey,
                content: pendingApprovalPlaceholderContent(
                    options.approval ??
                        ({
                            id: approvalRequestId,
                            type: 'tool_quota',
                        } as ApprovalRequest),
                ),
            });
        }
        const placeholderID =
            message?.id ?? store().nextOptimisticMessageID();
        patchStreamingAssistant(placeholderID, {
            approvalState: 'retrying',
            status: 'attention',
            error: undefined,
        });
        await followJobStream(
            {
                jobID: resumeJobId,
                placeholderID,
            },
            (path, requestOptions) => api.stream(path, requestOptions),
            (jobID) =>
                api.request<JobSnapshot>(
                    `/internal/v1/jobs/${encodeURIComponent(jobID)}`,
                ),
            () => loadSession(store().sessionKey.value),
        );
        const latest = readStreamingAssistant(placeholderID);
        if (
            !(
                latest?.approvalState === 'pending' && latest.approvalRequestId
            )
        ) {
            markDoctorApprovalResolved(
                approvalRequestId ?? resumeJobId,
                'approved',
                sessionKey,
            );
        }
        return true;
    }

    function stopActiveTurn() {
        store().bumpMessageGeneration();
        const runnerTurn = store().activeRunnerTurn.value;
        const jobID = store().activeJobID.value;
        store().activeRunnerTurn.value = null;
        store().activeJobID.value = null;
        const optimisticTurn = store().activeOptimisticTurn.value;
        store().activeOptimisticTurn.value = null;
        store().activeRequestController.value?.abort();
        store().activeRequestController.value = null;
        stopStreaming();
        if (optimisticTurn) {
            removeStreamingAssistant(optimisticTurn.placeholderID);
        }
        store().activeSendPromise = null;
        store().loading.value = false;
        store().error.value = null;
        if (runnerTurn) {
            void api
                .request(
                    `/internal/v1/runner-chat/sessions/${encodeURIComponent(runnerTurn.sessionID)}/turns/${encodeURIComponent(runnerTurn.turnID)}/abort`,
                    { method: 'POST', body: {} },
                )
                .catch(() => undefined);
        }
        if (jobID) {
            void api
                .request(
                    `/internal/v1/jobs/${encodeURIComponent(jobID)}/abort`,
                    { method: 'POST', body: {} },
                )
                .catch(() => undefined);
        }
    }

    function clearMessages() {
        store().bumpMessageGeneration();
        store().activeSendPromise = null;
        store().activeRequestController.value?.abort();
        store().activeRequestController.value = null;
        stopStreaming();
        store().activeRunnerTurn.value = null;
        store().activeJobID.value = null;
        store().activeOptimisticTurn.value = null;
        store().messages.value = [];
        store().sessionKey.value = null;
        persistSessionKey(null);
        store().activePlan.value = null;
        store().applyResult.value = null;
        store().postCheckResult.value = null;
        store().planApplyResults.value = {};
        store().planApplyFailures.value = {};
        store().planPostCheckResults.value = {};
        store().loading.value = false;
        store().error.value = null;
    }

    function clearError() {
        store().error.value = null;
    }

    return {
        sessionKey: computed(() => store().sessionKey.value),
        messages: computed(() => store().messages.value),
        adminBrain: computed(() => store().adminBrain.value),
        status: computed(() => store().status.value),
        activePlan: computed(() => store().activePlan.value),
        applyResult: computed(() => store().applyResult.value),
        postCheckResult: computed(() => store().postCheckResult.value),
        planApplyResults: store().planApplyResults,
        planApplyFailures: store().planApplyFailures,
        planPostCheckResults: store().planPostCheckResults,
        loading: computed(() => store().loading.value),
        applying: computed(() => store().applying.value),
        error: computed(() => store().error.value),
        loadStatus,
        loadAdminBrain,
        createSession,
        loadSession,
        sendMessage,
        createPlan,
        validatePlan,
        applyPlan,
        rollbackPlan,
        runPostChecks,
        approvePendingApproval,
        denyPendingApproval,
        resumeApprovedApprovalFromDesk,
        clearMessages,
        clearError,
        stopStreaming: stopActiveTurn,
        hydratePersistedSession,
    };
}
