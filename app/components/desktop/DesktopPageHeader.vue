<template>
    <header class="or3-desktop-page-header">
        <div class="or3-desktop-page-header__main">
            <div class="or3-desktop-page-header__title-row">
                <h1 v-if="title" class="or3-desktop-page-header__title">
                    {{ title }}
                </h1>
                <slot name="title-extra" />
            </div>
            <p v-if="subtitle" class="or3-desktop-page-header__subtitle">
                {{ subtitle }}
            </p>
            <div v-if="badges?.length || $slots.badges" class="or3-desktop-page-header__badges">
                <span
                    v-for="badge in badges"
                    :key="badge.label"
                    class="or3-desktop-page-header__badge"
                    :data-tone="badge.tone || 'neutral'"
                >
                    <Icon v-if="badge.icon" :name="badge.icon" class="size-3" />
                    {{ badge.label }}
                </span>
                <slot name="badges" />
            </div>
            <slot />
        </div>
        <div v-if="$slots.actions" class="or3-desktop-page-header__actions">
            <slot name="actions" />
        </div>
    </header>
</template>

<script setup lang="ts">
withDefaults(
    defineProps<{
        title?: string;
        subtitle?: string;
        badges?: Array<{ label: string; tone?: 'green' | 'amber' | 'neutral' | 'rose'; icon?: string }>;
    }>(),
    {
        title: '',
        subtitle: '',
        badges: () => [],
    },
);
</script>
