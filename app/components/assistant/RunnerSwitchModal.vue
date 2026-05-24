<template>
    <UModal v-model:open="open" :ui="{ content: 'sm:max-w-md' }">
        <template #content>
            <UCard>
                <template #header>
                    <h2 class="text-lg font-semibold text-(--or3-text)">
                        Start a new chat?
                    </h2>
                </template>
                <p class="text-sm leading-6 text-(--or3-text-muted)">
                    This conversation was started with
                    <span class="font-medium text-(--or3-text)">{{
                        currentRunnerLabel
                    }}</span
                    >. To use
                    <span class="font-medium text-(--or3-text)">{{
                        nextRunnerLabel
                    }}</span
                    >, start a fresh chat so replies stay consistent.
                </p>
                <template #footer>
                    <div class="flex flex-wrap justify-end gap-2">
                        <UButton
                            color="neutral"
                            variant="ghost"
                            @click="emit('cancel')"
                        >
                            Keep current agent
                        </UButton>
                        <UButton color="primary" @click="emit('confirm')">
                            Start new chat
                        </UButton>
                    </div>
                </template>
            </UCard>
        </template>
    </UModal>
</template>

<script setup lang="ts">
const open = defineModel<boolean>('open', { default: false });

defineProps<{
    currentRunnerLabel: string;
    nextRunnerLabel: string;
}>();

const emit = defineEmits<{
    confirm: [];
    cancel: [];
}>();
</script>
