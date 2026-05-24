import type { ChatActivityEntry, ChatMessagePart } from '~/types/app-state';
import { now } from './activity';

function activityStatusForPart(
    status: ChatMessagePart['status'] | undefined,
): ChatActivityEntry['status'] {
    if (status === 'running') return 'running';
    if (status === 'error') return 'error';
    if (status === 'attention') return 'attention';
    return 'complete';
}

export function mergeActivityWithToolParts(
    activityLog: ChatActivityEntry[] | undefined,
    parts: ChatMessagePart[] | undefined,
): ChatActivityEntry[] {
    const merged = [...(activityLog ?? [])];
    const coveredToolCallIds = new Set<string>();

    for (const entry of merged) {
        const match = entry.id.match(/^activity:(.+):call$/);
        if (!match?.[1]) continue;
        coveredToolCallIds.add(match[1]);
        const normalized = match[1].replace(/^tool:/, '');
        if (normalized) coveredToolCallIds.add(normalized);
    }

    for (const part of parts ?? []) {
        if (part.type !== 'tool' || !part.name) continue;
        const toolCallId = part.toolCallId?.trim();
        const partKey = part.id.replace(/^tool:/, '');
        if (
            toolCallId &&
            (coveredToolCallIds.has(`tool:${toolCallId}`) ||
                coveredToolCallIds.has(toolCallId) ||
                coveredToolCallIds.has(partKey))
        ) {
            continue;
        }
        merged.push({
            id: `activity:part:${part.id}`,
            type: 'tool_call',
            label: `Tool call: ${part.name}`,
            status: activityStatusForPart(part.status),
            createdAt: now(),
        });
    }

    return merged;
}
