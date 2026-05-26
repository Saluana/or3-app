<template>
    <div :class="rootClass">
        <slot name="header" />

        <div :class="bodyClass">
            <div v-if="showWelcome" :class="contentClass">
                <WelcomeCard
                    :can-host-locally="canHostLocally"
                    @setup-host="emit('setup-host')"
                    @pair-device="emit('pair-device')"
                    @learn-more="emit('learn-more')"
                />
            </div>
            <div v-else-if="!messages.length" :class="contentClass">
                <section class="or3-chat-empty">
                    <div class="or3-chat-empty__avatar">
                        <img
                            src="/computer-icons/chat-guy.webp"
                            alt="chat avatar"
                            class="or3-chat-empty__avatar-image"
                        />
                    </div>
                    <component :is="emptyTitleTag" class="or3-chat-empty__title">
                        Hi, I'm or3-intern.
                    </component>
                    <p class="or3-chat-empty__subtitle">
                        {{
                            variant === 'mobile'
                                ? 'Ask me about your computer, attach files for context, or tap a quick prompt below to get started.'
                                : 'Ask me anything about your computer, attach files for context, or pick a quick prompt to get going.'
                        }}
                    </p>
                    <QuickPromptChips
                        class="or3-chat-empty__chips"
                        @select="(value: string) => emit('prompt-select', value)"
                    />
                    <div class="or3-chat-empty__actions">
                        <UButton
                            icon="i-pixelarticons-book"
                            :color="variant === 'mobile' ? 'primary' : 'neutral'"
                            variant="soft"
                            @click="emit('open-prompt-gallery')"
                        >
                            Open prompt library
                        </UButton>
                        <UButton
                            icon="i-pixelarticons-edit-box"
                            :color="variant === 'mobile' ? 'primary' : 'neutral'"
                            variant="ghost"
                            @click="emit('open-file-editor')"
                        >
                            Edit workspace files
                        </UButton>
                    </div>
                </section>
            </div>
            <div
                v-else
                :class="[
                    contentClass,
                    variant === 'mobile'
                        ? 'or3-chat-shell__content--virtualized'
                        : '',
                ]"
            >
                <ChatMessageList
                    :key="messageListKey"
                    ref="messageListRef"
                    :messages="messages"
                    :padding-bottom="messageListPaddingBottom"
                    :keyboard-padding-bottom="messageListKeyboardPaddingBottom"
                    :keyboard-open="keyboardOpen"
                    :class="messageListClass"
                    @scroll-state="(state) => emit('scroll-state', state)"
                />
            </div>
        </div>

        <div
            v-if="variant === 'mobile'"
            class="or3-chat-shell__fade"
            aria-hidden="true"
        />

        <div :class="composerOuterClass">
            <div :class="composerInnerClass">
                <div
                    v-show="showScrollToBottom"
                    class="or3-chat-scroll-jump"
                    :style="{ opacity: scrollToBottomOpacity }"
                >
                    <UButton
                        icon="i-pixelarticons-arrow-down"
                        size="sm"
                        color="primary"
                        variant="solid"
                        class="or3-chat-scroll-jump__button"
                        @click="scrollToBottom"
                    >
                        Scroll to bottom
                    </UButton>
                </div>
                <div :class="statusClass">
                    <AssistantStatusIndicator :active="isStreaming" />
                </div>
                <AssistantComposerApprovalBar
                    v-if="pendingApprovalMessage"
                    :message="pendingApprovalMessage"
                />
                <AssistantComposer
                    v-model="draft"
                    v-model:mode="chatMode"
                    v-model:selected-runner-id="selectedRunnerId"
                    v-model:selected-runner-model="selectedRunnerModel"
                    v-model:selected-runner-thinking-level="selectedRunnerThinkingLevel"
                    :streaming="isStreaming"
                    :runners="runners"
                    @send="(payload) => emit('send', payload)"
                    @stop="emit('stop')"
                />
            </div>
        </div>
    </div>
</template>

<script setup lang="ts">
import { computed, provide, ref } from 'vue';
import type { ChatMessage } from '~/types/app-state';
import {
    COMPOSER_APPROVAL_MESSAGE_ID_KEY,
    findPendingApprovalMessage,
} from '~/utils/chat/pending-approval-message';
import type { ChatRunnerInfo } from '~/types/or3-api';
import type { AssistantSendPayload } from '~/types/app-state';

const draft = defineModel<string>('draft', { required: true });
const chatMode = defineModel<'ask' | 'work' | 'admin'>('chatMode', {
    required: true,
});
const selectedRunnerId = defineModel<string>('selectedRunnerId', {
    required: true,
});
const selectedRunnerModel = defineModel<string>('selectedRunnerModel', {
    required: true,
});
const selectedRunnerThinkingLevel = defineModel<string>(
    'selectedRunnerThinkingLevel',
    { required: true },
);

const props = withDefaults(
    defineProps<{
        variant: 'mobile' | 'desktop';
        showWelcome: boolean;
        messages: ChatMessage[];
        messageListKey?: string;
        isStreaming: boolean;
        runners: ChatRunnerInfo[];
        canHostLocally: boolean;
        keyboardOpen?: boolean;
        showScrollToBottom: boolean;
        scrollToBottomOpacity: number;
    }>(),
    {
        messageListKey: 'active-thread',
        keyboardOpen: false,
    },
);

const emit = defineEmits<{
    send: [payload: string | AssistantSendPayload];
    stop: [];
    'scroll-state': [
        state: { distanceFromBottom: number; isScrollable: boolean },
    ];
    'prompt-select': [value: string];
    'open-prompt-gallery': [];
    'open-file-editor': [];
    'setup-host': [];
    'pair-device': [];
    'learn-more': [];
}>();

const messageListRef = ref<{ scrollToBottom?: () => void } | null>(null);

const pendingApprovalMessage = computed(() =>
    findPendingApprovalMessage(props.messages),
);

provide(
    COMPOSER_APPROVAL_MESSAGE_ID_KEY,
    computed(() => pendingApprovalMessage.value?.id ?? ''),
);

const rootClass = computed(() =>
    props.variant === 'mobile' ? 'or3-chat-shell or3-chat-shell--mobile' : 'or3-chat-desktop',
);
const bodyClass = computed(() =>
    props.variant === 'mobile' ? 'or3-chat-shell__body' : 'or3-chat-desktop__body',
);
const contentClass = computed(() => {
    if (props.variant === 'mobile') return 'or3-chat-shell__content';
    if (!props.messages.length) return 'or3-chat-desktop__empty';
    return 'or3-chat-desktop__messages';
});
const composerOuterClass = computed(() =>
    props.variant === 'mobile'
        ? 'or3-chat-shell__composer'
        : 'or3-chat-desktop__composer',
);
const composerInnerClass = computed(() =>
    props.variant === 'mobile'
        ? 'or3-chat-shell__composer-inner'
        : 'or3-chat-desktop__composer-inner',
);
const statusClass = computed(() =>
    props.variant === 'mobile'
        ? 'or3-chat-shell__status'
        : 'or3-chat-desktop__status',
);
const messageListClass = computed(() =>
    props.variant === 'mobile'
        ? 'or3-chat-shell__message-list'
        : 'or3-chat-desktop__message-list',
);
const messageListPaddingBottom = computed(() =>
    props.variant === 'mobile' ? 256 : 24,
);
const messageListKeyboardPaddingBottom = computed(() =>
    props.variant === 'mobile' ? 112 : 24,
);
const emptyTitleTag = computed(() =>
    props.variant === 'mobile' ? 'h1' : 'h2',
);

function scrollToBottom() {
    messageListRef.value?.scrollToBottom?.();
}

defineExpose({ scrollToBottom });
</script>

<style scoped>
.or3-chat-shell__status,
.or3-chat-desktop__status {
    display: flex;
    justify-content: center;
    pointer-events: none;
}

.or3-chat-shell__composer-inner,
.or3-chat-desktop__composer-inner {
    position: relative;
}

.or3-chat-scroll-jump {
    position: absolute;
    left: 0;
    right: 0;
    bottom: 100%;
    margin-bottom: 0.65rem;
    display: flex;
    justify-content: center;
    pointer-events: none;
    transition: opacity 160ms ease;
}

.or3-chat-scroll-jump__button {
    pointer-events: auto;
    border-radius: 9999px !important;
    border: 1px solid var(--or3-border) !important;
    background: color-mix(in srgb, var(--or3-surface) 92%, white 8%) !important;
    color: var(--or3-text) !important;
    box-shadow:
        0 0.65rem 1.5rem rgba(48, 40, 29, 0.12),
        inset 0 1px 0 rgba(255, 255, 255, 0.75) !important;
}

.or3-chat-empty__actions {
    display: flex;
    flex-wrap: wrap;
    justify-content: center;
    gap: 0.75rem;
    margin-top: 1rem;
}
</style>
