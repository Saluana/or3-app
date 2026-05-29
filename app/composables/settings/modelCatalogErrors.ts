export function modelCatalogFriendlyError(err: unknown): string {
    const message =
        (err instanceof Error && err.message) ||
        (typeof err === 'object' &&
            err !== null &&
            'message' in err &&
            String((err as { message?: unknown }).message)) ||
        (typeof err === 'object' &&
            err !== null &&
            'error' in err &&
            String((err as { error?: unknown }).error)) ||
        'Could not load models for this provider.';
    const text = String(message);
    if (/missing api base|provider missing api/i.test(text)) {
        return 'This provider has no API base URL configured yet.';
    }
    if (/401|unauthor/i.test(text)) {
        return 'Provider rejected the saved API key. Check it in Providers.';
    }
    if (/not configured/i.test(text)) {
        return 'Set this provider up first (API key + base URL).';
    }
    return text;
}
