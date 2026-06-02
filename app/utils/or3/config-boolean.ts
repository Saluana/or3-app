/**
 * Coerce a config value to a boolean, handling legacy string values.
 *
 * JavaScript's `Boolean("false")` and `Boolean("off")` both return `true`,
 * which makes toggles lie about the current state. This helper treats the
 * following as falsy: `false`, `"false"`, `"off"`, `"0"`, `0`, `""`, `null`,
 * `undefined`. Everything else is truthy.
 */
export function coerceConfigBoolean(value: unknown): boolean {
    if (value === false || value === 0) return false
    if (value === true || value === 1) return true
    if (typeof value === 'string') {
        const lower = value.trim().toLowerCase()
        if (lower === 'false' || lower === 'off' || lower === '0' || lower === '') return false
    }
    if (value == null) return false
    return Boolean(value)
}
