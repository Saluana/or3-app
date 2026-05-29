<template>
    <DesktopSecondarySidebar
        :search-value="query"
        search-placeholder="Search settings…"
        footer-text="Updated just now"
        scroll-key="settings"
    >
        <template #filters>
            <span
                class="text-[11px] font-mono uppercase tracking-[0.16em] text-(--or3-text-muted)"
            >
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
import { computed, ref } from 'vue';
import { useRoute } from 'vue-router';
import { useSimpleSettings } from '~/composables/settings/useSimpleSettings';
import { useElectronHostSetup } from '~/composables/useElectronHostSetup';
import { useWhenHostApiReady } from '~/composables/useWhenHostApiReady';
import {
    desktopSidebarFixedDestinations,
    type SettingsDestination,
} from '~/settings/settingsNavigation';

const route = useRoute();
const simple = useSimpleSettings();
const { isElectronHostMode, ensureLoaded } = useElectronHostSetup();
const query = ref('');

void ensureLoaded();

interface SidebarItem {
    label: string;
    description: string;
    icon: string;
    to: string;
}

function toSidebarItem(dest: SettingsDestination): SidebarItem {
    return {
        label: dest.label,
        description: dest.description,
        icon: dest.icon,
        to: dest.to,
    };
}

const baseItems = computed<SidebarItem[]>(() => {
    const sections = simple.availableSections.value || [];
    const dynamic: SidebarItem[] = sections.map((s) => ({
        label: s.label,
        description: simple.summaryFor(s) || s.description,
        icon: s.icon,
        to: `/settings/section/${s.key}`,
    }));

    const fixed = desktopSidebarFixedDestinations(isElectronHostMode.value).map(
        toSidebarItem,
    );

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

useWhenHostApiReady(() => {
    void simple.ensureLoaded();
});

defineExpose({ query });
</script>
