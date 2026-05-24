<template>
    <div class="rounded-xl border border-(--or3-border) bg-white/70 px-3 py-3 text-sm">
        <div class="flex items-start justify-between gap-3">
            <div class="min-w-0">
                <p class="font-mono font-semibold text-(--or3-text)">Post-fix check</p>
                <p class="mt-0.5 text-xs leading-5 text-(--or3-text-muted)">
                    {{ statusText }}
                </p>
            </div>
            <UButton
                v-if="planId"
                size="xs"
                color="neutral"
                variant="outline"
                icon="i-pixelarticons-check"
                label="Run checks"
                @click="$emit('run')"
            />
        </div>
    </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import type { DoctorPostCheckResponse } from '~/types/or3-api';

const props = defineProps<{ planId?: string; result?: DoctorPostCheckResponse | null }>();
defineEmits<{ run: [] }>();

const statusText = computed(() => {
    if (!props.result) return 'Run Doctor checks after applying the fix.';
    if (props.result.status === 'passed') return 'Doctor checks passed after the fix.';
    if (props.result.status === 'failed') return 'Doctor found a problem after the fix.';
    return `Doctor check status: ${props.result.status}.`;
});
</script>
