<template>
    <AppShell desktop-flush>
        <template #sidebar>
            <ChatSessionsSidebar
                :sessions="historySessions"
                :loading="historyLoading"
                :error="historyError"
                :active-session-key="activeSession?.sessionKey ?? null"
                @open="openHistorySession"
                @new="onNewSession"
                @refresh="refreshHistory"
                @rename="renameHistorySession"
                @archive="archiveHistorySession"
            />
        </template>

        <!-- Mobile body (default slot) -->
        <div class="or3-chat-shell or3-chat-shell--mobile">
            <div class="or3-chat-shell__header bg-transparent!">
                <header class="flex items-center justify-between gap-3 pb-5">
                    <div
                        class="flex items-center gap-3 outline-none or3-focus-ring rounded-2xl"
                        aria-label="Go to chat home"
                    >
                        <BrandMark size="lg" />
                    </div>
                    <div class="flex shrink-0 items-center gap-3 self-start">
                        <UButton
                            @click="openHistory"
                            class="or3-focus-ring or3-touch-target inline-flex size-12 items-center justify-center rounded-[1.35rem] border border-(--or3-border) bg-(--or3-surface) shadow-[0_1px_0_rgba(255,255,255,0.65)_inset,0_8px_20px_rgba(42,35,25,0.05)] transition hover:border-(--or3-green)/30 hover:bg-white/95"
                            aria-label="Open chat history"
                        >
                            <img
                                src="/icons/chat-history.webp"
                                alt=""
                                class="or3-header-action-icon"
                            />
                        </UButton>
                        <button
                            type="button"
                            class="or3-focus-ring or3-touch-target relative inline-flex size-12 items-center justify-center rounded-[1.35rem] border border-(--or3-border) bg-(--or3-surface) shadow-[0_1px_0_rgba(255,255,255,0.65)_inset,0_8px_20px_rgba(42,35,25,0.05)] transition hover:border-(--or3-green)/30 hover:bg-white/95"
                            :aria-label="
                                pendingCount
                                    ? `${pendingCount} approval requests waiting`
                                    : 'Open approval requests'
                            "
                            @click="approvalsOpen = true"
                        >
                            <img
                                src="/computer-icons/security.png"
                                alt=""
                                class="or3-header-action-icon or3-header-action-icon--approvals"
                            />
                            <span
                                v-if="pendingCount"
                                class="absolute -right-1 -top-1 min-w-4.5 rounded-full bg-(--or3-amber) px-1.5 py-0.5 text-center text-[10px] font-semibold leading-none text-white shadow-sm"
                                >{{
                                    pendingCount > 99 ? '99+' : pendingCount
                                }}</span
                            >
                        </button>
                        <NuxtLink
                            to="/settings"
                            class="or3-focus-ring or3-touch-target inline-flex size-12 items-center justify-center rounded-[1.35rem] border border-(--or3-border) bg-(--or3-surface) shadow-[0_1px_0_rgba(255,255,255,0.65)_inset,0_8px_20px_rgba(42,35,25,0.05)] transition hover:border-(--or3-green)/30 hover:bg-white/95"
                            aria-label="Open settings"
                        >
                            <img
                                src="/computer-icons/settings.png"
                                alt=""
                                class="or3-header-action-icon"
                            />
                        </NuxtLink>
                    </div>
                </header>
            </div>

            <div class="or3-chat-shell__body">
                <div v-if="!messages.length" class="or3-chat-shell__content">
                    <section class="or3-chat-empty">
                        <div class="or3-chat-empty__avatar">
                            <img
                                src="/computer-icons/chat-guy.webp"
                                alt="chat avatar"
                                class="or3-chat-empty__avatar-image"
                            />
                        </div>
                        <h1 class="or3-chat-empty__title">
                            Hi, I'm or3-intern.
                        </h1>
                        <p class="or3-chat-empty__subtitle">
                            Ask me about your computer, attach files for
                            context, or tap a quick prompt below to get
                            started.
                        </p>
                        <QuickPromptChips
                            class="or3-chat-empty__chips"
                            @select="onPromptSelect"
                        />
                        <div class="or3-chat-empty__actions">
                            <UButton
                                icon="i-pixelarticons-book"
                                color="neutral"
                                variant="soft"
                                @click="openPromptGallery"
                            >
                                Open prompt library
                            </UButton>
                            <UButton
                                icon="i-pixelarticons-edit-box"
                                color="neutral"
                                variant="ghost"
                                @click="openFileEditor"
                            >
                                Edit workspace files
                            </UButton>
                        </div>
                    </section>
                </div>
                <div
                    v-else
                    class="or3-chat-shell__content or3-chat-shell__content--virtualized"
                >
                    <ChatMessageList
                        :key="activeSession?.id ?? 'active-thread'"
                        ref="mobileMessageList"
                        :messages="messages"
                        class="or3-chat-shell__message-list"
                        @scroll-state="updateScrollState"
                    />
                </div>
            </div>

            <div class="or3-chat-shell__fade" aria-hidden="true" />

            <div class="or3-chat-shell__composer">
                <div class="or3-chat-shell__composer-inner">
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
                            @click="scrollMessagesToBottom"
                        >
                            Scroll to bottom
                        </UButton>
                    </div>
                    <div class="or3-chat-shell__status">
                        <AssistantStatusIndicator :active="isStreaming" />
                    </div>
                    <AssistantComposer
                        v-model="draft"
                        v-model:mode="chatMode"
                        v-model:selected-runner-id="selectedRunnerId"
                        v-model:selected-runner-model="selectedRunnerModel"
                        v-model:selected-runner-thinking-level="selectedRunnerThinkingLevel"
                        :streaming="isStreaming"
                        :runners="runners"
                        @send="sendWithMode"
                        @stop="stop"
                    />
                </div>
            </div>
        </div>

        <!-- Desktop body -->
        <template #desktop>
            <div class="or3-chat-desktop">
                <div class="or3-chat-desktop__header">
                    <div class="or3-chat-desktop__header-main">
     
                    </div>
                    <div class="or3-chat-desktop__header-actions">
                        <UTooltip text="Approvals">
                        <UButton
                            icon="i-pixelarticons-shield"
                            color="primary"
                            variant="subtle"
                            class="backdrop-blur flex items-center justify-center w-12 h-12 rounded-full relative"
                            @click="approvalsOpen = true"
                        >
                            <span
                                v-if="pendingCount"
                                class="or3-desktop-badge or3-desktop-badge--amber ml-2"
                            >
                                {{ pendingCount > 99 ? '99+' : pendingCount }}
                            </span>
                        </UButton>
                        </UTooltip>
                    </div>
                </div>

                <div class="or3-chat-desktop__body">
                    <div
                        v-if="!messages.length"
                        class="or3-chat-desktop__empty"
                    >
                        <div class="or3-chat-empty__avatar">
                            <img
                                src="/computer-icons/chat-guy.webp"
                                alt="chat avatar"
                                class="or3-chat-empty__avatar-image"
                            />
                        </div>
                        <h2 class="or3-chat-empty__title">
                            Hi, I'm or3-intern.
                        </h2>
                        <p class="or3-chat-empty__subtitle">
                            Ask me anything about your computer, attach files
                            for context, or pick a quick prompt to get going.
                        </p>
                        <QuickPromptChips
                            class="or3-chat-empty__chips"
                            @select="onPromptSelect"
                        />
                        <div class="or3-chat-empty__actions">
                            <UButton
                                icon="i-pixelarticons-book"
                                color="neutral"
                                variant="soft"
                                @click="openPromptGallery"
                            >
                                Open prompt library
                            </UButton>
                            <UButton
                                icon="i-pixelarticons-edit-box"
                                color="neutral"
                                variant="ghost"
                                @click="openFileEditor"
                            >
                                Edit workspace files
                            </UButton>
                        </div>
                    </div>
                    <div v-else class="or3-chat-desktop__messages">
                        <ChatMessageList
                            :key="activeSession?.id ?? 'active-thread'"
                            ref="desktopMessageList"
                            :messages="messages"
                            class="or3-chat-desktop__message-list"
                            @scroll-state="updateScrollState"
                        />
                    </div>
                </div>

                <div class="or3-chat-desktop__composer">
                    <div class="or3-chat-desktop__composer-inner">
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
                                @click="scrollMessagesToBottom"
                            >
                                Scroll to bottom
                            </UButton>
                        </div>
                        <div class="or3-chat-desktop__status">
                            <AssistantStatusIndicator :active="isStreaming" />
                        </div>
                        <AssistantComposer
                            v-model="draft"
                            v-model:mode="chatMode"
                            v-model:selected-runner-id="selectedRunnerId"
                            v-model:selected-runner-model="selectedRunnerModel"
                            v-model:selected-runner-thinking-level="selectedRunnerThinkingLevel"
                            :streaming="isStreaming"
                            :runners="runners"
                            @send="sendWithMode"
                            @stop="stop"
                        />
                    </div>
                </div>
            </div>

            <ApprovalsSlideover v-model:open="approvalsOpen" />
        </template>

        <SessionHistoryPanel
            v-model:open="historyOpen"
            :sessions="historySessions"
            :loading="historyLoading"
            :error="historyError"
            @refresh="refreshHistory"
            @open-session="openHistorySession"
            @rename-session="renameHistorySession"
            @archive-session="archiveHistorySession"
        />

        <ApprovalsSlideover v-model:open="approvalsOpen" />
    </AppShell>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import type { ChatSessionMeta } from '~/types/or3-api';

const chat = useChatSessions();
const {
    activeSession,
    messages,
    draft,
    messageCount,
    newSession,
    setSessionRunnerMetadata,
} = chat;
const { isStreaming, chatMode, send, stop } = useAssistantStream();
const {
    selectableRunners,
    defaultRunner,
    getRunner,
    refresh: refreshRunners,
} = useChatRunners();
const sessionHistory = useSessionHistory();
const router = useRouter();
const { pendingCount } = useApprovals();

const selectedRunnerId = ref('or3-intern');
const selectedRunnerModel = ref('');
const selectedRunnerThinkingLevel = ref('');
const approvalsOpen = ref(false);
const mobileMessageList = ref<{
    scrollToBottom?: () => void;
} | null>(null);
const desktopMessageList = ref<{
    scrollToBottom?: () => void;
} | null>(null);
const distanceFromBottom = ref(0);
const isMessageListScrollable = ref(false);
const liveChannelController = ref<AbortController | null>(null);

const showScrollToBottom = computed(
    () => isMessageListScrollable.value && distanceFromBottom.value > 1,
);
const scrollToBottomOpacity = computed(() =>
    Math.min(1, distanceFromBottom.value / 150),
);

function onPromptSelect(value: string) {
    draft.value = value;
}

function openPromptGallery() {
    void router.push('/prompts');
}

function openFileEditor() {
    void router.push('/computer');
}

function updateScrollState(state: {
    distanceFromBottom: number;
    isScrollable: boolean;
}) {
    distanceFromBottom.value = state.distanceFromBottom;
    isMessageListScrollable.value = state.isScrollable;
}

function scrollMessagesToBottom() {
    mobileMessageList.value?.scrollToBottom?.();
    desktopMessageList.value?.scrollToBottom?.();
}

const runners = computed(() => selectableRunners.value);
const historyOpen = sessionHistory.historyOpen;
const historySessions = sessionHistory.sessions;
const historyLoading = sessionHistory.loading;
const historyError = sessionHistory.error;

function openHistory() {
    historyOpen.value = true;
    void sessionHistory.refresh();
}

function refreshHistory(options: { q?: string; includeArchived?: boolean }) {
    void sessionHistory.refresh(options);
}

function openHistorySession(session: ChatSessionMeta) {
    void sessionHistory.openSession(session).then(() => {
        selectedRunnerId.value = session.runner_id || 'or3-intern';
    });
}

function renameHistorySession(session: ChatSessionMeta, title: string) {
    void sessionHistory.rename(session.session_key, title);
}

function archiveHistorySession(session: ChatSessionMeta, archived: boolean) {
    void sessionHistory.archive(session.session_key, archived);
}

function isExternalChannelSession(sessionKey?: string | null) {
    return /^(telegram|discord|slack|whatsapp|email):/.test(
        String(sessionKey || '').trim(),
    );
}

function stopLiveChannelStream() {
    liveChannelController.value?.abort();
    liveChannelController.value = null;
}

function startLiveChannelStream(sessionKey?: string | null) {
    stopLiveChannelStream();
    if (!isExternalChannelSession(sessionKey)) return;
    const controller = new AbortController();
    liveChannelController.value = controller;
    void sessionHistory
        .hydrate(sessionKey as string)
        .catch(() => null)
        .then(() => {
            if (controller.signal.aborted) return;
            return sessionHistory.followLiveMessages(
                sessionKey as string,
                controller.signal,
            );
        })
        .catch((error) => {
            if (controller.signal.aborted) return;
            console.warn('live channel stream stopped', error);
        });
}

function onNewSession() {
    const session = newSession('New conversation');
    const runner = getRunner(selectedRunnerId.value);
    if (runner) {
        setSessionRunnerMetadata(session.id, {
            runnerId: runner.id,
            runnerLabel: runner.display_name || runner.id,
            runnerModel: selectedRunnerModel.value || runner.default_model,
            runnerContinuationMode: continuationModeForRunner(runner.id),
        });
    }
}

function continuationModeForRunner(runnerId?: string | null) {
    const runner = getRunner(runnerId || undefined);
    const caps = runner?.chat_capabilities || runner?.supports?.chat;
    return caps?.chatNativeSession ? 'native' : 'replay';
}

watch(
    () => activeSession.value?.runnerId,
    (runnerId) => {
        selectedRunnerId.value =
            runnerId || defaultRunner.value?.id || 'or3-intern';
    },
    { immediate: true },
);

watch(
    () => activeSession.value?.id,
    () => {
        distanceFromBottom.value = 0;
        isMessageListScrollable.value = false;
    },
);

watch(
    () => activeSession.value?.sessionKey,
    (sessionKey) => startLiveChannelStream(sessionKey),
    { immediate: true },
);

watch(selectedRunnerId, (runnerId, previous) => {
    if (!activeSession.value) return;
    if (!previous || runnerId === activeSession.value.runnerId) return;
    const runner = getRunner(runnerId);
    if (!runner) return;
    if (messageCount(activeSession.value.id) > 0) {
        const shouldSwitch = window.confirm(
            'Start a new conversation for this runner? Existing conversations keep their original runner.',
        );
        if (!shouldSwitch) {
            selectedRunnerId.value =
                activeSession.value.runnerId || 'or3-intern';
            return;
        }
        const session = newSession('New conversation');
        selectedRunnerModel.value = runner.default_model || runner.runtime?.default_model || '';
        selectedRunnerThinkingLevel.value = '';
        setSessionRunnerMetadata(session.id, {
            runnerId,
            runnerLabel: runner.display_name || runner.id,
            runnerModel: selectedRunnerModel.value || undefined,
            runnerContinuationMode: continuationModeForRunner(runnerId),
        });
        return;
    }
    selectedRunnerModel.value = runner.default_model || runner.runtime?.default_model || '';
    selectedRunnerThinkingLevel.value = '';
    setSessionRunnerMetadata(activeSession.value.id, {
        runnerId,
        runnerLabel: runner.display_name || runner.id,
        runnerModel: selectedRunnerModel.value || undefined,
        runnerContinuationMode: continuationModeForRunner(runnerId),
    });
});

function sendWithMode(payload: Parameters<typeof send>[0]) {
    const runner = getRunner(selectedRunnerId.value);
    const sessionContinuationMode =
        activeSession.value?.runnerContinuationMode ||
        continuationModeForRunner(selectedRunnerId.value);
    if (typeof payload === 'string') {
        void send({
            text: payload,
            transportText: payload,
            mode: chatMode.value,
            runnerId: selectedRunnerId.value,
            runnerModel: selectedRunnerModel.value || runner?.default_model,
            runnerThinkingLevel: selectedRunnerThinkingLevel.value || undefined,
            runnerLabel: runner?.display_name || selectedRunnerId.value,
            runnerContinuationMode: sessionContinuationMode,
        });
        return;
    }
    void send({
        ...payload,
        mode: payload.mode ?? chatMode.value,
        runnerId: payload.runnerId || selectedRunnerId.value,
        runnerModel:
            payload.runnerModel ||
            selectedRunnerModel.value ||
            runner?.default_model,
        runnerThinkingLevel:
            payload.runnerThinkingLevel ||
            selectedRunnerThinkingLevel.value ||
            undefined,
        runnerLabel:
            payload.runnerLabel ||
            runner?.display_name ||
            selectedRunnerId.value,
        runnerContinuationMode:
            payload.runnerContinuationMode || sessionContinuationMode,
    });
}

onMounted(() => {
    void refreshRunners();
    void sessionHistory.refresh();
});

onBeforeUnmount(() => {
    stopLiveChannelStream();
});
</script>

<style scoped>
.or3-chat-shell__status {
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

.or3-header-action-icon {
    display: block;
    width: auto;
    height: 22px;
    max-width: 24px;
    object-fit: contain;
    image-rendering: pixelated;
}

.or3-header-action-icon--approvals {
    height: 24px;
    max-width: 22px;
}
</style>
