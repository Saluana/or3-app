import type {
    JobEvent,
    RunnerChatEvent,
} from '~/types/or3-api';

export type NormalizedTurnEvent = {
    type: string;
    payload?: Record<string, unknown>;
    sequence?: number;
    jobId?: string;
};

export function eventPayload(event: JobEvent | { event?: string; json?: unknown }) {
    const json = 'json' in event ? event.json : undefined;
    const data = 'data' in event ? event.data : undefined;
    if (json && typeof json === 'object')
        return json as Record<string, unknown>;
    if (data && typeof data === 'object')
        return data as Record<string, unknown>;
    return undefined;
}

export function eventName(event: JobEvent | { event?: string; json?: unknown }) {
    const payload = eventPayload(event);
    return String(
        ('event' in event ? event.event : '') ||
            ('type' in event ? event.type : '') ||
            payload?.type ||
            '',
    );
}

export function eventSequence(
    event: JobEvent | { event?: string; json?: unknown },
) {
    if ('sequence' in event && typeof event.sequence === 'number')
        return event.sequence;
    const payload = eventPayload(event);
    return typeof payload?.sequence === 'number' ? payload.sequence : undefined;
}

export function eventJobId(event: JobEvent | { event?: string; json?: unknown }) {
    const payload = eventPayload(event);
    return typeof payload?.job_id === 'string' ? payload.job_id : undefined;
}

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

export function normalizeRunnerChatEvent(
    event: RunnerChatEvent | { event?: string; json?: unknown },
) {
    if ('json' in event) {
        return {
            ...event,
            json: normalizeRunnerChatEventPayload(event.json),
        };
    }
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
            text:
                typeof runnerEvent.text === 'string'
                    ? runnerEvent.text
                    : payload.text,
            chunk:
                typeof runnerEvent.text === 'string'
                    ? runnerEvent.text
                    : payload.chunk,
        },
    };
}

function normalizeRunnerChatEventPayload(value: unknown) {
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
        return value;
    }
    const outer = value as Record<string, unknown>;
    const canonical =
        outer.payload && typeof outer.payload === 'object' && !Array.isArray(outer.payload)
            ? (outer.payload as Record<string, unknown>)
            : undefined;
    if (!canonical) return outer;

    return {
        ...outer,
        ...canonical,
        type:
            typeof canonical.type === 'string' && canonical.type.trim()
                ? canonical.type
                : outer.type,
        sequence: outer.sequence ?? outer.seq,
        job_id: outer.job_id,
        text:
            typeof outer.text === 'string'
                ? outer.text
                : typeof canonical.text === 'string'
                  ? canonical.text
                  : undefined,
        chunk:
            typeof outer.text === 'string'
                ? outer.text
                : typeof canonical.chunk === 'string'
                  ? canonical.chunk
                  : undefined,
    };
}

export function responseJobId(response: Response) {
    const header = response.headers.get('X-Or3-Job-Id')?.trim();
    return header || null;
}
