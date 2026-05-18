import { afterEach, describe, expect, it, vi } from 'vitest';

import { useLocalCache } from '../../app/composables/useLocalCache';
import { usePairing } from '../../app/composables/usePairing';
import {
    encodePairingInviteV2,
    parsePairingInvite,
    type PairingInviteV2,
} from '../../app/utils/or3/secure-connections';

const validSecret = 'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA';

function testInvite(overrides: Partial<PairingInviteV2> = {}): PairingInviteV2 {
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
            pairingSecret: validSecret,
            qrNonce: 'nonce-1',
        },
        capabilities: ['chat', 'files', 'terminal'],
        routes: [
            { kind: 'direct', baseUrl: 'http://192.168.1.78:9100', priority: 20 },
            { kind: 'app-proxy', baseUrl: 'http://192.168.1.78:3060/api/or3', priority: 10 },
        ],
        signature: 'sha256:test',
        ...overrides,
    };
}

function bytesToBase64Url(bytes: number[]) {
    return btoa(String.fromCharCode(...bytes))
        .replace(/\+/g, '-')
        .replace(/\//g, '_')
        .replace(/=+$/g, '');
}

function cborText(value: string) {
    const bytes = Array.from(new TextEncoder().encode(value));
    const header = bytes.length < 24 ? [0x60 + bytes.length] : [0x78, bytes.length];
    return [...header, ...bytes];
}

function cborUint(value: number) {
    if (value < 24) return [value];
    if (value <= 0xff) return [0x18, value];
    if (value <= 0xffff) return [0x19, value >> 8, value & 0xff];
    const big = BigInt(value);
    return [
        0x1b,
        Number((big >> 56n) & 0xffn),
        Number((big >> 48n) & 0xffn),
        Number((big >> 40n) & 0xffn),
        Number((big >> 32n) & 0xffn),
        Number((big >> 24n) & 0xffn),
        Number((big >> 16n) & 0xffn),
        Number((big >> 8n) & 0xffn),
        Number(big & 0xffn),
    ];
}

function cborArray(values: string[]) {
    return [0x80 + values.length, ...values.flatMap((value) => cborText(value))];
}

function cborMap(record: Record<string, string | number | string[]>) {
    const entries = Object.entries(record);
    return [
        0xa0 + entries.length,
        ...entries.flatMap(([key, value]) => [
            ...cborText(key),
            ...(Array.isArray(value)
                ? cborArray(value)
                : typeof value === 'number'
                  ? cborUint(value)
                  : cborText(value)),
        ]),
    ];
}

function legacyQrFixture() {
    return `or3pair:v1:${bytesToBase64Url(cborMap({
        version: 1,
        relayOrigin: 'https://relay.or3.chat',
        rendezvousId: 'rv-legacy',
        hostId: 'host-legacy',
        hostDisplayName: 'Legacy Mac',
        hostSigningPublicKey: 'signing-public-key',
        hostNoisePublicKey: 'noise-public-key',
        pairingSecret: validSecret,
        expiresAtUnixMs: Date.now() + 60_000,
        capabilities: ['chat'],
        qrNonce: 'nonce-legacy',
    }))}`;
}

describe('usePairing', () => {
    afterEach(() => {
        useLocalCache().clearAll();
        localStorage.clear();
        sessionStorage.clear();
        vi.unstubAllGlobals();
    });

    it('connects with a pairing request created by the CLI', async () => {
        const fetchMock = vi.fn(
            async (_url: string | URL | Request, init?: RequestInit) => {
                expect(String(_url)).toBe(
                    'http://127.0.0.1:9100/internal/v1/pairing/exchange',
                );
                expect(JSON.parse(String(init?.body))).toEqual({
                    request_id: 42,
                    code: '123456',
                });
                return new Response(
                    JSON.stringify({
                        device_id: 'phone-1',
                        role: 'operator',
                        token: 'paired-token',
                    }),
                    {
                        status: 200,
                        headers: { 'Content-Type': 'application/json' },
                    },
                );
            },
        );
        vi.stubGlobal('fetch', fetchMock);

        const host = await usePairing().exchangeExistingPairing({
            baseUrl: 'http://127.0.0.1:9100',
            displayName: 'Studio Mac',
            deviceName: 'Phone',
            requestId: '42',
            code: '123-456',
        });

        expect(host).toMatchObject({
            name: 'Studio Mac',
            baseUrl: 'http://127.0.0.1:9100',
            token: 'paired-token',
            pairedToken: 'paired-token',
            deviceId: 'phone-1',
            status: 'online',
        });
        expect(useLocalCache().state.value.hosts[0]).toMatchObject({
            token: 'paired-token',
            status: 'online',
        });
        expect(usePairing().pendingPairing.value).toBeNull();
        expect(localStorage.getItem('or3-app:v1:pending-pairing')).toBeNull();
    });

    it('does not show an app-created code when CLI pairing cannot reach the service', async () => {
        vi.stubGlobal(
            'fetch',
            vi.fn(async () => {
                throw new TypeError('Failed to fetch');
            }),
        );

        const pairing = usePairing();

        await expect(
            pairing.exchangeExistingPairing({
                baseUrl: 'http://127.0.0.1:9100',
                displayName: 'Studio Mac',
                deviceName: 'Phone',
                requestId: '31',
                code: '614-513',
            }),
        ).rejects.toThrow(/Localhost only works/);

        expect(pairing.pendingPairing.value).toBeNull();
        expect(pairing.pairingStatus.value).toBe('idle');
        expect(localStorage.getItem('or3-app:v1:pending-pairing')).toBeNull();
    });
});

describe('PairingInviteV2', () => {
    it('encodes and decodes v2 invite links', () => {
        const invite = testInvite();
        const encoded = encodePairingInviteV2(invite);
        const parsed = parsePairingInvite(`http://192.168.1.78:3060/pair#invite=${encoded}`);

        expect(parsed.version).toBe(2);
        if (parsed.version !== 2) throw new Error('expected v2 invite');
        expect(parsed.invite.host.displayName).toBe('Studio Mac');
        expect(parsed.invite.pairing.rendezvousId).toBe('rv-1');
        expect(parsed.routes[0]).toMatchObject({ kind: 'app-proxy' });
    });

    it('rejects expired v2 invites with friendly copy', () => {
        const invite = testInvite({ expiresAtUnixMs: Date.now() - 1 });

        expect(() => parsePairingInvite(encodePairingInviteV2(invite))).toThrow(
            /expired.*Refresh the QR/i,
        );
    });

    it('keeps v1 QR parsing backward compatible', () => {
        const parsed = parsePairingInvite(legacyQrFixture());

        expect(parsed.version).toBe(1);
        if (parsed.version !== 1) throw new Error('expected v1 QR');
        expect(parsed.qr.hostDisplayName).toBe('Legacy Mac');
        expect(parsed.qr.rendezvousId).toBe('rv-legacy');
    });
});
