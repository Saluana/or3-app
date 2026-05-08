<template>
    <USlideover v-model:open="open">
        <template #content>
            <UCard class="or3-session-history">
                <template #header>
                    <div class="or3-session-history__header">
                        <div>
                            <p class="or3-session-history__eyebrow">History</p>
                            <h2 class="or3-session-history__title">Conversations</h2>
                        </div>
                        <UButton
                            icon="i-pixelarticons-close"
                            color="neutral"
                            variant="ghost"
                            square
                            aria-label="Close history"
                            @click="open = false"
                        />
                    </div>
                </template>

                <div class="or3-session-history__filters">
                    <UInput v-model="query" icon="i-pixelarticons-search" placeholder="Search sessions" />
                    <label class="or3-session-history__archive">
                        <input v-model="includeArchived" type="checkbox" />
                        <span>Archived</span>
                    </label>
                </div>

                <div v-if="loading" class="or3-session-history__empty">Loading sessions…</div>
                <div v-else-if="error" class="or3-session-history__empty or3-session-history__empty--error">{{ error }}</div>
                <div v-else-if="!filteredSessions.length" class="or3-session-history__empty">No matching sessions.</div>

                <div v-else class="or3-session-history__list">
                    <button
                        v-for="session in filteredSessions"
                        :key="session.session_key"
                        type="button"
                        class="or3-session-history__item"
                        @click="emit('open-session', session)"
                    >
                        <span class="or3-session-history__item-main">
                            <strong>{{ session.title || 'Untitled conversation' }}</strong>
                            <small>{{ session.runner_label || session.runner_id || 'OR3 Intern' }} · {{ session.message_count || 0 }} messages</small>
                            <small v-if="session.parent_session_key">Forked from {{ session.parent_session_key }}</small>
                        </span>
                        <span class="or3-session-history__item-actions" @click.stop>
                            <UButton
                                icon="i-pixelarticons-edit-box"
                                color="neutral"
                                variant="ghost"
                                square
                                aria-label="Rename session"
                                @click="renameSession(session)"
                            />
                            <UButton
                                :icon="session.archived ? 'i-pixelarticons-undo' : 'i-pixelarticons-archive'"
                                color="neutral"
                                variant="ghost"
                                square
                                :aria-label="session.archived ? 'Unarchive session' : 'Archive session'"
                                @click="emit('archive-session', session, !session.archived)"
                            />
                        </span>
                    </button>
                </div>
            </UCard>
        </template>
    </USlideover>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import type { ChatSessionMeta } from '../../types/or3-api';

const props = withDefaults(
    defineProps<{
        open?: boolean;
        sessions?: ChatSessionMeta[];
        loading?: boolean;
        error?: string | null;
    }>(),
    {
        open: false,
        sessions: () => [],
        loading: false,
        error: null,
    },
);

const emit = defineEmits<{
    'update:open': [value: boolean];
    refresh: [options: { q?: string; includeArchived?: boolean }];
    'open-session': [session: ChatSessionMeta];
    'rename-session': [session: ChatSessionMeta, title: string];
    'archive-session': [session: ChatSessionMeta, archived: boolean];
}>();

const query = ref('');
const includeArchived = ref(false);

const open = computed({
    get: () => props.open,
    set: (value: boolean) => emit('update:open', value),
});

const filteredSessions = computed(() => {
    const q = query.value.trim().toLowerCase();
    return props.sessions.filter((session) => {
        if (!includeArchived.value && session.archived) return false;
        if (!q) return true;
        return [session.title, session.last_message_preview, session.runner_label, session.runner_id]
            .filter(Boolean)
            .join(' ')
            .toLowerCase()
            .includes(q);
    });
});

watch(
    () => [open.value, query.value, includeArchived.value] as const,
    ([isOpen]) => {
        if (!isOpen) return;
        emit('refresh', { q: query.value, includeArchived: includeArchived.value });
    },
    { immediate: true },
);

function renameSession(session: ChatSessionMeta) {
    const next = window.prompt('Rename conversation', session.title || 'Untitled conversation');
    if (!next?.trim()) return;
    emit('rename-session', session, next.trim());
}
</script>

<style scoped>
.or3-session-history {
    min-height: 100dvh;
}

.or3-session-history__header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 1rem;
}

.or3-session-history__eyebrow {
    color: var(--or3-text-muted);
    font-size: 0.72rem;
    font-weight: 800;
    letter-spacing: 0.08em;
    text-transform: uppercase;
}

.or3-session-history__title {
    font-size: 1.25rem;
    font-weight: 850;
}

.or3-session-history__filters {
    display: grid;
    gap: 0.75rem;
    margin-bottom: 1rem;
}

.or3-session-history__archive {
    display: inline-flex;
    align-items: center;
    gap: 0.5rem;
    color: var(--or3-text-muted);
    font-size: 0.85rem;
    font-weight: 700;
}

.or3-session-history__list {
    display: grid;
    gap: 0.6rem;
}

.or3-session-history__item {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 0.75rem;
    border: 1px solid var(--or3-border);
    border-radius: 1rem;
    background: color-mix(in srgb, white 92%, var(--or3-surface) 8%);
    padding: 0.8rem;
    text-align: left;
}

.or3-session-history__item-main {
    display: grid;
    min-width: 0;
    gap: 0.15rem;
}

.or3-session-history__item-main strong,
.or3-session-history__item-main small {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
}

.or3-session-history__item-main small,
.or3-session-history__empty {
    color: var(--or3-text-muted);
    font-size: 0.8rem;
}

.or3-session-history__item-actions {
    display: flex;
    flex-shrink: 0;
    gap: 0.25rem;
}

.or3-session-history__empty {
    padding: 1.5rem 0.5rem;
    text-align: center;
}

.or3-session-history__empty--error {
    color: var(--or3-danger);
}
</style>
