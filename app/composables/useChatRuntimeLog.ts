import { ref } from 'vue';
import { getActiveTraceId } from '~/utils/logTrace';

export type ChatRuntimeLogLevel = 'debug' | 'info' | 'warn' | 'error';

export interface ChatRuntimeLogEntry {
    id: string;
    createdAt: string;
    level: ChatRuntimeLogLevel;
    area: string;
    event: string;
    detail?: string;
    data?: Record<string, unknown>;
    traceId?: string;
}

const MAX_ENTRIES = 250;
const entries = ref<ChatRuntimeLogEntry[]>([]);

function createId() {
    return `chatlog_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

function redactValue(value: unknown): unknown {
    if (typeof value === 'string') {
        return value.length > 500 ? `${value.slice(0, 500)}\n...` : value;
    }
    if (!value || typeof value !== 'object') return value;
    if (Array.isArray(value)) return value.slice(0, 20).map(redactValue);
    const out: Record<string, unknown> = {};
    for (const [key, child] of Object.entries(value)) {
        const normalized = key.toLowerCase();
        if (
            normalized.includes('token') ||
            normalized.includes('secret') ||
            normalized.includes('password') ||
            normalized.includes('authorization')
        ) {
            out[key] = '[redacted]';
            continue;
        }
        out[key] = redactValue(child);
    }
    return out;
}

export function useChatRuntimeLog() {
    function add(
        area: string,
        event: string,
        detail?: string,
        data?: Record<string, unknown>,
        level: ChatRuntimeLogLevel = 'info',
        traceId?: string,
    ) {
        const normalizedTraceId =
            traceId?.trim() ||
            getActiveTraceId() ||
            (typeof data?.traceId === 'string' ? data.traceId.trim() : '') ||
            (typeof data?.trace_id === 'string' ? data.trace_id.trim() : '') ||
            undefined;
        entries.value = [
            {
                id: createId(),
                createdAt: new Date().toISOString(),
                level,
                area,
                event,
                detail,
                data: redactValue(data) as Record<string, unknown> | undefined,
                traceId: normalizedTraceId,
            },
            ...entries.value,
        ].slice(0, MAX_ENTRIES);
    }

    function clear() {
        entries.value = [];
    }

    return {
        entries,
        add,
        clear,
    };
}
