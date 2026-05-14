import {
    useChatRuntimeLog,
    type ChatRuntimeLogLevel,
} from '~/composables/useChatRuntimeLog';
import { getActiveTraceId } from '~/utils/logTrace';

type LogMethod = (
    event: string,
    detail?: string,
    data?: Record<string, unknown>,
) => void;

export interface AppLogger {
    debug: LogMethod;
    info: LogMethod;
    warn: LogMethod;
    error: LogMethod;
}

const logLevelOrder: Record<ChatRuntimeLogLevel, number> = {
    debug: 10,
    info: 20,
    warn: 30,
    error: 40,
};

function storageLogLevel(): ChatRuntimeLogLevel {
    if (typeof window === 'undefined' || !window.localStorage) return 'info';
    try {
        const value = window.localStorage.getItem('or3.logLevel')?.trim();
        if (
            value === 'debug' ||
            value === 'info' ||
            value === 'warn' ||
            value === 'error'
        ) {
            return value;
        }
    } catch {
        // Local storage may be unavailable in private or embedded contexts.
    }
    return 'info';
}

function shouldLog(level: ChatRuntimeLogLevel) {
    return logLevelOrder[level] >= logLevelOrder[storageLogLevel()];
}

function consoleMethod(level: ChatRuntimeLogLevel) {
    if (level === 'debug') return console.debug;
    if (level === 'info') return console.info;
    if (level === 'warn') return console.warn;
    return console.error;
}

export function setDebugLoggingEnabled(enabled: boolean) {
    if (typeof window === 'undefined' || !window.localStorage) return;
    try {
        if (enabled) {
            window.localStorage.setItem('or3.logLevel', 'debug');
        } else {
            window.localStorage.setItem('or3.logLevel', 'info');
        }
    } catch {
        // Runtime logging should never make settings pages fail.
    }
}

export function isDebugLoggingEnabled() {
    return storageLogLevel() === 'debug';
}

export function createLogger(component: string): AppLogger {
    const write = (
        level: ChatRuntimeLogLevel,
        event: string,
        detail?: string,
        data?: Record<string, unknown>,
    ) => {
        if (!shouldLog(level)) return;
        const traceId =
            getActiveTraceId() ||
            (typeof data?.traceId === 'string' ? data.traceId.trim() : '') ||
            (typeof data?.trace_id === 'string' ? data.trace_id.trim() : '') ||
            undefined;
        const payload = traceId ? { ...data, traceId } : data;
        useChatRuntimeLog().add(
            component,
            event,
            detail,
            payload,
            level,
            traceId,
        );

        if (import.meta.dev) {
            consoleMethod(level).call(
                console,
                `[${component}] ${event}`,
                detail ?? '',
                payload ?? '',
            );
        }
    };

    return {
        debug(event, detail, data) {
            write('debug', event, detail, data);
        },
        info(event, detail, data) {
            write('info', event, detail, data);
        },
        warn(event, detail, data) {
            write('warn', event, detail, data);
        },
        error(event, detail, data) {
            write('error', event, detail, data);
        },
    };
}
