<template>
    <div class="space-y-3">
        <UTextarea
            :model-value="modelValue"
            :rows="10"
            autoresize
            class="font-mono text-sm"
            placeholder="Add plain-language rules for OR3's approval reviewer…"
            @update:model-value="emit('update:modelValue', String($event ?? ''))"
        />
        <div class="flex flex-wrap gap-2">
            <UButton
                size="sm"
                color="neutral"
                variant="soft"
                icon="i-pixelarticons-sparkle"
                @click="insertExamples"
            >
                Insert examples
            </UButton>
            <UButton
                size="sm"
                color="neutral"
                variant="soft"
                icon="i-pixelarticons-reload"
                @click="resetStarter"
            >
                Reset to starter
            </UButton>
            <UButton
                size="sm"
                color="neutral"
                variant="soft"
                icon="i-pixelarticons-close"
                @click="emit('update:modelValue', '')"
            >
                Clear
            </UButton>
        </div>
        <p class="text-xs leading-5 text-(--or3-text-muted)">
            {{
                dirty
                    ? 'Unsaved changes — review and save when ready.'
                    : 'Saved rules are stored on your OR3 host.'
            }}
        </p>
    </div>
</template>

<script setup lang="ts">
import {
    MODERATOR_POLICY_EXAMPLES,
    MODERATOR_STARTER_POLICY,
} from '~/utils/or3/moderator-settings';

defineProps<{
    modelValue: string;
    dirty?: boolean;
}>();

const emit = defineEmits<{
    'update:modelValue': [string];
}>();

function insertExamples() {
    const block = MODERATOR_POLICY_EXAMPLES.map((line) => `- ${line}`).join(
        '\n',
    );
    emit('update:modelValue', block);
}

function resetStarter() {
    emit('update:modelValue', MODERATOR_STARTER_POLICY);
}
</script>
