<template>
    <DesktopSecondarySidebar
        :search-value="query"
        search-placeholder="Search conversations…"
        :footer-text="footerText"
        :on-refresh="refresh"
        scroll-key="chat-sessions"
        @update:search-value="onSearch"
    >
        <template #filters>
            <UButton
                icon="i-pixelarticons-plus"
                color="primary"
                size="sm"
                block
                @click="onNew"
            >
                New chat
            </UButton>
            <div class="mt-2 flex w-full flex-wrap items-center gap-1.5">
                <button
                    v-for="filter in filters"
                    :key="filter.value"
                    type="button"
                    class="or3-chip"
                    :class="{ 'is-active': activeFilter === filter.value }"
                    :aria-pressed="activeFilter === filter.value"
                    @click="setFilter(filter.value)"
                >
                    <Icon v-if="filter.icon" :name="filter.icon" class="size-3" />
                    {{ filter.label }}
                </button>
            </div>
        </template>

        <div v-if="loading && !visibleSessions.length" class="px-3 py-6 text-center font-mono text-xs text-(--or3-text-muted)">
            Loading conversations…
        </div>

        <div v-else-if="error" class="px-3 py-6 text-center font-mono text-xs text-(--or3-danger)">
            {{ error }}
        </div>

        <template v-else>
            <template v-for="group in groupedSessions" :key="group.label">
                <p class="or3-desktop-side-section-label">{{ group.label }}</p>
                <div
                    v-for="session in group.items"
                    :key="session.session_key"
                    class="or3-desktop-list-item"
                    :class="{ 'is-active': session.session_key === activeSessionKey }"
                >
                    <button
                        type="button"
                        class="or3-desktop-list-item__main"
                        @click="onOpen(session)"
                    >
                        <span class="or3-desktop-list-item__title-row">
                            <span class="or3-desktop-list-item__title">
                                <span
                                    v-if="session.session_key === activeSessionKey"
                                    class="or3-live-dot"
                                    aria-hidden="true"
                                />
                                {{ session.title || 'Untitled conversation' }}
                            </span>
                            <span class="or3-desktop-list-item__meta">{{ formatTime(session.last_message_at || session.updated_at) }}</span>
                        </span>
                        <p
                            v-if="session.last_message_preview"
                            class="or3-desktop-list-item__preview"
                        >
                            {{ session.last_message_preview }}
                        </p>
                    </button>
                    <span class="or3-desktop-list-item__actions">
                        <UButton
                            icon="i-pixelarticons-edit-box"
                            color="neutral"
                            variant="ghost"
                            size="xs"
                            square
                            aria-label="Rename conversation"
                            @click.stop="startRename(session)"
                        />
                        <UButton
                            :icon="session.archived ? 'i-pixelarticons-undo' : 'i-pixelarticons-archive'"
                            color="neutral"
                            variant="ghost"
                            size="xs"
                            square
                            :aria-label="session.archived ? 'Unarchive conversation' : 'Archive conversation'"
                            @click.stop="emit('archive', session, !session.archived)"
                        />
                    </span>
                </div>
            </template>

            <div
                v-if="!groupedSessions.length"
                class="px-4 py-10 text-center font-mono text-xs text-(--or3-text-muted)"
            >
                {{ emptyTitle }}
                <br />
                {{ emptyDetail }}
            </div>
        </template>
    </DesktopSecondarySidebar>

    <EditNameModal
        v-model:open="renameOpen"
        title="Rename chat"
        eyebrow="Conversation"
        label="Name"
        placeholder="Untitled conversation"
        submit-label="Save name"
        :initial-value="renameTitle"
        @submit="submitRename"
    />
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import type { ChatSessionMeta } from '~/types/or3-api';
import EditNameModal from '~/components/app/EditNameModal.vue';

const props = defineProps<{
    sessions: ChatSessionMeta[];
    loading?: boolean;
    error?: string | null;
    activeSessionKey?: string | null;
}>();

const emit = defineEmits<{
    open: [session: ChatSessionMeta];
    new: [];
    refresh: [options: { q?: string; includeArchived?: boolean }];
    rename: [session: ChatSessionMeta, title: string];
    archive: [session: ChatSessionMeta, archived: boolean];
}>();

const query = ref('');
const debouncedSearchQuery = ref('');
let searchDebounceTimer: ReturnType<typeof setTimeout> | null = null;
watch(
    query,
    (value) => {
        if (searchDebounceTimer) clearTimeout(searchDebounceTimer);
        searchDebounceTimer = setTimeout(() => {
            debouncedSearchQuery.value = value.trim().toLowerCase();
        }, 150);
    },
    { immediate: true },
);
onBeforeUnmount(() => {
    if (searchDebounceTimer) clearTimeout(searchDebounceTimer);
});

function sessionSearchHaystack(session: ChatSessionMeta) {
    return [session.title, session.last_message_preview, session.runner_label, session.runner_id]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();
}

const activeFilter = ref<'all' | 'recent' | 'archived'>('all');
const renameOpen = ref(false);
const renameTarget = ref<ChatSessionMeta | null>(null);
const renameTitle = computed(() => renameTarget.value?.title || 'Untitled conversation');

const filters = [
    { label: 'All', value: 'all' as const, icon: 'i-pixelarticons-inbox-all' },
    { label: 'Recent', value: 'recent' as const, icon: 'i-pixelarticons-clock' },
    { label: 'Archived', value: 'archived' as const, icon: 'i-pixelarticons-archive' },
];

const visibleSessions = computed(() => {
    const q = debouncedSearchQuery.value;
    return props.sessions.filter((s) => {
        if (activeFilter.value === 'archived') {
            if (!s.archived) return false;
        } else if (s.archived) {
            return false;
        }
        if (activeFilter.value === 'recent') {
            const ts = s.last_message_at || s.updated_at || 0;
            const sevenDays = 1000 * 60 * 60 * 24 * 7;
            if (ts && Date.now() - ts > sevenDays) return false;
        }
        if (!q) return true;
        return sessionSearchHaystack(s).includes(q);
    });
});

interface SessionGroup {
    label: string;
    items: ChatSessionMeta[];
}

const groupedSessions = computed<SessionGroup[]>(() => {
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
    const yesterdayStart = todayStart - 86400_000;
    const sevenDaysAgo = todayStart - 86400_000 * 7;

    const today: ChatSessionMeta[] = [];
    const yesterday: ChatSessionMeta[] = [];
    const lastWeek: ChatSessionMeta[] = [];
    const older: ChatSessionMeta[] = [];

    const sorted = [...visibleSessions.value].sort(
        (a, b) => (b.last_message_at || b.updated_at || 0) - (a.last_message_at || a.updated_at || 0),
    );

    for (const s of sorted) {
        const ts = s.last_message_at || s.updated_at || 0;
        if (ts >= todayStart) today.push(s);
        else if (ts >= yesterdayStart) yesterday.push(s);
        else if (ts >= sevenDaysAgo) lastWeek.push(s);
        else older.push(s);
    }

    const groups: SessionGroup[] = [];
    if (today.length) groups.push({ label: 'Today', items: today });
    if (yesterday.length) groups.push({ label: 'Yesterday', items: yesterday });
    if (lastWeek.length) groups.push({ label: 'Last 7 days', items: lastWeek });
    if (older.length) groups.push({ label: 'Older', items: older });
    return groups;
});

const footerText = computed(() => {
    const total = visibleSessions.value.length;
    if (props.loading) return 'Refreshing…';
    return total === 1 ? '1 conversation' : `${total} conversations`;
});

const emptyTitle = computed(() => {
    if (activeFilter.value === 'archived') return 'No archived conversations.';
    if (activeFilter.value === 'recent') return 'No recent conversations.';
    return 'No conversations yet.';
});

const emptyDetail = computed(() => {
    if (activeFilter.value === 'archived') return 'Archived chats will show up here.';
    if (activeFilter.value === 'recent') return 'Recent chats from the last 7 days will show up here.';
    return 'Start a new chat to begin.';
});

function formatTime(ms?: number | null) {
    if (!ms) return '';
    const d = new Date(ms);
    const now = new Date();
    const sameDay = d.toDateString() === now.toDateString();
    if (sameDay) {
        return d.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
    }
    const diffMs = now.getTime() - d.getTime();
    const diffDays = Math.floor(diffMs / 86400_000);
    if (diffDays < 7) {
        return d.toLocaleDateString(undefined, { weekday: 'short' });
    }
    return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

function onSearch(v: string) {
    query.value = v;
    refresh();
}

function setFilter(filter: typeof activeFilter.value) {
    if (activeFilter.value === filter) return;
    activeFilter.value = filter;
    refresh();
}

function onOpen(session: ChatSessionMeta) {
    emit('open', session);
}

function onNew() {
    emit('new');
}

function startRename(session: ChatSessionMeta) {
    renameTarget.value = session;
    renameOpen.value = true;
}

function submitRename(title: string) {
    if (!renameTarget.value) return;
    emit('rename', renameTarget.value, title);
}

function refresh() {
    emit('refresh', {
        q: query.value.trim() || undefined,
        includeArchived: activeFilter.value === 'archived' || undefined,
    });
}

onMounted(() => {
    refresh();
});
</script>
