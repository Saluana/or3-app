import { computed, ref } from 'vue';
import type {
    ApprovalActionResponse,
    ApprovalAllowlist,
    ApprovalRequest,
} from '~/types/or3-api';
import {
    normalizeApprovalAllowlist,
    normalizeApprovalRequest,
} from '~/utils/or3/approvals';
import { useOr3Api } from './useOr3Api';

const approvals = ref<ApprovalRequest[]>([]);
const allowlists = ref<ApprovalAllowlist[]>([]);
const selectedApproval = ref<ApprovalRequest | null>(null);
const approvalsLoading = ref(false);
const approvalsError = ref<string | null>(null);
const pendingCount = ref(0);
const activeApprovalStatus = ref('');
let approvalsPollTimer: ReturnType<typeof setInterval> | null = null;
const approvalActionsInFlight = new Set<string>();
const issuedApprovalTokens = ref<Record<string, string>>({});

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

async function withApprovalAction<T>(
    id: number | string,
    action: string,
    fn: () => Promise<T>,
) {
    const key = `${action}:${String(id)}`;
    if (approvalActionsInFlight.has(key)) {
        throw new Error(`Approval ${action} is already in progress.`);
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

    const pendingApprovals = computed(() =>
        approvals.value.filter((item) => item.status === 'pending'),
    );

    async function loadPendingCount() {
        try {
            const response = await api.request<{ items: unknown[] }>(
                '/internal/v1/approvals?status=pending',
            );
            pendingCount.value = response.items?.length ?? 0;
        } catch {
            pendingCount.value = 0;
        }
    }

    async function loadApprovals(status = '') {
        activeApprovalStatus.value = status;
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
        approvalsError.value = null;
        try {
            const response = await api.request<{ items: unknown[] }>(
                '/internal/v1/approvals/allowlists',
            );
            allowlists.value = (response.items ?? []).map(
                normalizeApprovalAllowlist,
            );
        } catch (error: any) {
            approvalsError.value =
                error?.message ?? 'Unable to load allowlists.';
        }
    }

    async function fetchApproval(id: number | string) {
        const response = await api.request<{ item: unknown }>(
            `/internal/v1/approvals/${id}`,
        );
        const normalized = normalizeApprovalRequest(response.item);
        selectedApproval.value = normalized;
        return normalized;
    }

    async function reloadApprovals() {
        await loadApprovals(activeApprovalStatus.value);
    }

    async function approve(id: number | string, allowlist = false, note = '') {
        return withApprovalAction(id, 'approve', async () => {
            const response = await api.request<ApprovalActionResponse>(
                `/internal/v1/approvals/${id}/approve`,
                {
                    method: 'POST',
                    body: { allowlist, note },
                },
            );
            if (response.token) {
                rememberIssuedApprovalToken(
                    response.request_id ?? id,
                    response.token,
                );
            }
            await Promise.all([
                reloadApprovals(),
                loadAllowlists(),
                loadPendingCount(),
            ]);
            return response;
        });
    }

    async function deny(id: number | string, note = '') {
        return withApprovalAction(id, 'deny', async () => {
            const response = await api.request<ApprovalActionResponse>(
                `/internal/v1/approvals/${id}/deny`,
                {
                    method: 'POST',
                    body: { note },
                },
            );
            consumeIssuedApprovalToken(response.request_id ?? id);
            await Promise.all([reloadApprovals(), loadPendingCount()]);
            return response;
        });
    }

    async function cancel(id: number | string, note = '') {
        return withApprovalAction(id, 'cancel', async () => {
            const response = await api.request<ApprovalActionResponse>(
                `/internal/v1/approvals/${id}/cancel`,
                {
                    method: 'POST',
                    body: { note },
                },
            );
            consumeIssuedApprovalToken(response.request_id ?? id);
            await Promise.all([reloadApprovals(), loadPendingCount()]);
            return response;
        });
    }

    async function createAllowlist(
        domain: string,
        scope: Record<string, unknown>,
        matcher: Record<string, unknown>,
        expires_at = 0,
    ) {
        await api.request('/internal/v1/approvals/allowlists', {
            method: 'POST',
            body: { domain, scope, matcher, expires_at },
        });
        await loadAllowlists();
    }

    async function expirePending() {
        await api.request('/internal/v1/approvals/expire', {
            method: 'POST',
            body: {},
        });
        await Promise.all([reloadApprovals(), loadPendingCount()]);
    }

    async function removeAllowlist(id: number | string) {
        await api.request(`/internal/v1/approvals/allowlists/${id}/remove`, {
            method: 'POST',
            body: {},
        });
        await loadAllowlists();
    }

    function startPolling(intervalMs = 15000) {
        if (!import.meta.client || approvalsPollTimer) return;
        approvalsPollTimer = setInterval(() => {
            if (document.visibilityState === 'visible') void loadPendingCount();
        }, intervalMs);
    }

    function stopPolling() {
        if (!approvalsPollTimer) return;
        clearInterval(approvalsPollTimer);
        approvalsPollTimer = null;
    }

    return {
        approvals,
        allowlists,
        selectedApproval,
        approvalsLoading,
        approvalsError,
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
