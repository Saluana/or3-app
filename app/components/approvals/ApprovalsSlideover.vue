<template>
    <USlideover
        v-model:open="open"
        :side="side"
        :ui="{ content: contentClass }"
    >
        <template #content>
            <UCard
                class="or3-approvals-slideover bg-(--or3-background)"
                :class="side === 'bottom' ? 'or3-approvals-slideover--bottom' : 'or3-approvals-slideover--side'"
            >
                <template #header>
                    <div class="or3-approvals-slideover__header">
                        <div>
                            <p class="or3-approvals-slideover__eyebrow">Approvals</p>
                            <h2 class="or3-approvals-slideover__title">Requests</h2>
                        </div>
                        <UButton
                            icon="i-pixelarticons-close"
                            color="neutral"
                            variant="ghost"
                            square
                            aria-label="Close approvals"
                            @click="open = false"
                        />
                    </div>
                </template>

                <ApprovalsPanel :open="open" />
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
const side = computed<'bottom' | 'right'>(() =>
    isDesktop.value ? 'right' : 'bottom',
);
const contentClass = computed(() =>
    side.value === 'bottom'
        ? 'or3-approvals-slideover-shell or3-approvals-slideover-shell--bottom h-[92dvh] rounded-t-3xl'
        : 'or3-approvals-slideover-shell or3-approvals-slideover-shell--side sm:max-w-xl',
);

const open = computed({
    get: () => props.open ?? false,
    set: (value: boolean) => emit('update:open', value),
});
</script>

<style scoped>
.or3-approvals-slideover {
    display: flex;
    flex-direction: column;
}

.or3-approvals-slideover--bottom {
    min-height: 100%;
}

.or3-approvals-slideover--side {
    min-height: 100dvh;
}

.or3-approvals-slideover :deep([data-slot="body"]) {
    flex: 1;
    overflow-y: auto;
    min-height: 0;
}

.or3-approvals-slideover-shell--bottom {
    align-items: end;
}

.or3-approvals-slideover-shell--side {
    align-items: stretch;
}

.or3-approvals-slideover__header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 1rem;
}

.or3-approvals-slideover__eyebrow {
    color: var(--or3-text-muted);
    font-size: 0.72rem;
    font-weight: 800;
    letter-spacing: 0.08em;
    text-transform: uppercase;
}

.or3-approvals-slideover__title {
    font-size: 1.25rem;
    font-weight: 850;
}
</style>
