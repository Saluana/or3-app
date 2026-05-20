import { describe, expect, it } from 'vitest';
import {
    applyWebEnrollmentRestrictions,
    base64URLToBytes,
    buildEnrollmentProposal,
    buildEnrollmentProposalSigningBytes,
    buildSecureSessionPrologue,
    buildSecureSessionPrologueHash,
    buildSecureSessionStartPayload,
    buildSecureFrame,
    bytesToBase64URL,
    encodePairingInviteV2,
    parsePairingInvite,
    rejectSensitiveDeepLink,
    secureConnectionCapabilityDiscovery,
    signEnrollmentProposal,
    shouldRekeySecureSession,
    type DeviceIdentityRecord,
    type HostEnrollmentRecord,
    type PairingInviteV2,
} from '~/utils/or3/secure-connections';

function makeInvite(overrides: Partial<PairingInviteV2> = {}): PairingInviteV2 {
    return {
        version: 2,
        kind: 'or3.pair.invite',
        inviteId: 'invite-1',
        issuedAtUnixMs: Date.now(),
        expiresAtUnixMs: Date.now() + 60_000,
        host: {
            id: 'host-1',
            displayName: 'Studio Mac',
            signingPublicKey: 'signing-public-key',
            noisePublicKey: 'noise-public-key',
        },
        pairing: {
            rendezvousId: 'rv-1',
            pairingSecret: 'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA',
            qrNonce: 'nonce-1',
        },
        capabilities: ['chat'],
        routes: [{ kind: 'direct', baseUrl: 'http://192.168.1.78:9100', priority: 10 }],
        ...overrides,
    };
}

async function makeDeviceIdentity(): Promise<DeviceIdentityRecord> {
    const signing = (await crypto.subtle.generateKey(
        { name: 'Ed25519' },
        true,
        ['sign', 'verify'],
    )) as CryptoKeyPair;
    const noise = (await crypto.subtle.generateKey(
        { name: 'X25519' } as AlgorithmIdentifier,
        true,
        ['deriveBits'],
    )) as CryptoKeyPair;
    const signingPublic = new Uint8Array(
        await crypto.subtle.exportKey('raw', signing.publicKey),
    );
    const noisePublic = new Uint8Array(
        await crypto.subtle.exportKey('raw', noise.publicKey),
    );
    return {
        version: 1,
        deviceId: 'device-test',
        displayName: 'Phone',
        platform: 'ios',
        trustLevel: 'native-software',
        secureStorageMode: 'native-secure',
        deviceSigningPublicKey: bytesToBase64URL(signingPublic),
        deviceSigningPrivateKeyJwk: await crypto.subtle.exportKey(
            'jwk',
            signing.privateKey,
        ),
        deviceNoisePublicKey: bytesToBase64URL(noisePublic),
        deviceNoisePrivateKeyJwk: await crypto.subtle.exportKey(
            'jwk',
            noise.privateKey,
        ),
        createdAtUnixMs: 1_000,
    };
}

async function makeHostEnrollment(): Promise<HostEnrollmentRecord> {
    const hostNoise = (await crypto.subtle.generateKey(
        { name: 'X25519' } as AlgorithmIdentifier,
        true,
        ['deriveBits'],
    )) as CryptoKeyPair;
    const hostNoisePublic = new Uint8Array(
        await crypto.subtle.exportKey('raw', hostNoise.publicKey),
    );
    return {
        hostId: 'host-test',
        hostSigningPublicKey: 'host-signing',
        hostNoisePublicKey: bytesToBase64URL(hostNoisePublic),
        enrollmentCertificate: { version: 1 },
        enrollmentCertificateHash: 'cert-hash',
        relayOrigin: 'https://relay.or3.chat',
        serviceBaseUrl: 'https://relay.or3.chat',
        accountId: 'acct-1',
        role: 'operator',
        capabilities: ['chat'],
        trustLevel: 'native-software',
        storedAtUnixMs: 1_000,
    };
}

describe('secure connection helpers', () => {
    it('caps browser enrollment trust and capabilities', () => {
        const restricted = applyWebEnrollmentRestrictions(
            'web',
            ['chat', 'terminal', 'secrets'],
            Date.now() + 7 * 24 * 60 * 60 * 1000,
            1_000,
        );
        expect(restricted.trustLevel).toBe('web-limited');
        expect(restricted.capabilities).toEqual(['chat']);
        expect(restricted.expiresAtUnixMs).toBe(86_401_000);
    });

    it('rejects sensitive deep-link query material', () => {
        expect(rejectSensitiveDeepLink('or3://pair?token=abc')).toBe(true);
        expect(rejectSensitiveDeepLink('or3://pair?session_id=abc')).toBe(true);
        expect(rejectSensitiveDeepLink('or3://pair#access_token=abc')).toBe(true);
        expect(rejectSensitiveDeepLink('or3://pair?pagination_token=abc')).toBe(false);
        expect(rejectSensitiveDeepLink('or3://pair?code=123456')).toBe(false);
    });

    it('rekeys on resume, age, count, bytes, and near expiry', () => {
        const claims = {
            issued_at_unix_ms: 1_000,
            expires_at_unix_ms: 2_000_000,
        };
        expect(shouldRekeySecureSession(claims, { appResumed: true })).toBe(
            true,
        );
        expect(shouldRekeySecureSession(claims, { nowUnixMs: 700_000 })).toBe(
            true,
        );
        expect(shouldRekeySecureSession(claims, { messageCount: 8192 })).toBe(
            true,
        );
        expect(
            shouldRekeySecureSession(claims, { byteCount: 32 * 1024 * 1024 }),
        ).toBe(true);
        expect(
            shouldRekeySecureSession(
                { issued_at_unix_ms: 1_000, expires_at_unix_ms: 31_000 },
                { nowUnixMs: 2_000 },
            ),
        ).toBe(true);
    });

    it('builds secure frame metadata', () => {
        expect(
            buildSecureFrame({
                kind: 'control',
                sessionId: 'session',
                sequence: 1,
                correlationId: 'corr',
                body: new Uint8Array([1, 2, 3]),
                sentAtUnixMs: 1_000,
            }),
        ).toMatchObject({ version: 1, sessionId: 'session', sequence: 1 });
        expect(() =>
            buildSecureFrame({
                kind: 'control',
                sessionId: 'session',
                sequence: Number.MAX_SAFE_INTEGER + 1,
                correlationId: 'corr',
                body: new Uint8Array([1]),
                sentAtUnixMs: 1_000,
            }),
        ).toThrow(/metadata is incomplete/i);
    });

    it('reports v2 feature discovery without remote legacy pairing', () => {
        const discovery = secureConnectionCapabilityDiscovery();
        expect(discovery.qrPairingV2).toBe(true);
        expect(discovery.legacyPairingRemote).toBe(false);
    });

    it('signs enrollment proposals over canonical bytes', async () => {
        const identity = await makeDeviceIdentity();
        const proposal = buildEnrollmentProposal(identity, 'operator', [
            'chat',
        ]);
        const signed = await signEnrollmentProposal(identity, proposal);
        const publicKey = await crypto.subtle.importKey(
            'raw',
            base64URLToBytes(signed.deviceSigningPublicKey),
            { name: 'Ed25519' },
            false,
            ['verify'],
        );
        const signature = base64URLToBytes(signed.signature || '');
        await expect(
            crypto.subtle.verify(
                { name: 'Ed25519' },
                publicKey,
                signature,
                buildEnrollmentProposalSigningBytes(signed),
            ),
        ).resolves.toBe(true);
        await expect(
            crypto.subtle.verify(
                { name: 'Ed25519' },
                publicKey,
                signature,
                buildEnrollmentProposalSigningBytes({
                    ...signed,
                    requestedRole: 'admin',
                }),
            ),
        ).resolves.toBe(false);
    });

    it('downgrades exportable native storage to web-limited enrollment claims', async () => {
        const identity = await makeDeviceIdentity();
        identity.trustLevel = 'web-limited';

        const proposal = buildEnrollmentProposal(identity, 'operator', [
            'chat',
            'files',
            'terminal',
        ]);

        expect(proposal.requestedCapabilities).toEqual(['chat', 'files']);
        expect(proposal.secureStorageEvidence.trustLevel).toBe('web-limited');
    });

    it('builds secure session payloads from the stored enrollment metadata', async () => {
        const identity = await makeDeviceIdentity();
        const host = await makeHostEnrollment();
        const prologue = buildSecureSessionPrologue(identity, host, 'route-1');
        const payload = await buildSecureSessionStartPayload(
            identity,
            host,
            'route-1',
        );

        expect(payload).toMatchObject({
            device_id: identity.deviceId,
            relay_route_id: 'route-1',
            relay_origin: host.relayOrigin,
            enrollment_certificate_hash: host.enrollmentCertificateHash,
            account_id: host.accountId,
        });
        expect(payload.noise_handshake.deviceId).toBe(identity.deviceId);
        expect(payload.noise_handshake.enrollmentCertHash).toBe(
            host.enrollmentCertificateHash,
        );
        expect(payload.noise_handshake.prologueHash).toBe(
            buildSecureSessionPrologueHash(prologue),
        );
        const capped = await buildSecureSessionStartPayload(
            identity,
            host,
            'route-1',
            99_999,
        );
        expect(capped.ttl_seconds).toBe(3600);
    });

    it('rejects future-dated v2 invites', () => {
        const invite = makeInvite({ issuedAtUnixMs: Date.now() + 10 * 60_000 });
        expect(() => parsePairingInvite(encodePairingInviteV2(invite))).toThrow(
            /not valid yet/i,
        );
    });
});
