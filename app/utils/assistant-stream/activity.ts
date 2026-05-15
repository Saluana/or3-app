import type { ChatActivityEntry, ChatToolCall } from "~/types/app-state";

export function now() {
    return new Date().toISOString();
}

export function createToolCall(
    name: string,
    args?: string,
    id?: string,
): ChatToolCall {
    return {
        id:
            id ||
            `tool_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`,
        name,
        status: "running",
        arguments: args,
        startedAt: now(),
    };
}

export function previewValue(value: unknown, limit = 4_000) {
    if (value === undefined || value === null) return "";
    const text =
        typeof value === "string"
            ? value
            : JSON.stringify(value, null, 2) || String(value);
    const redacted = redactSensitiveLogText(text);
    return redacted.length > limit
        ? `${redacted.slice(0, limit)}\n...`
        : redacted;
}

export function createActivity(
    type: string,
    label: string,
    detail?: string,
    status: ChatActivityEntry["status"] = "running",
    id?: string,
): ChatActivityEntry {
    return {
        id:
            id ||
            `activity_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`,
        type,
        label,
        detail,
        status,
        createdAt: now(),
    };
}

export function canonicalActivityStatus(
    status: unknown,
): ChatActivityEntry["status"] {
    const normalized = String(status ?? "").toLowerCase();
    if (
        normalized === "completed" ||
        normalized === "complete" ||
        normalized === "succeeded" ||
        normalized === "success"
    ) {
        return "complete";
    }
    if (normalized === "failed" || normalized === "error") return "error";
    if (
        normalized === "declined" ||
        normalized === "denied" ||
        normalized === "attention" ||
        normalized === "requested"
    ) {
        return "attention";
    }
    return "running";
}

export function canonicalActivityLabel(itemType: unknown, fallback?: unknown) {
    const label = String(fallback ?? "").trim();
    if (label) return label;
    switch (String(itemType ?? "unknown")) {
        case "command_execution":
            return "Command run";
        case "file_change":
            return "File change";
        case "mcp_tool_call":
            return "MCP tool call";
        case "web_search":
            return "Web search";
        case "collab_agent_tool_call":
            return "Subagent task";
        case "dynamic_tool_call":
            return "Tool call";
        case "plan":
            return "Plan updated";
        case "reasoning":
            return "Reasoning";
        case "assistant_message":
            return "Assistant message";
        default:
            return "Runner activity";
    }
}

export function canonicalToolDisplayName(
    itemType: unknown,
    payload?: Record<string, unknown>,
) {
    const data =
        payload?.data && typeof payload.data === "object"
            ? (payload.data as Record<string, unknown>)
            : undefined;
    for (const candidate of [
        data?.tool,
        data?.name,
        data?.command,
        data?.path,
    ]) {
        if (typeof candidate === "string" && candidate.trim()) {
            return candidate.trim();
        }
    }
    const state =
        data?.state && typeof data.state === "object"
            ? (data.state as Record<string, unknown>)
            : undefined;
    for (const candidate of [state?.title, state?.tool, state?.name]) {
        if (typeof candidate === "string" && candidate.trim()) {
            return candidate.trim();
        }
    }
    const directTitle = String(payload?.title ?? "").trim();
    if (
        directTitle &&
        directTitle.toLowerCase() !== "runner activity" &&
        directTitle.toLowerCase() !== "tool call" &&
        directTitle.toLowerCase() !== "tool"
    ) {
        return directTitle;
    }
    return canonicalActivityLabel(itemType, payload?.title);
}

export function truncateLogDetail(value: string, limit = 500) {
    const redacted = redactSensitiveLogText(value);
    return redacted.length > limit
        ? `${redacted.slice(0, limit)}\n...`
        : redacted;
}

export function redactSensitiveLogText(value: string) {
    return value
        .replace(/ya29\.[A-Za-z0-9._~+/=-]+/gi, "[redacted]")
        .replace(/\bBearer\s+[A-Za-z0-9._~+/=-]+/gi, "Bearer [redacted]")
        .replace(
            /(["']?(?:access_token|refresh_token|id_token|approval_token|token)["']?\s*[:=]\s*["']?)([^"'\s,}]+)/gi,
            "$1[redacted]",
        );
}

export function canonicalActivityDetail(payload?: Record<string, unknown>) {
    if (!payload) return undefined;
    for (const key of ["detail", "delta", "text", "message", "summary"]) {
        const value = payload[key];
        if (typeof value === "string" && value.trim()) {
            return truncateLogDetail(value);
        }
    }
    const data = payload.data;
    if (data && typeof data === "object") {
        const record = data as Record<string, unknown>;
        const state =
            record.state && typeof record.state === "object"
                ? (record.state as Record<string, unknown>)
                : undefined;
        const command = record.command;
        if (typeof command === "string" && command.trim()) {
            return truncateLogDetail(command);
        }
        for (const value of [state?.output, state?.error, state?.input]) {
            if (typeof value === "string" && value.trim()) {
                return truncateLogDetail(value);
            }
            if (value && typeof value === "object") {
                return truncateLogDetail(JSON.stringify(value));
            }
        }
    }
    return undefined;
}

export function canonicalActivityKey(
    itemType: string,
    label: string,
    payload?: Record<string, unknown>,
) {
    const data =
        payload?.data && typeof payload.data === "object"
            ? (payload.data as Record<string, unknown>)
            : undefined;
    const rawId =
        data?.callID ??
        data?.id ??
        data?.messageID ??
        payload?.id ??
        `${itemType}:${label}`;
    return `activity:${itemType}:${String(rawId)}`;
}

export function sanitizeAssistantText(text: string) {
    if (!text) return "";

    return text
        .replace(/<tool_call>[\s\S]*?<\/tool_call>/gi, "")
        .replace(/<tool_call[\s\S]*$/i, "")
        .replace(/<\/tool_call>/gi, "")
        .replace(/<function=[^>]*>/gi, "")
        .replace(/<parameter=[^>]*>/gi, "")
        .replace(/<function=[\s\S]*$/i, "")
        .replace(/<parameter=[\s\S]*$/i, "")
        .replace(
            /<\s*[|｜]\s*DSML\s*[|｜]\s*tool_calls\s*>[\s\S]*?<\s*\/\s*[|｜]\s*DSML\s*[|｜]\s*tool_calls\s*>/gi,
            "",
        )
        .replace(/<\s*[|｜]\s*DSML\s*[|｜]\s*tool_calls[\s\S]*$/i, "")
        .replace(
            /<\s*\/?\s*[|｜]\s*DSML\s*[|｜]\s*(?:invoke|parameter)[^>]*>/gi,
            "",
        )
        .trim();
}

export function isStructuredStdoutDiagnostic(
    payload?: Record<string, unknown>,
) {
    if (payload?.stream !== "stdout") return false;
    const chunk = String(payload.chunk ?? "").trim();
    if (!chunk.startsWith("{")) return false;
    try {
        const parsed = JSON.parse(chunk);
        return Boolean(
            parsed && typeof parsed === "object" && "type" in parsed,
        );
    } catch {
        return false;
    }
}
