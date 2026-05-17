import { createHash } from 'node:crypto';

const OR3_ELECTRON_CSP_BASE_DIRECTIVES = [
    "default-src 'self'",
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data:",
    "font-src 'self' data:",
    "connect-src 'self' http: https: ws: wss:",
    "worker-src 'self' blob:",
    "object-src 'none'",
    "base-uri 'none'",
    "frame-ancestors 'none'",
];

export function buildElectronCsp({ scriptHashes = [] } = {}) {
    const normalizedHashes = [...new Set(scriptHashes)]
        .map((hash) => String(hash || '').trim())
        .filter(Boolean)
        .map((hash) => `'sha256-${hash}'`);

    return [
        ["script-src 'self'", ...normalizedHashes].join(' '),
        ...OR3_ELECTRON_CSP_BASE_DIRECTIVES,
    ].join('; ');
}

export function extractInlineScriptHashes(html) {
    const source = String(html || '');
    const hashes = [];
    const scriptTagPattern = /<script\b([^>]*)>([\s\S]*?)<\/script>/gi;

    for (const match of source.matchAll(scriptTagPattern)) {
        const attributes = match[1] || '';
        const content = match[2] || '';
        if (/\bsrc\s*=/.test(attributes)) continue;

        const typeMatch = attributes.match(/\btype\s*=\s*["']([^"']+)["']/i);
        const scriptType = typeMatch?.[1]?.trim().toLowerCase() || '';
        if (
            scriptType &&
            scriptType !== 'text/javascript' &&
            scriptType !== 'application/javascript' &&
            scriptType !== 'module'
        ) {
            continue;
        }

        if (!content.trim()) continue;
        hashes.push(
            createHash('sha256').update(content, 'utf8').digest('base64'),
        );
    }

    return hashes;
}

export const OR3_ELECTRON_CSP = buildElectronCsp();

export const IPC_CHANNELS = Object.freeze({
    hostIdentity: 'secure-connections:host-identity',
    createPairingIntent: 'secure-connections:create-pairing-intent',
    approveEnrollment: 'secure-connections:approve-enrollment',
    listDevices: 'secure-connections:list-devices',
    revokeDevice: 'secure-connections:revoke-device',
    sessionStatus: 'secure-connections:session-status',
});

export function isAllowedNavigation(url) {
    return (
        url.startsWith('app://or3/') || url.startsWith('http://127.0.0.1:3060/')
    );
}

export function validateIpcChannel(channel) {
    return Object.values(IPC_CHANNELS).includes(channel);
}
