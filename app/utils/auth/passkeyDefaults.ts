/**
 * Generate a friendly default passkey label from the current device/browser context.
 */
export function defaultPasskeyNickname(): string {
    if (typeof navigator === 'undefined') return 'This device';

    const ua = navigator.userAgent;

    if (/iPhone/i.test(ua)) return 'This iPhone';
    if (/iPad/i.test(ua)) return 'This iPad';
    if (/Android/i.test(ua)) {
        if (/Mobile/i.test(ua)) return 'This Android phone';
        return 'This Android tablet';
    }

    // Check Edge before Chrome — Edge UAs include both tokens.
    if (/Edg\//i.test(ua)) return edgeLabel(ua);
    if (/Firefox\//i.test(ua)) return firefoxLabel(ua);
    if (/Chrome\//i.test(ua)) return chromeLabel(ua);
    if (/Safari\//i.test(ua) && !/Chrome/i.test(ua)) return safariLabel(ua);

    return 'This device';
}

function chromeLabel(ua: string): string {
    if (/Mac OS X/i.test(ua)) return 'Chrome on Mac';
    if (/Windows/i.test(ua)) return 'Chrome on Windows';
    if (/Linux/i.test(ua)) return 'Chrome on Linux';
    return 'Chrome';
}

function edgeLabel(ua: string): string {
    if (/Mac OS X/i.test(ua)) return 'Edge on Mac';
    if (/Windows/i.test(ua)) return 'Edge on Windows';
    if (/Linux/i.test(ua)) return 'Edge on Linux';
    return 'Edge';
}

function firefoxLabel(ua: string): string {
    if (/Mac OS X/i.test(ua)) return 'Firefox on Mac';
    if (/Windows/i.test(ua)) return 'Firefox on Windows';
    if (/Linux/i.test(ua)) return 'Firefox on Linux';
    return 'Firefox';
}

function safariLabel(ua: string): string {
    if (/Mac OS X/i.test(ua)) return 'Safari on Mac';
    if (/iPhone|iPad/i.test(ua)) return 'Safari';
    return 'Safari';
}
