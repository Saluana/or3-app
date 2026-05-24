import { computed, ref } from 'vue';
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
    DoctorPlanApplyResponse,
    DoctorPlanResponse,
    DoctorPostCheckResponse,
    DoctorSettingsChangePlan,
    DoctorStatusResponse,
} from '~/types/or3-api';
import { createAssistantEventApplier } from '~/utils/assistant-stream/event-applier';
import { suppressOr3ApiNetworkErrorLogsFor, useOr3Api } from './useOr3Api';
import { useAuthSession } from './useAuthSession';

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

const sessionKey = ref<string | null>(null);
const messages = ref<DoctorMessageState[]>([]);
const adminBrain = ref<DoctorAdminBrainProvider | null>(null);
const status = ref<DoctorStatusResponse | null>(null);
const activePlan = ref<DoctorPlanResponse | null>(null);
const applyResult = ref<DoctorPlanApplyResponse | null>(null);
const postCheckResult = ref<DoctorPostCheckResponse | null>(null);
const loading = ref(false);
const applying = ref(false);
const error = ref<string | null>(null);
const activeRequestController = ref<AbortController | null>(null);
const activeStreamController = ref<AbortController | null>(null);
const activeRunnerTurn = ref<{ sessionID: string; turnID: string } | null>(
    null,
);
const activeJobID = ref<string | null>(null);
const activeOptimisticTurn = ref<{
    userID: number;
    placeholderID: number;
} | null>(null);
let activeSendPromise: Promise<DoctorChatSessionResponse> | null = null;
let optimisticMessageID = -1;
let messageGeneration = 0;

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
    return `doctor-app-${Date.now().toString(36)}`;
}

function chatAdminBrainKind(provider: DoctorAdminBrainProvider | null) {
    return String(provider?.kind ?? '').trim();
}

function doctorAdminBrainUsesExternalRunner(
    provider: DoctorAdminBrainProvider | null,
) {
    const runnerID = String(provider?.runner_id ?? '').trim();
    return (
        chatAdminBrainKind(provider) === 'runner' ||
        Boolean(provider?.available && runnerID && runnerID !== 'or3-intern')
    );
}

export type DoctorChatMessage = DoctorMessageState;

export type DoctorChatCard =
    | { type: 'finding'; card: DoctorFindingCard }
    | { type: 'recommended_fix'; card: DoctorFindingCard }
    | {
          type: 'plan';
          plan: DoctorSettingsChangePlan;
          status?: string;
          rollbackId?: string;
          postCheckPending?: boolean;
      }
    | { type: 'risk'; plan: DoctorSettingsChangePlan }
    | { type: 'restart'; plan: DoctorSettingsChangePlan }
    | { type: 'post_check'; planId?: string; result?: DoctorPostCheckResponse }
    | { type: 'undo'; planId?: string; rollbackId?: string }
    | { type: 'manual_fallback'; message: string };

export interface DoctorToolResult {
    kind?: string;
    ok?: boolean;
    status?: string;
    summary?: string;
    preview?: string;
    plan_id?: string;
    stats?: Record<string, unknown>;
}

const jsonBlockPattern = /```(?:json)?\s*([\s\S]*?)```/gi;
const telemetryOnlyToolKinds = new Set([
    'doctor_status',
    'doctor_logs',
    'doctor_docs_search',
    'doctor_config_search',
    'doctor_config_metadata',
]);

function isTelemetryOnlyResult(result: DoctorToolResult) {
    return telemetryOnlyToolKinds.has(String(result.kind ?? ''));
}

function stringField(record: Record<string, unknown>, ...keys: string[]) {
    for (const key of keys) {
        const value = record[key];
        if (typeof value === 'string') return value;
    }
    return '';
}

function numberField(record: Record<string, unknown>, ...keys: string[]) {
    for (const key of keys) {
        const value = record[key];
        if (typeof value === 'number') return value;
        if (typeof value === 'string') {
            const parsed = Number(value);
            if (Number.isFinite(parsed)) return parsed;
        }
    }
    return undefined;
}

function normalizeDoctorMessage(raw: unknown): DoctorChatMessage | null {
    if (!raw || typeof raw !== 'object') return null;
    const record = raw as Record<string, unknown>;
    return {
        id: numberField(record, 'id', 'ID'),
        role: stringField(record, 'role', 'Role') || 'assistant',
        content: stringField(record, 'content', 'Content'),
        created_at: numberField(record, 'created_at', 'CreatedAt'),
        meta: parseMaybeJSON(
            record.meta ??
                record.Meta ??
                record.payload_json ??
                record.PayloadJSON,
        ),
    };
}

function parseMaybeJSON(value: unknown) {
    if (typeof value !== 'string') return value;
    const trimmed = value.trim();
    if (!trimmed) return undefined;
    try {
        return JSON.parse(trimmed) as unknown;
    } catch {
        return value;
    }
}

function parseRecordJSON(value: unknown) {
    const parsed = parseMaybeJSON(value);
    return parsed && typeof parsed === 'object'
        ? (parsed as Record<string, unknown>)
        : undefined;
}

function candidateDoctorRecords(content: unknown) {
    const records: Record<string, unknown>[] = [];
    const direct = parseRecordJSON(content);
    if (direct) records.push(direct);
    if (typeof content === 'string') {
        for (const match of content.matchAll(jsonBlockPattern)) {
            const record = parseRecordJSON(match[1]);
            if (record) records.push(record);
        }
    }
    return records;
}

function looksLikeStatsRecord(record: Record<string, unknown>) {
    return (
        typeof record.card_type === 'string' ||
        Boolean(record.plan) ||
        Boolean(record.plans) ||
        Boolean(record.finding_cards) ||
        typeof record.rollback_id === 'string' ||
        typeof record.post_check_pending === 'boolean'
    );
}

function doctorToolResultFromRecord(
    record: Record<string, unknown>,
): DoctorToolResult | null {
    const kind = typeof record.kind === 'string' ? record.kind : '';
    let stats =
        record.stats && typeof record.stats === 'object'
            ? (record.stats as Record<string, unknown>)
            : undefined;
    if (!stats && looksLikeStatsRecord(record)) {
        stats = record;
    }
    if (!stats && asPlan(record)) {
        stats = { card_type: 'settings_change_preview', plan: record };
    }
    if (!kind && !stats) return null;
    return {
        kind: kind || (stats?.plan ? 'doctor_plan' : 'doctor_result'),
        ok: typeof record.ok === 'boolean' ? record.ok : undefined,
        status: typeof record.status === 'string' ? record.status : undefined,
        summary:
            typeof record.summary === 'string' ? record.summary : undefined,
        preview:
            typeof record.preview === 'string' ? record.preview : undefined,
        plan_id:
            typeof record.plan_id === 'string' ? record.plan_id : undefined,
        stats,
    };
}

export function parseDoctorToolResults(content: unknown): DoctorToolResult[] {
    const results: DoctorToolResult[] = [];
    const seen = new Set<string>();
    for (const record of candidateDoctorRecords(content)) {
        const result = doctorToolResultFromRecord(record);
        if (!result) continue;
        const key = JSON.stringify(result);
        if (seen.has(key)) continue;
        seen.add(key);
        results.push(result);
    }
    return results;
}

export function parseDoctorToolResult(
    content: unknown,
): DoctorToolResult | null {
    return parseDoctorToolResults(content)[0] ?? null;
}

function asFindingCard(value: unknown): DoctorFindingCard | null {
    if (!value || typeof value !== 'object') return null;
    const record = value as Record<string, unknown>;
    const id = String(record.id ?? '').trim();
    const what = String(record.what_i_found ?? '').trim();
    if (!id || !what) return null;
    return record as unknown as DoctorFindingCard;
}

function asPlan(value: unknown): DoctorSettingsChangePlan | null {
    if (!value || typeof value !== 'object') return null;
    const record = value as Record<string, unknown>;
    const title = String(record.title ?? '').trim();
    const changes = Array.isArray(record.changes) ? record.changes : undefined;
    if (!title || !changes) return null;
    return record as unknown as DoctorSettingsChangePlan;
}

function asPostCheckResult(
    result: DoctorToolResult,
): DoctorPostCheckResponse | undefined {
    const stats = result.stats;
    if (!stats) return undefined;
    const status =
        typeof stats.status === 'string' ? stats.status : result.status;
    if (!status) return undefined;
    return {
        checkpoint_id:
            typeof stats.checkpoint_id === 'string'
                ? stats.checkpoint_id
                : undefined,
        status,
        results: Array.isArray(stats.results) ? stats.results : undefined,
        doctor_report: stats.doctor_report,
    };
}

export function doctorToolResultText(result: DoctorToolResult | null) {
    if (!result) return '';
    return result.summary || result.preview || result.status || '';
}

function doctorCardsForResult(
    result: DoctorToolResult,
    options: { messageRole?: string } = {},
): DoctorChatCard[] {
    if (!result?.stats) return [];
    const stats = result.stats;
    const cards: DoctorChatCard[] = [];
    const fromToolMessage = options.messageRole === 'tool';

    if (isTelemetryOnlyResult(result)) return [];

    const findingCards = Array.isArray(stats.finding_cards)
        ? stats.finding_cards
              .map((item) => asFindingCard(item))
              .filter((card): card is DoctorFindingCard => Boolean(card))
        : [];
    if (!fromToolMessage || result.kind !== 'doctor_status') {
        for (const card of findingCards) {
            cards.push({ type: 'finding', card });
            if (card.recommended_fix)
                cards.push({ type: 'recommended_fix', card });
        }
    }

    const plan = asPlan(stats.plan);
    if (plan) {
        const rollbackId =
            typeof stats.rollback_id === 'string'
                ? stats.rollback_id
                : undefined;
        const status =
            typeof stats.status === 'string' ? stats.status : result.status;
        const postCheckPending = Boolean(stats.post_check_pending);
        cards.push({
            type: 'plan',
            plan,
            status,
            rollbackId,
            postCheckPending,
        });
        if (plan.requires_approval || plan.requires_step_up_auth) {
            cards.push({ type: 'risk', plan });
        }
        if (plan.restart_required) cards.push({ type: 'restart', plan });
        if (plan.id && (postCheckPending || plan.post_apply_checks?.length)) {
            cards.push({ type: 'post_check', planId: plan.id });
        }
        if (plan.id && rollbackId) {
            cards.push({ type: 'undo', planId: plan.id, rollbackId });
        }
    }

    const plans = Array.isArray(stats.plans)
        ? stats.plans
              .map((item) => asPlan(item))
              .filter((item): item is DoctorSettingsChangePlan => Boolean(item))
        : [];
    for (const suggested of plans) {
        if (plan && suggested.id === plan.id) continue;
        cards.push({ type: 'plan', plan: suggested });
        if (suggested.requires_approval || suggested.requires_step_up_auth) {
            cards.push({ type: 'risk', plan: suggested });
        }
        if (suggested.restart_required)
            cards.push({ type: 'restart', plan: suggested });
    }

    if (result.kind === 'doctor_post_check') {
        cards.push({
            type: 'post_check',
            planId:
                result.plan_id ||
                (typeof stats.plan_id === 'string' ? stats.plan_id : undefined),
            result: asPostCheckResult(result),
        });
    }

    if (result.ok === false && result.summary && !fromToolMessage) {
        cards.push({ type: 'manual_fallback', message: result.summary });
    }

    return cards;
}

export function doctorCardsForMessage(
    message: DoctorChatMessage,
): DoctorChatCard[] {
    return parseDoctorToolResults(message.content).flatMap((result) =>
        doctorCardsForResult(result, { messageRole: message.role }),
    );
}

function stripDoctorJSONBlocks(content: string) {
    return content.replace(jsonBlockPattern, (match, body) =>
        parseDoctorToolResult(body) ? '' : match,
    );
}

export function doctorVisibleTextForMessage(message: DoctorChatMessage) {
    const content = String(message.content ?? '');
    const results = parseDoctorToolResults(content);
    if (message.role === 'tool') {
        return '';
    }
    if (!results.length) return content.trim();
    const stripped = stripDoctorJSONBlocks(content).trim();
    if (stripped && !parseDoctorToolResult(stripped)) return stripped;
    if (results.every(isTelemetryOnlyResult)) return '';
    if (
        results.some(
            (result) =>
                doctorCardsForResult(result, { messageRole: message.role })
                    .length > 0,
        )
    )
        return '';
    return results
        .map((result) =>
            result.ok === false ? doctorToolResultText(result) : '',
        )
        .filter(Boolean)
        .join('\n')
        .trim();
}

function normalizeDoctorMessages(raw: unknown) {
    if (!Array.isArray(raw)) return [];
    const normalized = raw
        .map((message) => normalizeDoctorMessage(message))
        .filter((message): message is DoctorChatMessage => Boolean(message));
    return normalized.filter((message, index) => {
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
}

function maxMessageID(items = messages.value) {
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

function appendOrUpdateStreamingAssistant(
    id: number,
    content: string,
    status: ChatMessage['status'],
) {
    const existing = messages.value.findIndex((message) => message.id === id);
    const current = existing >= 0 ? messages.value[existing] : null;
    const message: DoctorChatMessage = {
        ...(current ?? {}),
        id,
        role: 'assistant',
        content,
        created_at: Math.floor(Date.now() / 1000),
        meta: { ...(parseRecordJSON(current?.meta) ?? {}), status },
        status,
    };
    if (existing >= 0) {
        messages.value = messages.value.map((item, index) =>
            index === existing ? message : item,
        );
        return;
    }
    messages.value = [...messages.value, message];
}

function patchStreamingAssistant(
    id: number,
    patch: Partial<DoctorMessageState>,
) {
    messages.value = messages.value.map((message) => {
        if (message.id !== id) return message;
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
    id: number,
    mutate: (message: DoctorMessageState) => DoctorMessageState,
) {
    messages.value = messages.value.map((message) =>
        message.id === id ? mutate(message) : message,
    );
}

function readStreamingAssistant(id: number) {
    return messages.value.find((message) => message.id === id);
}

function doctorMessageToChatMessage(
    message: DoctorMessageState | undefined,
): ChatMessage | undefined {
    if (!message) return undefined;
    const role = message.role === 'user' ? 'user' : 'assistant';
    return {
        id: String(message.id ?? ''),
        sessionId: sessionKey.value ?? 'doctor',
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

function createDoctorStreamApplier(placeholderID: number) {
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
    messages.value = [
        ...messages.value,
        {
            id,
            role: 'user',
            content,
            created_at: Math.floor(Date.now() / 1000),
            meta: { status: 'pending' },
        },
    ];
}

function nextOptimisticMessageID() {
    optimisticMessageID -= 1;
    return optimisticMessageID;
}

function removeMessage(id: number) {
    messages.value = messages.value.filter((message) => message.id !== id);
}

function removeStreamingAssistant(id: number) {
    messages.value = messages.value.filter((message) => message.id !== id);
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
    activeStreamController.value?.abort();
    activeStreamController.value = null;
}

async function streamDoctorEvents(
    input: {
        path: string;
        placeholderID: number;
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
    activeStreamController.value = controller;
    activeRunnerTurn.value = {
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
        if (activeStreamController.value === controller) {
            activeStreamController.value = null;
        }
        if (
            activeRunnerTurn.value?.sessionID === input.sessionID &&
            activeRunnerTurn.value?.turnID === input.turnID
        ) {
            activeRunnerTurn.value = null;
        }
    }
    await reloadSession();
    removeStreamingAssistant(input.placeholderID);
}

async function followJobStream(
    input: {
        jobID: string;
        placeholderID: number;
    },
    streamEvents: (path: string, options: any) => AsyncIterable<unknown>,
    reloadSession: () => Promise<unknown>,
) {
    stopStreaming();
    const controller = new AbortController();
    activeStreamController.value = controller;
    activeJobID.value = input.jobID;
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
        if (controller.signal.aborted || isAbortLikeError(err)) return;
        throw err;
    } finally {
        if (activeStreamController.value === controller) {
            activeStreamController.value = null;
        }
        if (activeJobID.value === input.jobID) {
            activeJobID.value = null;
        }
    }
    await reloadSession();
    removeStreamingAssistant(input.placeholderID);
}

function approvalFor(plan: DoctorSettingsChangePlan, rememberForMinutes = 0) {
    return {
        plan_id: plan.id ?? '',
        approved: true,
        approved_at: Date.now(),
        remember_for_minutes: rememberForMinutes,
    };
}

export function useDoctorAdminChat() {
    const api = useOr3Api();
    const authSession = useAuthSession();

    async function loadStatus() {
        loading.value = true;
        error.value = null;
        try {
            status.value = await api.request<DoctorStatusResponse>(
                '/internal/v1/doctor/status',
            );
            adminBrain.value = status.value.admin_brain ?? null;
            return status.value;
        } catch (err) {
            error.value = errorMessage(err);
            throw err;
        } finally {
            loading.value = false;
        }
    }

    async function loadAdminBrain() {
        adminBrain.value = await api.request<DoctorAdminBrainProvider>(
            '/internal/v1/doctor/admin-brain',
        );
        return adminBrain.value;
    }

    async function createSession(
        title = 'Doctor Session',
        options: {
            runnerId?: string;
            runnerModel?: string;
            signal?: AbortSignal;
        } = {},
    ) {
        loading.value = true;
        error.value = null;
        try {
            const key = sessionKey.value ?? newSessionKey();
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
            sessionKey.value = key;
            const nextMessages = normalizeDoctorMessages(response.messages);
            messages.value = nextMessages;
            adminBrain.value = response.admin_brain ?? adminBrain.value;
            return response;
        } catch (err) {
            error.value = errorMessage(err);
            throw err;
        } finally {
            loading.value = false;
        }
    }

    async function loadSession(key = sessionKey.value) {
        if (!key) return null;
        const response = await api.request<DoctorChatSessionResponse>(
            `/internal/v1/doctor/sessions/${encodeURIComponent(key)}`,
        );
        sessionKey.value = key;
        messages.value = normalizeDoctorMessages(response.messages);
        adminBrain.value = response.admin_brain ?? adminBrain.value;
        return response;
    }

    async function loadEvents(afterID = 0) {
        if (!sessionKey.value) return null;
        const params = new URLSearchParams();
        if (afterID > 0) params.set('after_id', String(afterID));
        const suffix = params.toString() ? `?${params.toString()}` : '';
        const response = await api.request<DoctorChatSessionResponse>(
            `/internal/v1/doctor/sessions/${encodeURIComponent(sessionKey.value)}/events${suffix}`,
        );
        const events = normalizeDoctorMessages(response.events);
        if (events.length) {
            const realUserContents = new Set(
                events
                    .filter(
                        (message) =>
                            (message.id ?? 0) > 0 && message.role === 'user',
                    )
                    .map((message) => message.content),
            );
            const seen = new Set(messages.value.map((message) => message.id));
            messages.value = [
                ...messages.value.filter(
                    (message) =>
                        !(
                            (message.id ?? 0) < 0 &&
                            message.role === 'user' &&
                            realUserContents.has(message.content)
                        ),
                ),
                ...events.filter((message) => !seen.has(message.id)),
            ];
        }
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
        const generation = messageGeneration;
        const controller = new AbortController();
        activeRequestController.value = controller;
        let previousMaxID = 0;
        let placeholderID = 0;
        let optimisticUserID = 0;
        try {
            if (!sessionKey.value)
                await createSession('Doctor Session', {
                    runnerId: options.runnerId,
                    runnerModel: options.runnerModel,
                    signal: controller.signal,
                });
            if (!sessionKey.value)
                throw new Error('Doctor session was not created.');
            loading.value = true;
            error.value = null;
            previousMaxID = maxMessageID();
            placeholderID = nextOptimisticMessageID();
            optimisticUserID = nextOptimisticMessageID();
            appendOptimisticUser(optimisticUserID, content);
            appendOrUpdateStreamingAssistant(
                placeholderID,
                'Working…',
                'streaming',
            );
            activeOptimisticTurn.value = {
                userID: optimisticUserID,
                placeholderID,
            };
            const requestJobStream =
                options.runnerId === 'or3-intern' ||
                Boolean(
                    adminBrain.value?.available &&
                    !doctorAdminBrainUsesExternalRunner(adminBrain.value),
                );
            const baseBody = requestJobStream
                ? { content, stream: true }
                : { content };
            const extendedBody = {
                ...baseBody,
                model: options.runnerModel,
                thinking_level: options.runnerThinkingLevel,
            };
            let response: DoctorChatSessionResponse;
            try {
                response = await api.request<DoctorChatSessionResponse>(
                    `/internal/v1/doctor/sessions/${encodeURIComponent(sessionKey.value)}/messages`,
                    {
                        method: 'POST',
                        body:
                            options.runnerModel || options.runnerThinkingLevel
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
                        `/internal/v1/doctor/sessions/${encodeURIComponent(sessionKey.value)}/messages`,
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
            if (generation !== messageGeneration) return response;
            const nextMessages = normalizeDoctorMessages(response.messages);
            adminBrain.value = response.admin_brain ?? adminBrain.value;
            const runnerChat = response.runner_chat;
            if (response.job_id) {
                await followJobStream(
                    {
                        jobID: response.job_id,
                        placeholderID,
                    },
                    (path, requestOptions) => api.stream(path, requestOptions),
                    () => loadSession(sessionKey.value),
                );
            } else if (runnerChat?.session_id && runnerChat.turn_id) {
                await followRunnerStream(
                    {
                        sessionID: runnerChat.session_id,
                        turnID: runnerChat.turn_id,
                        placeholderID,
                    },
                    (path, requestOptions) => api.stream(path, requestOptions),
                    () => loadSession(sessionKey.value),
                );
            } else {
                if (nextMessages.length) messages.value = nextMessages;
                if (!hasAssistantAfter(messages.value, previousMaxID)) {
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
                error.value = null;
                return {
                    messages: messages.value,
                    admin_brain: adminBrain.value ?? undefined,
                } as DoctorChatSessionResponse;
            }
            if (generation !== messageGeneration) throw err;
            if (placeholderID !== 0) removeStreamingAssistant(placeholderID);
            if (optimisticUserID !== 0) removeMessage(optimisticUserID);
            error.value = errorMessage(err);
            throw err;
        } finally {
            if (activeRequestController.value === controller) {
                activeRequestController.value = null;
            }
            if (activeOptimisticTurn.value?.placeholderID === placeholderID) {
                activeOptimisticTurn.value = null;
            }
            if (generation === messageGeneration) loading.value = false;
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
        if (activeSendPromise) return activeSendPromise;
        const promise = performSendMessage(normalizedContent, options);
        activeSendPromise = promise;
        void promise
            .finally(() => {
                if (activeSendPromise === promise) activeSendPromise = null;
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
                        options.conversationID ?? sessionKey.value ?? '',
                    accepted_card_id: options.acceptedCardID ?? '',
                    approved_authority: options.approvedAuthority ?? 'danger',
                    plan,
                },
            },
        );
        activePlan.value = response;
        return response;
    }

    async function validatePlan(planID = activePlan.value?.plan?.id) {
        if (!planID) throw new Error('No Doctor plan selected.');
        activePlan.value = await api.request<DoctorPlanResponse>(
            `/internal/v1/doctor/plans/${encodeURIComponent(planID)}/validate`,
            { method: 'POST', body: {} },
        );
        return activePlan.value;
    }

    async function applyPlan(
        plan = activePlan.value?.plan,
        options: {
            rememberForMinutes?: number;
            approvedAuthority?: string;
        } = {},
    ) {
        if (!plan?.id) throw new Error('No Doctor plan selected.');
        applying.value = true;
        error.value = null;
        try {
            applyResult.value = await authSession.retryWithAuth(
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
                                approved_authority:
                                    options.approvedAuthority ?? 'danger',
                            },
                            onAuthChallenge,
                        },
                    ),
                'doctor-plan-apply',
            );
            if (applyResult.value.restart_required) {
                suppressOr3ApiNetworkErrorLogsFor(65000);
            }
            return applyResult.value;
        } catch (err) {
            error.value = errorMessage(err);
            throw err;
        } finally {
            applying.value = false;
        }
    }

    async function rollbackPlan(planID = activePlan.value?.plan?.id) {
        if (!planID) throw new Error('No Doctor plan selected.');
        applying.value = true;
        error.value = null;
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
                                approved_authority: 'danger',
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
            error.value = errorMessage(err);
            throw err;
        } finally {
            applying.value = false;
        }
    }

    async function runPostChecks(planID = activePlan.value?.plan?.id) {
        if (!planID) throw new Error('No Doctor plan selected.');
        postCheckResult.value = await api.request<DoctorPostCheckResponse>(
            `/internal/v1/doctor/plans/${encodeURIComponent(planID)}/post-checks`,
            { method: 'POST', body: {} },
        );
        return postCheckResult.value;
    }

    function stopActiveTurn() {
        messageGeneration += 1;
        const runnerTurn = activeRunnerTurn.value;
        const jobID = activeJobID.value;
        activeRunnerTurn.value = null;
        activeJobID.value = null;
        const optimisticTurn = activeOptimisticTurn.value;
        activeOptimisticTurn.value = null;
        activeRequestController.value?.abort();
        activeRequestController.value = null;
        stopStreaming();
        if (optimisticTurn) {
            removeStreamingAssistant(optimisticTurn.placeholderID);
        }
        activeSendPromise = null;
        loading.value = false;
        error.value = null;
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
        messageGeneration += 1;
        activeSendPromise = null;
        activeRequestController.value?.abort();
        activeRequestController.value = null;
        stopStreaming();
        activeRunnerTurn.value = null;
        activeJobID.value = null;
        activeOptimisticTurn.value = null;
        messages.value = [];
        sessionKey.value = null;
        activePlan.value = null;
        applyResult.value = null;
        postCheckResult.value = null;
        loading.value = false;
        error.value = null;
    }

    function clearError() {
        error.value = null;
    }

    return {
        sessionKey: computed(() => sessionKey.value),
        messages: computed(() => messages.value),
        adminBrain: computed(() => adminBrain.value),
        status: computed(() => status.value),
        activePlan: computed(() => activePlan.value),
        applyResult: computed(() => applyResult.value),
        postCheckResult: computed(() => postCheckResult.value),
        loading: computed(() => loading.value),
        applying: computed(() => applying.value),
        error: computed(() => error.value),
        loadStatus,
        loadAdminBrain,
        createSession,
        loadSession,
        loadEvents,
        sendMessage,
        createPlan,
        validatePlan,
        applyPlan,
        rollbackPlan,
        runPostChecks,
        clearMessages,
        clearError,
        stopStreaming: stopActiveTurn,
    };
}
