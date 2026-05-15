<template>
    <DesktopSecondarySidebar
        :search-value="query"
        search-placeholder="Search settings…"
        footer-text="Updated just now"
        scroll-key="settings"
    >
        <template #filters>
            <span class="text-[11px] font-mono uppercase tracking-[0.16em] text-(--or3-text-muted)">
                Preferences
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
            </span>
            <p class="or3-desktop-list-item__preview">{{ item.description }}</p>
        </NuxtLink>

        <div
            v-if="!filteredItems.length"
            class="px-4 py-8 text-center font-mono text-xs text-(--or3-text-muted)"
        >
            No matching settings.
        </div>
    </DesktopSecondarySidebar>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { useRoute } from 'vue-router';
import { useSimpleSettings } from '~/composables/settings/useSimpleSettings';

const route = useRoute();
const simple = useSimpleSettings();
const query = ref('');

interface SidebarItem {
    label: string;
    description: string;
    icon: string;
    to: string;
}

const baseItems = computed<SidebarItem[]>(() => {
    const sections = simple.availableSections.value || [];
    const dynamic: SidebarItem[] = sections.map((s) => ({
        label: s.label,
        description: simple.summaryFor(s) || s.description,
        icon: s.icon,
        to: `/settings/section/${s.key}`,
    }));

    const fixed: SidebarItem[] = [
        {
            label: 'Pair computer',
            description: 'Connect or re-pair this app to or3-intern.',
            icon: 'i-pixelarticons-link',
            to: '/settings/pair',
        },
        {
            label: 'Health check',
            description: 'See what needs attention right now.',
            icon: 'i-pixelarticons-heart',
            to: '/settings/health',
        },
        {
            label: 'Permissions',
            description: 'What OR3 can access on this device.',
            icon: 'i-pixelarticons-lock',
            to: '/settings/permissions',
        },
        {
            label: 'Skills',
            description: 'Toggle and configure agent skills.',
            icon: 'i-pixelarticons-tool-case',
            to: '/settings/skills',
        },
        {
            label: 'Add-ons',
            description: 'Manage MCP servers and external tools.',
            icon: 'i-pixelarticons-plug',
            to: '/settings/addons',
        },
        {
            label: 'Passkeys',
            description: 'Manage device passkeys for security.',
            icon: 'i-pixelarticons-shield',
            to: '/settings/passkeys',
        },
        {
            label: 'Observability',
            description: 'Logs, telemetry, and diagnostics.',
            icon: 'i-pixelarticons-chart',
            to: '/settings/observability',
        },
        {
            label: 'Advanced',
            description: 'Raw config keys for power users.',
            icon: 'i-pixelarticons-warning-box',
            to: '/settings/advanced',
        },
    ];
    return [...dynamic, ...fixed];
});

const filteredItems = computed(() => {
    const q = query.value.trim().toLowerCase();
    if (!q) return baseItems.value;
    return baseItems.value.filter((item) =>
        `${item.label} ${item.description}`.toLowerCase().includes(q),
    );
});

function isActive(to: string) {
    if (route.path === to) return true;
    if (route.path.startsWith(to + '/')) return true;
    return false;
}

onMounted(() => {
    void simple.ensureLoaded();
});

defineExpose({ query });
</script>
