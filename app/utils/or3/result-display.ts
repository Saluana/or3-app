type ParsedPayload = Record<string, unknown>;

export function extractReadableResultText(
    text: string | null | undefined,
    runnerId?: string,
): string | null {
    const trimmed = (text ?? '').trim();
    if (!trimmed) return null;

    let bestScore = 0;
    let bestCandidate = '';
    const consider = (payload: unknown) => {
        const { score, text: candidate } = extractCandidate(payload, runnerId);
        if (!candidate || score <= 0) return;
        if (score >= bestScore) {
            bestScore = score;
            bestCandidate = candidate;
        }
    };

    try {
        consider(JSON.parse(trimmed));
    } catch {
        for (const document of splitJsonDocuments(trimmed)) {
            try {
                consider(JSON.parse(document));
            } catch {
                continue;
            }
        }
    }

    return bestCandidate || null;
}

export function normalizeResultDisplayText(
    text: string | null | undefined,
    runnerId?: string,
): string {
    return extractReadableResultText(text, runnerId) ?? text ?? '';
}

export function looksLikeJsonDocument(
    text: string | null | undefined,
): boolean {
    const trimmed = (text ?? '').trim();
    if (!trimmed) return false;
    if (
        !trimmed.startsWith('{') &&
        !trimmed.startsWith('[') &&
        !trimmed.startsWith('"')
    ) {
        return false;
    }
    try {
        JSON.parse(trimmed);
        return true;
    } catch {
        return splitJsonDocuments(trimmed).length > 0;
    }
}

export function shouldRenderResultAsMarkdown(
    text: string | null | undefined,
): boolean {
    const trimmed = (text ?? '').trim();
    if (!trimmed) return false;
    return !looksLikeJsonDocument(trimmed);
}

function extractCandidate(
    payload: unknown,
    runnerId?: string,
): { score: number; text: string } {
    if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
        return { score: 0, text: '' };
    }
    const obj = payload as ParsedPayload;

    switch (runnerId) {
        case 'gemini':
            if (asText(obj.response)) {
                return { score: 100, text: asText(obj.response)! };
            }
            break;
        case 'claude':
            if (
                obj.type === 'result' &&
                obj.subtype === 'success' &&
                asText(obj.result)
            ) {
                return { score: 100, text: asText(obj.result)! };
            }
            if (obj.type === 'assistant') {
                const assistant = extractClaudeAssistantText(obj.message);
                if (assistant) return { score: 85, text: assistant };
            }
            break;
        case 'codex': {
            const item = asObject(obj.item);
            if (
                obj.type === 'item.completed' &&
                item?.type === 'agent_message' &&
                asText(item.text)
            ) {
                return { score: 100, text: asText(item.text)! };
            }
            break;
        }
        case 'opencode':
            if (obj.type === 'text') {
                const partText = extractPartText(obj.part);
                if (partText) {
                    return { score: 100, text: partText };
                }
            }
            if (
                (obj.type === 'assistant_message' ||
                    obj.type === 'assistant') &&
                asText(obj.message)
            ) {
                return { score: 100, text: asText(obj.message)! };
            }
            break;
    }

    if (obj.type === 'result' && asText(obj.response)) {
        return { score: 92, text: asText(obj.response)! };
    }
    if (obj.type === 'result' && asText(obj.result)) {
        return { score: 88, text: asText(obj.result)! };
    }
    if (
        (obj.type === 'assistant_message' || obj.type === 'assistant') &&
        asText(obj.message)
    ) {
        return { score: 90, text: asText(obj.message)! };
    }
    if (obj.type === 'text') {
        const partText = extractPartText(obj.part);
        if (partText) {
            return { score: 84, text: partText };
        }
    }
    if (obj.type === 'assistant' && asText(obj.content)) {
        return { score: 85, text: asText(obj.content)! };
    }
    if (
        obj.type === 'message' &&
        (obj.role === 'assistant' || obj.role === 'model')
    ) {
        if (asText(obj.message))
            return { score: 80, text: asText(obj.message)! };
        if (asText(obj.content))
            return { score: 78, text: asText(obj.content)! };
        if (asText(obj.text)) return { score: 75, text: asText(obj.text)! };
    }

    const item = asObject(obj.item);
    if (item?.type === 'agent_message' && asText(item.text)) {
        return { score: 90, text: asText(item.text)! };
    }
    if (asText(obj.response)) return { score: 70, text: asText(obj.response)! };
    if (obj.type !== 'tool_result' && asText(obj.result)) {
        return { score: 68, text: asText(obj.result)! };
    }
    return { score: 0, text: '' };
}

function extractClaudeAssistantText(value: unknown): string {
    const message = asObject(value);
    const content = message?.content;
    if (Array.isArray(content)) {
        return content
            .map((part) => {
                const block = asObject(part);
                return block?.type === 'text' ? asText(block.text) : null;
            })
            .filter((part): part is string => !!part)
            .join('\n\n');
    }
    return asText(content) ?? '';
}

function extractPartText(value: unknown): string {
    const part = asObject(value);
    if (!part) return '';
    if (part.type && part.type !== 'text') return '';
    return asText(part.text ?? part) ?? '';
}

function splitJsonDocuments(text: string): string[] {
    const documents: string[] = [];
    let index = 0;

    while (index < text.length) {
        while (index < text.length && /\s/.test(text[index]!)) index += 1;
        if (index >= text.length) break;

        const end = findJsonDocumentEnd(text, index);
        if (end <= index) return [];

        documents.push(text.slice(index, end));
        index = end;
    }

    return documents;
}

function findJsonDocumentEnd(text: string, start: number): number {
    const startChar = text[start];
    if (!startChar) return -1;

    if (startChar === '{' || startChar === '[') {
        let depth = 0;
        let inString = false;
        let escaped = false;

        for (let index = start; index < text.length; index += 1) {
            const char = text[index]!;
            if (inString) {
                if (escaped) {
                    escaped = false;
                } else if (char === '\\') {
                    escaped = true;
                } else if (char === '"') {
                    inString = false;
                }
                continue;
            }

            if (char === '"') {
                inString = true;
                continue;
            }

            if (char === '{' || char === '[') depth += 1;
            if (char === '}' || char === ']') {
                depth -= 1;
                if (depth === 0) return index + 1;
                if (depth < 0) return -1;
            }
        }

        return -1;
    }

    if (startChar === '"') {
        let escaped = false;
        for (let index = start + 1; index < text.length; index += 1) {
            const char = text[index]!;
            if (escaped) {
                escaped = false;
                continue;
            }
            if (char === '\\') {
                escaped = true;
                continue;
            }
            if (char === '"') return index + 1;
        }
        return -1;
    }

    if (text.startsWith('true', start)) return start + 4;
    if (text.startsWith('false', start)) return start + 5;
    if (text.startsWith('null', start)) return start + 4;

    if (/[\-0-9]/.test(startChar)) {
        let index = start + 1;
        while (index < text.length && /[0-9eE+\-.]/.test(text[index]!)) {
            index += 1;
        }
        return index;
    }

    return -1;
}

function asObject(value: unknown): ParsedPayload | null {
    if (!value || typeof value !== 'object' || Array.isArray(value))
        return null;
    return value as ParsedPayload;
}

function asText(value: unknown): string | null {
    if (typeof value === 'string') {
        const trimmed = value.trim();
        return trimmed ? trimmed : null;
    }
    if (Array.isArray(value)) {
        const joined = value
            .map((item) => asText(item))
            .filter((item): item is string => !!item)
            .join('\n\n')
            .trim();
        return joined || null;
    }
    if (value && typeof value === 'object') {
        const obj = value as ParsedPayload;
        for (const key of [
            'text',
            'message',
            'content',
            'response',
            'result',
        ]) {
            const candidate = asText(obj[key]);
            if (candidate) return candidate;
        }
    }
    return null;
}
