import { computed, ref } from "vue";

export interface ChatRuntimeLogEntry {
    id: string;
    createdAt: string;
    area: string;
    event: string;
    detail?: string;
    data?: Record<string, unknown>;
}

const MAX_ENTRIES = 250;
const entries = ref<ChatRuntimeLogEntry[]>([]);

function createId() {
    return `chatlog_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

function redactValue(value: unknown): unknown {
    if (typeof value === "string") {
        return value.length > 500 ? `${value.slice(0, 500)}\n...` : value;
    }
    if (!value || typeof value !== "object") return value;
    if (Array.isArray(value)) return value.slice(0, 20).map(redactValue);
    const out: Record<string, unknown> = {};
    for (const [key, child] of Object.entries(value)) {
        const normalized = key.toLowerCase();
        if (
            normalized.includes("token") ||
            normalized.includes("secret") ||
            normalized.includes("password") ||
            normalized.includes("authorization")
        ) {
            out[key] = "[redacted]";
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
    ) {
        entries.value = [
            ...entries.value,
            {
                id: createId(),
                createdAt: new Date().toISOString(),
                area,
                event,
                detail,
                data: redactValue(data) as Record<string, unknown> | undefined,
            },
        ].slice(-MAX_ENTRIES);
    }

    function clear() {
        entries.value = [];
    }

    const exportText = computed(() => JSON.stringify(entries.value, null, 2));

    return {
        entries,
        latestEntries: computed(() => [...entries.value].reverse()),
        exportText,
        add,
        clear,
    };
}
