<template>
    <USelectMenu
        :model-value="menuValue"
        :items="items"
        value-key="value"
        :search-input="items.length > 8"
        :loading="loading"
        class="w-full"
        @update:model-value="onSelect"
    />
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { useProviderSettings } from '~/composables/settings/useProviderSettings';

const INHERIT_PROVIDER_VALUE = '__inherit_provider__';

const props = withDefaults(
    defineProps<{
        modelValue: string;
        inheritLabel?: string;
    }>(),
    {
        inheritLabel: 'Reuse chat primary provider',
    },
);

const emit = defineEmits<{
    'update:modelValue': [value: string];
}>();

const settings = useProviderSettings();
const loading = ref(false);

const menuValue = computed(() =>
    props.modelValue.trim() ? props.modelValue.trim() : INHERIT_PROVIDER_VALUE,
);

const items = computed(() => {
    const options = [
        {
            label: props.inheritLabel,
            value: INHERIT_PROVIDER_VALUE,
        },
    ];
    for (const provider of settings.providerStatus.value?.providers ?? []) {
        const label = provider.label?.trim() || provider.key;
        const keyConfigured = provider.apiKeyConfigured ? '' : ' · missing key';
        options.push({
            label: `${label}${keyConfigured}`,
            value: provider.key,
        });
    }
    return options;
});

function onSelect(value: string) {
    emit(
        'update:modelValue',
        value === INHERIT_PROVIDER_VALUE ? '' : String(value ?? '').trim(),
    );
}

onMounted(async () => {
    loading.value = true;
    try {
        await settings.loadProviders();
    } catch {
        /* parent surfaces configure errors */
    } finally {
        loading.value = false;
    }
});
</script>
