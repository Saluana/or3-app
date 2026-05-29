<template>
    <component
        :is="disabled || !to ? 'div' : NuxtLink"
        :to="disabled || !to ? undefined : to"
        class="or3-focus-ring or3-setting-card"
        :class="{ 'or3-setting-card--disabled': disabled }"
        :aria-disabled="disabled || undefined"
    >
        <span class="or3-setting-card__icon">
            <Icon :name="icon" class="size-5.5" />
        </span>

        <span class="or3-setting-card__body">
            <span class="or3-setting-card__title">{{ title }}</span>
            <span class="or3-setting-card__desc">{{ description }}</span>
        </span>

        <span class="or3-setting-card__trail">
            <StatusPill
                v-if="badge"
                :label="badge.label"
                :tone="badge.tone ?? 'neutral'"
            />
            <Icon
                v-if="!disabled"
                name="i-pixelarticons-chevron-right"
                class="or3-setting-card__chevron size-4"
            />
        </span>
    </component>
</template>

<script setup lang="ts">
import { resolveComponent } from 'vue';

defineProps<{
    title: string;
    description: string;
    icon: string;
    to?: string;
    disabled?: boolean;
    badge?: { label: string; tone?: 'green' | 'amber' | 'neutral' | 'danger' };
}>();

// Resolve NuxtLink to the real component. Binding the string 'NuxtLink' to
// <component :is> does not resolve at runtime here and renders an inert
// <nuxtlink> element, so navigation silently no-ops.
const NuxtLink = resolveComponent('NuxtLink');
</script>

<style scoped>
.or3-setting-card {
    position: relative;
    display: flex;
    align-items: center;
    gap: 0.9rem;
    min-height: 4.25rem;
    padding: 0.9rem 1rem;
    border-radius: var(--or3-radius-card);
    background: var(--or3-surface);
    border: 1px solid var(--or3-border);
    box-shadow: var(--or3-shadow-soft);
    color: var(--or3-text);
    text-decoration: none;
    overflow: hidden;
    transition:
        transform 0.16s ease,
        box-shadow 0.16s ease,
        border-color 0.16s ease,
        background 0.16s ease;
}

/* Soft accent rail that reveals on hover — gives the row a tactile,
   "selectable" feel without shouting. */
.or3-setting-card::before {
    content: "";
    position: absolute;
    inset: 0 auto 0 0;
    width: 3px;
    background: var(--or3-green);
    transform: scaleY(0);
    transform-origin: center;
    transition: transform 0.18s ease;
}

.or3-setting-card:hover {
    border-color: color-mix(in srgb, var(--or3-green) 32%, var(--or3-border));
    box-shadow: var(--or3-shadow);
    background: color-mix(in srgb, var(--or3-surface) 88%, var(--or3-green-soft) 12%);
}

.or3-setting-card:hover::before {
    transform: scaleY(0.55);
}

.or3-setting-card:active {
    transform: scale(0.985);
}

.or3-setting-card--disabled {
    pointer-events: none;
    opacity: 0.62;
    box-shadow: none;
    background: color-mix(in srgb, var(--or3-surface) 70%, var(--or3-surface-soft) 30%);
}

.or3-setting-card__icon {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
    width: 2.75rem;
    height: 2.75rem;
    border-radius: 14px;
    background: var(--or3-green-soft);
    border: 1px solid color-mix(in srgb, var(--or3-green) 22%, white 78%);
    color: var(--or3-green-dark);
    box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.6);
    transition: transform 0.18s ease;
}

.or3-setting-card:hover .or3-setting-card__icon {
    transform: scale(1.04);
}

.or3-setting-card--disabled .or3-setting-card__icon {
    background: color-mix(in srgb, var(--or3-surface-soft) 70%, white 30%);
    border-color: var(--or3-border);
    color: var(--or3-text-muted);
}

.or3-setting-card__body {
    display: flex;
    flex-direction: column;
    gap: 0.15rem;
    min-width: 0;
    flex: 1 1 auto;
}

.or3-setting-card__title {
    font-family:
        ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas,
        "Liberation Mono", "Courier New", monospace;
    font-size: 0.95rem;
    font-weight: 600;
    line-height: 1.25;
    color: var(--or3-text);
}

.or3-setting-card__desc {
    font-size: 0.8rem;
    line-height: 1.4;
    color: var(--or3-text-muted);
    display: -webkit-box;
    -webkit-line-clamp: 2;
    line-clamp: 2;
    -webkit-box-orient: vertical;
    overflow: hidden;
}

.or3-setting-card__trail {
    display: flex;
    flex-direction: column;
    align-items: flex-end;
    justify-content: center;
    gap: 0.4rem;
    flex-shrink: 0;
}

.or3-setting-card__chevron {
    color: color-mix(in srgb, var(--or3-text-muted) 70%, transparent);
    transition:
        transform 0.16s ease,
        color 0.16s ease;
}

.or3-setting-card:hover .or3-setting-card__chevron {
    color: var(--or3-green-dark);
    transform: translateX(2px);
}

@media (prefers-reduced-motion: reduce) {
    .or3-setting-card,
    .or3-setting-card__icon,
    .or3-setting-card__chevron,
    .or3-setting-card::before {
        transition: none;
    }
}
</style>
