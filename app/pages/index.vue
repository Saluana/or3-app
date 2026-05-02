<template>
    <div class="or3-chat-shell">
        <div class="or3-chat-shell__header">
            <AppHeader subtitle="CHAT" />
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
                <AssistantComposer
                    v-model="draft"
                    :streaming="isStreaming"
                    @send="send"
                    @stop="stop"
                />
            </div>
        </div>

        <BottomNav />
    </div>
</template>

<script setup lang="ts">
import { nextTick, onMounted, ref, watch } from 'vue';

const { messages, draft } = useChatSessions();
const { isStreaming, send, stop } = useAssistantStream();
const router = useRouter();

const scrollEl = ref<HTMLElement | null>(null);
const autoScrollLocked = ref(true);
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
});
</script>

<style scoped>
.or3-chat-empty__actions {
    display: flex;
    flex-wrap: wrap;
    justify-content: center;
    gap: 0.75rem;
    margin-top: 1rem;
}
</style>
