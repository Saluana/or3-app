<template>
    <DesktopSecondarySidebar
        :search-value="query"
        search-placeholder="Search memory…"
        footer-text="Memory tools"
    >
        <template #filters>
            <span class="text-[11px] font-mono uppercase tracking-[0.16em] text-(--or3-text-muted)">
                Knowledge
            </span>
        </template>

        <p class="or3-desktop-side-section-label">Sections</p>
        <button
            v-for="item in items"
            :key="item.key"
            type="button"
            class="or3-desktop-list-item"
            :class="{ 'is-active': item.key === activeKey }"
            @click="emit('select', item.key)"
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
        </button>
    </DesktopSecondarySidebar>
</template>

<script setup lang="ts">
import { ref } from 'vue';

const props = defineProps<{
    activeKey?: string;
}>();

const emit = defineEmits<{
    select: [key: string];
}>();

const query = ref('');

const items = [
    {
        key: 'embeddings',
        label: 'What it remembers',
        description: 'Semantic memory of notes and documents.',
        icon: 'i-pixelarticons-lightbulb-on',
    },
    {
        key: 'audit',
        label: 'Trust check',
        description: 'Verify the activity log integrity.',
        icon: 'i-pixelarticons-shield',
    },
    {
        key: 'scopes',
        label: 'Scope tools',
        description: 'Developer tools for memory scopes.',
        icon: 'i-pixelarticons-tool-case',
    },
];
</script>
