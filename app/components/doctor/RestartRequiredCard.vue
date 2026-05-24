<template>
    <div
        class="space-y-3 rounded-xl border border-amber-200 bg-amber-50 px-3 py-3 text-sm text-amber-800"
    >
        <div class="flex items-start gap-2">
            <Icon
                name="i-pixelarticons-reload"
                class="mt-0.5 size-4 shrink-0"
            />
            <div class="min-w-0 flex-1">
                <p class="font-mono font-semibold">Restart required</p>
                <p class="mt-0.5 text-xs leading-5">
                    This plan changes settings that need or3-intern to restart.
                    The app will suppress temporary reconnect noise and resume
                    post-checks after the service comes back.
                </p>
                <p
                    v-if="result?.restart_error"
                    class="mt-2 text-xs leading-5 text-rose-800"
                >
                    {{ result.restart_error }}
                </p>
            </div>
        </div>
        <UButton
            v-if="showManualRestart"
            size="xs"
            color="neutral"
            variant="outline"
            icon="i-pixelarticons-reload"
            label="Restart service"
            :loading="restart.restartingService.value"
            @click="requestRestart"
        />
    </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import type { DoctorPlanApplyResponse } from '~/types/or3-api';
import { useServiceRestart } from '~/composables/useServiceRestart';

const props = defineProps<{
    result?: DoctorPlanApplyResponse | null;
    showManualRestart?: boolean;
}>();
const restart = useServiceRestart();
const showManualRestart = computed(
    () => props.showManualRestart || Boolean(props.result?.manual_recovery),
);

async function requestRestart() {
    await restart.restartService();
}
</script>
