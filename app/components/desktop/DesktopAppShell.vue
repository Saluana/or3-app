<template>
    <div
        class="or3-desktop-shell"
        :class="{
            'or3-desktop-shell--secondary-collapsed': hasSidebar && secondaryCollapsed,
        }"
    >
        <DesktopPrimarySidebar />

        <aside
            v-if="hasSidebar"
            class="or3-desktop-secondary"
            :class="{ 'or3-desktop-secondary--collapsed': secondaryCollapsed }"
            :aria-label="sidebarLabel"
        >
            <Transition name="or3-secondary-fade">
                <div
                    v-show="!secondaryCollapsed"
                    class="or3-desktop-secondary__content"
                >
                    <slot name="sidebar" />
                </div>
            </Transition>
            <button
                type="button"
                class="or3-desktop-secondary__toggle or3-focus-ring"
                :aria-expanded="!secondaryCollapsed"
                :aria-label="secondaryCollapsed ? 'Expand secondary navigation' : 'Collapse secondary navigation'"
                :title="secondaryCollapsed ? 'Expand sidebar' : 'Collapse sidebar'"
                @click="toggleSecondary"
            >
                <Icon
                    :name="secondaryCollapsed ? 'i-pixelarticons-chevron-right' : 'i-pixelarticons-chevron-left'"
                    class="size-3"
                />
            </button>
        </aside>

        <div class="or3-desktop-main-wrap">
            <section class="or3-desktop-main" :class="{ 'or3-desktop-main--flush': flush }">
                <DesktopPageHeader
                    v-if="!flush && (title || $slots.header)"
                    :title="title"
                    :subtitle="subtitle"
                    :badges="badges"
                >
                    <template v-if="$slots['header-actions']" #actions>
                        <slot name="header-actions" />
                    </template>
                    <template v-if="$slots.header" #default>
                        <slot name="header" />
                    </template>
                </DesktopPageHeader>

                <div
                    class="or3-desktop-main__body"
                    :class="{ 'or3-desktop-main__body--flush': flush }"
                >
                    <slot />
                </div>
            </section>

            <button
                v-if="hasSidebar && secondaryCollapsed"
                type="button"
                class="or3-desktop-main-wrap__expand or3-focus-ring"
                aria-label="Expand secondary navigation"
                title="Expand sidebar"
                @click="toggleSecondary"
            >
                <Icon name="i-pixelarticons-chevron-right" class="size-3" />
            </button>
        </div>
    </div>
</template>

<script setup lang="ts">
import { computed, useSlots, watch } from 'vue';

withDefaults(
    defineProps<{
        title?: string;
        subtitle?: string;
        badges?: Array<{ label: string; tone?: 'green' | 'amber' | 'neutral' | 'rose'; icon?: string }>;
        sidebarLabel?: string;
        flush?: boolean;
    }>(),
    {
        title: '',
        subtitle: '',
        badges: () => [],
        sidebarLabel: 'Page navigation',
        flush: false,
    },
);

const slots = useSlots();
const hasSidebar = computed(() => Boolean(slots.sidebar));
const storageKey = 'or3:desktop-secondary-collapsed';
const secondaryCollapsed = useState<boolean>(
    'or3-desktop-secondary-collapsed',
    () => (import.meta.client ? localStorage.getItem(storageKey) === 'true' : false),
);

watch(secondaryCollapsed, (value) => {
    if (!import.meta.client) {
        return;
    }

    localStorage.setItem(storageKey, String(value));
});

function toggleSecondary() {
    secondaryCollapsed.value = !secondaryCollapsed.value;
}
</script>
