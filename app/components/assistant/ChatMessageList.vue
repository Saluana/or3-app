<template>
    <Or3Scroll
        :items="messages"
        item-key="id"
        :estimate-height="112"
        :overscan="400"
        :maintain-bottom="true"
        :bottom-threshold="24"
        :autoscroll-threshold="2"
        :tail-count="4"
        :padding-top="24"
        class="or3-chat-message-list"
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
import { computed } from 'vue';
import { Or3Scroll } from 'or3-scroll';
import type { ChatMessage } from '../../types/app-state';

const props = defineProps<{ messages: ChatMessage[] }>();

const lastMessageId = computed(() => {
    const lastMessage = props.messages[props.messages.length - 1];
    return lastMessage?.id ?? null;
});
</script>

<style scoped>
.or3-chat-message-list {
    width: 100%;
    height: 100%;
    --or3-chat-bottom-gap: 1rem;
    --or3-chat-bottom-gap-keyboard: 6rem;
}

.or3-chat-message-list__item {
    padding-bottom: 1.25rem;
}

.or3-chat-message-list__item--last {
    padding-bottom: calc(var(--or3-safe-bottom) + var(--or3-chat-bottom-gap));
}

html.or3-keyboard-open .or3-chat-message-list__item--last {
    padding-bottom: calc(
        var(--or3-safe-bottom) + var(--or3-chat-bottom-gap-keyboard)
    );
}

@media (max-width: 767px) {
    body:has(
            input:focus,
            textarea:focus,
            select:focus,
            [contenteditable='true']:focus,
            .ProseMirror:focus
        )
        .or3-chat-message-list__item--last {
        padding-bottom: calc(
            var(--or3-safe-bottom) + var(--or3-chat-bottom-gap-keyboard)
        );
    }
}
</style>
