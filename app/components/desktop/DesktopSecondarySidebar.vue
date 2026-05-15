<template>
    <div class="or3-desktop-side-panel">
        <div v-if="$slots.search || searchPlaceholder" class="or3-desktop-side-panel__search">
            <slot name="search">
                <UInput
                    :model-value="searchValue"
                    icon="i-pixelarticons-search"
                    :placeholder="searchPlaceholder"
                    size="md"
                    class="w-full"
                    @update:model-value="$emit('update:searchValue', String($event))"
                >
                    <template #trailing>
                        <kbd class="or3-desktop-side-panel__kbd" aria-hidden="true">⌘K</kbd>
                    </template>
                </UInput>
            </slot>
        </div>

        <div v-if="$slots.filters" class="or3-desktop-side-panel__filters">
            <slot name="filters" />
        </div>

        <div
            ref="listRef"
            class="or3-desktop-side-panel__list"
            @scroll.passive="onScroll"
        >
            <slot />
        </div>

        <div v-if="$slots.footer || footerText" class="or3-desktop-side-panel__footer">
            <slot name="footer">
                <span class="or3-desktop-side-panel__footer-text">{{ footerText }}</span>
                <UButton
                    v-if="onRefresh"
                    icon="i-pixelarticons-reload"
                    color="neutral"
                    variant="ghost"
                    size="xs"
                    square
                    aria-label="Refresh"
                    @click="onRefresh"
                />
            </slot>
        </div>
    </div>
</template>

<script setup lang="ts">
import { onMounted, ref } from 'vue';

const props = defineProps<{
    searchPlaceholder?: string;
    searchValue?: string;
    footerText?: string;
    onRefresh?: () => void;
    /** When provided, the scroll position of the list is persisted across mounts in module-level cache. */
    scrollKey?: string;
}>();

defineEmits<{
    'update:searchValue': [value: string];
}>();

const listRef = ref<HTMLElement | null>(null);

// module-level cache survives across page navigations within an SPA session
const scrollCache: Record<string, number> = ((globalThis as any).__or3SidebarScroll ||= {});

function onScroll() {
    if (!props.scrollKey || !listRef.value) return;
    scrollCache[props.scrollKey] = listRef.value.scrollTop;
}

onMounted(() => {
    if (!props.scrollKey || !listRef.value) return;
    const saved = scrollCache[props.scrollKey];
    if (typeof saved === 'number') listRef.value.scrollTop = saved;
});
</script>
