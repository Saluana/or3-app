<template>
    <UModal v-model:open="openProxy" :ui="{ content: 'sm:max-w-md' }">
        <template #content>
            <div class="space-y-4 p-5">
                <DangerCallout tone="danger" :title="title">
                    <span class="font-semibold">{{ itemName }}</span>
                    <span v-if="consequence">: {{ consequence }}</span>
                </DangerCallout>

                <div class="rounded-2xl border border-(--or3-border) bg-white/70 p-3 text-sm leading-6 text-(--or3-text-muted)">
                    <span class="font-mono text-xs font-semibold uppercase tracking-wide text-(--or3-text)">
                        Undo
                    </span>
                    <p class="mt-1">{{ undoAvailability }}</p>
                </div>

                <p v-if="error" class="text-sm text-(--or3-danger)">
                    {{ error }}
                </p>

                <div class="flex justify-end gap-2">
                    <UButton
                        label="Cancel"
                        color="neutral"
                        variant="ghost"
                        :disabled="loading"
                        @click="openProxy = false"
                    />
                    <UButton
                        :label="confirmLabel"
                        color="error"
                        :loading="loading"
                        @click="$emit('confirm')"
                    />
                </div>
            </div>
        </template>
    </UModal>
</template>

<script setup lang="ts">
import { computed } from 'vue';

const props = withDefaults(
    defineProps<{
        open: boolean;
        title?: string;
        itemName: string;
        consequence: string;
        undoAvailability: string;
        confirmLabel?: string;
        loading?: boolean;
        error?: string;
    }>(),
    {
        title: 'Confirm this change?',
        confirmLabel: 'Confirm',
        loading: false,
        error: '',
    },
);

const emit = defineEmits<{
    'update:open': [value: boolean];
    confirm: [];
}>();

const openProxy = computed({
    get: () => props.open,
    set: (value: boolean) => emit('update:open', value),
});
</script>
