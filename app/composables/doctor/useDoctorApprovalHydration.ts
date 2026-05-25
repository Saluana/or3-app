import { effectScope, ref, watch } from 'vue';
import { useActiveHost } from '../useActiveHost';
import { useOr3Api } from '../useOr3Api';
import { useDoctorChatStore } from './doctorChatStore';
import { pendingApprovalPlaceholderContent } from '~/utils/assistant-stream/approval';
import { normalizeApprovalRequest } from '~/utils/or3/approvals';
import { sortDoctorMessages, type DoctorMessageState } from '~/utils/doctor';

const doctorApprovalHydrationInFlight = new Set<string>();
export const doctorApprovalHydrationError = ref<string | null>(null);
const MAX_RESOLVED_DOCTOR_APPROVALS = 500;
const resolvedDoctorApprovals = new Map<string, string>();
let doctorApprovalHydrationConsumerCount = 0;
let doctorApprovalHydrationScope: ReturnType<typeof effectScope> | null = null;
let stopDoctorApprovalHydrationWatch: (() => void) | null = null;
let doctorApprovalHydrationVisibilityHandler: (() => void) | null = null;

function resolutionKey(sessionKey: string, approvalId: number | string) {
    return `${sessionKey.trim()}:${String(approvalId).trim()}`;
}

export function isDoctorApprovalResolved(
    approvalId: number | string,
    sessionKey?: string,
) {
    const key = sessionKey?.trim();
    if (!key) return false;
    return resolvedDoctorApprovals.has(resolutionKey(key, approvalId));
}

export function markDoctorApprovalResolved(
    approvalId: number | string,
    state: string,
    sessionKey?: string,
) {
    const key = sessionKey?.trim();
    if (!key) return;
    const resolvedKey = resolutionKey(key, approvalId);
    if (resolvedDoctorApprovals.has(resolvedKey)) {
        resolvedDoctorApprovals.delete(resolvedKey);
    }
    resolvedDoctorApprovals.set(resolvedKey, state);
    while (resolvedDoctorApprovals.size > MAX_RESOLVED_DOCTOR_APPROVALS) {
        const oldest = resolvedDoctorApprovals.keys().next().value as
            | string
            | undefined;
        if (!oldest) break;
        resolvedDoctorApprovals.delete(oldest);
    }
}

function findDoctorMessageForApproval(
    messages: DoctorMessageState[],
    approvalId: number | string,
) {
    const id = String(approvalId).trim();
    return messages.find(
        (message) =>
            message.role === 'assistant' &&
            String(message.approvalRequestId ?? '').trim() === id,
    );
}

export function ensureDoctorApprovalMessage(
    store: ReturnType<typeof useDoctorChatStore>,
    options: {
        approvalRequestId: number | string;
        sessionKey?: string;
        content: string;
        createdAt?: number;
    },
) {
    const sessionKey = String(
        options.sessionKey ?? store.sessionKey.value ?? '',
    ).trim();
    const approvalKey = String(options.approvalRequestId).trim();
    if (!approvalKey) return undefined;
    if (sessionKey && isDoctorApprovalResolved(approvalKey, sessionKey)) {
        return undefined;
    }
    const existing = findDoctorMessageForApproval(
        store.messages.value,
        approvalKey,
    );
    if (existing) return existing;

    const createdAt =
        options.createdAt && options.createdAt > 0
            ? options.createdAt
            : Math.floor(Date.now() / 1000);
    const message: DoctorMessageState = {
        id: store.nextOptimisticMessageID(),
        role: 'assistant',
        content: options.content,
        created_at: createdAt,
        meta: { status: 'attention' },
        status: 'attention',
        approvalRequestId: options.approvalRequestId,
        approvalState: 'pending',
    };
    store.messages.value = sortDoctorMessages([
        ...store.messages.value,
        message,
    ]);
    return message;
}

export function useDoctorApprovalHydration() {
    const store = useDoctorChatStore();
    const { activeHost } = useActiveHost();
    const api = useOr3Api();

    const hydratePendingDoctorApprovals = async () => {
        if (!import.meta.client || store.loading.value) return;

        const hostId = activeHost.value?.id?.trim();
        const hasAuth = Boolean(
            activeHost.value?.token?.trim() ||
            activeHost.value?.authMode === 'secure-session',
        );
        const sessionKey = store.sessionKey.value?.trim();
        if (!hostId || !hasAuth || !sessionKey) return;

        const hydrationKey = `${hostId}:${sessionKey}`;
        if (doctorApprovalHydrationInFlight.has(hydrationKey)) return;

        doctorApprovalHydrationInFlight.add(hydrationKey);
        doctorApprovalHydrationError.value = null;
        try {
            const response = await api.request<{ items: unknown[] }>(
                '/internal/v1/approvals?status=pending',
            );
            const approvals = (response.items ?? [])
                .map(normalizeApprovalRequest)
                .filter(
                    (approval) =>
                        approval.requester_session_id?.trim() === sessionKey,
                );

            for (const approval of approvals) {
                if (isDoctorApprovalResolved(approval.id, sessionKey)) {
                    continue;
                }
                if (
                    findDoctorMessageForApproval(
                        store.messages.value,
                        approval.id,
                    )
                ) {
                    continue;
                }
                ensureDoctorApprovalMessage(store, {
                    approvalRequestId: approval.id,
                    sessionKey,
                    content: pendingApprovalPlaceholderContent(approval),
                    createdAt: approval.created_at
                        ? Math.floor(
                              new Date(approval.created_at).getTime() / 1000,
                          )
                        : undefined,
                });
            }
        } catch (error) {
            doctorApprovalHydrationError.value =
                error && typeof error === 'object' && 'message' in error
                    ? String((error as { message?: unknown }).message)
                    : 'Could not refresh Doctor approval requests';
        } finally {
            doctorApprovalHydrationInFlight.delete(hydrationKey);
        }
    };

    const installDoctorApprovalHydrationWatcher = () => {
        if (!import.meta.client) return () => undefined;
        doctorApprovalHydrationConsumerCount += 1;
        if (!stopDoctorApprovalHydrationWatch) {
            doctorApprovalHydrationScope = effectScope(true);
            doctorApprovalHydrationScope.run(() => {
                stopDoctorApprovalHydrationWatch = watch(
                    () => ({
                        hostId: activeHost.value?.id ?? '',
                        token:
                            activeHost.value?.token ||
                            activeHost.value?.authMode === 'secure-session'
                                ? 'ready'
                                : 'none',
                        sessionKey: store.sessionKey.value ?? '',
                        streaming: store.loading.value,
                    }),
                    () => {
                        void hydratePendingDoctorApprovals();
                    },
                    { immediate: true },
                );
            });
        }
        if (
            typeof document !== 'undefined' &&
            !doctorApprovalHydrationVisibilityHandler
        ) {
            doctorApprovalHydrationVisibilityHandler = () => {
                if (document.visibilityState === 'visible') {
                    void hydratePendingDoctorApprovals();
                }
            };
            document.addEventListener(
                'visibilitychange',
                doctorApprovalHydrationVisibilityHandler,
            );
        }

        let disposed = false;
        return () => {
            if (disposed) return;
            disposed = true;
            doctorApprovalHydrationConsumerCount = Math.max(
                0,
                doctorApprovalHydrationConsumerCount - 1,
            );
            if (doctorApprovalHydrationConsumerCount > 0) return;
            doctorApprovalHydrationScope?.stop();
            doctorApprovalHydrationScope = null;
            stopDoctorApprovalHydrationWatch?.();
            stopDoctorApprovalHydrationWatch = null;
            if (
                typeof document !== 'undefined' &&
                doctorApprovalHydrationVisibilityHandler
            ) {
                document.removeEventListener(
                    'visibilitychange',
                    doctorApprovalHydrationVisibilityHandler,
                );
            }
            doctorApprovalHydrationVisibilityHandler = null;
        };
    };

    return {
        doctorApprovalHydrationError,
        hydratePendingDoctorApprovals,
        installDoctorApprovalHydrationWatcher,
        ensureDoctorApprovalMessage: (options: {
            approvalRequestId: number | string;
            sessionKey?: string;
            content: string;
            createdAt?: number;
        }) => ensureDoctorApprovalMessage(store, options),
        markDoctorApprovalResolved,
        isDoctorApprovalResolved,
        findDoctorMessageForApproval: (approvalId: number | string) =>
            findDoctorMessageForApproval(store.messages.value, approvalId),
    };
}
