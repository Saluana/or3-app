<template>
    <DesktopSecondarySidebar
        :search-value="query"
        search-placeholder="Search or quick action…"
        :footer-text="
            connected ? `Connected · ${activeHostName}` : 'Not connected'
        "
        scroll-key="computer"
    >
        <template #filters>
            <span
                class="flex items-center gap-1.5 text-[11px] font-mono uppercase tracking-[0.16em] text-(--or3-text-muted)"
            >
                <span
                    class="inline-block size-1.5 rounded-full"
                    :class="
                        connected ? 'bg-(--or3-green)' : 'bg-(--or3-text-muted)'
                    "
                />
                {{ connected ? 'Connected' : 'Disconnected' }}
            </span>
        </template>

        <NuxtLink
            v-for="item in filteredItems"
            :key="item.to"
            :to="item.to"
            class="or3-desktop-list-item"
            :class="{ 'is-active': isActive(item.to) }"
        >
            <span class="or3-desktop-list-item__title-row">
                <span class="or3-desktop-list-item__title">
                    <span class="or3-desktop-list-item__icon">
                        <Icon :name="item.icon" class="size-4" />
                    </span>
                    {{ item.label }}
                </span>
                <span
                    v-if="item.badge"
                    class="or3-desktop-list-item__meta"
                    :data-tone="item.badgeTone"
                    >{{ item.badge }}</span
                >
            </span>
            <p v-if="item.description" class="or3-desktop-list-item__preview">
                {{ item.description }}
            </p>
        </NuxtLink>
    </DesktopSecondarySidebar>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue';
import { useRoute } from 'vue-router';
import { useActiveHost } from '../../../composables/useActiveHost';
import { useApprovals } from '../../../composables/useApprovals';

const route = useRoute();
const { activeHost, isConnected, isPaired } = useActiveHost();
const { pendingCount } = useApprovals();
const connected = computed(() => Boolean(isConnected.value));
const activeHostName = computed(() => activeHost.value?.name || 'My Computer');

const query = ref('');

interface SidebarItem {
    label: string;
    description?: string;
    icon: string;
    to: string;
    badge?: string;
    badgeTone?: 'amber' | 'green';
}

const items = computed<SidebarItem[]>(() => [
    {
        label: 'My Computer',
        description: connected.value
            ? `${activeHostName.value} · Connected`
            : isPaired.value
              ? `${activeHostName.value} · Unreachable`
              : 'Pair to get started',
        icon: 'i-pixelarticons-monitor',
        to: '/computer',
    },
    {
        label: 'Files',
        description: 'Browse and manage workspace files.',
        icon: 'i-pixelarticons-folder',
        to: '/computer/files',
    },
    {
        label: 'Terminal',
        description: 'Run commands in your environment.',
        icon: 'i-pixelarticons-terminal',
        to: '/computer/terminal',
    },
    {
        label: 'Approvals',
        description: 'Review pending requests.',
        icon: 'i-pixelarticons-shield',
        to: '/approvals',
        badge: pendingCount.value ? String(pendingCount.value) : undefined,
        badgeTone: 'amber',
    },
    {
        label: 'Activity',
        description: 'Recent commands and events.',
        icon: 'i-pixelarticons-timeline',
        to: '/activity',
    },
    {
        label: 'Scheduled',
        description: 'Recurring tasks and jobs.',
        icon: 'i-pixelarticons-calendar',
        to: '/scheduled',
    },
]);

const filteredItems = computed(() => {
    const q = query.value.trim().toLowerCase();
    if (!q) return items.value;
    return items.value.filter((item) =>
        `${item.label} ${item.description || ''}`.toLowerCase().includes(q),
    );
});

function isActive(to: string) {
    if (route.path === to) return true;
    if (to !== '/' && route.path.startsWith(to + '/')) return true;
    return false;
}
</script>
