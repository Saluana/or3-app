import { afterEach, describe, expect, it, vi } from 'vitest';

import { useApprovals } from '../../app/composables/useApprovals';
import { useLocalCache } from '../../app/composables/useLocalCache';

describe('useApprovals', () => {
    afterEach(() => {
        vi.unstubAllGlobals();
        useApprovals().clearIssuedApprovalTokens();
        useLocalCache().clearAll();
    });

    it('blocks duplicate approval actions while one is in flight', async () => {
        useLocalCache().updateHost({
            id: 'test',
            name: 'Test Mac',
            baseUrl: 'http://127.0.0.1:9100/',
            token: 'secret',
        });

        let releaseApprove: (() => void) | undefined;
        const approveStarted = new Promise<void>((resolve) => {
            releaseApprove = resolve;
        });
        let approveRequests = 0;
        const fetchMock = vi.fn(async (url: string | URL | Request) => {
            const path = String(url);
            if (path.endsWith('/internal/v1/approvals/42/approve')) {
                approveRequests += 1;
                await approveStarted;
                return new Response(
                    JSON.stringify({ request_id: 42, token: 'tok' }),
                    {
                        status: 200,
                        headers: { 'Content-Type': 'application/json' },
                    },
                );
            }
            if (path.includes('/internal/v1/approvals/allowlists')) {
                return new Response(JSON.stringify({ items: [] }), {
                    status: 200,
                    headers: { 'Content-Type': 'application/json' },
                });
            }
            if (path.includes('/internal/v1/approvals')) {
                return new Response(JSON.stringify({ items: [] }), {
                    status: 200,
                    headers: { 'Content-Type': 'application/json' },
                });
            }
            throw new Error(`unexpected request: ${path}`);
        });
        vi.stubGlobal('fetch', fetchMock);

        const { approve } = useApprovals();
        const first = approve(42);
        await expect(approve(42)).rejects.toThrow('already in progress');
        releaseApprove?.();
        await expect(first).resolves.toMatchObject({ request_id: 42 });
        expect(approveRequests).toBe(1);
    });

    it('stores and consumes approval tokens for later chat retries', async () => {
        useLocalCache().updateHost({
            id: 'test',
            name: 'Test Mac',
            baseUrl: 'http://127.0.0.1:9100/',
            token: 'secret',
        });

        const fetchMock = vi.fn(async (url: string | URL | Request) => {
            const path = String(url);
            if (path.endsWith('/internal/v1/approvals/42/approve')) {
                return new Response(
                    JSON.stringify({ request_id: 42, token: 'tok-42' }),
                    {
                        status: 200,
                        headers: { 'Content-Type': 'application/json' },
                    },
                );
            }
            if (path.includes('/internal/v1/approvals/allowlists')) {
                return new Response(JSON.stringify({ items: [] }), {
                    status: 200,
                    headers: { 'Content-Type': 'application/json' },
                });
            }
            if (path.includes('/internal/v1/approvals')) {
                return new Response(JSON.stringify({ items: [] }), {
                    status: 200,
                    headers: { 'Content-Type': 'application/json' },
                });
            }
            throw new Error(`unexpected request: ${path}`);
        });
        vi.stubGlobal('fetch', fetchMock);

        const { approve, consumeIssuedApprovalToken } = useApprovals();
        await expect(approve(42)).resolves.toMatchObject({
            request_id: 42,
            token: 'tok-42',
        });
        expect(consumeIssuedApprovalToken(42)).toBe('tok-42');
        expect(consumeIssuedApprovalToken(42)).toBeUndefined();
    });

    it('preserves resume job ids while still storing approval tokens', async () => {
        useLocalCache().updateHost({
            id: 'test',
            name: 'Test Mac',
            baseUrl: 'http://127.0.0.1:9100/',
            token: 'secret',
        });

        const fetchMock = vi.fn(async (url: string | URL | Request) => {
            const path = String(url);
            if (path.endsWith('/internal/v1/approvals/42/approve')) {
                return new Response(
                    JSON.stringify({
                        request_id: 42,
                        token: 'tok-42',
                        resume_job_id: 'job-resume-42',
                    }),
                    {
                        status: 200,
                        headers: { 'Content-Type': 'application/json' },
                    },
                );
            }
            if (path.includes('/internal/v1/approvals/allowlists')) {
                return new Response(JSON.stringify({ items: [] }), {
                    status: 200,
                    headers: { 'Content-Type': 'application/json' },
                });
            }
            if (path.includes('/internal/v1/approvals')) {
                return new Response(JSON.stringify({ items: [] }), {
                    status: 200,
                    headers: { 'Content-Type': 'application/json' },
                });
            }
            throw new Error(`unexpected request: ${path}`);
        });
        vi.stubGlobal('fetch', fetchMock);

        const { approve, consumeIssuedApprovalToken } = useApprovals();
        await expect(approve(42)).resolves.toMatchObject({
            request_id: 42,
            token: 'tok-42',
            resume_job_id: 'job-resume-42',
        });
        expect(consumeIssuedApprovalToken(42)).toBe('tok-42');
    });

    it('reloads the active approval filter after approve succeeds', async () => {
        useLocalCache().updateHost({
            id: 'test',
            name: 'Test Mac',
            baseUrl: 'http://127.0.0.1:9100/',
            token: 'secret',
        });

        const approvalListPaths: string[] = [];
        const fetchMock = vi.fn(async (url: string | URL | Request) => {
            const path = String(url);
            if (path.endsWith('/internal/v1/approvals/42/approve')) {
                return new Response(
                    JSON.stringify({ request_id: 42, token: 'tok-42' }),
                    {
                        status: 200,
                        headers: { 'Content-Type': 'application/json' },
                    },
                );
            }
            if (path.includes('/internal/v1/approvals/allowlists')) {
                return new Response(JSON.stringify({ items: [] }), {
                    status: 200,
                    headers: { 'Content-Type': 'application/json' },
                });
            }
            if (
                path.includes('/internal/v1/approvals') &&
                !path.includes('/approve')
            ) {
                approvalListPaths.push(path);
                return new Response(JSON.stringify({ items: [] }), {
                    status: 200,
                    headers: { 'Content-Type': 'application/json' },
                });
            }
            throw new Error(`unexpected request: ${path}`);
        });
        vi.stubGlobal('fetch', fetchMock);

        const { loadApprovals, approve } = useApprovals();
        await loadApprovals('pending');
        approvalListPaths.length = 0;

        await expect(approve(42)).resolves.toMatchObject({
            request_id: 42,
            token: 'tok-42',
        });

        expect(approvalListPaths).toContain(
            'http://127.0.0.1:9100/internal/v1/approvals?status=pending',
        );
        expect(approvalListPaths).not.toContain(
            'http://127.0.0.1:9100/internal/v1/approvals',
        );
    });
});
