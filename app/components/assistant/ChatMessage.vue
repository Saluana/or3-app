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
                ]"
            >
                <template v-if="message.role !== 'user'">
                    <AssistantReasoningPanel
                        :content="message.reasoningText"
                        :pending="
                            message.status === 'streaming' && !message.content
                        "
                        :tool-calls="message.toolCalls || []"
                    />
                    <AssistantToolCallList
                        v-if="message.toolCalls?.length"
                        :tool-calls="message.toolCalls"
                    />
                    <AssistantActivityLog
                        v-if="message.activityLog?.length"
                        :items="message.activityLog"
                    />
                    <StreamingMarkdown
                        v-if="message.content"
                        :content="message.content"
                    />
                    <p
                        v-else-if="message.status === 'streaming'"
                        class="or3-msg__thinking"
                    >
                        <span class="or3-msg__dot" />
                        <span class="or3-msg__dot" />
                        <span class="or3-msg__dot" />
                    </p>
                </template>
                <template v-else>
                    <p
                        v-if="message.content"
                        class="whitespace-pre-wrap text-[0.9375rem] leading-6 text-(--or3-text)"
                    >
                        {{ message.content }}
                    </p>
                    <div
                        v-if="message.attachments?.length"
                        class="mt-2 flex flex-wrap gap-1.5"
                    >
                        <span
                            v-for="attachment in message.attachments"
                            :key="attachment.id"
                            class="inline-flex max-w-full items-center gap-1.5 rounded-full border border-(--or3-border) bg-white/65 px-2.5 py-1 text-[11px] text-(--or3-text)"
                        >
                            <Icon
                                :name="
                                    attachment.kind === 'text'
                                        ? 'i-pixelarticons-notebook'
                                        : 'i-pixelarticons-paperclip'
                                "
                                class="size-3 shrink-0"
                            />
                            <span class="truncate">{{
                                attachment.preview || attachment.name
                            }}</span>
                        </span>
                    </div>
                </template>
                <p
                    v-if="message.status === 'failed'"
                    class="mt-2 text-xs text-(--or3-danger)"
                >
                    {{ message.error || 'Message failed' }}
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
                        v-if="showApprovalActions"
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
                        v-if="showApprovalActions"
                        type="button"
                        class="or3-msg__action or3-msg__action--approve"
                        :disabled="approvalBusy"
                        aria-label="Approve request"
                        title="Approve request"
                        @click="approveApproval"
                    >
                        <Icon name="i-pixelarticons-check" class="size-4" />
                        <span>Approve</span>
                    </button>
                </div>
            </div>
            <div v-if="hasMeta" class="or3-msg__meta">
                <span v-if="message.pinned" class="or3-msg__meta-pin">
                    <Icon name="i-pixelarticons-bookmark" class="size-3" />
                    Saved
                </span>
                <span
                    v-if="message.approvalState === 'pending'"
                    class="or3-msg__meta-pin"
                >
                    <Icon name="i-pixelarticons-shield" class="size-3" />
                    Approval needed
                </span>
                <span v-if="timestamp">{{ timestamp }}</span>
            </div>
        </div>
    </article>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue';
import { useToast } from '@nuxt/ui/composables';
import { useApprovals } from '../../composables/useApprovals';
import { useAssistantStream } from '../../composables/useAssistantStream';
import { useChatSessions } from '../../composables/useChatSessions';
import type { ChatMessage } from '../../types/app-state';

const props = defineProps<{ message: ChatMessage }>();
const toast = useToast();
const { toggleMessagePin, updateMessage } = useChatSessions();
const { isStreaming, send } = useAssistantStream();
const { approve, deny } = useApprovals();
const copied = ref(false);
const approvalBusy = ref(false);
let copiedTimer: ReturnType<typeof setTimeout> | null = null;

const copyText = computed(() => props.message.content.trim());
const canCopy = computed(() => Boolean(copyText.value));
const canRetry = computed(
    () =>
        props.message.role === 'assistant' &&
        props.message.status === 'failed' &&
        !!props.message.retryPayload,
);
const showApprovalActions = computed(
    () =>
        props.message.role === 'assistant' &&
        props.message.approvalState === 'pending' &&
        !!props.message.approvalRequestId,
);
const hasMeta = computed(
    () =>
        !!timestamp.value ||
        !!props.message.pinned ||
        props.message.approvalState === 'pending',
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

async function approveApproval() {
    if (!props.message.approvalRequestId || approvalBusy.value) return;
    approvalBusy.value = true;
    try {
        await approve(props.message.approvalRequestId);
        updateMessage(props.message.id, { approvalState: 'approved' });
        toast.add({
            title: 'Approval granted',
            description: 'The request was approved.',
            color: 'success',
            icon: 'i-pixelarticons-check',
        });
    } catch (error) {
        toast.add({
            title: 'Approval failed',
            description:
                error instanceof Error && error.message
                    ? error.message
                    : 'Could not approve this request.',
            color: 'error',
            icon: 'i-pixelarticons-warning-box',
        });
    } finally {
        approvalBusy.value = false;
    }
}

async function denyApproval() {
    if (!props.message.approvalRequestId || approvalBusy.value) return;
    approvalBusy.value = true;
    try {
        await deny(props.message.approvalRequestId);
        updateMessage(props.message.id, { approvalState: 'denied' });
        toast.add({
            title: 'Approval denied',
            description: 'The request was denied.',
            color: 'neutral',
            icon: 'i-pixelarticons-close-box',
        });
    } catch (error) {
        toast.add({
            title: 'Deny failed',
            description:
                error instanceof Error && error.message
                    ? error.message
                    : 'Could not deny this request.',
            color: 'error',
            icon: 'i-pixelarticons-warning-box',
        });
    } finally {
        approvalBusy.value = false;
    }
}
</script>

<style scoped>
.or3-msg {
    display: flex;
    width: 100%;
}

.or3-msg--user {
    justify-content: flex-end;
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
    word-wrap: break-word;
    overflow-wrap: anywhere;
}

.or3-msg__bubble--assistant {
    background: var(--or3-surface);
    border-color: var(--or3-border);
    width: 100%;
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
