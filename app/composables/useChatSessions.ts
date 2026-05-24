import { computed } from "vue";
import type {
    ChatActivityEntry,
    ChatMessage,
    ChatMessagePart,
    ChatSession,
    ChatToolCall,
} from "~/types/app-state";
import type { ChatHistoryMessage, ChatSessionMeta } from "~/types/or3-api";
import { isSyntheticApprovalContinuationUserMessage } from "~/utils/chat/approval-continuation";
import {
    compactAssistantRunMessages,
    mergeAssistantMessages,
    shouldMergeAssistantRunMessages,
} from "~/utils/chat/merge-assistant-run";
import { useActiveHost } from "./useActiveHost";
import { useLocalCache } from "./useLocalCache";

const resolvedApprovalKeys = new Set<string>();

function now() {
    return new Date().toISOString();
}

function createId(prefix: string) {
    return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

function msToIso(value?: number) {
    if (!value) return now();
    const ms = value > 10_000_000_000 ? value : value * 1000;
    return new Date(ms).toISOString();
}

function defaultRunnerFields() {
    return {
        runnerId: "or3-intern",
        runnerLabel: "OR3 Intern",
        runnerContinuationMode: "replay",
        archived: false,
    } satisfies Partial<ChatSession>;
}

function patchFromBackendSessionMeta(
    meta: ChatSessionMeta,
    session: ChatSession,
): Partial<ChatSession> {
    return {
        title: meta.title || session.title,
        runnerId: meta.runner_id || session.runnerId || "or3-intern",
        runnerLabel: meta.runner_label || session.runnerLabel,
        runnerChatSessionId:
            meta.runner_chat_session_id || session.runnerChatSessionId,
        runnerContinuationMode:
            meta.runner_continuation_mode ||
            session.runnerContinuationMode ||
            "replay",
        runnerModel: meta.runner_model || session.runnerModel,
        runnerMode: meta.runner_mode || session.runnerMode,
        runnerIsolation: meta.runner_isolation || session.runnerIsolation,
        runnerCwd: meta.runner_cwd || session.runnerCwd,
        backendMessageCount: meta.message_count,
        lastMessagePreview: meta.last_message_preview,
        lastMessageAt: meta.last_message_at
            ? msToIso(meta.last_message_at)
            : session.lastMessageAt,
        parentSessionKey: meta.parent_session_key || undefined,
        forkAnchorMessageId: meta.fork_anchor_message_id || undefined,
        forkedFromRunnerId: meta.forked_from_runner_id || undefined,
        forkStrategy: meta.fork_strategy || undefined,
        archived: Boolean(meta.archived),
        createdAt: meta.created_at
            ? msToIso(meta.created_at)
            : session.createdAt,
        updatedAt: meta.updated_at ? msToIso(meta.updated_at) : now(),
    };
}

function backendRole(backend: ChatHistoryMessage): ChatMessage["role"] {
    return backend.role === "user" ||
        backend.role === "assistant" ||
        backend.role === "system" ||
        backend.role === "tool"
        ? backend.role
        : "assistant";
}

function normalizeContent(value?: string) {
    return (value ?? "").trim();
}

function messagePreview(value?: string) {
    return normalizeContent(value).replace(/\s+/g, " ").slice(0, 160);
}

function uniqueBackendIds(...values: Array<number | undefined>) {
    return [...new Set(values.filter((value): value is number => typeof value === "number" && value > 0))];
}

function backendIdsForMessage(message: ChatMessage) {
    return uniqueBackendIds(message.backendMessageId, ...(message.backendMessageIds ?? []));
}

function appendBackendId(message: ChatMessage, backendID: number) {
    return uniqueBackendIds(...backendIdsForMessage(message), backendID);
}

function payloadText(payload: Record<string, unknown>, keys: string[]) {
    for (const key of keys) {
        const value = payload[key];
        if (typeof value === "string" && value.trim()) return value;
    }
    return "";
}

function previewValue(value: unknown, limit = 2_000) {
    if (value === undefined || value === null) return "";
    const text = typeof value === "string" ? value : JSON.stringify(value, null, 2) || String(value);
    return text.length > limit ? `${text.slice(0, limit)}\n...` : text;
}

function parseToolResult(content: string) {
    try {
        const parsed = JSON.parse(content) as unknown;
        return parsed && typeof parsed === "object" ? (parsed as Record<string, unknown>) : undefined;
    } catch {
        return undefined;
    }
}

function toolResultPreview(content: string, payload: Record<string, unknown>) {
    const result = parseToolResult(content);
    return (
        payloadText(payload, ["preview", "summary"]) ||
        (result ? payloadText(result, ["summary", "preview", "status"]) : "") ||
        messagePreview(content)
    );
}

function toolResultStatus(content: string): ChatToolCall["status"] {
    const result = parseToolResult(content);
    if (!result) return "complete";
    if (result.ok === false) return "error";
    if (String(result.status ?? "").toLowerCase() === "approval_required") return "attention";
    return "complete";
}

function normalizeToolCall(raw: unknown, index: number, createdAt: string): ChatToolCall | null {
    if (!raw || typeof raw !== "object") return null;
    const record = raw as Record<string, unknown>;
    const fn = record.function && typeof record.function === "object" ? (record.function as Record<string, unknown>) : undefined;
    const name = String(fn?.name ?? record.name ?? "tool").trim() || "tool";
    const id = String(record.id ?? record.tool_call_id ?? `tool_${index}`).trim() || `tool_${index}`;
    const args = typeof fn?.arguments === "string" ? fn.arguments : typeof record.arguments === "string" ? record.arguments : undefined;
    return {
        id,
        name,
        status: "running",
        arguments: args,
        startedAt: createdAt,
    };
}

function toolPart(call: ChatToolCall): ChatMessagePart {
    return {
        id: `tool:${call.id}`,
        type: "tool",
        toolCallId: call.id,
        name: call.name,
        status: call.status,
        argumentsPreview: previewValue(call.arguments),
        resultPreview: call.result,
        errorPreview: call.error,
    };
}

function activityForTool(call: ChatToolCall): ChatActivityEntry {
    return {
        id: `tool:${call.id}`,
        type: "tool_call",
        label: call.status === "running" ? `Running ${call.name}` : `Used ${call.name}`,
        detail: call.error || call.result || call.arguments,
        status: call.status === "error" || call.status === "attention" ? call.status : call.status === "complete" ? "complete" : "running",
        createdAt: call.completedAt || call.startedAt,
    };
}

function upsertById<T extends { id: string }>(items: T[] | undefined, item: T) {
    const next = [...(items ?? [])];
    const index = next.findIndex((existing) => existing.id === item.id);
    if (index >= 0) next[index] = { ...next[index], ...item };
    else next.push(item);
    return next;
}

function approvalResolutionKeys(
    approvalRequestId: number | string | undefined,
    sessionKey?: string,
) {
    const approvalKey = String(approvalRequestId ?? "").trim();
    if (!approvalKey) return [];
    const requestedSessionKey = sessionKey?.trim();
    return [
        `approval:${approvalKey}`,
        requestedSessionKey
            ? `approval:${requestedSessionKey}:${approvalKey}`
            : "",
    ].filter(Boolean);
}

export function useChatSessions() {
    const cache = useLocalCache();
    const { activeHost } = useActiveHost();

    const sessions = computed(() =>
        cache.state.value.sessions.filter(
            (session) => session.hostId === activeHost.value?.id,
        ),
    );

    function setActiveChatSessionId(sessionId: string) {
        const hostId = activeHost.value?.id?.trim();
        if (!hostId) return;
        if (!cache.state.value.activeChatSessionIdByHost) {
            cache.state.value.activeChatSessionIdByHost = {};
        }
        cache.state.value.activeChatSessionIdByHost[hostId] = sessionId;
        cache.persist();
    }

    const activeSession = computed(() => {
        const hostSessions = sessions.value;
        const hostId = activeHost.value?.id?.trim();
        if (!hostSessions.length) return null;
        if (!hostId) return hostSessions[0] ?? null;
        const activeId =
            cache.state.value.activeChatSessionIdByHost?.[hostId]?.trim();
        if (activeId) {
            const match = hostSessions.find((session) => session.id === activeId);
            if (match) return match;
        }
        return hostSessions[0] ?? null;
    });

    function pendingStreamingMessagesForHost(hostId = activeHost.value?.id) {
        const normalizedHostId = hostId?.trim();
        if (!normalizedHostId) return [];
        const sessionIds = new Set(
            cache.state.value.sessions
                .filter((session) => session.hostId === normalizedHostId)
                .map((session) => session.id),
        );
        return cache.state.value.messages.filter(
            (message) =>
                message.role === "assistant" &&
                message.status === "streaming" &&
                sessionIds.has(message.sessionId) &&
                (Boolean(message.jobId) || Boolean(message.runnerChatTurnId)),
        );
    }
    const messages = computed(() =>
        cache.state.value.messages.filter(
            (message) => message.sessionId === activeSession.value?.id,
        ),
    );
    const draftKey = computed(
        () =>
            `${activeHost.value?.id ?? "none"}:${activeSession.value?.id ?? "new"}`,
    );
    const draft = computed({
        get: () => cache.state.value.drafts[draftKey.value] ?? "",
        set: (value: string) => cache.setDraft(draftKey.value, value),
    });

    function sessionIndexById(sessionId: string) {
        return cache.state.value.sessions.findIndex(
            (item) => item.id === sessionId,
        );
    }

    function promoteSession(sessionId: string) {
        const index = sessionIndexById(sessionId);
        if (index < 0) return null;
        if (index === 0) {
            touchSession(sessionId);
            setActiveChatSessionId(sessionId);
            cache.persist();
            return cache.state.value.sessions.find((item) => item.id === sessionId) ?? null;
        }
        const [session] = cache.state.value.sessions.splice(index, 1);
        if (!session) return null;
        cache.state.value.sessions.unshift(session);
        touchSession(session.id);
        setActiveChatSessionId(session.id);
        cache.persist();
        return session;
    }

    function ensureSession() {
        if (activeSession.value) return activeSession.value;
        const hostId = activeHost.value?.id ?? "local";
        const timestamp = now();
        const id = createId("session");
        const session: ChatSession = {
            id,
            hostId,
            sessionKey: `or3-app:${hostId}:${id}`,
            title: "New conversation",
            createdAt: timestamp,
            updatedAt: timestamp,
            ...defaultRunnerFields(),
        };
        cache.state.value.sessions.unshift(session);
        setActiveChatSessionId(id);
        cache.persist();
        return session;
    }

    function findSessionByKey(sessionKey?: string) {
        const requestedKey = sessionKey?.trim();
        if (!requestedKey) return null;
        const hostId = activeHost.value?.id;
        return (
            cache.state.value.sessions.find((session) => {
                if (hostId && session.hostId !== hostId) return false;
                return session.sessionKey === requestedKey;
            }) ?? null
        );
    }

    function activateSessionByKey(sessionKey?: string, title?: string) {
        const requestedKey = sessionKey?.trim();
        if (!requestedKey) return activeSession.value ?? ensureSession();

        const existing = findSessionByKey(requestedKey);
        if (existing) {
            if (
                (!existing.title || existing.title === "New conversation") &&
                title?.trim()
            ) {
                existing.title = title.trim().slice(0, 48);
            }
            return promoteSession(existing.id);
        }

        const hostId = activeHost.value?.id ?? "local";
        const timestamp = now();
        const session: ChatSession = {
            id: createId("session"),
            hostId,
            sessionKey: requestedKey,
            title: title?.trim().slice(0, 48) || "New conversation",
            createdAt: timestamp,
            updatedAt: timestamp,
            ...defaultRunnerFields(),
        };
        cache.state.value.sessions.unshift(session);
        setActiveChatSessionId(session.id);
        cache.persist();
        return session;
    }

    function touchSession(sessionId: string, fallbackTitle?: string) {
        const session = cache.state.value.sessions.find(
            (item) => item.id === sessionId,
        );
        if (!session) return;
        session.updatedAt = now();
        if (
            (!session.title || session.title === "New conversation") &&
            fallbackTitle?.trim()
        ) {
            session.title = fallbackTitle.trim().slice(0, 48);
        }
    }

    function syncSessionMessageSummary(sessionId: string) {
        const session = cache.state.value.sessions.find(
            (item) => item.id === sessionId,
        );
        if (!session) return;
        const sessionMessages = cache.state.value.messages.filter(
            (message) => message.sessionId === sessionId,
        );
        session.backendMessageCount = sessionMessages.length;
        const latestVisible = [...sessionMessages]
            .reverse()
            .find((message) => messagePreview(message.content));
        if (latestVisible) {
            session.lastMessagePreview = messagePreview(latestVisible.content);
            session.lastMessageAt = latestVisible.createdAt;
        } else {
            session.lastMessagePreview = undefined;
            session.lastMessageAt = undefined;
        }
    }

    function addMessage(
        message: Omit<ChatMessage, "id" | "createdAt"> &
            Partial<Pick<ChatMessage, "id" | "createdAt">>,
    ) {
        const complete: ChatMessage = {
            id: message.id ?? createId("msg"),
            createdAt: message.createdAt ?? now(),
            ...message,
        };
        cache.state.value.messages.push(complete);
        touchSession(
            complete.sessionId,
            complete.role === "user" ? complete.content : undefined,
        );
        syncSessionMessageSummary(complete.sessionId);
        cache.persist();
        return complete;
    }

    function updateMessage(id: string, patch: Partial<ChatMessage>) {
        const message = cache.state.value.messages.find(
            (item) => item.id === id,
        );
        if (!message) return;
        Object.assign(message, patch);
        touchSession(message.sessionId);
        syncSessionMessageSummary(message.sessionId);
        cache.persist();
    }

    function toggleMessagePin(id: string) {
        const message = cache.state.value.messages.find(
            (item) => item.id === id,
        );
        if (!message) return false;
        message.pinned = !message.pinned;
        touchSession(message.sessionId);
        cache.persist();
        return message.pinned;
    }

    function findAssistantMessageForApproval(
        approvalRequestId: number | string | undefined,
        sessionKey?: string,
    ) {
        const approvalKey = String(approvalRequestId ?? "").trim();
        if (!approvalKey) return null;

        const hostId = activeHost.value?.id;
        const requestedSessionKey = sessionKey?.trim();
        const sessionIds = new Set(
            cache.state.value.sessions
                .filter((session) => {
                    if (hostId && session.hostId !== hostId) return false;
                    if (requestedSessionKey)
                        return session.sessionKey === requestedSessionKey;
                    return session.id === activeSession.value?.id;
                })
                .map((session) => session.id),
        );
        if (!sessionIds.size) return null;

        for (
            let index = cache.state.value.messages.length - 1;
            index >= 0;
            index--
        ) {
            const message = cache.state.value.messages[index];
            if (!message || message.role !== "assistant") continue;
            if (!sessionIds.has(message.sessionId)) continue;
            if (String(message.approvalRequestId ?? "").trim() !== approvalKey)
                continue;
            return message;
        }
        return null;
    }

    function isApprovalResolved(
        approvalRequestId: number | string | undefined,
        sessionKey?: string,
    ) {
        return approvalResolutionKeys(approvalRequestId, sessionKey).some(
            (key) => resolvedApprovalKeys.has(key),
        );
    }

    function findApprovalAttachTarget(sessionKey?: string) {
        const requestedSessionKey = sessionKey?.trim();
        const targetSession = requestedSessionKey
            ? findSessionByKey(requestedSessionKey)
            : activeSession.value;
        if (!targetSession) return null;

        for (
            let index = cache.state.value.messages.length - 1;
            index >= 0;
            index--
        ) {
            const message = cache.state.value.messages[index];
            if (!message || message.role !== "assistant") continue;
            if (message.sessionId !== targetSession.id) continue;
            if (message.approvalRequestId) continue;
            if (
                message.status === "streaming" ||
                message.status === "attention" ||
                message.errorCode === "approval_required"
            ) {
                return message;
            }
        }
        return null;
    }

    function markApprovalResolved(
        approvalRequestId: number | string | undefined,
        state: NonNullable<ChatMessage["approvalState"]>,
        sessionKey?: string,
        error?: string,
    ) {
        const keys = approvalResolutionKeys(approvalRequestId, sessionKey);
        for (const key of keys) resolvedApprovalKeys.add(key);

        const approvalKey = String(approvalRequestId ?? "").trim();
        if (!approvalKey) return;
        const resolvedSessionKey = sessionKey?.trim();
        const sessionById = new Map(
            cache.state.value.sessions.map((session) => [session.id, session]),
        );
        for (const message of cache.state.value.messages) {
            if (message.role !== "assistant") continue;
            if (String(message.approvalRequestId ?? "").trim() !== approvalKey)
                continue;
            if (
                resolvedSessionKey &&
                sessionById.get(message.sessionId)?.sessionKey !==
                    resolvedSessionKey
            ) {
                continue;
            }
            const preserveLiveStatus =
                message.status === "streaming" ||
                message.approvalState === "retrying";
            updateMessage(message.id, {
                approvalRequestId: undefined,
                approvalState: state === "approved" ? undefined : state,
                status:
                    state === "failed"
                        ? "failed"
                        : preserveLiveStatus
                          ? message.status
                          : "complete",
                error,
                errorCode: undefined,
            });
        }
    }

    function ensureApprovalMessage(options: {
        approvalRequestId: number | string;
        sessionKey?: string;
        content?: string;
        createdAt?: string;
        status?: ChatMessage["status"];
        approvalState?: ChatMessage["approvalState"];
        approvalType?: string;
        approvalPreview?: string;
    }) {
        const approvalKey = String(options.approvalRequestId ?? "").trim();
        if (!approvalKey) return null;
        if (isApprovalResolved(options.approvalRequestId, options.sessionKey)) {
            return null;
        }

        const existing = findAssistantMessageForApproval(
            options.approvalRequestId,
            options.sessionKey,
        );
        if (existing) {
            updateMessage(existing.id, {
                status: options.status ?? existing.status ?? "attention",
                approvalState:
                    options.approvalState ??
                    existing.approvalState ??
                    "pending",
                content:
                    existing.content || options.content || existing.content,
                approvalType:
                    options.approvalType ?? existing.approvalType,
                approvalPreview:
                    options.approvalPreview ?? existing.approvalPreview,
                error: undefined,
            });
            return (
                cache.state.value.messages.find(
                    (item) => item.id === existing.id,
                ) ?? existing
            );
        }

        const attachTarget = findApprovalAttachTarget(options.sessionKey);
        if (attachTarget) {
            updateMessage(attachTarget.id, {
                approvalRequestId: options.approvalRequestId,
                approvalState: options.approvalState ?? "pending",
                status: options.status ?? "attention",
                content:
                    attachTarget.content ||
                    options.content ||
                    attachTarget.content,
                approvalType:
                    options.approvalType ?? attachTarget.approvalType,
                approvalPreview:
                    options.approvalPreview ?? attachTarget.approvalPreview,
                error: undefined,
                errorCode: "approval_required",
            });
            return (
                cache.state.value.messages.find(
                    (item) => item.id === attachTarget.id,
                ) ?? attachTarget
            );
        }

        const session = options.sessionKey
            ? activateSessionByKey(options.sessionKey)
            : ensureSession();
        if (!session) return null;

        return addMessage({
            sessionId: session.id,
            role: "assistant",
            content:
                options.content ||
                "Approval is needed before or3-intern can continue.",
            status: options.status ?? "attention",
            approvalRequestId: options.approvalRequestId,
            approvalType: options.approvalType,
            approvalPreview: options.approvalPreview,
            approvalState: options.approvalState ?? "pending",
            createdAt: options.createdAt,
            reasoningText: "",
            toolCalls: [],
            parts: [],
            activityLog: [],
        });
    }

    function newSession(title = "New conversation") {
        const hostId = activeHost.value?.id ?? "local";
        const timestamp = now();
        const id = createId("session");
        const session: ChatSession = {
            id,
            hostId,
            sessionKey: `or3-app:${hostId}:${id}`,
            title,
            createdAt: timestamp,
            updatedAt: timestamp,
            ...defaultRunnerFields(),
        };
        cache.state.value.sessions.unshift(session);
        setActiveChatSessionId(id);
        cache.persist();
        return session;
    }

    function clearSessionMessages(sessionId = activeSession.value?.id) {
        if (!sessionId) return 0;
        const before = cache.state.value.messages.length;
        cache.state.value.messages = cache.state.value.messages.filter(
            (message) => message.sessionId !== sessionId,
        );
        const removed = before - cache.state.value.messages.length;
        const session = cache.state.value.sessions.find(
            (item) => item.id === sessionId,
        );
        if (session) {
            session.updatedAt = now();
            session.title = "New conversation";
            session.backendMessageCount = 0;
            session.lastMessagePreview = undefined;
            session.lastMessageAt = undefined;
        }
        cache.persist();
        return removed;
    }

    function appendSystemMessage(
        content: string,
        sessionId = activeSession.value?.id,
    ) {
        const targetSession = sessionId
            ? cache.state.value.sessions.find((item) => item.id === sessionId)
            : ensureSession();
        const resolvedSession = targetSession ?? ensureSession();
        return addMessage({
            sessionId: resolvedSession.id,
            role: "system",
            content,
            status: "complete",
        });
    }

    function messageCount(sessionId = activeSession.value?.id) {
        if (!sessionId) return 0;
        return cache.state.value.messages.filter(
            (message) => message.sessionId === sessionId,
        ).length;
    }

    function latestBackendMessageId(sessionId = activeSession.value?.id) {
        if (!sessionId) return 0;
        return cache.state.value.messages.reduce((latest, message) => {
            if (message.sessionId !== sessionId) return latest;
            return Math.max(latest, ...backendIdsForMessage(message));
        }, 0);
    }

    function setSessionRunnerMetadata(
        sessionId: string,
        patch: Partial<ChatSession>,
    ) {
        const session = cache.state.value.sessions.find(
            (item) => item.id === sessionId,
        );
        if (!session) return null;
        Object.assign(session, patch, { updatedAt: now() });
        cache.persist();
        return session;
    }

    function bindRunnerChatSession(
        sessionId: string,
        runnerChatSessionId: string,
    ) {
        return setSessionRunnerMetadata(sessionId, { runnerChatSessionId });
    }

    function syncBackendSessionMeta(meta: ChatSessionMeta) {
        const existing = findSessionByKey(meta.session_key);
        if (!existing) return null;
        return setSessionRunnerMetadata(
            existing.id,
            patchFromBackendSessionMeta(meta, existing),
        );
    }

    function applyBackendSessionMeta(meta: ChatSessionMeta) {
        const session = activateSessionByKey(meta.session_key, meta.title);
        if (!session) return null;
        return setSessionRunnerMetadata(
            session.id,
            patchFromBackendSessionMeta(meta, session),
        );
    }

    function compactSessionMessages(sessionId: string) {
        const sessionMessages = cache.state.value.messages.filter(
            (message) => message.sessionId === sessionId,
        );
        const otherMessages = cache.state.value.messages.filter(
            (message) => message.sessionId !== sessionId,
        );
        const compacted = compactAssistantRunMessages(sessionMessages);
        if (compacted.length === sessionMessages.length) return;
        cache.state.value.messages = [...otherMessages, ...compacted];
        cache.persist();
    }

    function hydrateBackendMessages(
        session: ChatSession,
        backendMessages: ChatHistoryMessage[],
    ) {
        let mergeNextAssistantIntoPrevious = false;
        const sessionMessages = () =>
            cache.state.value.messages.filter(
                (message) => message.sessionId === session.id,
            );
        const existingByBackendID = () =>
            new Map(
                sessionMessages()
                    .filter(
                        (message) =>
                            backendIdsForMessage(message).length > 0,
                    )
                    .flatMap((message) =>
                        backendIdsForMessage(message).map((id) => [id, message] as const),
                    ),
            );
        const claimedLocalMessageIds = new Set<string>();
        const attachToolResultToAssistant = (
            backend: ChatHistoryMessage,
            payload: Record<string, unknown>,
        ) => {
            const toolCallId = String(payload.tool_call_id ?? payload.call_id ?? "").trim();
            const toolName = String(payload.tool ?? payload.name ?? "tool").trim() || "tool";
            const messages = sessionMessages();
            const assistant = [...messages]
                .reverse()
                .find((message) => {
                    if (message.role !== "assistant") return false;
                    if (!toolCallId) return Boolean(message.toolCalls?.length || message.parts?.some((part) => part.type === "tool"));
                    return Boolean(
                        message.toolCalls?.some((call) => call.id === toolCallId) ||
                            message.parts?.some((part) => part.toolCallId === toolCallId),
                    );
                });
            if (!assistant) return false;

            const status = toolResultStatus(backend.content);
            const result = status === "complete" ? toolResultPreview(backend.content, payload) : undefined;
            const error = status !== "complete" ? toolResultPreview(backend.content, payload) : undefined;
            const existingCall = assistant.toolCalls?.find((call) => call.id === toolCallId);
            const call: ChatToolCall = {
                id: toolCallId || existingCall?.id || `tool_backend_${backend.id}`,
                name: existingCall?.name || toolName,
                status,
                arguments:
                    existingCall?.arguments ||
                    previewValue(payload.args ?? payload.arguments),
                result,
                error,
                startedAt: existingCall?.startedAt || msToIso(backend.created_at),
                completedAt: msToIso(backend.created_at),
            };
            updateMessage(assistant.id, {
                backendMessageIds: appendBackendId(assistant, backend.id),
                toolCalls: upsertById(assistant.toolCalls, call),
                parts: upsertById(assistant.parts, toolPart(call)),
                activityLog: upsertById(assistant.activityLog, activityForTool(call)).slice(-30),
            });
            cache.state.value.messages = cache.state.value.messages.filter(
                (message) =>
                    message.id === assistant.id ||
                    !backendIdsForMessage(message).includes(backend.id),
            );
            cache.persist();
            return true;
        };
        for (const backend of backendMessages) {
            const backendID = backend.id;
            const role = backendRole(backend);
            const payload =
                backend.payload && typeof backend.payload === "object"
                    ? (backend.payload as Record<string, unknown>)
                    : {};
            if (
                role === "user" &&
                isSyntheticApprovalContinuationUserMessage(
                    backend.content,
                    payload,
                )
            ) {
                mergeNextAssistantIntoPrevious = true;
                continue;
            }
            const runnerPermissionPayload =
                payload.runner_permission &&
                typeof payload.runner_permission === "object"
                    ? (payload.runner_permission as Record<string, unknown>)
                    : undefined;
            if (role === "tool" && attachToolResultToAssistant(backend, payload)) {
                continue;
            }
            const toolCalls = Array.isArray(payload.tool_calls)
                ? payload.tool_calls
                      .map((item, index) => normalizeToolCall(item, index, msToIso(backend.created_at)))
                      .filter((item): item is ChatToolCall => Boolean(item))
                : [];
            const toolParts = toolCalls.map(toolPart);
            const toolActivities = toolCalls.map((call) => activityForTool(call));
            const patch: Partial<ChatMessage> = {
                backendMessageId: backendID,
                backendMessageIds: uniqueBackendIds(backendID),
                sourceSessionKey: session.sessionKey,
                runnerId:
                    typeof payload.runner_id === "string"
                        ? payload.runner_id
                        : session.runnerId,
                runnerChatSessionId:
                    typeof payload.runner_chat_session_id === "string"
                        ? payload.runner_chat_session_id
                        : session.runnerChatSessionId,
                runnerChatTurnId:
                    typeof payload.runner_chat_turn_id === "string"
                        ? payload.runner_chat_turn_id
                        : undefined,
                approvalRequestId:
                    typeof payload.approval_request_id === "string" ||
                    typeof payload.approval_request_id === "number"
                        ? payload.approval_request_id
                        : typeof payload.approval_id === "string" ||
                            typeof payload.approval_id === "number"
                          ? payload.approval_id
                          : undefined,
                approvalState:
                    payload.approval_state === "pending"
                        ? "pending"
                        : undefined,
                retryPayload:
                    payload.status === "approval_required" &&
                    typeof payload.user_message === "string" &&
                    payload.user_message.trim()
                        ? {
                              text: payload.user_message,
                              transportText: payload.user_message,
                              suppressUserEcho: true,
                              runnerId:
                                  typeof payload.runner_id === "string"
                                      ? payload.runner_id
                                      : session.runnerId,
                              runnerChatSessionId:
                                  typeof payload.runner_chat_session_id ===
                                  "string"
                                      ? payload.runner_chat_session_id
                                      : session.runnerChatSessionId,
                              runnerContinuationMode:
                                  typeof payload.continuation_mode === "string"
                                      ? payload.continuation_mode
                                      : session.runnerContinuationMode,
                              runnerModel:
                                  typeof payload.model === "string"
                                      ? payload.model
                                      : session.runnerModel,
                              runnerMode:
                                  typeof payload.mode === "string"
                                      ? payload.mode
                                      : session.runnerMode,
                              runnerIsolation:
                                  typeof payload.isolation === "string"
                                      ? payload.isolation
                                      : session.runnerIsolation,
                              runnerCwd:
                                  typeof payload.cwd === "string"
                                      ? payload.cwd
                                      : session.runnerCwd,
                              runnerPermission: runnerPermissionPayload
                                  ? {
                                        runnerId:
                                            typeof runnerPermissionPayload.runner_id ===
                                            "string"
                                                ? runnerPermissionPayload.runner_id
                                                : undefined,
                                        kind:
                                            typeof runnerPermissionPayload.kind ===
                                            "string"
                                                ? runnerPermissionPayload.kind
                                                : undefined,
                                        access:
                                            typeof runnerPermissionPayload.access ===
                                            "string"
                                                ? runnerPermissionPayload.access
                                                : undefined,
                                        targetPath:
                                            typeof runnerPermissionPayload.target_path ===
                                            "string"
                                                ? runnerPermissionPayload.target_path
                                                : undefined,
                                    }
                                  : undefined,
                          }
                        : undefined,
                status:
                    payload.status === "approval_required"
                        ? "attention"
                        : "complete",
            };
            if (toolCalls.length) {
                patch.toolCalls = toolCalls;
                patch.parts = [
                    ...(backend.content.trim()
                        ? [
                              {
                                  id: `text:${backendID}`,
                                  type: "text" as const,
                                  content: backend.content,
                              },
                          ]
                        : []),
                    ...toolParts,
                ];
                patch.activityLog = toolActivities;
            }
            const existing = existingByBackendID().get(backendID);
            if (existing) {
                updateMessage(existing.id, patch);
                mergeNextAssistantIntoPrevious = false;
                continue;
            }
            if (role === "assistant" && mergeNextAssistantIntoPrevious) {
                const previousAssistant = [...sessionMessages()]
                    .reverse()
                    .find((message) => message.role === "assistant");
                if (previousAssistant) {
                    const merged = mergeAssistantMessages(previousAssistant, {
                        ...previousAssistant,
                        ...patch,
                        id: previousAssistant.id,
                        sessionId: session.id,
                        role: "assistant",
                        content:
                            previousAssistant.content || backend.content,
                        createdAt:
                            previousAssistant.createdAt ||
                            msToIso(backend.created_at),
                    });
                    updateMessage(previousAssistant.id, merged);
                    mergeNextAssistantIntoPrevious = false;
                    continue;
                }
            }
            const localMatch = sessionMessages().find(
                (message) =>
                    !message.backendMessageId &&
                    !claimedLocalMessageIds.has(message.id) &&
                    message.role === role &&
                    normalizeContent(message.content) ===
                        normalizeContent(backend.content),
            );
            if (localMatch) {
                claimedLocalMessageIds.add(localMatch.id);
                updateMessage(localMatch.id, {
                    ...patch,
                    backendMessageIds: appendBackendId(localMatch, backendID),
                    content: localMatch.content || backend.content,
                    createdAt:
                        localMatch.createdAt || msToIso(backend.created_at),
                });
                continue;
            }
            const nextMessage = {
                id: `backend_${backendID}`,
                sessionId: session.id,
                role,
                content: backend.content,
                status: "complete" as const,
                createdAt: msToIso(backend.created_at),
                ...patch,
            };
            const previousAssistant = [...sessionMessages()]
                .reverse()
                .find((message) => message.role === "assistant");
            if (
                role === "assistant" &&
                shouldMergeAssistantRunMessages(
                    previousAssistant,
                    nextMessage as ChatMessage,
                    mergeNextAssistantIntoPrevious,
                ) &&
                previousAssistant
            ) {
                updateMessage(
                    previousAssistant.id,
                    mergeAssistantMessages(previousAssistant, nextMessage as ChatMessage),
                );
            } else {
                addMessage(nextMessage);
            }
            mergeNextAssistantIntoPrevious = false;
        }
        touchSession(session.id);
        compactSessionMessages(session.id);
        cache.persist();
    }

    return {
        sessions,
        activeSession,
        messages,
        draft,
        setActiveChatSessionId,
        promoteSession,
        pendingStreamingMessagesForHost,
        ensureSession,
        findSessionByKey,
        activateSessionByKey,
        newSession,
        addMessage,
        updateMessage,
        toggleMessagePin,
        findAssistantMessageForApproval,
        isApprovalResolved,
        markApprovalResolved,
        ensureApprovalMessage,
        clearSessionMessages,
        appendSystemMessage,
        messageCount,
        latestBackendMessageId,
        setSessionRunnerMetadata,
        bindRunnerChatSession,
        syncBackendSessionMeta,
        applyBackendSessionMeta,
        hydrateBackendMessages,
        compactSessionMessages,
    };
}
