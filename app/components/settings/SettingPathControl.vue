<template>
    <div class="flex items-center gap-2">
        <UInput
            :model-value="modelValue"
            :placeholder="placeholder"
            icon="i-pixelarticons-folder"
            class="min-w-0 flex-1"
            :ui="{ base: 'font-mono' }"
            @update:model-value="emit('update:modelValue', String($event ?? ''))"
        />
        <UButton
            color="primary"
            variant="soft"
            icon="pixelarticons:folder"
            :label="buttonLabel"
            class="shrink-0"
            @click="pickerOpen = true"
        />

        <CwdPickerSheet
            :open="pickerOpen"
            :initial-path="modelValue"
            purpose="directory"
            :header-eyebrow="pickerEyebrow"
            :header-title="pickerTitle"
            :header-subtitle="pickerSubtitle"
            :primary-action-label="pickerActionLabel"
            @update:open="pickerOpen = $event"
            @select="onSelect"
        />
    </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue';
import CwdPickerSheet from '~/components/agents/CwdPickerSheet.vue';

const props = withDefaults(
    defineProps<{
        modelValue: string;
        placeholder?: string;
        label?: string;
        buttonLabel?: string;
    }>(),
    {
        placeholder: '/path/to/folder',
        label: 'Folder',
        buttonLabel: 'Browse',
    },
);

const emit = defineEmits<{
    'update:modelValue': [value: string];
}>();

const pickerOpen = ref(false);

const pickerEyebrow = computed(() => props.label.toUpperCase());
const pickerTitle = computed(() => `Choose ${props.label.toLowerCase()}`);
const pickerSubtitle = computed(
    () => 'Pick a folder from approved areas on this computer.',
);
const pickerActionLabel = computed(() => `Use this ${props.label.toLowerCase()}`);

function onSelect(path: string) {
    emit('update:modelValue', path);
}
</script>
