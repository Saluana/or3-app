import { beforeEach, describe, expect, it, vi } from 'vitest';

const requestSpy = vi.fn();

vi.mock('~/composables/useOr3Api', () => ({
    useOr3Api: () => ({ request: requestSpy }),
}));

vi.mock('~/utils/or3/secure-connections', async () => {
    const actual = await vi.importActual<
        typeof import('~/utils/or3/secure-connections')
    >('~/utils/or3/secure-connections');
    return {
        ...actual,
        loadSecureConnectionState: vi.fn(),
        buildSecureSessionStartPayload: vi.fn(),
    };
});

import { useSecureConnectionSession } from '../../app/composables/useSecureConnectionSession';
import {
    buildSecureSessionStartPayload,
    loadSecureConnectionState,
} from '~/utils/or3/secure-connections';

describe('useSecureConnectionSession', () => {
    beforeEach(() => {
        requestSpy.mockReset();
        vi.mocked(loadSecureConnectionState).mockResolvedValue({
            deviceIdentity: {
                version: 1,
                deviceId: 'device-1',
                displayName: 'Phone',
                platform: 'ios',
                trustLevel: 'native-software',
                secureStorageMode: 'native-secure',
                deviceSigningPublicKey: 'sign',
                deviceSigningPrivateKeyJwk: {} as JsonWebKey,
                deviceNoisePublicKey: 'noise',
                deviceNoisePrivateKeyJwk: {} as JsonWebKey,
                createdAtUnixMs: 1,
            },
            hosts: {
                'host-1': {
                    hostId: 'host-1',
                    hostSigningPublicKey: 'host-sign',
                    hostNoisePublicKey: 'host-noise',
                    enrollmentCertificate: { version: 1 },
                    enrollmentCertificateHash: 'cert-hash',
                    relayOrigin: 'https://relay.or3.chat',
                    serviceBaseUrl: 'https://relay.or3.chat',
                    role: 'operator',
                    capabilities: ['chat'],
                    trustLevel: 'native-software',
                    storedAtUnixMs: 1,
                },
            },
        });
        vi.mocked(buildSecureSessionStartPayload).mockResolvedValue({
            device_id: 'device-1',
            device_noise_public_key: 'noise',
            relay_route_id: 'route-1',
            relay_origin: 'https://relay.or3.chat',
            enrollment_certificate_hash: 'cert-hash',
            noise_handshake: {
                version: 1,
                prologueHash: 'prologue-hash',
                deviceId: 'device-1',
                deviceNoisePublicKey: 'noise',
                deviceEphemeralKey: 'ephemeral',
                enrollmentCertHash: 'cert-hash',
            },
            ttl_seconds: 1200,
        });
        requestSpy.mockResolvedValue({
            claims: {
                host_id: 'host-1',
                device_id: 'device-1',
                enrollment_epoch: 7,
                role: 'operator',
                capabilities: ['chat'],
                trust_level: 'native-software',
                session_id: 'session-from-server',
                relay_route_id: 'route-1',
                issued_at_unix_ms: Date.now(),
                expires_at_unix_ms: Date.now() + 60_000,
            },
        });
    });

    it('starts secure sessions from server-issued claims instead of local placeholders', async () => {
        const session = useSecureConnectionSession();

        const result = await session.start('host-1', 'route-1');

        expect(requestSpy).toHaveBeenCalledWith(
            '/internal/v1/secure-connections/sessions',
            expect.objectContaining({
                method: 'POST',
                baseUrl: 'https://relay.or3.chat',
                body: expect.objectContaining({
                    relay_route_id: 'route-1',
                    enrollment_certificate_hash: 'cert-hash',
                }),
            }),
        );
        expect(result.claims.session_id).toBe('session-from-server');
        expect(session.claims.value?.session_id).toBe('session-from-server');
        expect(session.connected.value).toBe(true);
    });
});
