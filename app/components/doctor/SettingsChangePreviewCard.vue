<template>
    <div class="space-y-3 rounded-xl border border-(--or3-border) bg-white/70 px-3 py-3">
        <div class="flex items-start justify-between gap-3">
            <div class="min-w-0">
                <p class="font-mono text-sm font-semibold text-(--or3-text)">
                    {{ title }}
                </p>
                <p v-if="summary" class="mt-1 text-xs leading-5 text-(--or3-text-muted)">
                    {{ summary }}
                </p>
            </div>
            <StatusPill :label="riskLabel" :tone="riskTone" class="shrink-0" />
        </div>

        <ul class="space-y-2">
            <li
                v-for="(change, index) in changes"
                :key="`${change.section}.${change.field}.${index}`"
                class="rounded-lg border border-(--or3-border) bg-(--or3-surface) px-3 py-2 text-xs leading-5"
            >
                <p class="font-mono font-semibold text-(--or3-text)">
                    {{ change.section }}.{{ change.field }}
                </p>
                <p class="text-(--or3-text-muted)">
                    {{ change.impact || valueSummary(change) }}
                </p>
            </li>
        </ul>

        <details v-if="exactDiff.length" class="rounded-lg border border-(--or3-border) bg-(--or3-surface)">
            <summary class="cursor-pointer px-3 py-2 font-mono text-[11px] uppercase tracking-wide text-(--or3-text-muted)">
                Show exact config diff
            </summary>
            <ul class="border-t border-(--or3-border) p-3 font-mono text-[11px]">
                <li v-for="line in exactDiff" :key="`${line.path}:${line.old_value}:${line.new_value}`" class="break-all">
                    <span class="text-(--or3-text-muted)">{{ line.path }}</span>
                    <span class="mx-1 text-(--or3-text-muted)">:</span>
                    <span class="text-rose-700">{{ line.old_value ?? 'unset' }}</span>
                    <span class="mx-1 text-(--or3-text-muted)">→</span>
                    <span class="text-green-700">{{ line.new_value ?? 'unset' }}</span>
                </li>
            </ul>
        </details>
    </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import type { DoctorSettingsChangePlan, DoctorSettingsPlanChange } from '~/types/or3-api';

const props = defineProps<{
    plan?: DoctorSettingsChangePlan | null;
    title?: string;
    summary?: string;
    changes?: DoctorSettingsPlanChange[];
    riskLevel?: string;
    exactDiff?: DoctorSettingsChangePlan['exact_config_diff'];
}>();

const title = computed(() => props.plan?.title || props.title || 'Settings change preview');
const summary = computed(() => props.plan?.summary || props.summary || '');
const changes = computed(() => props.plan?.changes ?? props.changes ?? []);
const exactDiff = computed(() => props.plan?.exact_config_diff ?? props.exactDiff ?? []);
const risk = computed(() => props.plan?.risk_level ?? props.riskLevel ?? 'notice');
const riskLabel = computed(() => risk.value.toUpperCase());
const riskTone = computed<'green' | 'amber' | 'danger' | 'neutral'>(() => {
    if (risk.value === 'safe') return 'green';
    if (risk.value === 'danger' || risk.value === 'warning') return 'danger';
    if (risk.value === 'notice') return 'amber';
    return 'neutral';
});

function valueSummary(change: DoctorSettingsPlanChange) {
    const oldValue = change.old_value?.summary ?? change.old_value?.value ?? 'current value';
    const newValue = change.new_value?.summary ?? change.new_value?.value ?? 'new value';
    return `${oldValue} -> ${newValue}`;
}
</script>
