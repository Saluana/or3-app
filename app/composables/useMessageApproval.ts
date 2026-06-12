import { computed, ref, watch, type ComputedRef, type Ref } from 'vue';
import { useToast } from '@nuxt/ui/composables';
import { useApprovals } from './useApprovals';
import { useAssistantStream } from './useAssistantStream';
import { useChatSessions } from './useChatSessions';
import type { ApprovalRequest } from '~/types/or3-api';
import type { ChatMessage } from '~/types/app-state';
import {
    approvalActionErrorMessage,
    approvalStatusFromError,
    canContinueApprovedRequest,
    resolvedApprovalMessage,
    resolvedApprovalState,
} from '~/utils/assistantApproval';
import {
    formatApprovalInlineCopy,
    formatApprovalSubjectPreview,
} from '~/utils/or3/approval-display';
import {
    formatModeratorCardSummary,
    parseModeratorAlternative,
} from '~/utils/or3/moderator-display';

export function useMessageApproval(
    message: Ref<ChatMessage> | ComputedRef<ChatMessage>,
) {
    const toast = useToast();
    const {
        activeSession,
        markApprovalResolved,
        messages,
        updateMessage,
    } = useChatSessions();
    const { isStreaming, send } = useAssistantStream();
    const {
        approve,
        deny,
        fetchApproval,
        consumeIssuedApprovalToken,
        approvals,
        loadApprovals,
    } = useApprovals();

    const approvalBusy = ref(false);
    const approvalDetail = ref<ApprovalRequest | null>(null);
    const approvalDetailLoading = ref(false);
    const approvalDetailLoads = new Set<string>();

    const approvalRequestKey = computed(() =>
        String(message.value.approvalRequestId ?? '').trim(),
    );

    const approvalIsPending = computed(() => {
        if (!approvalRequestKey.value) return false;
        const state = String(message.value.approvalState ?? '').trim();
        if (state === 'pending' || state === 'retrying') return true;
        if (state && !['pending', 'retrying'].includes(state)) return false;
        return message.value.status === 'attention';
    });

    const showApprovalActions = computed(
        () => approvalIsPending.value && !!approvalRequestKey.value,
    );

    function storedApprovalForMessage() {
        const key = approvalRequestKey.value;
        if (!key) return undefined;
        return approvals.value.find((item) => String(item.id) === key);
    }

    function approvalPreviewFromContent(content?: string) {
        const match = content?.match(
            /(?:\*\*Usage:\*\*|Requested action:)\s*([^\n]+)/i,
        );
        return match?.[1]?.trim() ?? '';
    }

    const approvalDisplay = computed(() => {
        const stored = approvalDetail.value ?? storedApprovalForMessage();
        if (stored) {
            return formatApprovalInlineCopy(stored);
        }
        const cachedType = message.value.approvalType?.trim();
        const cachedPreview =
            message.value.approvalPreview?.trim() ||
            approvalPreviewFromContent(message.value.content);
        if (cachedType || cachedPreview) {
            const copy = formatApprovalInlineCopy({
                type: cachedType,
                subject: cachedPreview ? { summary: cachedPreview } : undefined,
            });
            return cachedPreview ? { ...copy, preview: cachedPreview } : copy;
        }
        if (
            message.value.content?.toLowerCase().includes('tool-call limit') ||
            message.value.content?.toLowerCase().includes('tool call limit') ||
            message.value.approvalType === 'tool_quota'
        ) {
            return formatApprovalInlineCopy({ type: 'tool_quota' });
        }
        return formatApprovalInlineCopy(undefined);
    });

    const approvalRecord = computed(
        () => approvalDetail.value ?? storedApprovalForMessage(),
    );

    const moderatorReview = computed(() => {
        const meta = approvalRecord.value?.moderator;
        if (!meta) return null;
        const summary = formatModeratorCardSummary(meta);
        if (!summary) return null;
        const parsed = parseModeratorAlternative(meta.reason);
        return {
            summary,
            reason: parsed.reason,
            alternative: parsed.alternative,
            reviewed: Boolean(
                String(meta.status ?? '').trim() ||
                    String(meta.action ?? '').trim(),
            ),
        };
    });

    const approvalNotice = computed(() => {
        if (moderatorReview.value?.reviewed) {
            return 'OR3 reviewed this and sent it to you for approval.';
        }
        return 'Review the request below, then approve or deny it.';
    });

    function currentMessage() {
        return (
            messages.value.find((item) => item.id === message.value.id) ??
            message.value
        );
    }

    async function loadApprovalDetail(id: number | string | undefined) {
        const key = String(id ?? '').trim();
        if (!key || approvalDetailLoads.has(key)) return;
        const cached = storedApprovalForMessage();
        if (cached) {
            approvalDetail.value = cached;
            return;
        }
        if (approvalDetail.value && String(approvalDetail.value.id) === key) return;
        approvalDetailLoads.add(key);
        approvalDetailLoading.value = true;
        try {
            const approval = await fetchApproval(key);
            approvalDetail.value = approval;
            updateMessage(message.value.id, {
                approvalType: approval.type || approval.domain,
                approvalPreview: formatApprovalSubjectPreview(approval),
            });
        } catch {
            approvalDetail.value = null;
        } finally {
            approvalDetailLoads.delete(key);
            approvalDetailLoading.value = false;
        }
    }

    watch(
        () => [approvalRequestKey.value, approvalIsPending.value],
        ([requestId, pending]) => {
            const approvalId = String(requestId ?? '').trim();
            if (!pending || !approvalId) {
                approvalDetail.value = null;
                return;
            }
            void loadApprovals('pending').catch(() => undefined);
            void loadApprovalDetail(approvalId);
        },
        { immediate: true },
    );

    async function retryApprovedRequest(
        explicitToken?: string,
        options: { allowWhileApprovalBusy?: boolean } = {},
    ) {
        const latest = currentMessage();
        if (
            !latest.retryPayload ||
            !canContinueApprovedRequest({
                isStreaming: isStreaming.value,
                approvalBusy: approvalBusy.value,
                allowWhileApprovalBusy: options.allowWhileApprovalBusy,
            })
        ) {
            return false;
        }
        const requestId = latest.approvalRequestId;
        const token =
            explicitToken ??
            (requestId ? consumeIssuedApprovalToken(requestId) : undefined);
        if (!token) return false;

        const retryPayload = { ...latest.retryPayload, approvalToken: token };
        updateMessage(latest.id, {
            approvalState: 'retrying',
            status: 'attention',
            retryPayload,
            error: undefined,
        });
        await send(retryPayload);

        const after = currentMessage();
        const waitingAgain =
            after.approvalState === 'pending' && !!after.approvalRequestId;
        const retryFailed =
            after.approvalState === 'failed' || after.status === 'failed';
        if (!waitingAgain && !retryFailed) {
            markApprovalResolved(
                requestId,
                'approved',
                latest.sourceSessionKey || activeSession.value?.sessionKey,
            );
        }
        return true;
    }

    function approvalGrantedMessage(remember: boolean, continues: boolean) {
        if (remember) {
            return continues
                ? 'The request was approved and remembered. OR3 is continuing now.'
                : 'The request was approved and matching future requests were saved.';
        }
        return continues
            ? 'The request was approved. OR3 is continuing now.'
            : 'The request was approved.';
    }

    async function resolveStaleApprovalAction(error: unknown) {
        const latest = currentMessage();
        const requestId = latest.approvalRequestId;
        let status = approvalStatusFromError(error);
        if (!resolvedApprovalState(status) && requestId) {
            try {
                const approval = await fetchApproval(requestId);
                status = approval.status;
            } catch {
                /* keep original error */
            }
        }
        const state = resolvedApprovalState(status);
        if (!state) return false;

        markApprovalResolved(
            requestId,
            state,
            latest.sourceSessionKey || activeSession.value?.sessionKey,
            resolvedApprovalMessage(status),
        );
        toast.add({
            title: 'Approval already handled',
            description: resolvedApprovalMessage(status),
            color: state === 'approved' ? 'success' : 'neutral',
            icon:
                state === 'approved'
                    ? 'i-pixelarticons-check'
                    : 'i-pixelarticons-info-box',
        });
        return true;
    }

    async function approveApproval(remember = false) {
        const latest = currentMessage();
        if (!latest.approvalRequestId || approvalBusy.value) return;
        approvalBusy.value = true;
        let retryAttempted = false;
        let approvalGranted = false;
        try {
            const approval = await approve(
                latest.approvalRequestId,
                remember,
                remember
                    ? 'approved and remembered from chat'
                    : 'approved from chat',
            );
            approvalGranted = true;
            const approvalToken =
                consumeIssuedApprovalToken(latest.approvalRequestId) ??
                approval.token;
            retryAttempted = Boolean(approvalToken);
            toast.add({
                title: 'Approval granted',
                description: approvalGrantedMessage(remember, retryAttempted),
                color: 'success',
                icon: 'i-pixelarticons-check',
            });
            const retried = approvalToken
                ? await retryApprovedRequest(approvalToken, {
                      allowWhileApprovalBusy: true,
                  })
                : false;
            if (!retried) {
                markApprovalResolved(
                    latest.approvalRequestId,
                    'approved',
                    latest.sourceSessionKey || activeSession.value?.sessionKey,
                );
            }
        } catch (error) {
            if (!approvalGranted && (await resolveStaleApprovalAction(error)))
                return;
            const description = approvalActionErrorMessage(error);
            updateMessage(currentMessage().id, {
                approvalState: retryAttempted ? 'failed' : 'pending',
                status: retryAttempted ? 'failed' : 'attention',
                error: description,
            });
            toast.add({
                title: approvalGranted
                    ? 'Approval retry failed'
                    : 'Approval failed',
                description,
                color: 'error',
                icon: 'i-pixelarticons-warning-box',
            });
        } finally {
            approvalBusy.value = false;
        }
    }

    async function denyApproval() {
        const latest = currentMessage();
        if (!latest.approvalRequestId || approvalBusy.value) return;
        approvalBusy.value = true;
        try {
            await deny(latest.approvalRequestId);
            markApprovalResolved(
                latest.approvalRequestId,
                'denied',
                latest.sourceSessionKey || activeSession.value?.sessionKey,
            );
            toast.add({
                title: 'Approval denied',
                description: 'The request was denied.',
                color: 'neutral',
                icon: 'i-pixelarticons-close-box',
            });
        } catch (error) {
            if (await resolveStaleApprovalAction(error)) return;
            const description =
                error instanceof Error && error.message
                    ? error.message
                    : 'Could not deny this request.';
            updateMessage(latest.id, {
                approvalState: 'pending',
                status: 'attention',
                error: description,
            });
            toast.add({
                title: 'Deny failed',
                description,
                color: 'error',
                icon: 'i-pixelarticons-warning-box',
            });
        } finally {
            approvalBusy.value = false;
        }
    }

    watch(
        () => [
            message.value.approvalRequestId,
            message.value.approvalState,
            message.value.retryPayload,
            isStreaming.value,
        ],
        () => {
            const latest = currentMessage();
            if (
                latest.approvalState !== 'pending' ||
                !latest.approvalRequestId ||
                !latest.retryPayload ||
                approvalBusy.value ||
                isStreaming.value
            ) {
                return;
            }
            void retryApprovedRequest().catch((error) => {
                updateMessage(currentMessage().id, {
                    approvalState: 'failed',
                    status: 'failed',
                    error: approvalActionErrorMessage(error),
                });
            });
        },
        { immediate: true },
    );

    return {
        approvalBusy,
        approvalDetailLoading,
        approvalDisplay,
        approvalIsPending,
        approvalNotice,
        moderatorReview,
        showApprovalActions,
        approveApproval,
        denyApproval,
    };
}
