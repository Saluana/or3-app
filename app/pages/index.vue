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
                @refresh="() => refreshHistory({})"
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
                            <RetroIcon
                                name="i-pixelarticons-sparkles"
                                size="lg"
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
                        :messages="messages"
                        class="or3-chat-shell__message-list"
                    />
                </div>
            </div>

            <div class="or3-chat-shell__fade" aria-hidden="true" />

            <div class="or3-chat-shell__composer">
                <div class="or3-chat-shell__composer-inner">
                    <div class="or3-chat-shell__status">
                        <AssistantStatusIndicator :active="isStreaming" />
                    </div>
                    <AssistantComposer
                        v-model="draft"
                        v-model:mode="chatMode"
                        v-model:selected-runner-id="selectedRunnerId"
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
                        <h1 class="or3-chat-desktop__title">
                            {{ activeSession?.title || 'New conversation' }}
                        </h1>
                        <p class="or3-chat-desktop__subtitle">
                            <span
                                v-if="activeSession?.runnerLabel"
                                class="or3-chat-desktop__runner-label"
                            >
                                <span class="or3-live-dot" aria-hidden="true" />
                                {{ activeSession.runnerLabel }}
                            </span>
                            <span v-else
                                >Pick a runner and start chatting.</span
                            >
                        </p>
                    </div>
                    <div class="or3-chat-desktop__header-actions">
                        <UButton
                            icon="i-pixelarticons-shield"
                            color="neutral"
                            variant="ghost"
                            @click="approvalsOpen = true"
                        >
                            Approvals
                            <span
                                v-if="pendingCount"
                                class="or3-desktop-badge or3-desktop-badge--amber ml-2"
                            >
                                {{ pendingCount > 99 ? '99+' : pendingCount }}
                            </span>
                        </UButton>
                    </div>
                </div>

                <div class="or3-chat-desktop__body">
                    <div
                        v-if="!messages.length"
                        class="or3-chat-desktop__empty"
                    >
                        <div class="or3-chat-empty__avatar">
                            <RetroIcon
                                name="i-pixelarticons-sparkles"
                                size="lg"
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
                            :messages="messages"
                            class="or3-chat-desktop__message-list"
                        />
                    </div>
                </div>

                <div class="or3-chat-desktop__composer">
                    <div class="or3-chat-desktop__composer-inner">
                        <div class="or3-chat-desktop__status">
                            <AssistantStatusIndicator :active="isStreaming" />
                        </div>
                        <AssistantComposer
                            v-model="draft"
                            v-model:mode="chatMode"
                            v-model:selected-runner-id="selectedRunnerId"
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
import { computed, onMounted, ref, watch } from 'vue';
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
const approvalsOpen = ref(false);

function onPromptSelect(value: string) {
    draft.value = value;
}

function openPromptGallery() {
    void router.push('/prompts');
}

function openFileEditor() {
    void router.push('/computer');
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

function onNewSession() {
    const session = newSession('New conversation');
    const runner = getRunner(selectedRunnerId.value);
    if (runner) {
        setSessionRunnerMetadata(session.id, {
            runnerId: runner.id,
            runnerLabel: runner.display_name || runner.id,
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
        setSessionRunnerMetadata(session.id, {
            runnerId,
            runnerLabel: runner.display_name || runner.id,
            runnerContinuationMode: continuationModeForRunner(runnerId),
        });
        return;
    }
    setSessionRunnerMetadata(activeSession.value.id, {
        runnerId,
        runnerLabel: runner.display_name || runner.id,
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
            runnerLabel: runner?.display_name || selectedRunnerId.value,
            runnerContinuationMode: sessionContinuationMode,
        });
        return;
    }
    void send({
        ...payload,
        mode: payload.mode ?? chatMode.value,
        runnerId: payload.runnerId || selectedRunnerId.value,
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
</script>

<style scoped>
.or3-chat-shell__status {
    display: flex;
    justify-content: center;
    pointer-events: none;
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
