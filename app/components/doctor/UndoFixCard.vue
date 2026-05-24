<template>
    <div v-if="rollbackId || planId" class="rounded-xl border border-green-200 bg-green-50 px-3 py-3 text-sm text-green-800">
        <div class="flex items-start justify-between gap-3">
            <div class="min-w-0">
                <p class="font-mono font-semibold">Undo available</p>
                <p class="mt-0.5 text-xs leading-5">
                    OR3 saved a rollback record for this applied fix.
                </p>
            </div>
            <UButton
                v-if="planId"
                size="xs"
                color="neutral"
                variant="outline"
                icon="i-pixelarticons-undo"
                label="Undo"
                @click="$emit('undo')"
            />
        </div>
    </div>
</template>

<script setup lang="ts">
defineProps<{ planId?: string; rollbackId?: string }>();
defineEmits<{ undo: [] }>();
</script>
