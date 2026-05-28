<template>
    <Or3Scroll
        ref="scroller"
        :items="messages"
        item-key="id"
        :estimate-height="80"
        :overscan="3000"
        :maintain-bottom="true"
        :bottom-threshold="5"
        :padding-top="72"
        :padding-bottom="effectivePaddingBottom"
        class="or3-chat-message-list"
        @scroll="onScroll"
    >
        <template #default="{ item }">
            <div
                :class="[
                    'or3-chat-message-list__item',
                    item.id === lastMessageId
                        ? 'or3-chat-message-list__item--last'
                        : '',
                ]"
            >
                <ChatMessage
                    v-if="messageNeedsLiveRender(item)"
                    :message="item"
                />
                <ChatMessage
                    v-else
                    v-memo="messageMemoDeps(item)"
                    :message="item"
                />
            </div>
        </template>
    </Or3Scroll>
</template>

<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, provide, ref, watch } from 'vue';
import { Or3Scroll } from 'or3-scroll';
import { useApprovals } from '../../composables/useApprovals';
import { useAssistantStream } from '../../composables/useAssistantStream';
import { useChatSessions } from '../../composables/useChatSessions';
import { useSessionHistory } from '../../composables/useSessionHistory';
import type { ChatMessage } from '../../types/app-state';
import {
    CHAT_MESSAGE_ACTIONS_KEY,
    type ChatMessageActionsContext,
} from '../../utils/chat/chat-message-actions';

const props = withDefaults(
    defineProps<{
        messages: ChatMessage[];
        paddingBottom?: number;
        keyboardPaddingBottom?: number;
        keyboardOpen?: boolean;
    }>(),
    {
        paddingBottom: 16,
        keyboardPaddingBottom: 16,
        keyboardOpen: false,
    },
);
const emit = defineEmits<{
    (
        e: 'scroll-state',
        state: { distanceFromBottom: number; isScrollable: boolean },
    ): void;
}>();

const chat = useChatSessions();
const { isStreaming, send } = useAssistantStream();
const sessionHistory = useSessionHistory();
const { approve, deny, fetchApproval, consumeIssuedApprovalToken } =
    useApprovals();

const messageActions: ChatMessageActionsContext = {
    activeSession: chat.activeSession,
    isStreaming,
    findMessageById: chat.findMessageById,
    markApprovalResolved: chat.markApprovalResolved,
    updateMessage: chat.updateMessage,
    toggleMessagePin: chat.toggleMessagePin,
    send,
    forkSession: sessionHistory.forkSession,
    approve,
    deny,
    fetchApproval,
    consumeIssuedApprovalToken,
};
provide(CHAT_MESSAGE_ACTIONS_KEY, messageActions);

type ScrollApi = {
    scrollToBottom?: (opts?: { smooth?: boolean }) => void;
    reset?: () => void;
    refreshMeasurements?: () => void;
};

const scroller = ref<ScrollApi | null>(null);
const distanceFromBottom = ref(0);
const isScrollable = ref(false);

const lastMessageId = computed(() => {
    const lastMessage = props.messages[props.messages.length - 1];
    return lastMessage?.id ?? null;
});

function messageNeedsLiveRender(message: ChatMessage) {
    return (
        message.status === 'streaming' ||
        message.status === 'attention' ||
        Boolean(
            message.toolCalls?.some((call) => call.status !== 'complete'),
        )
    );
}

function toolStateSignature(message: ChatMessage) {
    return (message.toolCalls ?? [])
        .map(
            (call) =>
                `${call.id}:${call.status}:${call.result ?? ''}:${call.error ?? ''}`,
        )
        .join('|');
}

function partStateSignature(message: ChatMessage) {
    return (message.parts ?? [])
        .map(
            (part) =>
                `${part.id}:${part.type}:${part.status ?? ''}:${part.content ?? ''}`,
        )
        .join('|');
}

function messageMemoDeps(message: ChatMessage) {
    return [
        message.id,
        message.status,
        message.content,
        message.error,
        message.approvalState,
        message.approvalRequestId,
        toolStateSignature(message),
        partStateSignature(message),
    ];
}

const effectivePaddingBottom = computed(() =>
    props.keyboardOpen ? props.keyboardPaddingBottom : props.paddingBottom,
);

function scrollToBottom() {
    scroller.value?.scrollToBottom?.({ smooth: true });
}

function jumpToBottom() {
    scroller.value?.scrollToBottom?.();
}

function onScroll(payload: {
    scrollTop: number;
    scrollHeight: number;
    clientHeight: number;
    isAtBottom: boolean;
}) {
    distanceFromBottom.value =
        payload.scrollHeight - payload.scrollTop - payload.clientHeight;
    isScrollable.value = payload.scrollHeight > payload.clientHeight;
    emit('scroll-state', {
        distanceFromBottom: distanceFromBottom.value,
        isScrollable: isScrollable.value,
    });
}

let jumpToBottomScheduled = false;
let jumpToBottomRaf = 0;

function scheduleJumpToBottom() {
    if (jumpToBottomScheduled) return;
    jumpToBottomScheduled = true;
    void nextTick(() => {
        jumpToBottomScheduled = false;
        scroller.value?.reset?.();
        scroller.value?.refreshMeasurements?.();
        jumpToBottom();
        if (typeof requestAnimationFrame !== 'function') return;
        if (jumpToBottomRaf) cancelAnimationFrame(jumpToBottomRaf);
        jumpToBottomRaf = requestAnimationFrame(() => {
            jumpToBottomRaf = 0;
            scroller.value?.refreshMeasurements?.();
            jumpToBottom();
        });
    });
}

onBeforeUnmount(() => {
    if (jumpToBottomRaf) cancelAnimationFrame(jumpToBottomRaf);
});

onMounted(() => {
    scheduleJumpToBottom();
});

watch(
    () => props.messages[props.messages.length - 1]?.id,
    (nextId, previousId) => {
        if (
            previousId &&
            nextId !== previousId &&
            distanceFromBottom.value > 24
        ) {
            return;
        }
        scheduleJumpToBottom();
    },
);

defineExpose({ scrollToBottom, jumpToBottom });
</script>

<style scoped>
.or3-chat-message-list {
    width: 100%;
    height: 100%;
}

.or3-chat-message-list__item {
    padding-bottom: 1.25rem;
}

.or3-chat-message-list__item--last {
    padding-bottom: 1.25rem;
}
</style>
