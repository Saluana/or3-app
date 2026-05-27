export function now() {
    return new Date().toISOString();
}

export function createId(prefix: string) {
    return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

export function msToIso(value?: number) {
    if (!value) return now();
    const ms = value > 10_000_000_000 ? value : value * 1000;
    return new Date(ms).toISOString();
}
