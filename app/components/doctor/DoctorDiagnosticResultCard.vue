<template>
    <div class="rounded-xl border px-3 py-2 text-sm" :class="toneClass">
        <div class="flex items-start gap-2">
            <Icon :name="iconName" class="mt-0.5 size-4 shrink-0" />
            <div class="min-w-0 flex-1">
                <p class="font-mono font-semibold">{{ card.what_i_found }}</p>
                <p
                    v-if="detailText"
                    class="mt-0.5 text-xs leading-5"
                >
                    {{ detailText }}
                </p>
                <details v-if="card.advanced_details" class="mt-2">
                    <summary class="cursor-pointer font-mono text-[11px] uppercase tracking-wide">
                        Advanced details
                    </summary>
                    <pre class="mt-2 max-h-48 overflow-auto rounded-lg bg-white/70 p-2 text-[11px] whitespace-pre-wrap">{{ formattedDetails }}</pre>
                </details>
            </div>
        </div>
    </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import type { DoctorFindingCard } from '~/types/or3-api';

const props = defineProps<{ card: DoctorFindingCard }>();

function normalizeFindingText(value?: string) {
    return String(value ?? '')
        .trim()
        .replace(/\s+/g, ' ');
}

const detailText = computed(() => {
    const summary = normalizeFindingText(props.card.what_i_found);
    const detail = normalizeFindingText(
        props.card.what_this_means || 'Doctor reported this finding.',
    );
    if (!summary || detail === summary) return '';
    return props.card.what_this_means || 'Doctor reported this finding.';
});

const risk = computed(() => props.card.risk_level ?? 'notice');
const toneClass = computed(() => {
    switch (risk.value) {
        case 'safe':
            return 'border-green-200 bg-green-50/70 text-green-800';
        case 'warning':
        case 'danger':
            return 'border-rose-200 bg-rose-50/70 text-rose-800';
        case 'notice':
        default:
            return 'border-amber-200 bg-amber-50/70 text-amber-800';
    }
});
const iconName = computed(() =>
    risk.value === 'safe'
        ? 'i-pixelarticons-check'
        : risk.value === 'warning' || risk.value === 'danger'
          ? 'i-pixelarticons-warning-box'
          : 'i-pixelarticons-alert',
);
const formattedDetails = computed(() => {
    try {
        return JSON.stringify(props.card.advanced_details, null, 2);
    } catch {
        return String(props.card.advanced_details ?? '');
    }
});
</script>
