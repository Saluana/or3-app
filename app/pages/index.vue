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

        <ChatThread
            ref="mobileChatThread"
            variant="mobile"
            :show-welcome="showWelcome"
            :messages="messages"
            :message-list-key="activeSession?.id ?? 'active-thread'"
            v-model:draft="draft"
            v-model:chat-mode="chatMode"
            v-model:selected-runner-id="selectedRunnerId"
            v-model:selected-runner-model="selectedRunnerModel"
            v-model:selected-runner-thinking-level="selectedRunnerThinkingLevel"
            :is-streaming="isStreaming"
            :runners="runners"
            :can-host-locally="isElectron"
            :keyboard-open="isKeyboardOpen"
            :show-scroll-to-bottom="showScrollToBottom"
            :scroll-to-bottom-opacity="scrollToBottomOpacity"
            @scroll-state="updateScrollState"
            @prompt-select="onPromptSelect"
            @open-prompt-gallery="openPromptGallery"
            @open-file-editor="openFileEditor"
            @setup-host="startLocalHostSetup"
            @pair-device="openPairing"
            @learn-more="router.push('/settings/permissions')"
            @send="sendWithMode"
            @stop="stop"
        >
            <template #header>
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
                                class="or3-focus-ring or3-touch-target inline-flex size-12 items-center justify-center rounded-[1.35rem] border border-(--or3-border) bg-(--or3-surface) shadow-[0_1px_0_rgba(255,255,255,0.65)_inset,0_8px_20px_rgba(42,35,25,0.05)] transition hover:border-(--or3-green)/30 hover:bg-white/95"
                                aria-label="Open chat history"
                                @click="openHistory"
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
                                >
                                    {{
                                        pendingCount > 99 ? '99+' : pendingCount
                                    }}
                                </span>
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
            </template>
        </ChatThread>

        <template #desktop>
            <ChatThread
                ref="desktopChatThread"
                variant="desktop"
                :show-welcome="showWelcome"
                :messages="messages"
                :message-list-key="activeSession?.id ?? 'active-thread'"
                v-model:draft="draft"
                v-model:chat-mode="chatMode"
                v-model:selected-runner-id="selectedRunnerId"
                v-model:selected-runner-model="selectedRunnerModel"
                v-model:selected-runner-thinking-level="selectedRunnerThinkingLevel"
                :is-streaming="isStreaming"
                :runners="runners"
                :can-host-locally="isElectron"
                :show-scroll-to-bottom="showScrollToBottom"
                :scroll-to-bottom-opacity="scrollToBottomOpacity"
                @scroll-state="updateScrollState"
                @prompt-select="onPromptSelect"
                @open-prompt-gallery="openPromptGallery"
                @open-file-editor="openFileEditor"
                @setup-host="startLocalHostSetup"
                @pair-device="openPairing"
                @learn-more="router.push('/settings/permissions')"
                @send="sendWithMode"
                @stop="stop"
            >
                <template #header>
                    <div class="or3-chat-desktop__header">
                        <div class="or3-chat-desktop__header-main" />
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
                                        {{
                                            pendingCount > 99
                                                ? '99+'
                                                : pendingCount
                                        }}
                                    </span>
                                </UButton>
                            </UTooltip>
                        </div>
                    </div>
                </template>
            </ChatThread>
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
        <PairingSheet v-model:open="pairingOpen" />
        <RunnerSwitchModal
            v-model:open="runnerSwitchOpen"
            :current-runner-label="runnerSwitchCurrentLabel"
            :next-runner-label="runnerSwitchNextLabel"
            @confirm="confirmRunnerSwitch"
            @cancel="cancelRunnerSwitch"
        />
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
    error: runnersError,
} = useChatRunners();
const sessionHistory = useSessionHistory();
const router = useRouter();
const toast = useToast();
const { pendingCount } = useApprovals();
const { isKeyboardOpen } = useKeyboardOpen();
const { activeHost, isConnected, isPaired } = useActiveHost();
const electronHost = useElectronHostSetup();
const { isElectron } = electronHost;

const showWelcome = computed(
    () => !isPaired.value && messages.value.length === 0,
);

const selectedRunnerId = ref('or3-intern');
const selectedRunnerModel = ref('');
const selectedRunnerThinkingLevel = ref('');
const approvalsOpen = ref(false);
const pairingOpen = ref(false);
const mobileChatThread = ref<{ scrollToBottom?: () => void } | null>(null);
const desktopChatThread = ref<{ scrollToBottom?: () => void } | null>(null);
const distanceFromBottom = ref(0);
const isMessageListScrollable = ref(false);
const liveChannelController = ref<AbortController | null>(null);
const liveChannelPaused = ref(false);
const runnerSwitchOpen = ref(false);
const pendingRunnerSwitchId = ref<string | null>(null);
const runnerSwitchCurrentLabel = ref('OR3 Intern');
const runnerSwitchNextLabel = ref('OR3 Intern');

async function startLocalHostSetup() {
    await electronHost.ensureLoaded();
    await electronHost.chooseMode('host');
}

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

function openPairing() {
    pairingOpen.value = true;
}

function updateScrollState(state: {
    distanceFromBottom: number;
    isScrollable: boolean;
}) {
    distanceFromBottom.value = state.distanceFromBottom;
    isMessageListScrollable.value = state.isScrollable;
}

function scrollMessagesToBottom() {
    mobileChatThread.value?.scrollToBottom?.();
    desktopChatThread.value?.scrollToBottom?.();
}

const runners = computed(() => selectableRunners.value);
const historyOpen = sessionHistory.historyOpen;
const historySessions = sessionHistory.sessions;
const historyLoading = sessionHistory.loading;
const historyError = sessionHistory.error;

function openHistory() {
    if (isStreaming.value) {
        toast.add({
            title: 'Please wait',
            description:
                'Finish or stop the current reply before switching conversations.',
            color: 'warning',
            icon: 'i-pixelarticons-clock',
        });
        return;
    }
    historyOpen.value = true;
    void sessionHistory.refresh();
}

function refreshHistory(options: { q?: string; includeArchived?: boolean }) {
    void sessionHistory.refresh(options);
}

function openHistorySession(session: ChatSessionMeta) {
    if (isStreaming.value) {
        toast.add({
            title: 'Please wait',
            description:
                'Finish or stop the current reply before switching conversations.',
            color: 'warning',
            icon: 'i-pixelarticons-clock',
        });
        return;
    }
    void sessionHistory.openSession(session).then(() => {
        selectedRunnerId.value = session.runner_id || 'or3-intern';
        liveChannelPaused.value = false;
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

function refreshLiveChannel() {
    liveChannelPaused.value = false;
    startLiveChannelStream(activeSession.value?.sessionKey);
}

function startLiveChannelStream(sessionKey?: string | null) {
    stopLiveChannelStream();
    liveChannelPaused.value = false;
    if (!canUseHostApi(activeHost.value)) return;
    if (!isExternalChannelSession(sessionKey)) return;
    const controller = new AbortController();
    liveChannelController.value = controller;
    void sessionHistory
        .hydrate(sessionKey as string, 100, { replaceLocal: false })
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
            if (!canUseHostApi(activeHost.value)) return;
            liveChannelPaused.value = true;
            console.warn('live channel stream stopped', error);
        });
}

function onNewSession() {
    if (isStreaming.value) {
        toast.add({
            title: 'Please wait',
            description:
                'Finish or stop the current reply before starting a new chat.',
            color: 'warning',
            icon: 'i-pixelarticons-clock',
        });
        return;
    }
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
    () =>
        canUseHostApi(activeHost.value)
            ? activeSession.value?.sessionKey ?? ''
            : '',
    (sessionKey) => startLiveChannelStream(sessionKey || null),
    { immediate: true },
);

watch(selectedRunnerId, (runnerId, previous) => {
    if (!activeSession.value) return;
    if (!previous || runnerId === activeSession.value.runnerId) return;
    const runner = getRunner(runnerId);
    if (!runner) return;
    if (messageCount(activeSession.value.id) > 0) {
        pendingRunnerSwitchId.value = runnerId;
        runnerSwitchCurrentLabel.value =
            activeSession.value.runnerLabel ||
            getRunner(activeSession.value.runnerId)?.display_name ||
            activeSession.value.runnerId ||
            'OR3 Intern';
        runnerSwitchNextLabel.value = runner.display_name || runner.id;
        runnerSwitchOpen.value = true;
        return;
    }
    applyRunnerToActiveSession(runnerId, runner);
});

function applyRunnerToActiveSession(
    runnerId: string,
    runner: NonNullable<ReturnType<typeof getRunner>>,
) {
    selectedRunnerModel.value =
        runner.default_model || runner.runtime?.default_model || '';
    selectedRunnerThinkingLevel.value = '';
    if (!activeSession.value) return;
    setSessionRunnerMetadata(activeSession.value.id, {
        runnerId,
        runnerLabel: runner.display_name || runner.id,
        runnerModel: selectedRunnerModel.value || undefined,
        runnerContinuationMode: continuationModeForRunner(runnerId),
    });
}

function confirmRunnerSwitch() {
    const runnerId = pendingRunnerSwitchId.value;
    runnerSwitchOpen.value = false;
    pendingRunnerSwitchId.value = null;
    if (!runnerId) return;
    const runner = getRunner(runnerId);
    if (!runner) return;
    const session = newSession('New conversation');
    selectedRunnerId.value = runnerId;
    selectedRunnerModel.value =
        runner.default_model || runner.runtime?.default_model || '';
    selectedRunnerThinkingLevel.value = '';
    setSessionRunnerMetadata(session.id, {
        runnerId,
        runnerLabel: runner.display_name || runner.id,
        runnerModel: selectedRunnerModel.value || undefined,
        runnerContinuationMode: continuationModeForRunner(runnerId),
    });
}

function cancelRunnerSwitch() {
    runnerSwitchOpen.value = false;
    pendingRunnerSwitchId.value = null;
    selectedRunnerId.value =
        activeSession.value?.runnerId || defaultRunner.value?.id || 'or3-intern';
}

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

watch(
    () =>
        canUseHostApi(activeHost.value) ? activeHost.value?.id ?? '' : '',
    (hostId) => {
        if (hostId) void sessionHistory.refresh();
    },
    { immediate: true },
);

const runnersToastId = ref<string | number | undefined>();
const liveChannelToastId = ref<string | number | undefined>();
const historyToastId = ref<string | number | undefined>();

watch(
    () => canUseHostApi(activeHost.value),
    (ready) => {
        if (ready) return;
        stopLiveChannelStream();
        liveChannelPaused.value = false;
        if (liveChannelToastId.value !== undefined) {
            toast.remove(liveChannelToastId.value);
            liveChannelToastId.value = undefined;
        }
    },
);

watch(liveChannelPaused, (paused) => {
    if (liveChannelToastId.value !== undefined) {
        toast.remove(liveChannelToastId.value);
        liveChannelToastId.value = undefined;
    }
    if (!paused || !canUseHostApi(activeHost.value)) return;
    liveChannelToastId.value = toast.add({
        title: 'Live updates paused',
        description:
            'Refresh to load the latest messages for this channel.',
        color: 'warning',
        icon: 'i-pixelarticons-refresh',
        actions: [
            {
                label: 'Refresh',
                onClick: () => {
                    refreshLiveChannel();
                },
            },
        ],
    });
});

watch(historyError, (message) => {
    if (historyToastId.value !== undefined) {
        toast.remove(historyToastId.value);
        historyToastId.value = undefined;
    }
    if (!message || !canUseHostApi(activeHost.value)) return;
    if (historySessions.value.length > 0 || historyLoading.value) return;
    const lower = message.toLowerCase();
    if (
        lower.includes('unauthorized') ||
        lower.includes('unlock') ||
        lower.includes('pin')
    ) {
        return;
    }
    historyToastId.value = toast.add({
        title: "Couldn't load conversations",
        description: message,
        color: 'warning',
        icon: 'i-pixelarticons-alert',
        actions: [
            {
                label: 'Retry',
                onClick: () => {
                    void sessionHistory.refresh();
                },
            },
        ],
    });
});

watch(runnersError, (message) => {
    if (runnersToastId.value !== undefined) {
        toast.remove(runnersToastId.value);
        runnersToastId.value = undefined;
    }
    if (!message || !canUseHostApi(activeHost.value)) return;
    if (defaultRunner.value) return;
    runnersToastId.value = toast.add({
        title: "Couldn't load agents",
        description: 'Using OR3 Intern for now.',
        color: 'warning',
        icon: 'i-pixelarticons-alert',
        actions: [
            {
                label: 'Retry',
                onClick: () => {
                    void refreshRunners();
                },
            },
        ],
    });
});

onBeforeUnmount(() => {
    stopLiveChannelStream();
});
</script>

<style scoped>
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
