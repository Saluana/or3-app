<template>
    <ModelSelectPopover
        :provider="provider"
        :model-value="String(currentValue ?? '').trim()"
        :model-kind="control.modelKind === 'embeddings' ? 'embeddings' : 'chat'"
        @update:model-value="choose"
    />
</template>

<script setup lang="ts">
import { computed } from 'vue';
import type {
    SimpleSettingChange,
    SimpleSettingControl,
} from '~/settings/simpleSettings';
import ModelSelectPopover from './ModelSelectPopover.vue';

const props = defineProps<{
    control: SimpleSettingControl;
    currentValue: unknown;
    valueIndex: Record<string, unknown>;
    pendingChanges: SimpleSettingChange[];
}>();

const emit = defineEmits<{
    change: [change: SimpleSettingChange];
}>();

const roleProviderField = computed(() => {
    switch (props.control.modelRole) {
        case 'agents':
            return 'agentsProvider';
        case 'summarization':
            return 'summarizationProvider';
        case 'embeddings':
            return 'embeddingsProvider';
        default:
            return 'chatProvider';
    }
});

const provider = computed(() => {
    const pending = props.pendingChanges.find(
        (change) =>
            change.section === 'routing' &&
            change.field === roleProviderField.value,
    );
    return String(
        pending?.value ??
            props.valueIndex[`routing.${roleProviderField.value}`] ??
            props.valueIndex['provider.kind'] ??
            '',
    ).trim();
});

function primaryRef() {
    return props.control.fieldRefs[0];
}

function choose(model: string) {
    const ref = primaryRef();
    if (!ref) return;
    emit('change', {
        section: ref.section,
        field: ref.field,
        channel: ref.channel,
        value: model,
    });
}
</script>
