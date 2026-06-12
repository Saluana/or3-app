<template>
    <article
        :class="[
            'or3-msg',
            message.role === 'user' ? 'or3-msg--user' : 'or3-msg--assistant',
            message.pinned ? 'or3-msg--pinned' : '',
        ]"
    >
        <div class="or3-msg__body">
            <div
                :class="[
                    'or3-msg__bubble',
                    message.role === 'user'
                        ? 'or3-msg__bubble--user'
                        : 'or3-msg__bubble--assistant',
                    approvalNeedsAttention ? 'or3-msg__bubble--attention' : '',
                ]"
            >
                <template v-if="message.role !== 'user'">
                    <AssistantReasoningPanel
                        :content="message.reasoningText"
                        :pending="
                            message.status === 'streaming' && !message.content
                        "
                        :tool-calls="
                            hasOrderedParts ? [] : message.toolCalls || []
                        "
                    />
                    <AssistantToolCallList
                        v-if="!hasOrderedParts && message.toolCalls?.length"
                        :tool-calls="message.toolCalls"
                    />
                    <div v-if="renderBlocks.length" class="or3-msg__parts">
                        <template
                            v-for="block in renderBlocks"
                            :key="block.key"
                        >
                            <StreamingMarkdown
                                v-if="block.kind === 'markdown'"
                                :content="block.content"
                                :repair-incomplete-markdown="
                                    shouldRepairIncompleteMarkdown
                                "
                            />
                            <AssistantInlineToolCall
                                v-else-if="block.kind === 'tool'"
                                :part="block.part"
                            />
                        </template>
                    </div>
                    <StreamingMarkdown
                        v-else-if="message.content"
                        :content="message.content"
                        :repair-incomplete-markdown="
                            shouldRepairIncompleteMarkdown
                        "
                    />
                    <p
                        v-else-if="message.status === 'streaming'"
                        class="or3-msg__thinking"
                    >
                        <span class="or3-msg__dot" />
                        <span class="or3-msg__dot" />
                        <span class="or3-msg__dot" />
                    </p>
                    <AssistantActivityLog
                        v-if="activityItems.length"
                        :items="activityItems"
                        :streaming="message.status === 'streaming'"
                        consumer-mode
                    />
                </template>
                <template v-else>
                    <p
                        v-if="message.content"
                        class="or3-msg__user-text text-[0.9375rem] text-(--or3-text)"
                    >
                        {{ message.content }}
                    </p>
                    <div
                        v-if="message.attachments?.length"
                        class="or3-msg__attachments"
                    >
                        <UPopover
                            v-for="attachment in message.attachments"
                            :key="attachment.id"
                            class="inline-flex max-w-full min-w-0"
                            :ui="{
                                content:
                                    'p-0 bg-white border border-(--or3-border) rounded-xl shadow-lg max-w-xs',
                            }"
                        >
                            <span
                                class="or3-msg__attachment"
                                :title="attachmentTooltip(attachment)"
                            >
                                <span class="or3-msg__attachment-icon-wrap">
                                    <Icon
                                        :name="
                                            attachment.kind === 'text'
                                                ? 'i-pixelarticons-notebook'
                                                : 'i-pixelarticons-paperclip'
                                        "
                                        class="size-3 shrink-0"
                                    />
                                </span>
                                <span class="or3-msg__attachment-label">{{
                                    attachment.name
                                }}</span>
                            </span>

                            <template #content>
                                <div class="p-3 space-y-2">
                                    <div class="flex items-start gap-2.5">
                                        <span
                                            class="grid size-8 shrink-0 place-items-center rounded-lg bg-(--or3-green-soft) text-(--or3-green-dark)"
                                        >
                                            <Icon
                                                :name="
                                                    attachment.kind === 'text'
                                                        ? 'i-pixelarticons-notebook'
                                                        : 'i-pixelarticons-file'
                                                "
                                                class="size-4"
                                            />
                                        </span>
                                        <div class="min-w-0 flex-1">
                                            <p
                                                class="text-sm font-semibold text-(--or3-text) truncate"
                                            >
                                                {{ attachment.name }}
                                            </p>
                                            <p
                                                v-if="attachment.preview"
                                                class="text-xs text-(--or3-text-muted) break-all"
                                            >
                                                {{ attachment.preview }}
                                            </p>
                                        </div>
                                    </div>
                                    <div
                                        v-if="attachment.mimeType"
                                        class="text-xs text-(--or3-text-muted)"
                                    >
                                        <span class="font-medium">Type:</span>
                                        {{ attachment.mimeType }}
                                    </div>
                                    <div
                                        v-if="attachment.size"
                                        class="text-xs text-(--or3-text-muted)"
                                    >
                                        <span class="font-medium">Size:</span>
                                        {{ formatBytes(attachment.size) }}
                                    </div>
                                    <div
                                        v-if="attachment.path"
                                        class="text-xs text-(--or3-text-muted)"
                                    >
                                        <span class="font-medium">Path:</span>
                                        <span class="break-all">{{
                                            attachment.path
                                        }}</span>
                                    </div>
                                </div>
                            </template>
                        </UPopover>
                    </div>
                </template>
                <p
                    v-if="showErrorStrip"
                    class="mt-2 text-xs text-(--or3-danger)"
                >
                    {{ errorStripText }}
                </p>

                <div
                    class="or3-msg__actions"
                    :class="hasMeta ? 'or3-msg__actions--with-meta' : ''"
                >
                    <button
                        v-if="canCopy"
                        type="button"
                        class="or3-msg__action"
                        :aria-label="
                            copied ? 'Message copied' : 'Copy message markdown'
                        "
                        :title="copied ? 'Copied' : 'Copy markdown'"
                        @click="copyMessage"
                    >
                        <Icon
                            :name="
                                copied
                                    ? 'i-pixelarticons-check'
                                    : 'i-pixelarticons-copy'
                            "
                            class="size-4"
                        />
                        <span>{{ copied ? 'Copied' : 'Copy' }}</span>
                    </button>
                    <button
                        type="button"
                        class="or3-msg__action"
                        :aria-label="
                            message.pinned ? 'Unsave message' : 'Save message'
                        "
                        :title="
                            message.pinned ? 'Unsave message' : 'Save message'
                        "
                        @click="togglePin"
                    >
                        <Icon
                            name="i-pixelarticons-bookmark"
                            :class="[
                                'size-4',
                                message.pinned ? 'text-(--or3-green-dark)' : '',
                            ]"
                        />
                        <span>{{ message.pinned ? 'Saved' : 'Save' }}</span>
                    </button>
                    <button
                        v-if="canRetry"
                        type="button"
                        class="or3-msg__action"
                        :disabled="isStreaming"
                        aria-label="Retry message"
                        title="Retry message"
                        @click="retryMessage"
                    >
                        <Icon name="i-pixelarticons-undo" class="size-4" />
                        <span>Retry</span>
                    </button>
                    <button
                        v-if="canFork"
                        type="button"
                        class="or3-msg__action"
                        :disabled="isStreaming || forkBusy"
                        aria-label="Fork conversation from this message"
                        title="Fork conversation from this message"
                        @click="forkMessage"
                    >
                        <Icon
                            name="i-pixelarticons-git-branch"
                            class="size-4"
                        />
                        <span>{{ forkBusy ? 'Forking…' : 'Fork' }}</span>
                    </button>
                    <button
                        v-if="showInlineApprovalActions"
                        type="button"
                        class="or3-msg__action or3-msg__action--deny"
                        :disabled="approvalBusy"
                        aria-label="Deny approval"
                        title="Deny approval"
                        @click="denyApproval"
                    >
                        <Icon name="i-pixelarticons-close" class="size-4" />
                        <span>Deny</span>
                    </button>
                    <button
                        v-if="showInlineApprovalActions"
                        type="button"
                        class="or3-msg__action or3-msg__action--approve"
                        :disabled="approvalBusy"
                        aria-label="Approve request"
                        title="Approve request"
                        @click="approveApproval(false)"
                    >
                        <Icon name="i-pixelarticons-check" class="size-4" />
                        <span>Approve once</span>
                    </button>
                    <button
                        v-if="showInlineApprovalActions"
                        type="button"
                        class="or3-msg__action or3-msg__action--remember"
                        :disabled="approvalBusy"
                        aria-label="Approve and remember request"
                        title="Approve and remember matching future requests"
                        @click="approveApproval(true)"
                    >
                        <Icon name="i-pixelarticons-bookmark" class="size-4" />
                        <span>Approve &amp; remember</span>
                    </button>
                </div>
            </div>
            <div v-if="hasMeta" class="or3-msg__meta">
                <span v-if="message.pinned" class="or3-msg__meta-pin">
                    <Icon name="i-pixelarticons-bookmark" class="size-3" />
                    Saved
                </span>
                <span v-if="approvalMetaLabel" class="or3-msg__meta-pin">
                    <Icon name="i-pixelarticons-shield" class="size-3" />
                    {{ approvalMetaLabel }}
                </span>
                <span v-if="timestamp">{{ timestamp }}</span>
            </div>
        </div>
    </article>
</template>

<script setup lang="ts">
import { computed, inject, onBeforeUnmount, ref, watch } from 'vue';
import { useToast } from '@nuxt/ui/composables';
import type { ChatAttachment, ChatMessage } from '../../types/app-state';
import { mergeActivityWithToolParts } from '../../utils/assistant-stream/activity-merge';
import { CHAT_MESSAGE_ACTIONS_KEY } from '../../utils/chat/chat-message-actions';
import { COMPOSER_APPROVAL_MESSAGE_ID_KEY } from '../../utils/chat/pending-approval-message';
import {
    approvalActionErrorMessage,
    approvalStatusFromError,
    canContinueApprovedRequest,
    resolvedApprovalMessage,
    resolvedApprovalState,
} from '../../utils/assistantApproval';
import {
    buildAssistantRenderBlocks,
    shouldRepairIncompleteMarkdownForStatus,
} from '../../utils/streamingMarkdown';
import { userFacingErrorCopy } from '../../utils/assistant-stream/userErrorCopy';

const props = defineProps<{ message: ChatMessage }>();
const toast = useToast();
const actions = inject(CHAT_MESSAGE_ACTIONS_KEY);
if (!actions) {
    throw new Error('ChatMessage requires ChatMessageList context.');
}

const {
    activeSession,
    findMessageById,
    markApprovalResolved,
    toggleMessagePin,
    updateMessage,
    isStreaming,
    send,
    approve,
    deny,
    fetchApproval,
    consumeIssuedApprovalToken,
} = actions;
const sessionHistory = { forkSession: actions.forkSession };
const copied = ref(false);
const approvalBusy = ref(false);
const forkBusy = ref(false);
let copiedTimer: ReturnType<typeof setTimeout> | null = null;
const composerApprovalMessageId = inject(
    COMPOSER_APPROVAL_MESSAGE_ID_KEY,
    computed(() => ''),
);

const shouldRepairIncompleteMarkdown = computed(() =>
    shouldRepairIncompleteMarkdownForStatus(props.message.status),
);

const friendlyError = computed(() =>
    userFacingErrorCopy(
        { message: props.message.error, code: props.message.errorCode },
        props.message.errorCode,
    ),
);

const showErrorStrip = computed(() => {
    if (!props.message.error) return false;
    if (
        props.message.status !== 'failed' &&
        props.message.status !== 'attention'
    ) {
        return false;
    }
    const content = props.message.content?.trim();
    const error = props.message.error.trim();
    if (!content) return true;
    if (content === error) return false;
    if (content.includes(error)) return false;
    if (content.includes(friendlyError.value.message)) return false;
    return true;
});

const errorStripText = computed(
    () => friendlyError.value.suggestion || friendlyError.value.message,
);

function currentMessage(): ChatMessage {
    return findMessageById(props.message.id) ?? props.message;
}

const copyText = computed(() => props.message.content.trim());
const canCopy = computed(() => Boolean(copyText.value));
const renderBlocks = computed(() => buildAssistantRenderBlocks(props.message));
const hasOrderedParts = computed(() => renderBlocks.value.length > 0);
const activityItems = computed(() =>
    mergeActivityWithToolParts(
        props.message.activityLog,
        props.message.parts,
    ),
);
const canRetry = computed(
    () =>
        props.message.role === 'assistant' &&
        props.message.status === 'failed' &&
        !!props.message.retryPayload,
);
const canFork = computed(
    () =>
        props.message.status === 'complete' &&
        typeof props.message.backendMessageId === 'number' &&
        !props.message.approvalRequestId,
);
const approvalRequestKey = computed(() =>
    String(props.message.approvalRequestId ?? '').trim(),
);
const approvalIsPending = computed(() => {
    if (!approvalRequestKey.value) return false;
    const state = String(props.message.approvalState ?? '').trim();
    if (state === 'pending' || state === 'retrying') return true;
    if (state && !['pending', 'retrying'].includes(state)) return false;
    return props.message.status === 'attention';
});
const composerHandlesApproval = computed(
    () =>
        !!composerApprovalMessageId.value &&
        composerApprovalMessageId.value === props.message.id,
);
const showApprovalActions = computed(
    () => props.message.role === 'assistant' && approvalIsPending.value,
);
const showInlineApprovalActions = computed(
    () => showApprovalActions.value && !composerHandlesApproval.value,
);
const approvalNeedsAttention = computed(() =>
    ['pending', 'retrying', 'failed'].includes(
        String(props.message.approvalState ?? ''),
    ),
);
const approvalMetaLabel = computed(() => {
    switch (props.message.approvalState) {
        case 'pending':
            return 'Approval needed';
        case 'retrying':
            return 'Retrying approved tool';
        case 'failed':
            return 'Approval retry failed';
        case 'approved':
            return 'Approved';
        case 'denied':
            return 'Denied';
        case 'canceled':
            return 'Canceled';
        case 'expired':
            return 'Expired';
        default:
            return '';
    }
});
const hasMeta = computed(
    () =>
        !!timestamp.value ||
        !!props.message.pinned ||
        !!approvalMetaLabel.value,
);

const timestamp = computed(() => {
    if (!props.message.createdAt) return '';
    try {
        const d = new Date(props.message.createdAt);
        if (Number.isNaN(d.getTime())) return '';
        return d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
    } catch {
        return '';
    }
});

async function writeClipboard(value: string) {
    if (navigator?.clipboard?.writeText) {
        await navigator.clipboard.writeText(value);
        return;
    }
    const ta = document.createElement('textarea');
    ta.value = value;
    ta.style.position = 'fixed';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.select();
    document.execCommand('copy');
    document.body.removeChild(ta);
}

async function copyMessage() {
    if (!copyText.value) return;
    try {
        await writeClipboard(copyText.value);
        copied.value = true;
        if (copiedTimer) clearTimeout(copiedTimer);
        copiedTimer = setTimeout(() => {
            copied.value = false;
            copiedTimer = null;
        }, 1500);
    } catch {
        toast.add({
            title: 'Copy failed',
            description: 'The message could not be copied to the clipboard.',
            color: 'error',
            icon: 'i-pixelarticons-warning-box',
        });
    }
}

function togglePin() {
    const pinned = toggleMessagePin(props.message.id);
    toast.add({
        title: pinned ? 'Message pinned' : 'Message unpinned',
        description: pinned
            ? 'This message will stay marked in the conversation.'
            : 'This message is no longer pinned.',
        color: pinned ? 'success' : 'neutral',
        icon: pinned ? 'i-pixelarticons-bookmark' : 'i-pixelarticons-close-box',
    });
}

async function retryMessage() {
    if (!props.message.retryPayload || isStreaming.value) return;
    await send(props.message.retryPayload);
}

async function forkMessage() {
    if (!props.message.backendMessageId || forkBusy.value || isStreaming.value)
        return;
    forkBusy.value = true;
    try {
        const current = currentMessage();
        await sessionHistory.forkSession({
            sourceSessionKey:
                current.sourceSessionKey ||
                props.message.sourceSessionKey ||
                activeSession.value?.sessionKey ||
                '',
            anchorMessageId: props.message.backendMessageId,
            targetRunnerId: props.message.runnerId,
            title: 'Forked conversation',
        });
        toast.add({
            title: 'Conversation forked',
            description: 'Opened a new conversation from this message.',
            color: 'success',
            icon: 'i-pixelarticons-git-branch',
        });
    } catch (error) {
        toast.add({
            title: 'Fork failed',
            description:
                error && typeof error === 'object' && 'message' in error
                    ? String(
                          (error as { message?: unknown }).message ||
                              'Could not fork this message.',
                      )
                    : 'Could not fork this message.',
            color: 'error',
            icon: 'i-pixelarticons-warning-box',
        });
    } finally {
        forkBusy.value = false;
    }
}

async function retryApprovedRequest(
    explicitToken?: string,
    options: { allowWhileApprovalBusy?: boolean } = {},
) {
    const message = currentMessage();
    if (
        !message.retryPayload ||
        !canContinueApprovedRequest({
            isStreaming: isStreaming.value,
            approvalBusy: approvalBusy.value,
            allowWhileApprovalBusy: options.allowWhileApprovalBusy,
        })
    ) {
        return false;
    }
    const requestId = message.approvalRequestId;
    const token =
        explicitToken ??
        (requestId ? consumeIssuedApprovalToken(requestId) : undefined);
    if (!token) return false;

    const retryPayload = {
        ...message.retryPayload,
        approvalToken: token,
    };
    updateMessage(message.id, {
        approvalState: 'retrying',
        status: 'attention',
        retryPayload,
        error: undefined,
    });

    await send(retryPayload);

    const latest = currentMessage();
    const waitingAgain =
        latest.approvalState === 'pending' && !!latest.approvalRequestId;
    const retryFailed =
        latest.approvalState === 'failed' || latest.status === 'failed';
    if (!waitingAgain && !retryFailed) {
        markApprovalResolved(
            requestId,
            'approved',
            message.sourceSessionKey || activeSession.value?.sessionKey,
        );
    }
    return true;
}

function approvalErrorMessage(error: unknown) {
    return approvalActionErrorMessage(error);
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
    const message = currentMessage();
    const requestId = message.approvalRequestId;
    let status = approvalStatusFromError(error);
    if (!resolvedApprovalState(status) && requestId) {
        try {
            const approval = await fetchApproval(requestId);
            status = approval.status;
        } catch {
            // Keep the original error path if the status cannot be refreshed.
        }
    }
    const state = resolvedApprovalState(status);
    if (!state) return false;

    const description = resolvedApprovalMessage(status);
    markApprovalResolved(
        requestId,
        state,
        message.sourceSessionKey || activeSession.value?.sessionKey,
        description,
    );
    toast.add({
        title: 'Approval already handled',
        description,
        color: state === 'approved' ? 'success' : 'neutral',
        icon:
            state === 'approved'
                ? 'i-pixelarticons-check'
                : 'i-pixelarticons-info-box',
    });
    return true;
}

async function approveApproval(remember = false) {
    const message = currentMessage();
    if (!message.approvalRequestId || approvalBusy.value) return;
    approvalBusy.value = true;
    let retryAttempted = false;
    let approvalGranted = false;
    try {
        const approval = await approve(
            message.approvalRequestId,
            remember,
            remember
                ? 'approved and remembered from chat'
                : 'approved from chat',
        );
        approvalGranted = true;
        const approvalToken =
            consumeIssuedApprovalToken(message.approvalRequestId) ??
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
                message.approvalRequestId,
                'approved',
                message.sourceSessionKey || activeSession.value?.sessionKey,
            );
        }
    } catch (error) {
        if (!approvalGranted && (await resolveStaleApprovalAction(error)))
            return;
        const message = approvalErrorMessage(error);
        updateMessage(currentMessage().id, {
            approvalState: retryAttempted ? 'failed' : 'pending',
            status: retryAttempted ? 'failed' : 'attention',
            error: message,
        });
        toast.add({
            title: approvalGranted
                ? 'Approval retry failed'
                : 'Approval failed',
            description: message,
            color: 'error',
            icon: 'i-pixelarticons-warning-box',
        });
    } finally {
        approvalBusy.value = false;
    }
}

watch(
    () => {
        if (!props.message.approvalRequestId) return null;
        return [
            props.message.approvalState,
            props.message.retryPayload,
            isStreaming.value,
        ] as const;
    },
    (deps) => {
        if (!deps) return;
        const message = currentMessage();
        if (
            message.approvalState !== 'pending' ||
            !message.approvalRequestId ||
            !message.retryPayload ||
            approvalBusy.value ||
            isStreaming.value
        ) {
            return;
        }
        void retryApprovedRequest().catch((error) => {
            updateMessage(currentMessage().id, {
                approvalState: 'failed',
                status: 'failed',
                error: approvalErrorMessage(error),
            });
        });
    },
    { immediate: true },
);

onBeforeUnmount(() => {
    if (copiedTimer) clearTimeout(copiedTimer);
});

async function denyApproval() {
    if (!props.message.approvalRequestId || approvalBusy.value) return;
    approvalBusy.value = true;
    try {
        await deny(props.message.approvalRequestId);
        markApprovalResolved(
            props.message.approvalRequestId,
            'denied',
            props.message.sourceSessionKey || activeSession.value?.sessionKey,
        );
        toast.add({
            title: 'Approval denied',
            description: 'The request was denied.',
            color: 'neutral',
            icon: 'i-pixelarticons-close-box',
        });
    } catch (error) {
        if (await resolveStaleApprovalAction(error)) return;
        const message =
            error instanceof Error && error.message
                ? error.message
                : 'Could not deny this request.';
        updateMessage(props.message.id, {
            approvalState: 'pending',
            status: 'attention',
            error: message,
        });
        toast.add({
            title: 'Deny failed',
            description: message,
            color: 'error',
            icon: 'i-pixelarticons-warning-box',
        });
    } finally {
        approvalBusy.value = false;
    }
}

function formatBytes(size?: number): string {
    if (!size) return '';
    if (size < 1024) return `${size} B`;
    const units = ['KB', 'MB', 'GB', 'TB'];
    let value = size / 1024;
    let unitIndex = 0;
    while (value >= 1024 && unitIndex < units.length - 1) {
        value /= 1024;
        unitIndex += 1;
    }
    const precision = value >= 10 ? 0 : 1;
    return `${value.toFixed(precision)} ${units[unitIndex]}`;
}

function attachmentTooltip(attachment: ChatAttachment): string {
    const parts = [attachment.name];
    if (attachment.preview && attachment.preview !== attachment.name) {
        parts.push(attachment.preview);
    }
    return parts.join(' — ');
}
</script>

<style scoped>
.or3-msg {
    display: flex;
    width: 100%;
    min-width: 0;
}

.or3-msg--user {
    justify-content: flex-end;
}

.or3-msg__user-text {
    margin: 0;
    white-space: pre-line;
    line-height: 1.42;
}

.or3-msg__body {
    display: flex;
    flex-direction: column;
    gap: 0.45rem;
    min-width: 0;
    max-width: 100%;
}

.or3-msg--user .or3-msg__body {
    align-items: flex-end;
    max-width: 86%;
}

.or3-msg--assistant .or3-msg__body {
    align-items: stretch;
    flex: 1 1 auto;
    min-width: 0;
}

.or3-msg__bubble {
    border-radius: 1.25rem;
    padding: 0.85rem 1rem;
    border: 1px solid var(--or3-border);
    box-shadow: var(--or3-shadow-soft);
    min-width: 0;
    max-width: 100%;
    word-wrap: break-word;
    overflow-wrap: anywhere;
}

.or3-msg__bubble--assistant {
    background: var(--or3-surface);
    border-color: var(--or3-border);
    width: 100%;
}

.or3-msg__bubble--attention {
    border-color: color-mix(in srgb, #f59e0b 35%, var(--or3-border) 65%);
    box-shadow:
        var(--or3-shadow-soft),
        0 0 0 1px color-mix(in srgb, #f59e0b 12%, transparent);
}

.or3-msg__bubble--user {
    background: var(--or3-green-soft);
    border-color: color-mix(in srgb, var(--or3-green) 28%, white 72%);
    color: var(--or3-text);
    border-top-right-radius: 0.5rem;
}

.or3-msg--pinned .or3-msg__bubble {
    border-color: color-mix(
        in srgb,
        var(--or3-green) 38%,
        var(--or3-border) 62%
    );
    box-shadow:
        var(--or3-shadow-soft),
        0 0 0 1px color-mix(in srgb, var(--or3-green) 16%, transparent);
}

.or3-msg__actions {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    justify-content: flex-end;
    gap: 0.15rem;
    margin-top: 0.55rem;
    margin-right: -0.35rem;
}

.or3-msg__parts {
    display: flex;
    flex-direction: column;
    gap: 0.625rem;
}

.or3-msg__attachments {
    display: flex;
    flex-wrap: wrap;
    gap: 0.375rem;
    max-width: 100%;
    min-width: 0;
    margin-top: 0.5rem;
    overflow: hidden;
}

.or3-msg__attachment {
    display: inline-flex;
    align-items: center;
    gap: 0.4rem;
    max-width: 100%;
    min-width: 0;
    overflow: hidden;
    border-radius: 0.75rem;
    border: 1px solid color-mix(in srgb, var(--or3-border) 70%, transparent);
    background: color-mix(in srgb, var(--or3-surface) 85%, white 15%);
    padding: 0.35rem 0.6rem;
    color: var(--or3-text);
    box-shadow: 0 1px 2px color-mix(in srgb, var(--or3-border) 20%, transparent);
    transition:
        box-shadow 0.15s ease,
        border-color 0.15s ease;
    cursor: pointer;
}

.or3-msg__attachment:hover {
    border-color: color-mix(
        in srgb,
        var(--or3-green) 30%,
        var(--or3-border) 70%
    );
    box-shadow: 0 2px 6px color-mix(in srgb, var(--or3-border) 25%, transparent);
}

.or3-msg__attachment-icon-wrap {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 1.4rem;
    height: 1.4rem;
    border-radius: 0.45rem;
    background: color-mix(in srgb, var(--or3-green-soft) 80%, white 20%);
    color: var(--or3-green-dark);
    flex-shrink: 0;
}

.or3-msg__attachment-icon-wrap :deep(svg),
.or3-msg__attachment-icon-wrap :deep(.iconify) {
    width: 0.75rem;
    height: 0.75rem;
}

.or3-msg__attachment-label {
    min-width: 0;
    font-size: 0.75rem;
    font-weight: 500;
    color: var(--or3-text);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    line-height: 1.3;
}

.or3-msg--user .or3-msg__attachment {
    max-width: min(100%, 20rem);
    background: color-mix(in srgb, white 92%, var(--or3-green-soft) 8%);
    border-color: color-mix(
        in srgb,
        var(--or3-green) 18%,
        var(--or3-border) 82%
    );
}

.or3-msg--user .or3-msg__attachment:hover {
    border-color: color-mix(
        in srgb,
        var(--or3-green) 35%,
        var(--or3-border) 65%
    );
}

.or3-msg__notice {
    display: inline-flex;
    align-items: flex-start;
    gap: 0.45rem;
    margin-bottom: 0.8rem;
    padding: 0.65rem 0.8rem;
    border-radius: 0.9rem;
    font-size: 0.78rem;
    line-height: 1.45;
}

.or3-msg__notice--attention {
    background: color-mix(in srgb, #fef3c7 75%, white 25%);
    color: #92400e;
}

.or3-msg__approval {
    margin-bottom: 0.85rem;
    padding: 0.75rem 0.85rem;
    border-radius: 0.95rem;
    border: 1px solid color-mix(in srgb, #f59e0b 28%, var(--or3-border) 72%);
    background: color-mix(in srgb, #fffbeb 70%, var(--or3-surface) 30%);
}

.or3-msg__approval-head {
    display: flex;
    align-items: flex-start;
    gap: 0.65rem;
}

.or3-msg__approval-icon {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 2rem;
    height: 2rem;
    border-radius: 0.65rem;
    background: color-mix(in srgb, #1f1f1d 92%, transparent);
    color: #f1eddf;
    flex-shrink: 0;
}

.or3-msg__approval-title {
    margin: 0;
    font-size: 0.9rem;
    font-weight: 650;
    line-height: 1.35;
    color: var(--or3-text);
}

.or3-msg__approval-description {
    margin: 0.2rem 0 0;
    font-size: 0.78rem;
    line-height: 1.45;
    color: var(--or3-text-muted);
}

.or3-msg__approval-preview {
    margin: 0.65rem 0 0;
    padding: 0.55rem 0.65rem;
    border-radius: 0.7rem;
    border: 1px solid color-mix(in srgb, var(--or3-border) 85%, white 15%);
    background: color-mix(in srgb, var(--or3-surface) 88%, white 12%);
    font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
    font-size: 0.72rem;
    line-height: 1.45;
    color: var(--or3-green-dark);
    overflow-x: auto;
    white-space: pre-wrap;
    word-break: break-word;
}

.or3-msg__approval-preview--muted {
    font-family: inherit;
    color: var(--or3-text-muted);
    background: transparent;
    border-color: transparent;
    padding-left: 0;
    padding-right: 0;
}

.or3-msg__actions--with-meta {
    margin-top: 0.5rem;
}

.or3-msg__action {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 0.3rem;
    min-height: 1.75rem;
    border-radius: 0.5rem;
    border: 1px solid transparent;
    background: transparent;
    color: var(--or3-text-muted);
    padding: 0.3rem 0.5rem;
    font-size: 0.75rem;
    line-height: 1;
    opacity: 0.55;
    transition:
        color 0.15s ease,
        border-color 0.15s ease,
        background 0.15s ease,
        opacity 0.15s ease;
}

.or3-msg__action > span {
    font-weight: 500;
    letter-spacing: 0.01em;
}

.or3-msg__action:hover:not(:disabled),
.or3-msg__action:focus-visible {
    color: var(--or3-green-dark);
    background: color-mix(in srgb, var(--or3-green-soft) 55%, transparent);
    opacity: 1;
}

.or3-msg__action:focus-visible {
    outline: none;
    border-color: color-mix(in srgb, var(--or3-green) 32%, transparent);
}

.or3-msg__action--approve {
    color: var(--or3-green-dark);
    opacity: 0.85;
}

.or3-msg__action--approve:hover:not(:disabled),
.or3-msg__action--approve:focus-visible {
    background: color-mix(in srgb, var(--or3-green-soft) 80%, transparent);
    opacity: 1;
}

.or3-msg__action--remember {
    color: var(--or3-green-dark);
    border-color: color-mix(in srgb, var(--or3-green) 22%, transparent);
    opacity: 0.85;
}

.or3-msg__action--remember:hover:not(:disabled),
.or3-msg__action--remember:focus-visible {
    background: color-mix(in srgb, var(--or3-green-soft) 85%, transparent);
    opacity: 1;
}

.or3-msg__action--deny {
    color: var(--or3-danger);
    opacity: 0.7;
}

.or3-msg__action--deny:hover:not(:disabled),
.or3-msg__action--deny:focus-visible {
    color: var(--or3-danger);
    background: color-mix(in srgb, var(--or3-danger) 10%, transparent);
    opacity: 1;
}

.or3-msg__action:disabled {
    opacity: 0.3;
    cursor: default;
}

.or3-msg__action :deep(svg),
.or3-msg__action :deep(.iconify) {
    width: 0.85rem;
    height: 0.85rem;
}

.or3-msg--user .or3-msg__meta,
.or3-msg--assistant .or3-msg__meta {
    justify-content: flex-end;
}

.or3-msg__meta {
    display: inline-flex;
    align-items: center;
    flex-wrap: wrap;
    gap: 0.45rem;
    font-size: 0.6875rem;
    letter-spacing: 0.04em;
    color: var(--or3-text-muted);
    padding: 0 0.15rem;
    opacity: 0.78;
}

.or3-msg__meta-pin {
    display: inline-flex;
    align-items: center;
    gap: 0.2rem;
}

.or3-msg__thinking {
    display: inline-flex;
    align-items: center;
    gap: 0.3rem;
    padding: 0.125rem 0;
}

.or3-msg__dot {
    width: 0.4rem;
    height: 0.4rem;
    border-radius: 9999px;
    background: var(--or3-text-muted);
    opacity: 0.45;
    animation: or3-msg-dot 1.2s ease-in-out infinite;
}

.or3-msg__dot:nth-child(2) {
    animation-delay: 0.15s;
}
.or3-msg__dot:nth-child(3) {
    animation-delay: 0.3s;
}

@keyframes or3-msg-dot {
    0%,
    80%,
    100% {
        transform: scale(0.7);
        opacity: 0.35;
    }
    40% {
        transform: scale(1);
        opacity: 0.85;
    }
}

@media (prefers-reduced-motion: reduce) {
    .or3-msg__dot {
        animation: none;
        opacity: 0.6;
    }
    .or3-msg__meta {
        transition: none;
    }
}
</style>
