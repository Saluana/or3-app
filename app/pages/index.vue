<template>
    <div class="or3-chat-shell">
        <div class="or3-chat-shell__header">
            <AppHeader subtitle="CHAT" />
            <UButton
                icon="i-pixelarticons-list-box"
                color="neutral"
                variant="soft"
                size="sm"
                class="or3-chat-shell__history"
                @click="openHistory"
            >
                History
            </UButton>
        </div>

        <div
            ref="scrollEl"
            class="or3-chat-shell__body"
            @scroll.passive="onChatScroll"
        >
            <div class="or3-chat-shell__content">
                <!-- Empty state hero (shown only when there are no messages yet) -->
                <section v-if="!messages.length" class="or3-chat-empty">
                    <div class="or3-chat-empty__avatar">
                        <RetroIcon name="i-pixelarticons-sparkles" size="lg" />
                    </div>
                    <h1 class="or3-chat-empty__title">Hi, I'm or3-intern.</h1>
                    <p class="or3-chat-empty__subtitle">
                        Ask me about your computer, attach files for context, or
                        tap a quick prompt below to get started.
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

                <!-- Conversation thread -->
                <ol v-else class="or3-chat-thread" role="list">
                    <li v-for="m in messages" :key="m.id">
                        <ChatMessage :message="m" />
                    </li>
                </ol>
            </div>
        </div>

        <!-- Soft fade so messages disappear gently behind the composer -->
        <div class="or3-chat-shell__fade" aria-hidden="true" />

        <!-- Floating composer pinned just above the bottom navigation -->
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

        <BottomNav />
    </div>
</template>

<script setup lang="ts">
import { computed, nextTick, onMounted, ref, watch } from 'vue';
import type { ChatSessionMeta } from '~/types/or3-api';

const chat = useChatSessions();
const { activeSession, messages, draft, messageCount, newSession, setSessionRunnerMetadata } = chat;
const { isStreaming, chatMode, send, stop } = useAssistantStream();
const { selectableRunners, defaultRunner, getRunner, refresh: refreshRunners } = useChatRunners();
const sessionHistory = useSessionHistory();
const router = useRouter();

const scrollEl = ref<HTMLElement | null>(null);
const autoScrollLocked = ref(true);
const selectedRunnerId = ref('or3-intern');
let lastScrollTop = 0;

const RELEASE_DISTANCE_PX = 2;
const RELATCH_DISTANCE_PX = 24;

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

function continuationModeForRunner(runnerId?: string | null) {
    const runner = getRunner(runnerId || undefined);
    const caps = runner?.chat_capabilities || runner?.supports?.chat;
    return caps?.chatNativeSession ? 'native' : 'replay';
}

watch(
    () => activeSession.value?.runnerId,
    (runnerId) => {
        selectedRunnerId.value = runnerId || defaultRunner.value?.id || 'or3-intern';
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
            selectedRunnerId.value = activeSession.value.runnerId || 'or3-intern';
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
        runnerLabel: payload.runnerLabel || runner?.display_name || selectedRunnerId.value,
        runnerContinuationMode:
            payload.runnerContinuationMode || sessionContinuationMode,
    });
}

function distanceFromBottom(el: HTMLElement) {
    return el.scrollHeight - el.scrollTop - el.clientHeight;
}

function onChatScroll() {
    const el = scrollEl.value;
    if (!el) return;
    const distance = distanceFromBottom(el);
    const delta = el.scrollTop - lastScrollTop;
    lastScrollTop = el.scrollTop;

    if (delta < 0 && distance > RELEASE_DISTANCE_PX) {
        autoScrollLocked.value = false;
        return;
    }
    if (delta > 0 && distance <= RELATCH_DISTANCE_PX) {
        autoScrollLocked.value = true;
    }
}

function scrollToBottom(smooth = true) {
    const el = scrollEl.value;
    if (!el) return;
    el.scrollTo({ top: el.scrollHeight, behavior: smooth ? 'smooth' : 'auto' });
    lastScrollTop = el.scrollTop;
}

// Auto-scroll on new messages and during streaming, but only nudge while the
// user is already near the bottom — never yank them up while they're reading.
watch(
    () => messages.value.length,
    async () => {
        if (!autoScrollLocked.value) return;
        await nextTick();
        scrollToBottom(true);
    },
);

watch(
    () => messages.value[messages.value.length - 1]?.content,
    async () => {
        if (!autoScrollLocked.value) return;
        await nextTick();
        scrollToBottom(false);
    },
);

onMounted(() => {
    // Land at the bottom on first paint when there's existing history.
    nextTick(() => scrollToBottom(false));
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

.or3-chat-shell__header {
    position: relative;
}

.or3-chat-shell__history {
    position: absolute;
    right: 1rem;
    top: 50%;
    transform: translateY(-50%);
}

.or3-chat-empty__actions {
    display: flex;
    flex-wrap: wrap;
    justify-content: center;
    gap: 0.75rem;
    margin-top: 1rem;
}
</style>
