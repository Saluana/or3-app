import { computed, ref, watch } from 'vue';
import type {
    ApprovalActionResponse,
    ApprovalAllowlist,
    ApprovalRequest,
} from '~/types/or3-api';
import {
    normalizeApprovalAllowlist,
    normalizeApprovalRequest,
} from '~/utils/or3/approvals';
import { createLogger } from '~/utils/logger';
import { useActiveHost } from './useActiveHost';
import { needsUnlock } from './usePinLock';
import { canUseHostApi } from './useSecureHostTokens';
import type { AuthChallengeError } from '~/types/auth';
import { useAuthSession } from './useAuthSession';
import { useOr3Api } from './useOr3Api';

const approvals = ref<ApprovalRequest[]>([]);
const allowlists = ref<ApprovalAllowlist[]>([]);
const selectedApproval = ref<ApprovalRequest | null>(null);
const approvalsLoading = ref(false);
const approvalsError = ref<string | null>(null);
const allowlistsError = ref<string | null>(null);
const pendingCount = ref(0);
const activeApprovalStatus = ref('');
let approvalsPollTimer: ReturnType<typeof setInterval> | null = null;
let pendingCountInFlight: Promise<void> | null = null;
const approvalActionsInFlight = new Set<string>();
const issuedApprovalTokens = ref<Record<string, string>>({});
let approvalsHostKey = '';
let hostWatcherStarted = false;

function stopApprovalsPolling() {
    if (!approvalsPollTimer) return;
    clearInterval(approvalsPollTimer);
    approvalsPollTimer = null;
}

function resetApprovalsState() {
    approvals.value = [];
    allowlists.value = [];
    selectedApproval.value = null;
    approvalsError.value = null;
    allowlistsError.value = null;
    pendingCount.value = 0;
    activeApprovalStatus.value = '';
    clearIssuedApprovalTokens();
    stopApprovalsPolling();
}

function approvalTokenKey(id: number | string) {
    return String(id).trim();
}

function rememberIssuedApprovalToken(id: number | string, token: string) {
    const key = approvalTokenKey(id);
    const trimmed = token.trim();
    if (!key || !trimmed) return;
    issuedApprovalTokens.value = {
        ...issuedApprovalTokens.value,
        [key]: trimmed,
    };
}

function consumeIssuedApprovalToken(id: number | string) {
    const key = approvalTokenKey(id);
    if (!key) return undefined;
    const token = issuedApprovalTokens.value[key];
    if (!token) return undefined;
    const next = { ...issuedApprovalTokens.value };
    delete next[key];
    issuedApprovalTokens.value = next;
    return token;
}

function clearIssuedApprovalTokens() {
    issuedApprovalTokens.value = {};
}

function approvalMatchesId(item: ApprovalRequest, id: number | string) {
    return String(item.id) === String(id);
}

function applyLocalApprovalResolution(id: number | string) {
    const key = approvalTokenKey(id);
    if (!key) return;
    if (activeApprovalStatus.value === 'pending') {
        approvals.value = approvals.value.filter(
            (item) => !approvalMatchesId(item, key),
        );
    } else {
        approvals.value = approvals.value.map((item) =>
            approvalMatchesId(item, key)
                ? { ...item, status: 'approved' }
                : item,
        );
    }
    pendingCount.value = Math.max(0, pendingCount.value - 1);
}

function applyLocalDenyOrCancel(id: number | string, status: string) {
    const key = approvalTokenKey(id);
    if (!key) return;
    if (activeApprovalStatus.value === 'pending') {
        approvals.value = approvals.value.filter(
            (item) => !approvalMatchesId(item, key),
        );
    } else {
        approvals.value = approvals.value.map((item) =>
            approvalMatchesId(item, key) ? { ...item, status } : item,
        );
    }
    pendingCount.value = Math.max(0, pendingCount.value - 1);
}

async function withApprovalAction<T>(
    id: number | string,
    fn: () => Promise<T>,
) {
    const key = approvalTokenKey(id);
    if (!key) {
        throw new Error('Approval id is required.');
    }
    if (approvalActionsInFlight.has(key)) {
        throw new Error('Another approval action is already in progress.');
    }
    approvalActionsInFlight.add(key);
    try {
        return await fn();
    } finally {
        approvalActionsInFlight.delete(key);
    }
}

export function useApprovals() {
    const api = useOr3Api();
    const authSession = useAuthSession();
    const { activeHost, isPaired } = useActiveHost();
    const logger = createLogger('approvals');

    function hostKnownUnavailable() {
        return (
            needsUnlock() ||
            !canUseHostApi(activeHost.value) ||
            !isPaired.value ||
            activeHost.value?.status === 'offline' ||
            activeHost.value?.status === 'unauthorized'
        );
    }

    function hostContextKey() {
        if (!canUseHostApi(activeHost.value)) return '';
        const host = activeHost.value;
        if (!host?.id || !host.baseUrl) return '';
        return `${host.id}:${host.baseUrl}`;
    }

    function syncApprovalsHostContext() {
        const nextKey = hostContextKey();
        if (nextKey === approvalsHostKey) return;
        approvalsHostKey = nextKey;
        resetApprovalsState();
        if (!nextKey || hostKnownUnavailable()) return;
        void loadPendingCount();
        startPolling();
    }

    function ensureApprovalsHostWatcher() {
        if (hostWatcherStarted || !import.meta.client) return;
        hostWatcherStarted = true;
        watch(
            () =>
                [
                    hostContextKey(),
                    isPaired.value,
                    needsUnlock(),
                    activeHost.value?.status ?? '',
                ].join('|'),
            () => {
                syncApprovalsHostContext();
            },
            { immediate: true },
        );
    }

    async function withAuthRequest<T>(
        reason: string,
        operation: (
            onAuthChallenge: (challenge: AuthChallengeError) => Promise<boolean>,
        ) => Promise<T>,
    ) {
        return authSession.retryWithAuth(
            (onAuthChallenge) => operation(onAuthChallenge),
            reason,
        );
    }

    const pendingApprovals = computed(() =>
        approvals.value.filter((item) => item.status === 'pending'),
    );

    async function loadPendingCount() {
        if (hostKnownUnavailable()) {
            pendingCount.value = 0;
            return;
        }
        if (pendingCountInFlight) return pendingCountInFlight;
        pendingCountInFlight = (async () => {
            try {
                const response = await api.request<{ count: number }>(
                    '/internal/v1/approvals/count?status=pending',
                );
                pendingCount.value = response.count ?? 0;
            } catch {
                pendingCount.value = 0;
            } finally {
                pendingCountInFlight = null;
            }
        })();
        return pendingCountInFlight;
    }

    async function loadApprovals(status = '') {
        activeApprovalStatus.value = status;
        if (hostKnownUnavailable()) {
            approvals.value = [];
            if (status === 'pending') pendingCount.value = 0;
            return;
        }
        approvalsLoading.value = true;
        approvalsError.value = null;

        try {
            const params = new URLSearchParams();
            if (status) params.set('status', status);
            const suffix = params.size ? `?${params.toString()}` : '';
            const response = await api.request<{ items: unknown[] }>(
                `/internal/v1/approvals${suffix}`,
            );
            approvals.value = (response.items ?? []).map(
                normalizeApprovalRequest,
            );
            if (status === 'pending')
                pendingCount.value = approvals.value.length;
        } catch (error: any) {
            approvalsError.value =
                error?.message ?? 'Unable to load approvals.';
        } finally {
            approvalsLoading.value = false;
        }
    }

    async function loadAllowlists() {
        if (hostKnownUnavailable()) {
            allowlists.value = [];
            return;
        }
        allowlistsError.value = null;
        try {
            const response = await withAuthRequest('approval-allowlists', (onAuthChallenge) =>
                api.request<{ items: unknown[] }>(
                    '/internal/v1/approvals/allowlists',
                    { onAuthChallenge },
                ),
            );
            allowlists.value = (response.items ?? []).map(
                normalizeApprovalAllowlist,
            );
        } catch (error: any) {
            allowlistsError.value =
                error?.message ?? 'Unable to load saved rules.';
            throw error;
        }
    }

    async function fetchApproval(id: number | string) {
        const response = await withAuthRequest('approval-detail', (onAuthChallenge) =>
            api.request<{ item: unknown }>(`/internal/v1/approvals/${id}`, {
                onAuthChallenge,
            }),
        );
        const normalized = normalizeApprovalRequest(response.item);
        selectedApproval.value = normalized;
        return normalized;
    }

    async function reloadApprovals() {
        await loadApprovals(activeApprovalStatus.value);
    }

    function refreshApprovalsInBackground(rememberAllowlist = false) {
        void Promise.all([
            reloadApprovals().catch(() => {}),
            rememberAllowlist
                ? loadAllowlists().catch(() => {})
                : Promise.resolve(),
            loadPendingCount().catch(() => {}),
        ]);
    }

    async function approve(id: number | string, allowlist = false, note = '') {
        return withApprovalAction(id, async () => {
            logger.info('approve:start', 'Approval approve requested', {
                approvalId: id,
                remember: allowlist,
            });
            const response = await withAuthRequest('approval', (onAuthChallenge) =>
                api.request<ApprovalActionResponse>(
                    `/internal/v1/approvals/${id}/approve`,
                    {
                        method: 'POST',
                        body: { allowlist, note },
                        onAuthChallenge,
                    },
                ),
            );
            if (response.token) {
                rememberIssuedApprovalToken(
                    response.request_id ?? id,
                    response.token,
                );
            }
            applyLocalApprovalResolution(response.request_id ?? id);
            logger.info('approve:complete', 'Approval approve completed', {
                approvalId: response.request_id ?? id,
                issuedToken: Boolean(response.token),
            });
            refreshApprovalsInBackground(allowlist);
            return response;
        });
    }

    async function deny(id: number | string, note = '') {
        return withApprovalAction(id, async () => {
            logger.info('deny:start', 'Approval deny requested', {
                approvalId: id,
            });
            const response = await withAuthRequest('approval', (onAuthChallenge) =>
                api.request<ApprovalActionResponse>(
                    `/internal/v1/approvals/${id}/deny`,
                    {
                        method: 'POST',
                        body: { note },
                        onAuthChallenge,
                    },
                ),
            );
            consumeIssuedApprovalToken(response.request_id ?? id);
            applyLocalDenyOrCancel(response.request_id ?? id, 'denied');
            logger.info('deny:complete', 'Approval deny completed', {
                approvalId: response.request_id ?? id,
            });
            refreshApprovalsInBackground();
            return response;
        });
    }

    async function cancel(id: number | string, note = '') {
        return withApprovalAction(id, async () => {
            logger.info('cancel:start', 'Approval cancel requested', {
                approvalId: id,
            });
            const response = await withAuthRequest('approval', (onAuthChallenge) =>
                api.request<ApprovalActionResponse>(
                    `/internal/v1/approvals/${id}/cancel`,
                    {
                        method: 'POST',
                        body: { note },
                        onAuthChallenge,
                    },
                ),
            );
            consumeIssuedApprovalToken(response.request_id ?? id);
            applyLocalDenyOrCancel(response.request_id ?? id, 'canceled');
            logger.info('cancel:complete', 'Approval cancel completed', {
                approvalId: response.request_id ?? id,
            });
            refreshApprovalsInBackground();
            return response;
        });
    }

    async function createAllowlist(
        domain: string,
        scope: Record<string, unknown>,
        matcher: Record<string, unknown>,
        expires_at = 0,
    ) {
        await withAuthRequest('approval-allowlist', (onAuthChallenge) =>
            api.request('/internal/v1/approvals/allowlists', {
                method: 'POST',
                body: { domain, scope, matcher, expires_at },
                onAuthChallenge,
            }),
        );
        await loadAllowlists();
    }

    async function expirePending() {
        logger.info('expire:start', 'Expiring pending approvals');
        await withAuthRequest('approval', (onAuthChallenge) =>
            api.request('/internal/v1/approvals/expire', {
                method: 'POST',
                body: {},
                onAuthChallenge,
            }),
        );
        logger.info('expire:complete', 'Pending approvals expired');
        refreshApprovalsInBackground();
    }

    async function removeAllowlist(id: number | string) {
        await withAuthRequest('approval-allowlist', (onAuthChallenge) =>
            api.request(`/internal/v1/approvals/allowlists/${id}/remove`, {
                method: 'POST',
                body: {},
                onAuthChallenge,
            }),
        );
        await loadAllowlists();
    }

    function startPolling(intervalMs = 15000) {
        stopApprovalsPolling();
        if (!import.meta.client || hostKnownUnavailable()) return;
        approvalsPollTimer = setInterval(() => {
            if (document.visibilityState === 'visible') void loadPendingCount();
        }, intervalMs);
    }

    function stopPolling() {
        stopApprovalsPolling();
    }

    ensureApprovalsHostWatcher();

    return {
        approvals,
        allowlists,
        selectedApproval,
        approvalsLoading,
        approvalsError,
        allowlistsError,
        pendingApprovals,
        pendingCount,
        loadPendingCount,
        loadApprovals,
        loadAllowlists,
        fetchApproval,
        reloadApprovals,
        approve,
        deny,
        cancel,
        consumeIssuedApprovalToken,
        clearIssuedApprovalTokens,
        expirePending,
        createAllowlist,
        removeAllowlist,
        startPolling,
        stopPolling,
    };
}

if (import.meta.hot) {
    import.meta.hot.dispose(() => stopApprovalsPolling());
}
