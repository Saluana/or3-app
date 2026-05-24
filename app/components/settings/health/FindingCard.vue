<template>
    <div>
        <DoctorDiagnosticResultCard
            v-if="finding.doctorCard"
            :card="finding.doctorCard"
            @fix="$emit('fix')"
        />
        <div
            v-else
            class="rounded-xl border px-3 py-2 text-sm"
            :class="toneClass"
        >
            <div class="flex items-start gap-2">
                <Icon :name="iconName" class="mt-0.5 size-4 shrink-0" />
                <div class="min-w-0 flex-1">
                    <p class="font-mono font-semibold">{{ finding.label }}</p>
                    <p class="mt-0.5 text-xs leading-5">{{ finding.detail }}</p>
                </div>
                <div class="flex shrink-0 flex-col items-end gap-1">
                    <NuxtLink
                        v-if="finding.fixHref"
                        :to="finding.fixHref"
                        class="rounded-full border border-current px-2 py-0.5 font-mono text-[11px] uppercase tracking-wide hover:bg-white/40"
                    >
                        {{ finding.fixLabel ?? 'Open' }}
                    </NuxtLink>
                </div>
            </div>
            <div class="mt-2 flex justify-end">
                <button
                    type="button"
                    class="inline-flex items-center gap-1 rounded-full border border-(--or3-border) bg-white/60 px-2 py-0.5 font-mono text-[11px] uppercase tracking-wide text-(--or3-text-muted) transition hover:border-(--or3-green)/40 hover:text-(--or3-green-dark)"
                    @click="$emit('ask')"
                >
                    <Icon name="i-pixelarticons-message-text" class="size-3" />
                    Ask
                </button>
            </div>
        </div>
    </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import type {
    HealthFinding,
    HealthStatus,
} from '~/composables/settings/useSettingsHealth';

const props = defineProps<{ finding: HealthFinding }>();
defineEmits<{ (e: 'ask'): void; (e: 'fix'): void }>();

const toneClass = computed(() => {
    switch (props.finding.status as HealthStatus) {
        case 'ok':
            return 'border-green-200 bg-green-50/70 text-green-800';
        case 'warning':
            return 'border-amber-200 bg-amber-50/70 text-amber-800';
        case 'error':
            return 'border-rose-200 bg-rose-50/70 text-rose-800';
        default:
            return 'border-(--or3-border) bg-white/70 text-(--or3-text-muted)';
    }
});

const iconName = computed(() => {
    switch (props.finding.status as HealthStatus) {
        case 'ok':
            return 'i-pixelarticons-check';
        case 'warning':
            return 'i-pixelarticons-alert';
        case 'error':
            return 'i-pixelarticons-warning-box';
        default:
            return 'i-pixelarticons-loader';
    }
});
</script>
