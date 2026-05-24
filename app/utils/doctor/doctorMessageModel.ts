import type {
    ChatActivityEntry,
    ChatMessage,
    ChatMessagePart,
} from '~/types/app-state';
import type {
    DoctorFindingCard,
    DoctorPostCheckResponse,
    DoctorSettingsChangePlan,
} from '~/types/or3-api';
import { previewValue } from '~/utils/assistant-stream/activity';
import { scrubDoctorUserMessageContent } from './doctorContent';
import type { DoctorChatMessage } from './doctorTypes';
import { parseFindingCard, parsePlan } from './doctorValidate';

export type {
    DoctorChatMessage,
    DoctorMessageState,
} from './doctorTypes';

export const DOCTOR_EMPTY_FINAL_TEXT_WARNING =
    'Tool work completed, but or3-intern did not return a final assistant message. The last tool result is shown above; retry the turn if it still matters.';

export function isDoctorEmptyFinalTextWarning(value: string | undefined) {
    return String(value ?? '').trim() === DOCTOR_EMPTY_FINAL_TEXT_WARNING;
}

const DOCTOR_INTERIM_PREFACE_RE =
    /^(?:let me (?:also )?(?:check|look(?:\s+up)?|see|verify|pull up|scan|read|search|find out)|i(?:'ll| will) (?:check|look(?:\s+up)?|see|verify|search)|give me a (?:moment|sec|second)|one moment|working(?:…|\.\.\.)?)\b/i;

/** Short “on my way” lines shown while tools run — hide until the turn finishes. */
export function isDoctorInterimStreamingText(text: string | undefined) {
    const normalized = String(text ?? '').trim();
    if (!normalized) return false;
    if (normalized === 'Working…') return true;
    if (normalized.length > 120) return false;
    return DOCTOR_INTERIM_PREFACE_RE.test(normalized);
}

export function stripDoctorInterimPreface(text: string) {
    const trimmed = text.trim();
    if (!trimmed) return '';
    const blocks = trimmed.split(/\n\n+/).map((block) => block.trim()).filter(Boolean);
    if (blocks.length <= 1) return trimmed;
    if (!isDoctorInterimStreamingText(blocks[0])) return trimmed;
    const rest = blocks.slice(1).join('\n\n').trim();
    return rest || trimmed;
}

export function messageHasEmptyFinalTextError(
    message: Pick<DoctorChatMessage, 'content' | 'errorCode' | 'error'>,
) {
    if (message.errorCode === 'empty_final_text') return true;
    const error = String(message.error ?? '').trim();
    return error.includes('without a final assistant message');
}

export type DoctorChatCard =
    | { type: 'finding'; card: DoctorFindingCard }
    | { type: 'recommended_fix'; card: DoctorFindingCard }
    | {
          type: 'plan';
          plan: DoctorSettingsChangePlan;
          status?: string;
                    ok?: boolean;
                    error?: string;
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
    'doctor_docs_index',
    'doctor_docs_search',
    'doctor_docs_section',
    'doctor_config_search',
    'doctor_config_catalog',
    'doctor_config_metadata',
]);

export const doctorTelemetryToolNames = telemetryOnlyToolKinds;

export function isDoctorTelemetryToolName(name?: string) {
    return doctorTelemetryToolNames.has(String(name ?? '').trim());
}

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

export function normalizeDoctorMessage(raw: unknown): DoctorChatMessage | null {
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

export function parseRecordJSON(value: unknown) {
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

function stableDoctorResultKey(result: DoctorToolResult) {
    const kind = String(result.kind ?? '').trim();
    const planID =
        result.plan_id ||
        (result.stats && typeof result.stats === 'object'
            ? String((result.stats as Record<string, unknown>).plan_id ?? '')
            : '');
    if (planID) return `${kind}:${planID}`;
    return JSON.stringify(result);
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
    if (!stats && parsePlan(record)) {
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

function doctorToolResultsFromMeta(meta: unknown): DoctorToolResult[] {
    const record = parseRecordJSON(meta);
    const structured = record?.doctor_tool_result;
    if (!structured || typeof structured !== 'object') return [];
    const parsed = doctorToolResultFromRecord(
        structured as Record<string, unknown>,
    );
    return parsed ? [parsed] : [];
}

export function parseDoctorToolResults(
    content: unknown,
    meta?: unknown,
    options: { allowProseFallback?: boolean } = {},
): DoctorToolResult[] {
    const fromMeta = doctorToolResultsFromMeta(meta);
    if (fromMeta.length) return fromMeta;
    if (options.allowProseFallback === false) return [];
    const results: DoctorToolResult[] = [];
    const seen = new Set<string>();
    for (const record of candidateDoctorRecords(content)) {
        const result = doctorToolResultFromRecord(record);
        if (!result) continue;
        const key = stableDoctorResultKey(result);
        if (seen.has(key)) continue;
        seen.add(key);
        results.push(result);
    }
    return results;
}

export function parseDoctorToolResult(
    content: unknown,
    meta?: unknown,
): DoctorToolResult | null {
    return parseDoctorToolResults(content, meta)[0] ?? null;
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
              .map((item) => parseFindingCard(item))
              .filter((card): card is DoctorFindingCard => Boolean(card))
        : [];
    if (!fromToolMessage || result.kind !== 'doctor_status') {
        for (const card of findingCards) {
            cards.push({ type: 'finding', card });
        }
    }

    const plan = parsePlan(stats.plan);
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
            ok: result.ok,
            error:
                typeof stats.error === 'string' ? stats.error : undefined,
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
              .map((item) => parsePlan(item))
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

function doctorCardDedupeKey(card: DoctorChatCard) {
    if (card.type === 'plan') {
        return `plan:${card.plan.id ?? card.plan.title}`;
    }
    if (card.type === 'finding') {
        return `finding:${card.card.id}`;
    }
    if (card.type === 'post_check') {
        return `post_check:${card.planId ?? ''}`;
    }
    if (card.type === 'undo') {
        return `undo:${card.planId ?? ''}:${card.rollbackId ?? ''}`;
    }
    return `${card.type}`;
}

export function doctorCardsForMessage(
    message: DoctorChatMessage,
): DoctorChatCard[] {
    const cards: DoctorChatCard[] = [];
    const seen = new Set<string>();
    const structuredMeta = Boolean(
        doctorToolResultsFromMeta(message.meta).length,
    );
    const allowProseFallback =
        !structuredMeta &&
        message.role === 'assistant' &&
        !(message.parts?.some((part) => part.type === 'tool') ?? false);
    const addResult = (result: DoctorToolResult) => {
        for (const card of doctorCardsForResult(result, {
            messageRole: message.role,
        })) {
            const key = doctorCardDedupeKey(card);
            if (seen.has(key)) continue;
            seen.add(key);
            cards.push(card);
        }
    };
    for (const result of parseDoctorToolResults(message.content, message.meta, {
        allowProseFallback,
    })) {
        addResult(result);
    }
    for (const { result } of doctorCollectToolResults(message)) {
        addResult(result);
    }
    return cards;
}

function stripDoctorJSONBlocks(content: string) {
    return content.replace(jsonBlockPattern, (match, body) =>
        parseDoctorToolResult(body) ? '' : match,
    );
}

function doctorEmptyFinalSummary(message: DoctorChatMessage) {
    const content = String(message.content ?? '').trim();
    if (isDoctorEmptyFinalTextWarning(content)) return content;
    if (messageHasEmptyFinalTextError(message)) {
        return DOCTOR_EMPTY_FINAL_TEXT_WARNING;
    }
    return '';
}

function formatDoctorConfigFieldValue(value: unknown) {
    if (!value || typeof value !== 'object') return 'not set';
    const record = value as Record<string, unknown>;
    if (typeof record.summary === 'string' && record.summary.trim()) {
        return record.summary.trim();
    }
    if (record.present === false) return 'not set';
    if (record.redacted && record.present) return 'configured (hidden)';
    if (typeof record.value === 'boolean') return record.value ? 'On' : 'Off';
    if (typeof record.value === 'string' && record.value.trim()) {
        return record.value.trim();
    }
    if (record.value === null || record.value === undefined || record.value === '') {
        return 'not set';
    }
    return String(record.value);
}

const connectedAppsQuestionPattern =
    /\b(connected\s+apps?|which\s+apps?|what\s+apps?|any\s+apps?|integrations?|telegram|slack|discord|whatsapp|email\s+channel)\b/i;

function isConnectedAppsQuestion(text: string) {
    return connectedAppsQuestionPattern.test(text.trim());
}

function doctorSummaryFromConnectedApps(result: DoctorToolResult) {
    const apps = Array.isArray(result.stats?.connected_apps)
        ? (result.stats?.connected_apps as Array<Record<string, unknown>>)
        : [];
    if (!apps.length) {
        return "You don't have any connected apps turned on right now.";
    }
    const enabled = apps.filter((app) => app.enabled === true);
    const disabled = apps.filter((app) => app.enabled !== true);
    const lines = enabled.map((app) => {
        const name = String(app.name ?? app.id ?? 'App').trim();
        const detail = String(app.detail ?? '').trim();
        return detail
            ? `- **${name}** — ${detail}`
            : `- **${name}** — connected`;
    });
    let text =
        enabled.length === 1
            ? 'You have **1 connected app**:'
            : `You have **${enabled.length} connected apps**:`;
    text += `\n\n${lines.join('\n')}`;
    if (disabled.length) {
        const names = disabled
            .map((app) => String(app.name ?? app.id ?? '').trim())
            .filter(Boolean)
            .join(', ');
        if (names) {
            text += `\n\nNot connected: ${names}.`;
        }
    }
    return text;
}

function doctorSummaryFromConfigSearch(result: DoctorToolResult) {
    const fields = Array.isArray(result.stats?.fields)
        ? (result.stats?.fields as Array<Record<string, unknown>>)
        : [];
    if (!fields.length) {
        return (
            result.summary?.trim() ||
            "I couldn't find any matching settings for that question."
        );
    }
    if (fields.length === 1) {
        const field = fields[0] ?? {};
        const label = String(
            field.label || field.key || field.path || 'Setting',
        ).trim();
        const description = String(field.description ?? '').trim();
        const value = formatDoctorConfigFieldValue(field.current_value);
        const lines = [`Your **${label}** is set to **${value}**.`];
        if (
            description &&
            !description.toLowerCase().includes(label.toLowerCase())
        ) {
            lines.push(description);
        }
        return lines.join('\n\n');
    }
    const lines = fields.slice(0, 6).map((field) => {
        const label = String(field.label || field.key || field.path).trim();
        const value = formatDoctorConfigFieldValue(field.current_value);
        return `- **${label}**: ${value}`;
    });
    const suffix =
        fields.length > 6 ? `\n\n…and ${fields.length - 6} more.` : '';
    return `Here are the matching settings:\n\n${lines.join('\n')}${suffix}`;
}

function doctorCollectToolResults(message: DoctorChatMessage | null | undefined) {
    const results: Array<{ name: string; result: DoctorToolResult }> = [];
    for (const result of parseDoctorToolResults(
        message?.content,
        message?.meta,
    )) {
        results.push({ name: '', result });
    }
    for (const part of message?.parts ?? []) {
        if (part.type !== 'tool' || part.status === 'running') continue;
        const parsed = parseDoctorToolResult(part.resultPreview || '');
        if (parsed) results.push({ name: part.name || '', result: parsed });
    }
    for (const call of message?.toolCalls ?? []) {
        if (call.status === 'running') continue;
        const parsed = parseDoctorToolResult(call.result || '');
        if (parsed) results.push({ name: call.name, result: parsed });
    }
    return results;
}

export function doctorSynthesizeFinalSummary(
    message: DoctorChatMessage | null | undefined,
    options: { userMessage?: string } = {},
) {
    const userMessage = String(options.userMessage ?? '').trim();
    const tools = doctorCollectToolResults(message);
    for (let index = tools.length - 1; index >= 0; index -= 1) {
        const { result } = tools[index] ?? {};
        if (!result || result.ok === false) continue;
        const kind = String(result.kind ?? '').trim();
        if (kind === 'doctor_config_search') {
            const summary = doctorSummaryFromConfigSearch(result);
            if (summary.trim()) return summary.trim();
        }
        if (kind === 'doctor_status') {
            if (
                isConnectedAppsQuestion(userMessage) &&
                Array.isArray(result.stats?.connected_apps)
            ) {
                return doctorSummaryFromConnectedApps(result).trim();
            }
            const summary = result.summary?.trim();
            if (summary) return summary;
            continue;
        }
        const summary = result.summary?.trim();
        if (summary && !isTelemetryOnlyResult(result)) return summary;
    }
    return '';
}

export function doctorLastUserMessageBefore(
    items: DoctorChatMessage[],
    beforeId?: number,
) {
    const sorted = sortDoctorMessages(items);
    for (let index = sorted.length - 1; index >= 0; index -= 1) {
        const message = sorted[index];
        if (!message) continue;
        if (message.role !== 'user') continue;
        if (
            typeof beforeId === 'number' &&
            typeof message.id === 'number' &&
            message.id >= beforeId
        ) {
            continue;
        }
        return String(message.content ?? '').trim();
    }
    return '';
}

export function isGenericEmptyFinalRecovery(text: string) {
    const normalized = text.trim().toLowerCase();
    return (
        normalized.includes('did not return a final message') ||
        normalized.includes('did not return a final response') ||
        normalized.includes('completed without a final response')
    );
}

export function doctorVisibleTextForMessage(message: DoctorChatMessage) {
    const content = String(message.content ?? '');
    const results = parseDoctorToolResults(content, message.meta);
    if (message.role === 'tool') {
        return '';
    }
    if (!results.length) {
        const trimmed = content.trim();
        if (trimmed) return trimmed;
        return doctorEmptyFinalSummary(message);
    }
    const stripped = stripDoctorJSONBlocks(content).trim();
    if (stripped && !parseDoctorToolResult(stripped)) return stripped;
    if (results.every(isTelemetryOnlyResult)) {
        return doctorEmptyFinalSummary(message);
    }
    if (
        results.some(
            (result) =>
                doctorCardsForResult(result, { messageRole: message.role })
                    .length > 0,
        )
    ) {
        return stripped || doctorEmptyFinalSummary(message);
    }
    return results
        .map((result) =>
            result.ok === false ? doctorToolResultText(result) : '',
        )
        .filter(Boolean)
        .join('\n')
        .trim();
}

export type DoctorDisplayMessage = {
    rawId: number;
    id: string;
    role: 'user' | 'assistant';
    rawRole: string;
    text: string;
    isEmptyFinalSummary: boolean;
    status: ChatMessage['status'];
    error?: string;
    errorCode?: string;
    approvalRequestId?: number | string;
    approvalState?: string;
    parts: ChatMessagePart[];
    activityLog: ChatActivityEntry[];
    cards: DoctorChatCard[];
};

function doctorMessageSequence(message: DoctorChatMessage) {
    const meta = parseRecordJSON(message.meta);
    const seq = meta?.doctor_seq;
    if (typeof seq === 'number' && Number.isFinite(seq)) return seq;
    if (typeof seq === 'string') {
        const parsed = Number(seq);
        if (Number.isFinite(parsed)) return parsed;
    }
    return message.id ?? message.created_at ?? 0;
}

/** Stable chronological order: server doctor_seq, then persisted ids, then optimistic ids. */
export function compareDoctorMessageOrder(
    a: DoctorChatMessage,
    b: DoctorChatMessage,
): number {
    const seqA = doctorMessageSequence(a);
    const seqB = doctorMessageSequence(b);
    if (seqA > 0 && seqB > 0 && seqA !== seqB) {
        return seqA - seqB;
    }
    const idA = a.id ?? 0;
    const idB = b.id ?? 0;
    const createdA = a.created_at ?? 0;
    const createdB = b.created_at ?? 0;
    if (idA > 0 && idB > 0 && idA !== idB) {
        return idA - idB;
    }
    if (idA <= 0 && idB <= 0 && idA !== idB) {
        return idB - idA;
    }
    if ((idA <= 0) !== (idB <= 0)) {
        if (createdA !== createdB) return createdA - createdB;
        if (a.role === 'user' && b.role === 'assistant') return -1;
        if (a.role === 'assistant' && b.role === 'user') return 1;
        if (idA > 0) return -1;
        return 1;
    }
    if (idA !== idB) return idA - idB;
    if (createdA !== createdB) return createdA - createdB;
    if (a.role === 'user' && b.role === 'assistant') return -1;
    if (a.role === 'assistant' && b.role === 'user') return 1;
    return String(a.role ?? '').localeCompare(String(b.role ?? ''));
}

export function repairDoctorConversationOrder(
    messages: DoctorChatMessage[],
): DoctorChatMessage[] {
    return [...messages].sort(compareDoctorMessageOrder);
}

export function sortDoctorMessages(
    items: DoctorChatMessage[],
): DoctorChatMessage[] {
    return repairDoctorConversationOrder(items);
}

function doctorAssistantMessageMatches(
    message: DoctorChatMessage,
    placeholder: DoctorChatMessage,
) {
    if (message.role !== 'assistant' || placeholder.role !== 'assistant') {
        return false;
    }
    const content = String(placeholder.content ?? '').trim();
    const itemContent = String(message.content ?? '').trim();
    const error = String(placeholder.error ?? '').trim();
    const itemError = String(message.error ?? '').trim();
    const approvalRequestId = Number(placeholder.approvalRequestId ?? 0);
    const itemApprovalRequestId = Number(message.approvalRequestId ?? 0);
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
}

export function mergeDoctorStreamingState(
    server: DoctorChatMessage,
    local: DoctorChatMessage,
): DoctorChatMessage {
    const serverParts = server.parts ?? [];
    const localParts = local.parts ?? [];
    const parts =
        localParts.length > serverParts.length
            ? localParts
            : serverParts.length > 0
              ? serverParts
              : localParts;
    const serverToolCalls = server.toolCalls ?? [];
    const localToolCalls = local.toolCalls ?? [];
    const toolCalls =
        localToolCalls.length > serverToolCalls.length
            ? localToolCalls
            : serverToolCalls.length > 0
              ? serverToolCalls
              : localToolCalls;
    const activityById = new Map<string, ChatActivityEntry>();
    for (const entry of [
        ...(server.activityLog ?? []),
        ...(local.activityLog ?? []),
    ]) {
        activityById.set(entry.id, entry);
    }
    const serverContent = String(server.content ?? '').trim();
    const localContent = String(local.content ?? '').trim();
    return {
        ...server,
        parts,
        toolCalls,
        activityLog: [...activityById.values()],
        meta: server.meta ?? local.meta,
        content:
            serverContent.length >= localContent.length
                ? server.content
                : local.content,
        status:
            local.status === 'streaming' || local.status === 'attention'
                ? local.status
                : server.status ?? local.status,
        error: server.error ?? local.error,
        errorCode: server.errorCode ?? local.errorCode,
        approvalRequestId: server.approvalRequestId ?? local.approvalRequestId,
        approvalState: server.approvalState ?? local.approvalState,
        reasoningText: server.reasoningText ?? local.reasoningText,
        jobId: server.jobId ?? local.jobId,
        retryPayload: server.retryPayload ?? local.retryPayload,
    };
}

function preferDoctorMessage(
    existing: DoctorChatMessage,
    incoming: DoctorChatMessage,
): DoctorChatMessage {
    return mergeDoctorStreamingState(existing, incoming);
}

export function mergeDoctorMessages(
    ...groups: DoctorChatMessage[][]
): DoctorChatMessage[] {
    const byID = new Map<number, DoctorChatMessage>();
    const withoutID: DoctorChatMessage[] = [];
    for (const group of groups) {
        for (const message of group) {
            const id = message.id ?? 0;
            if (!id) {
                withoutID.push(message);
                continue;
            }
            const existing = byID.get(id);
            byID.set(
                id,
                existing ? preferDoctorMessage(existing, message) : message,
            );
        }
    }
    return sortDoctorMessages([...byID.values(), ...withoutID]);
}

export function mergeDoctorSessionWithLocal(
    serverMessages: DoctorChatMessage[],
    localMessages: DoctorChatMessage[],
    placeholder?: DoctorChatMessage | null,
): DoctorChatMessage[] {
    const server = sortDoctorMessages(serverMessages);
    const retainedLocal = localMessages
        .filter((message) => {
            const id = message.id ?? 0;
            if (id > 0) return false;
            if (message.role === 'user') {
                const text = String(message.content ?? '').trim();
                if (!text) return false;
                const serverHasSame = server.some(
                    (item) =>
                        item.role === 'user' &&
                        (item.id ?? 0) > 0 &&
                        String(item.content ?? '').trim() === text,
                );
                return !(serverHasSame && id < 0);
            }
            if (message.role !== 'assistant') return false;
            if (placeholder && id === placeholder.id) return false;
            return hasMeaningfulDoctorStreamingState(message);
        })
        .map((message) => {
            if (message.role !== 'user' || (message.id ?? 0) >= 0) {
                return message;
            }
            const latestAssistant = [...server]
                .reverse()
                .find((item) => item.role === 'assistant');
            const anchor = latestAssistant?.created_at ?? 0;
            if (anchor <= 0) return message;
            const lastUserCreated = server
                .filter((item) => item.role === 'user')
                .reduce(
                    (max, item) => Math.max(max, item.created_at ?? 0),
                    0,
                );
            const desired = anchor - 1;
            const createdAt = Math.max(lastUserCreated + 1, desired);
            if (
                (message.created_at ?? 0) >= anchor ||
                (message.created_at ?? 0) <= lastUserCreated
            ) {
                return { ...message, created_at: createdAt };
            }
            return message;
        });
    const merged = mergeDoctorMessages(server, retainedLocal);
    return finalizeDoctorMessagesAfterReload(merged, placeholder);
}

export function hasMeaningfulDoctorStreamingState(
    message: DoctorChatMessage | undefined | null,
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

function doctorMessagesContainEquivalentAssistant(
    items: DoctorChatMessage[],
    message: DoctorChatMessage,
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

export function finalizeDoctorMessagesAfterReload(
    serverMessages: DoctorChatMessage[],
    placeholder?: DoctorChatMessage | null,
): DoctorChatMessage[] {
    const sorted = sortDoctorMessages(serverMessages);
    if (!placeholder || !hasMeaningfulDoctorStreamingState(placeholder)) {
        return sorted;
    }
    if (doctorMessagesContainEquivalentAssistant(sorted, placeholder)) {
        return sorted.map((message) => {
            if (!doctorAssistantMessageMatches(message, placeholder)) {
                return message;
            }
            return mergeDoctorStreamingState(message, placeholder);
        });
    }
    const placeholderText = doctorVisibleTextForMessage(placeholder).trim();
    if (
        (placeholder.id ?? 0) < 0 &&
        (!placeholderText || placeholderText === 'Working…')
    ) {
        return sorted;
    }
    return mergeDoctorMessages(sorted, [placeholder]);
}

export function doctorSummaryInParts(
    summary: string,
    parts: ChatMessagePart[] = [],
) {
    const normalized = summary.trim();
    if (!normalized) return true;
    return parts.some(
        (part) =>
            part.type === 'text' &&
            String(part.content ?? '').trim() === normalized,
    );
}

function combineDoctorAssistantText(existing: string, incoming: string) {
    const current = existing.trim();
    const next = incoming.trim();
    if (!next) return current;
    if (!current) return next;
    if (current === next) return current;
    return `${current}\n\n${next}`;
}

function doctorTelemetrySummaryFromPart(part: ChatMessagePart) {
    if (part.type !== 'tool' || !isDoctorTelemetryToolName(part.name)) {
        return '';
    }
    const parsed = parseDoctorToolResult(part.resultPreview || '');
    const summary = parsed?.summary?.trim();
    if (summary) return summary;
    return '';
}

function isValidDoctorDisplayPart(part: ChatMessagePart) {
    if (part.type === 'text') {
        return Boolean(String(part.content ?? '').trim());
    }
    return Boolean(part.name || part.toolCallId);
}

function doctorToolPartFromMessage(
    message: DoctorChatMessage,
): ChatMessagePart | null {
    const results = parseDoctorToolResults(message.content, message.meta);
    const primary = results[0];
    if (!primary && message.role !== 'tool') return null;
    const name =
        primary?.kind ||
        String(
            (message.meta as Record<string, unknown> | undefined)
                ?.tool_name ?? 'doctor_tool',
        );
    const toolCallId = `persisted:${message.id ?? name}`;
    const resultPreview = previewValue(
        primary
            ? {
                  kind: primary.kind,
                  ok: primary.ok,
                  status: primary.status,
                  summary: primary.summary,
                  preview: primary.preview,
                  stats: primary.stats,
              }
            : message.content,
        4_000,
    );
    return {
        id: `tool:${toolCallId}`,
        type: 'tool',
        toolCallId,
        name,
        status: primary?.ok === false ? 'error' : 'complete',
        resultPreview,
        errorPreview:
            primary?.ok === false
                ? doctorToolResultText(primary) || undefined
                : undefined,
    };
}

function buildOrderedPartsFromTurnMessages(
    messages: DoctorChatMessage[],
    isStreamingTurn: boolean,
) {
    const parts: ChatMessagePart[] = [];
    const seenPartIds = new Set<string>();
    const filterInterimPreface =
        isStreamingTurn &&
        messages.filter((message) => message.role === 'assistant').length === 1;

    const pushPart = (part: ChatMessagePart) => {
        if (seenPartIds.has(part.id)) return;
        seenPartIds.add(part.id);
        parts.push(part);
    };

    for (const message of messages) {
        const persistedParts = (message.parts ?? []).filter(isValidDoctorDisplayPart);
        if (persistedParts.length) {
            for (const part of persistedParts) {
                pushPart(part);
            }
            continue;
        }
        if (message.role === 'tool') {
            const toolPart = doctorToolPartFromMessage(message);
            if (toolPart) pushPart(toolPart);
            continue;
        }
        if (message.role !== 'assistant') continue;
        const msgText = doctorVisibleTextForMessage(message).trim();
        if (!msgText) continue;
        if (
            filterInterimPreface &&
            isDoctorInterimStreamingText(msgText) &&
            !parts.some((part) => part.type === 'tool')
        ) {
            continue;
        }
        pushPart({
            id: `text:${message.id ?? parts.length}`,
            type: 'text',
            content: msgText,
        });
    }
    return parts;
}

function dedupeDoctorTextParts(
    parts: ChatMessagePart[],
    summaryText: string,
) {
    const summary = summaryText.trim();
    const telemetrySummaries = parts
        .map((part) => doctorTelemetrySummaryFromPart(part))
        .filter(Boolean);
    const seen = new Set<string>();
    return parts.filter((part) => {
        if (part.type !== 'text') return true;
        const content = String(part.content ?? '').trim();
        if (!content) return false;
        if (summary && (content === summary || summary.includes(content))) {
            return false;
        }
        if (
            telemetrySummaries.some(
                (toolSummary) =>
                    content === toolSummary || toolSummary.includes(content),
            )
        ) {
            return false;
        }
        if (seen.has(content)) return false;
        seen.add(content);
        return true;
    });
}

function collapseDoctorAssistantTurn(
    messages: DoctorChatMessage[],
    options: {
        isCardDismissed?: (card: DoctorChatCard) => boolean;
        userMessage?: string;
    },
): Omit<DoctorDisplayMessage, 'activityLog'> & {
    activityLog: ChatActivityEntry[];
} {
    const isCardDismissed = options.isCardDismissed ?? (() => false);
    let text = '';
    let parts: ChatMessagePart[] = [];
    let cards: DoctorChatCard[] = [];
    let activityLog: ChatActivityEntry[] = [];
    let status: ChatMessage['status'] = 'complete';
    let error: string | undefined;
    let errorCode: string | undefined;
    let approvalRequestId: number | string | undefined;
    let approvalState: string | undefined;
    let isEmptyFinalSummary = false;
    let rawId = 0;
    let id = 'doctor-turn';
    let isStreamingTurn = false;

    for (const message of messages) {
        if ((message.id ?? 0) > 0 && (rawId === 0 || (message.id ?? 0) < rawId)) {
            rawId = message.id ?? 0;
            id = String(message.id ?? id);
        }
        const msgCards = doctorCardsForMessage(message).filter(
            (card) => !isCardDismissed(card),
        );
        if (msgCards.length) cards = [...cards, ...msgCards];

        if (message.status === 'streaming' || message.status === 'attention') {
            isStreamingTurn = true;
            status = message.status;
        }

        if (message.activityLog?.length) {
            activityLog = [...activityLog, ...message.activityLog];
        }
        if (message.error) {
            error = message.error;
            errorCode = message.errorCode;
        }
        if (message.approvalRequestId) {
            approvalRequestId = message.approvalRequestId;
            approvalState = message.approvalState;
        }
    }

    parts = buildOrderedPartsFromTurnMessages(messages, isStreamingTurn);

    if (!parts.length) {
        for (const message of messages) {
            if (message.role === 'tool') continue;
            const msgText = doctorVisibleTextForMessage(message).trim();
            if (!msgText) continue;
            const hideInterimWhileStreaming =
                isStreamingTurn &&
                isDoctorInterimStreamingText(msgText) &&
                !parts.some((part) => part.type === 'tool');
            if (!hideInterimWhileStreaming) {
                text = combineDoctorAssistantText(text, msgText);
                if (isDoctorEmptyFinalTextWarning(msgText)) {
                    isEmptyFinalSummary = true;
                }
            }
        }
    } else if (!isStreamingTurn) {
        for (const message of messages) {
            if (message.role === 'tool') continue;
            const msgText = doctorVisibleTextForMessage(message).trim();
            if (!msgText) continue;
            text = combineDoctorAssistantText(text, msgText);
            if (isDoctorEmptyFinalTextWarning(msgText)) {
                isEmptyFinalSummary = true;
            }
        }
    }

    if (!text.trim()) {
        const synthesized = doctorSynthesizeFinalSummary(
            { parts, toolCalls: messages.flatMap((item) => item.toolCalls ?? []) },
            { userMessage: options.userMessage },
        );
        if (synthesized.trim()) text = synthesized.trim();
    }

    if (!isStreamingTurn) {
        text = stripDoctorInterimPreface(text);
    }

    if (parts.length > 0) {
        if (isStreamingTurn || doctorSummaryInParts(text, parts)) {
            text = '';
        }
    } else {
        parts = dedupeDoctorTextParts(parts, text);
        if (text && doctorSummaryInParts(text, parts)) {
            text = '';
        }
    }
    if (
        text &&
        parts.some((part) => {
            const toolSummary = doctorTelemetrySummaryFromPart(part);
            return toolSummary && text.trim() === toolSummary;
        })
    ) {
        text = '';
    }

    return {
        rawId,
        id,
        role: 'assistant',
        rawRole: 'assistant',
        text,
        isEmptyFinalSummary,
        status,
        error,
        errorCode,
        approvalRequestId,
        approvalState,
        parts,
        activityLog,
        cards,
    };
}

export function buildDoctorChatDisplayMessages(
    items: DoctorChatMessage[],
    options: {
        isCardDismissed?: (card: DoctorChatCard) => boolean;
        stripUserPrompt?: (content: string) => string;
    } = {},
): DoctorDisplayMessage[] {
    const stripUserPrompt =
        options.stripUserPrompt ?? scrubDoctorUserMessageContent;
    const sorted = sortDoctorMessages(items);
    const display: DoctorDisplayMessage[] = [];
    let assistantTurn: DoctorChatMessage[] = [];
    let lastUserText = '';
    let turnIndex = 0;

    const flushAssistantTurn = () => {
        if (!assistantTurn.length) return;
        const collapsed = collapseDoctorAssistantTurn(assistantTurn, {
            ...options,
            userMessage: lastUserText,
        });
        if (
            collapsed.text.length > 0 ||
            collapsed.parts.length > 0 ||
            collapsed.activityLog.length > 0 ||
            collapsed.cards.length > 0 ||
            collapsed.status === 'streaming' ||
            collapsed.status === 'attention' ||
            Boolean(collapsed.approvalRequestId) ||
            Boolean(collapsed.error)
        ) {
            display.push({
                ...collapsed,
                id: `doctor-assistant-${turnIndex}-${collapsed.rawId || display.length}`,
                activityLog: collapsed.activityLog,
            });
            turnIndex += 1;
        }
        assistantTurn = [];
    };

    for (const message of sorted) {
        if (message.role === 'user') {
            flushAssistantTurn();
            const text = stripUserPrompt(String(message.content ?? '')).trim();
            if (!text) continue;
            lastUserText = text;
            display.push({
                rawId: message.id ?? 0,
                id: `doctor-user-${message.id ?? display.length}`,
                role: 'user',
                rawRole: 'user',
                text,
                isEmptyFinalSummary: false,
                status: message.status ?? 'complete',
                error: message.error,
                errorCode: message.errorCode,
                approvalRequestId: message.approvalRequestId,
                approvalState: message.approvalState,
                parts: [],
                activityLog: [],
                cards: [],
            });
            continue;
        }
        assistantTurn.push(message);
    }
    flushAssistantTurn();
    return display;
}

export function resolveDoctorMessageRef(
    items: DoctorChatMessage[],
    ref: number | string,
) {
    const key = String(ref ?? '').trim();
    if (!key) return null;
    const id = Number(ref);
    if (Number.isFinite(id) && id !== 0) {
        return items.find((message) => message.id === id) ?? null;
    }
    return (
        items.find(
            (message) => String(message.approvalRequestId ?? '').trim() === key,
        ) ?? null
    );
}
