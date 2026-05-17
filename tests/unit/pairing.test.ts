import { afterEach, describe, expect, it, vi } from 'vitest';

import { useLocalCache } from '../../app/composables/useLocalCache';
import { usePairing } from '../../app/composables/usePairing';

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
