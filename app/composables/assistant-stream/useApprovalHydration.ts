import { watch, type Ref } from 'vue';
import type { Or3HostProfile } from '~/types/app-state';
import { pendingApprovalPlaceholderContent } from '~/utils/assistant-stream/approval';
import { normalizeApprovalRequest } from '~/utils/or3/approvals';
import type { useChatRuntimeLog } from '../useChatRuntimeLog';
import type { useChatSessions } from '../useChatSessions';
import type { useOr3Api } from '../useOr3Api';

type ChatStore = ReturnType<typeof useChatSessions>;
type RuntimeLogStore = ReturnType<typeof useChatRuntimeLog>;
type ApiClient = ReturnType<typeof useOr3Api>;

interface UseApprovalHydrationOptions {
    activeHost: Ref<Or3HostProfile | null | undefined>;
    api: ApiClient;
    chat: ChatStore;
    runtimeLog: RuntimeLogStore;
    isStreaming: Ref<boolean>;
    isClient?: boolean;
}

let approvalHydrationWatcherInstalled = false;
const approvalHydrationInFlight = new Set<string>();

export function useApprovalHydration(options: UseApprovalHydrationOptions) {
    const isClient = options.isClient ?? import.meta.client;

    const hydratePendingApprovalsForActiveSession = async () => {
        if (!isClient || options.isStreaming.value) return;

        const hostId = options.activeHost.value?.id?.trim();
        const hasAuthToken = Boolean(options.activeHost.value?.token?.trim());
        const sessionKey = options.chat.activeSession.value?.sessionKey?.trim();
        if (!hostId || !hasAuthToken || !sessionKey) return;

        const hydrationKey = `${hostId}:${sessionKey}`;
        if (approvalHydrationInFlight.has(hydrationKey)) return;

        approvalHydrationInFlight.add(hydrationKey);
        try {
            options.runtimeLog.add(
                'approval',
                'hydrate_pending:start',
                undefined,
                {
                    sessionKey,
                },
            );
            const response = await options.api.request<{ items: unknown[] }>(
                '/internal/v1/approvals?status=pending',
            );
            const approvals = (response.items ?? [])
                .map(normalizeApprovalRequest)
                .filter(
                    (approval) =>
                        approval.requester_session_id?.trim() === sessionKey,
                );

            for (const approval of approvals) {
                if (options.chat.isApprovalResolved(approval.id, sessionKey)) {
                    options.runtimeLog.add(
                        'approval',
                        'hydrate_pending:skip_resolved',
                        undefined,
                        {
                            approvalId: approval.id,
                            sessionKey,
                        },
                    );
                    continue;
                }
                if (
                    options.chat.findAssistantMessageForApproval(
                        approval.id,
                        sessionKey,
                    )
                ) {
                    continue;
                }
                options.chat.ensureApprovalMessage({
                    approvalRequestId: approval.id,
                    sessionKey,
                    content: pendingApprovalPlaceholderContent(approval),
                    createdAt: approval.created_at,
                    status: 'attention',
                    approvalState: 'pending',
                });
                options.runtimeLog.add(
                    'approval',
                    'hydrate_pending:upsert',
                    undefined,
                    {
                        approvalId: approval.id,
                        sessionKey,
                    },
                );
            }
        } catch (error) {
            options.runtimeLog.add(
                'approval',
                'hydrate_pending:error',
                String(error),
            );
        } finally {
            approvalHydrationInFlight.delete(hydrationKey);
        }
    };

    const installApprovalHydrationWatcher = () => {
        if (!isClient || approvalHydrationWatcherInstalled) return;

        approvalHydrationWatcherInstalled = true;
        watch(
            () => ({
                hostId: options.activeHost.value?.id ?? '',
                token: options.activeHost.value?.token ? 'ready' : 'none',
                sessionKey: options.chat.activeSession.value?.sessionKey ?? '',
                streaming: options.isStreaming.value,
            }),
            () => {
                void hydratePendingApprovalsForActiveSession();
            },
            { immediate: true },
        );
    };

    return {
        hydratePendingApprovalsForActiveSession,
        installApprovalHydrationWatcher,
    };
}
