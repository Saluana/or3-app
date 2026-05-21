<template>
    <USlideover v-model:open="open" :side="side" :ui="{ content: contentClass }">
        <template #content>
            <UCard
                class="or3-pairing-sheet"
                :class="side === 'bottom' ? 'or3-pairing-sheet--bottom' : 'or3-pairing-sheet--side'"
            >
                <template #header>
                    <div class="or3-pairing-sheet__header">
                        <div class="flex min-w-0 items-start gap-3">
                            <span class="or3-pairing-sheet__icon">
                                <Icon name="i-pixelarticons-link" class="size-5" />
                            </span>
                            <div class="min-w-0">
                                <p class="or3-pairing-sheet__eyebrow">Pair device</p>
                                <h2 class="or3-pairing-sheet__title">Connect to a computer</h2>
                            </div>
                        </div>
                        <UButton
                            icon="i-pixelarticons-close"
                            color="neutral"
                            variant="ghost"
                            square
                            aria-label="Close pairing"
                            @click="open = false"
                        />
                    </div>
                </template>

                <div class="or3-pairing-sheet__body">
                    <SecurePairingCard />
                    <NuxtLink class="or3-pairing-sheet__settings" to="/settings/pair" @click="open = false">
                        Advanced pairing settings
                    </NuxtLink>
                </div>
            </UCard>
        </template>
    </USlideover>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { useIsDesktop } from '~/composables/useViewport';

const props = defineProps<{
    open?: boolean;
}>();

const emit = defineEmits<{
    'update:open': [value: boolean];
}>();

const isDesktop = useIsDesktop();
const side = computed<'bottom' | 'right'>(() => (isDesktop.value ? 'right' : 'bottom'));
const contentClass = computed(() =>
    side.value === 'bottom'
        ? 'or3-pairing-sheet-shell or3-pairing-sheet-shell--bottom h-[92dvh] rounded-t-3xl'
        : 'or3-pairing-sheet-shell or3-pairing-sheet-shell--side sm:max-w-xl',
);

const open = computed({
    get: () => props.open ?? false,
    set: (value: boolean) => emit('update:open', value),
});
</script>

<style scoped>
.or3-pairing-sheet {
    display: flex;
    min-height: 100%;
    flex-direction: column;
    background: var(--or3-bg, #faf4e6);
}

.or3-pairing-sheet--side {
    min-height: 100dvh;
}

.or3-pairing-sheet__header {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 1rem;
}

.or3-pairing-sheet__icon {
    display: grid;
    width: 2.75rem;
    height: 2.75rem;
    flex: 0 0 auto;
    place-items: center;
    border: 1px solid color-mix(in srgb, var(--or3-green, #71a75f) 28%, white 72%);
    border-radius: 0.85rem;
    background: var(--or3-green-soft, #e1efe4);
    color: var(--or3-green-dark, #28623b);
}

.or3-pairing-sheet__eyebrow {
    margin: 0 0 0.2rem;
    font-family: var(--font-mono, ui-monospace, monospace);
    font-size: 0.7rem;
    font-weight: 700;
    letter-spacing: 0.14em;
    text-transform: uppercase;
    color: var(--or3-text-muted, #6f6a60);
}

.or3-pairing-sheet__title {
    margin: 0;
    font-family: var(--font-display, 'Press Start 2P', monospace);
    font-size: 0.95rem;
    line-height: 1.45;
    color: var(--or3-text, #24241f);
}

.or3-pairing-sheet__body {
    flex: 1;
    min-height: 0;
    overflow-y: auto;
    padding: 1rem;
}

.or3-pairing-sheet__body :deep(.or3-surface) {
    border-radius: 1rem;
}

.or3-pairing-sheet__settings {
    display: inline-flex;
    margin-top: 0.9rem;
    color: var(--or3-green-dark, #28623b);
    font-size: 0.875rem;
    font-weight: 700;
    text-decoration: underline;
    text-underline-offset: 3px;
}

.or3-pairing-sheet-shell--bottom {
    align-items: end;
}

.or3-pairing-sheet-shell--side {
    align-items: stretch;
}
</style>
