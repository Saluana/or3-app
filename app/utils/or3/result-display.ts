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
        for (const candidate of jsonRepairCandidates(trimmed)) {
            try {
                consider(JSON.parse(candidate));
            } catch {
                continue;
            }
        }
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

export function parseStructuredResultPayload(
    text: string | null | undefined,
): Record<string, unknown> | null {
    const trimmed = (text ?? '').trim();
    if (!trimmed) return null;
    for (const candidate of [trimmed, ...jsonRepairCandidates(trimmed)]) {
        try {
            const parsed = JSON.parse(candidate);
            return asObject(parsed);
        } catch {
            continue;
        }
    }
    return null;
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

function extractOpenCodeErrorMessage(obj: ParsedPayload): string | null {
    const err = asObject(obj.error);
    const data = asObject(err?.data);
    return (
        asText(data?.message) ||
        asText(err?.message) ||
        asText(obj.message) ||
        null
    );
}

function extractCandidate(
    payload: unknown,
    runnerId?: string,
    depth = 0,
): { score: number; text: string } {
    if (depth > 4) {
        return { score: 0, text: '' };
    }
    if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
        return { score: 0, text: '' };
    }
    const obj = payload as ParsedPayload;

    const wrappedFinalText = asText(obj.final_text);
    if (wrappedFinalText) {
        const nested = extractDisplayText(wrappedFinalText, runnerId, depth + 1);
        if (nested) {
            return { score: 97, text: nested };
        }
    }
    const wrappedError = asText(obj.error_message);
    if (wrappedError) {
        return { score: 98, text: wrappedError };
    }

    switch (runnerId) {
        case 'gemini':
            if (extractDisplayText(obj.response, runnerId, depth + 1)) {
                return {
                    score: 100,
                    text: extractDisplayText(obj.response, runnerId, depth + 1)!,
                };
            }
            break;
        case 'claude':
            if (
                obj.type === 'result' &&
                obj.subtype === 'success' &&
                extractDisplayText(obj.result, runnerId, depth + 1)
            ) {
                return {
                    score: 100,
                    text: extractDisplayText(obj.result, runnerId, depth + 1)!,
                };
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
            if (obj.type === 'error') {
                const message = extractOpenCodeErrorMessage(obj);
                if (message) {
                    return { score: 100, text: message };
                }
            }
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

    if (obj.type === 'error') {
        const message = extractOpenCodeErrorMessage(obj);
        if (message) {
            return { score: 96, text: message };
        }
    }

    if (obj.type === 'result' && extractDisplayText(obj.response, runnerId, depth + 1)) {
        return {
            score: 92,
            text: extractDisplayText(obj.response, runnerId, depth + 1)!,
        };
    }
    if (obj.type === 'result' && extractDisplayText(obj.result, runnerId, depth + 1)) {
        return {
            score: 88,
            text: extractDisplayText(obj.result, runnerId, depth + 1)!,
        };
    }
    if (
        (obj.type === 'assistant_message' || obj.type === 'assistant') &&
        extractDisplayText(obj.message, runnerId, depth + 1)
    ) {
        return {
            score: 90,
            text: extractDisplayText(obj.message, runnerId, depth + 1)!,
        };
    }
    if (obj.type === 'text') {
        const partText = extractPartText(obj.part);
        if (partText) {
            return { score: 84, text: partText };
        }
    }
    if (obj.type === 'assistant' && extractDisplayText(obj.content, runnerId, depth + 1)) {
        return {
            score: 85,
            text: extractDisplayText(obj.content, runnerId, depth + 1)!,
        };
    }
    if (
        obj.type === 'message' &&
        (obj.role === 'assistant' || obj.role === 'model')
    ) {
        if (extractDisplayText(obj.message, runnerId, depth + 1))
            return {
                score: 80,
                text: extractDisplayText(obj.message, runnerId, depth + 1)!,
            };
        if (extractDisplayText(obj.content, runnerId, depth + 1))
            return {
                score: 78,
                text: extractDisplayText(obj.content, runnerId, depth + 1)!,
            };
        if (extractDisplayText(obj.text, runnerId, depth + 1))
            return {
                score: 75,
                text: extractDisplayText(obj.text, runnerId, depth + 1)!,
            };
    }

    const item = asObject(obj.item);
    if (item?.type === 'agent_message' && extractDisplayText(item.text, runnerId, depth + 1)) {
        return {
            score: 90,
            text: extractDisplayText(item.text, runnerId, depth + 1)!,
        };
    }
    if (extractDisplayText(obj.response, runnerId, depth + 1)) {
        return {
            score: 70,
            text: extractDisplayText(obj.response, runnerId, depth + 1)!,
        };
    }
    if (obj.type !== 'tool_result' && extractDisplayText(obj.result, runnerId, depth + 1)) {
        return {
            score: 68,
            text: extractDisplayText(obj.result, runnerId, depth + 1)!,
        };
    }
    return { score: 0, text: '' };
}

function extractDisplayText(
    value: unknown,
    runnerId?: string,
    depth = 0,
): string | null {
    if (depth > 4) return null;

    if (typeof value === 'string') {
        const trimmed = value.trim();
        if (!trimmed) return null;

        const nested = extractDisplayTextFromSerialized(
            trimmed,
            runnerId,
            depth + 1,
        );
        return nested || trimmed;
    }

    if (Array.isArray(value)) {
        const joined = value
            .map((item) => extractDisplayText(item, runnerId, depth + 1))
            .filter((item): item is string => !!item)
            .join('\n\n')
            .trim();
        return joined || null;
    }

    if (value && typeof value === 'object') {
        const nested = extractCandidate(value, runnerId, depth + 1).text.trim();
        return nested || null;
    }

    return null;
}

function extractDisplayTextFromSerialized(
    text: string,
    runnerId?: string,
    depth = 0,
): string | null {
    if (depth > 4) return null;

    const candidates = [
        text,
        ...jsonRepairCandidates(text),
        ...splitJsonDocuments(text),
    ];

    for (const candidate of candidates) {
        try {
            const parsed = JSON.parse(candidate);
            const extracted = extractCandidate(parsed, runnerId, depth + 1).text.trim();
            if (extracted) return extracted;
        } catch {
            continue;
        }
    }

    return null;
}

function jsonRepairCandidates(text: string): string[] {
    const candidates: string[] = [];
    const trimmed = text.trim();
    if (
        trimmed.startsWith('"') &&
        trimmed.includes('":') &&
        !trimmed.startsWith('"{')
    ) {
        candidates.push(`{${trimmed}`);
    }
    return candidates;
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
