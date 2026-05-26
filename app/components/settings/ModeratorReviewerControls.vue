<template>
    <div class="space-y-4">
        <label class="block space-y-2">
            <span class="text-sm font-medium text-(--or3-text)">Reviewer provider</span>
            <ProviderSelectMenu
                :model-value="provider"
                inherit-label="Reuse chat primary provider"
                @update:model-value="onProviderChange"
            />
            <p class="text-xs leading-5 text-(--or3-text-muted)">
                {{ providerSummary }}
            </p>
        </label>

        <label class="block space-y-2">
            <span class="text-sm font-medium text-(--or3-text)">Reviewer model</span>
            <ModelSelectPopover
                :provider="provider"
                :model-value="model"
                allow-inherit
                empty-label="Reuse chat primary model"
                missing-provider-message="Pick a reviewer provider above, or leave provider empty to reuse chat."
                @update:model-value="emit('update:model', $event)"
            />
            <p class="text-xs leading-5 text-(--or3-text-muted)">
                {{ modelSummary }}
            </p>
        </label>
    </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import ModelSelectPopover from './ModelSelectPopover.vue';
import ProviderSelectMenu from './ProviderSelectMenu.vue';

const props = defineProps<{
    provider: string;
    model: string;
}>();

const emit = defineEmits<{
    'update:provider': [value: string];
    'update:model': [value: string];
}>();

const providerSummary = computed(() =>
    props.provider.trim()
        ? `Reviews with the ${props.provider.trim()} provider.`
        : 'Uses the same provider as your main chat model.',
);

const modelSummary = computed(() => {
    if (!props.provider.trim() && !props.model.trim()) {
        return 'Uses the same provider and model as your main chat.';
    }
    if (!props.model.trim()) {
        return 'Uses this provider’s default chat model.';
    }
    return `Reviews with ${props.model.trim()}.`;
});

function onProviderChange(value: string) {
    const previous = props.provider.trim();
    const next = value.trim();
    emit('update:provider', value);
    if (next !== previous) {
        emit('update:model', '');
    }
}
</script>
