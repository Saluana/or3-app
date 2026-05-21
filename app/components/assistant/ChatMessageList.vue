<template>
    <Or3Scroll
        ref="scroller"
        :items="messages"
        item-key="id"
        :estimate-height="112"
        :overscan="400"
        :maintain-bottom="true"
        :bottom-threshold="24"
        :autoscroll-threshold="2"
        :tail-count="4"
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
                <ChatMessage :message="item" />
            </div>
        </template>
    </Or3Scroll>
</template>

<script setup lang="ts">
import { computed, nextTick, onMounted, ref, watch } from 'vue';
import { Or3Scroll } from 'or3-scroll';
import type { ChatMessage } from '../../types/app-state';

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

function scheduleJumpToBottom() {
    void nextTick(() => {
        scroller.value?.reset?.();
        scroller.value?.refreshMeasurements?.();
        jumpToBottom();
        if (typeof requestAnimationFrame !== 'function') return;
        requestAnimationFrame(() => {
            scroller.value?.refreshMeasurements?.();
            jumpToBottom();
            requestAnimationFrame(() => {
                scroller.value?.refreshMeasurements?.();
                jumpToBottom();
            });
        });
    });
}

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
