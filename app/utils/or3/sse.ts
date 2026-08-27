import type { Or3SseEvent } from '~/types/or3-api';
import {
    parseInternSseBlock,
    readInternSseStream,
} from '@or3/intern-client';
import { serializeErrorForLog } from '~/utils/assistant-stream/errors';
import { createLogger } from '~/utils/logger';

const logger = createLogger('sse');

export function parseSseChunk(chunk: string): Or3SseEvent[] {
    return chunk
        .split(/(?:\r?\n){2,}/)
        .map((block) => block.trim())
        .filter(Boolean)
        .map(parseSseBlock);
}

export function parseSseBlock(block: string): Or3SseEvent {
    const event = parseInternSseBlock(block);
    if (event.data && event.json === undefined) {
        logger.warn('parse:invalid_json', 'SSE data was not valid JSON', {
            event: event.event,
            preview: event.data.slice(0, 300),
            ...serializeErrorForLog(
                new SyntaxError('Invalid SSE JSON payload'),
            ),
        });
    }
    return event as Or3SseEvent;
}

export async function* readSseStream(
    stream: ReadableStream<Uint8Array>,
): AsyncIterable<Or3SseEvent> {
    for await (const event of readInternSseStream(stream)) {
        yield event as Or3SseEvent;
    }
}
