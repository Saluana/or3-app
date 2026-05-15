export function mapToEnvText(values?: Record<string, string>) {
    return Object.entries(values ?? {})
        .map(([key, value]) => `${key}=${value}`)
        .join('\n');
}

export function mapToHeaderText(values?: Record<string, string>) {
    return Object.entries(values ?? {})
        .map(([key, value]) => `${key}: ${value}`)
        .join('\n');
}

export function envTextToMap(value: string) {
    const out: Record<string, string> = {};
    for (const raw of value.split(/\n/)) {
        const line = raw.trim();
        if (!line) continue;
        const idx = line.indexOf('=');
        if (idx > 0) {
            out[line.slice(0, idx).trim()] = line.slice(idx + 1).trim();
        }
    }
    return Object.keys(out).length ? out : undefined;
}

export function headerTextToMap(value: string) {
    const out: Record<string, string> = {};
    for (const raw of value.split(/\n/)) {
        const line = raw.trim();
        if (!line) continue;
        const idx = line.indexOf(':');
        if (idx > 0) {
            out[line.slice(0, idx).trim()] = line.slice(idx + 1).trim();
        }
    }
    return Object.keys(out).length ? out : undefined;
}

export function splitCommandArgs(value: string) {
    const args: string[] = [];
    let current = '';
    let quote: '"' | "'" | null = null;
    let escaping = false;

    for (const char of value) {
        if (escaping) {
            current += char;
            escaping = false;
            continue;
        }
        if (char === '\\') {
            escaping = true;
            continue;
        }
        if (quote) {
            if (char === quote) {
                quote = null;
            } else {
                current += char;
            }
            continue;
        }
        if (char === '"' || char === "'") {
            quote = char;
            continue;
        }
        if (/\s/.test(char)) {
            if (current) {
                args.push(current);
                current = '';
            }
            continue;
        }
        current += char;
    }

    if (escaping) current += '\\';
    if (current) args.push(current);
    return args;
}
