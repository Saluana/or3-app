<template>
    <UPopover
        v-model:open="isOpen"
        :content="{ side: 'top', align: 'center', sideOffset: 6 }"
    >
        <button type="button" class="or3-info-hint" :aria-label="text">
            <Icon name="mdi:information-symbol" class="size-3.5" />
        </button>
        <template #content>
            <div class="or3-info-popover">
                <p>{{ text }}</p>
            </div>
        </template>
    </UPopover>
</template>

<script setup lang="ts">
import { useHintGroup } from '~/composables/useHintGroup';

defineProps<{
    text: string;
}>();

const { createHintOpen } = useHintGroup();
const isOpen = createHintOpen();
</script>

<style scoped>
.or3-info-hint {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 1.2rem;
    height: 1.2rem;
    border-radius: 50%;
    background: var(--or3-surface-soft);
    border: 1px solid var(--or3-border);
    color: var(--or3-text-muted);
    cursor: pointer;
    flex-shrink: 0;
    transition:
        background 140ms ease,
        color 140ms ease,
        border-color 140ms ease;
}
.or3-info-hint:hover {
    background: var(--or3-green-soft);
    border-color: color-mix(
        in srgb,
        var(--or3-green) 30%,
        var(--or3-border) 70%
    );
    color: var(--or3-green-dark);
}
</style>

<style>
.or3-info-popover {
    max-width: 260px;
    padding: 0.6rem 0.8rem;
    font-size: 0.78rem;
    line-height: 1.5;
    color: var(--or3-text);
}
</style>
