import { computed, ref } from 'vue';
import { createLogger } from '~/utils/logger';
import { useOr3Api } from './useOr3Api';

export type ServerLogLevel = 'debug' | 'info' | 'warn' | 'error';

export interface ServerLogEntry {
    id: string;
    timestamp: string;
    level: ServerLogLevel;
    component: string;
    message: string;
    traceId?: string;
    session?: string;
    fields?: Record<string, string>;
}

export interface ServerLogFilters {
    level?: ServerLogLevel;
    component?: string;
    traceId?: string;
    session?: string;
}

const MAX_SERVER_LOG_ENTRIES = 500;
const entries = ref<ServerLogEntry[]>([]);
const isStreaming = ref(false);
const error = ref<string | null>(null);
const activeFilters = ref<ServerLogFilters>({ level: 'info' });
let controller: AbortController | null = null;
let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
let reconnectAttempt = 0;
let manualDisconnect = false;

function normalizeLevel(value: unknown): ServerLogLevel {
    if (value === 'debug' || value === 'warn' || value === 'error')
        return value;
    return 'info';
}

function normalizeServerLogEntry(value: unknown): ServerLogEntry | null {
    if (!value || typeof value !== 'object') return null;
    const raw = value as Record<string, unknown>;
    const message = String(raw.message ?? '').trim();
    if (!message) return null;
    return {
        id: String(
            raw.id ??
                `serverlog_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`,
        ),
        timestamp: String(raw.timestamp ?? new Date().toISOString()),
        level: normalizeLevel(raw.level),
        component: String(raw.component ?? 'service').trim() || 'service',
        message,
        traceId: typeof raw.trace_id === 'string' ? raw.trace_id : undefined,
        session: typeof raw.session === 'string' ? raw.session : undefined,
        fields:
            raw.fields && typeof raw.fields === 'object'
                ? (raw.fields as Record<string, string>)
                : undefined,
    };
}

function buildQuery(filters: ServerLogFilters) {
    const params = new URLSearchParams();
    if (filters.level) params.set('level', filters.level);
    if (filters.component?.trim())
        params.set('component', filters.component.trim());
    if (filters.traceId?.trim()) params.set('trace_id', filters.traceId.trim());
    if (filters.session?.trim()) params.set('session', filters.session.trim());
    const query = params.toString();
    return query ? `?${query}` : '';
}

function pushEntry(entry: ServerLogEntry) {
    entries.value = [...entries.value, entry].slice(-MAX_SERVER_LOG_ENTRIES);
}

function clearReconnectTimer() {
    if (!reconnectTimer) return;
    clearTimeout(reconnectTimer);
    reconnectTimer = null;
}

export function useServerLogs() {
    const api = useOr3Api();
    const logger = createLogger('server_logs');

    async function runConnection(filters: ServerLogFilters) {
        clearReconnectTimer();
        const activeController = new AbortController();
        controller = activeController;
        isStreaming.value = true;
        error.value = null;
        logger.info('connect:start', 'Server log stream connecting', {
            ...filters,
        });
        try {
            const suffix = buildQuery(filters);
            for await (const event of api.stream(
                `/internal/v1/logs/stream${suffix}`,
                {
                    method: 'GET',
                    signal: activeController.signal,
                },
            )) {
                if (event.event && event.event !== 'log') continue;
                const entry = normalizeServerLogEntry(event.json);
                if (entry) pushEntry(entry);
            }
            reconnectAttempt = 0;
        } catch (streamError) {
            if (activeController.signal.aborted || manualDisconnect) return;
            const message =
                streamError instanceof Error
                    ? streamError.message
                    : String(streamError);
            error.value = message;
            logger.warn('connect:error', 'Server log stream disconnected', {
                error: message,
            });
            scheduleReconnect();
        } finally {
            if (controller === activeController) {
                controller = null;
                isStreaming.value = false;
            }
        }
    }

    function scheduleReconnect() {
        if (manualDisconnect || reconnectTimer) return;
        reconnectAttempt += 1;
        const delay = Math.min(
            30000,
            1000 * 2 ** Math.min(reconnectAttempt - 1, 5),
        );
        reconnectTimer = setTimeout(() => {
            reconnectTimer = null;
            if (!manualDisconnect) void runConnection(activeFilters.value);
        }, delay);
    }

    function connect(filters: ServerLogFilters = activeFilters.value) {
        manualDisconnect = false;
        activeFilters.value = { level: 'info', ...filters };
        clearReconnectTimer();
        controller?.abort();
        void runConnection(activeFilters.value);
    }

    function disconnect() {
        manualDisconnect = true;
        clearReconnectTimer();
        controller?.abort();
        controller = null;
        isStreaming.value = false;
    }

    function clear() {
        entries.value = [];
    }

    const latestEntries = computed(() => [...entries.value].reverse());
    const exportText = computed(() => JSON.stringify(entries.value, null, 2));

    return {
        entries,
        latestEntries,
        isStreaming,
        error,
        activeFilters,
        exportText,
        connect,
        disconnect,
        clear,
    };
}
