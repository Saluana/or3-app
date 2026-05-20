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

const OR3_ELECTRON_RUNTIME_SCRIPT_HASHES = [
    'tYCcUbFfjZ9QESuTWESGWrFg2SmiEdyD2MYUfRWUgK0=',
];

export function buildElectronCsp({ scriptHashes = [] } = {}) {
    const normalizedHashes = [...new Set([...scriptHashes, ...OR3_ELECTRON_RUNTIME_SCRIPT_HASHES])]
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
    platformCapabilities: 'or3:platform:get-capabilities',
    setupGetState: 'or3:setup:get-state',
    setupSaveState: 'or3:setup:save-state',
    filesystemPickWorkspace: 'or3:filesystem:pick-workspace-directory',
    filesystemPickData: 'or3:filesystem:pick-data-directory',
    filesystemPickInternBinary: 'or3:filesystem:pick-intern-binary',
    internLocate: 'or3:intern:locate',
    internInstall: 'or3:intern:install',
    internConfigure: 'or3:intern:configure',
    internStart: 'or3:intern:start',
    internStop: 'or3:intern:stop',
    internRestart: 'or3:intern:restart',
    internStatus: 'or3:intern:status',
    internIssueServiceToken: 'or3:intern:issue-service-token',
    internSetAutostart: 'or3:intern:set-autostart',
    internCreateSecureInvite: 'or3:intern:create-secure-invite',
    internCreateCliInvite: 'or3:intern:create-cli-invite',
    internListSecureDevices: 'or3:intern:list-secure-devices',
    internRevokeSecureDevice: 'or3:intern:revoke-secure-device',
    internListLegacyDevices: 'or3:intern:list-legacy-devices',
    internRevokeLegacyDevice: 'or3:intern:revoke-legacy-device',
});

export function isAllowedNavigation(url) {
    if (url.startsWith('app://or3/')) return true;
    const devServerUrl = String(process.env.OR3_ELECTRON_DEV_URL || '').trim();
    const allowDevNavigation =
        process.env.OR3_ELECTRON_ALLOW_DEV_NAVIGATION === 'true';
    if (allowDevNavigation && devServerUrl && url.startsWith(devServerUrl)) {
        return true;
    }
    return false;
}

export function validateIpcChannel(channel) {
    return Object.values(IPC_CHANNELS).includes(channel);
}
