export const OR3_ELECTRON_CSP = [
    "default-src 'self'",
    "script-src 'self'",
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data:",
    "font-src 'self' data:",
    "connect-src 'self' http: https: ws: wss:",
    "worker-src 'self' blob:",
    "object-src 'none'",
    "base-uri 'none'",
    "frame-ancestors 'none'",
].join('; ');

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
