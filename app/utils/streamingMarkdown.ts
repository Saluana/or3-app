import type { ChatMessage, ChatMessagePart } from '../types/app-state';

export function shouldRepairIncompleteMarkdownForStatus(
    status: ChatMessage['status'] | null | undefined,
): boolean {
    return status === 'streaming';
}

export type AssistantRenderBlock =
    | { key: string; kind: 'markdown'; content: string }
    | { key: string; kind: 'tool'; part: ChatMessagePart };

function countTableColumns(row: string): number {
    return row
        .trim()
        .split('|')
        .filter((cell) => cell.trim().length > 0).length;
}

function isTableRow(line: string): boolean {
    const trimmed = line.trim();
    if (!trimmed.includes('|')) return false;
    if (!trimmed.startsWith('|')) return false;
    return countTableColumns(trimmed) >= 2;
}

function isTableSeparatorRow(line: string): boolean {
    const trimmed = line.trim();
    if (!trimmed.startsWith('|') || !trimmed.endsWith('|')) return false;
    const cells = trimmed
        .split('|')
        .filter((cell) => cell.trim().length > 0);
    if (!cells.length) return false;
    return cells.every((cell) => /^:?-{3,}:?$/.test(cell.trim()));
}

function buildTableSeparator(columnCount: number): string {
    const safeCount = Math.max(columnCount, 1);
    return `|${Array(safeCount).fill('---').join('|')}|`;
}

function splitConcatenatedTableRowsPass(text: string): string {
    if (!text.includes('|')) return text;

    let result = text;
    if (result.includes('||')) {
        result = result
            .replace(/\s\|\|\s+/g, '\n')
            .replace(/\|\|\s*(?=\|)/g, '\n|')
            .replace(/\|\|+/g, '\n');
    }

    const pipeCount = (result.match(/\|/g) || []).length;
    if (pipeCount >= 4) {
        result = result.replace(/\|\s+\|(?=\s*[^|\s])/g, '|\n|');
    }

    return result;
}

/**
 * Models often glue table rows on one line with `||` or ` | |` instead of newlines.
 */
export function splitConcatenatedTableRows(text: string): string {
    let result = text;
    for (let pass = 0; pass < 8; pass += 1) {
        const next = splitConcatenatedTableRowsPass(result);
        if (next === result) break;
        result = next;
    }
    return result;
}

/** Expand `|---|` when the header row has multiple columns. */
export function fixMarkdownTableSeparators(markdown: string): string {
    const lines = splitConcatenatedTableRows(markdown).split('\n');
    const out: string[] = [];

    for (let index = 0; index < lines.length; index += 1) {
        let line = lines[index] ?? '';
        const previous = out[out.length - 1];

        if (
            previous &&
            isTableRow(previous) &&
            !isTableSeparatorRow(previous) &&
            isTableSeparatorRow(line) &&
            countTableColumns(line) < countTableColumns(previous)
        ) {
            line = buildTableSeparator(countTableColumns(previous));
        }

        out.push(line);
    }

    return out.join('\n');
}

/** Normalize assistant markdown before handing it to streamdown-vue. */
export function normalizeMarkdownForDisplay(markdown: string): string {
    if (!markdown) return '';
    return fixMarkdownTableSeparators(markdown);
}

function isRenderablePart(part: ChatMessagePart): boolean {
    if (part.type === 'text') return Boolean(part.content?.trim());
    return Boolean(part.name || part.toolCallId);
}

/**
 * Merge consecutive text parts into one markdown block so tables split by tool
 * events during streaming still render as a single GFM table.
 */
export function buildAssistantRenderBlocks(
    message: Pick<ChatMessage, 'content' | 'parts' | 'status'>,
): AssistantRenderBlock[] {
    const parts = (message.parts ?? []).filter(isRenderablePart);
    if (!parts.length) {
        const content = String(message.content ?? '').trim();
        return content
            ? [{ key: 'content', kind: 'markdown', content: message.content ?? '' }]
            : [];
    }

    const hasToolParts = parts.some((part) => part.type === 'tool');
    // When there are no tool parts, message.content is canonical (see useAssistantMessageState).
    if (!hasToolParts && message.content?.trim()) {
        return [
            {
                key: 'content',
                kind: 'markdown',
                content: message.content ?? '',
            },
        ];
    }

    const blocks: AssistantRenderBlock[] = [];
    let textRun = '';
    let textIndex = 0;

    const flushText = () => {
        if (!textRun.trim()) {
            textRun = '';
            return;
        }
        blocks.push({
            key: `text-${textIndex}`,
            kind: 'markdown',
            content: textRun,
        });
        textIndex += 1;
        textRun = '';
    };

    for (const part of parts) {
        if (part.type === 'text') {
            textRun += part.content ?? '';
            continue;
        }
        flushText();
        blocks.push({ key: part.id, kind: 'tool', part });
    }
    flushText();

    if (
        !blocks.length &&
        message.content?.trim() &&
        message.status === 'complete'
    ) {
        return [
            {
                key: 'content-fallback',
                kind: 'markdown',
                content: message.content ?? '',
            },
        ];
    }

    return blocks;
}
