<template>
    <div
        class="space-y-3 rounded-xl border border-(--or3-border) bg-white/70 px-3 py-3"
        :class="error ? 'border-rose-200 bg-rose-50/45' : ''"
    >
        <div class="flex items-start justify-between gap-3">
            <div class="min-w-0">
                <p class="font-mono text-sm font-semibold text-(--or3-text)">
                    {{ title }}
                </p>
                <p v-if="summary" class="mt-1 text-xs leading-5 text-(--or3-text-muted)">
                    {{ summary }}
                </p>
            </div>
            <StatusPill v-if="statusLabel" :label="statusLabel" :tone="statusTone" class="shrink-0" />
        </div>

        <div
            v-if="error"
            class="rounded-lg border border-rose-200 bg-white/75 px-3 py-2 text-xs leading-5 text-rose-800"
        >
            <p class="font-mono font-semibold">This plan can’t be applied yet</p>
            <p class="mt-1">{{ error }}</p>
        </div>

        <ul v-if="changes.length" class="space-y-2">
            <li
                v-for="(change, index) in changes"
                :key="`${changePath(change)}.${index}`"
                class="rounded-lg border border-(--or3-border) bg-(--or3-surface) px-3 py-2 text-xs leading-5"
            >
                <p class="font-mono font-semibold text-(--or3-text)">
                    {{ changePath(change) }}
                </p>
                <p v-if="change.impact" class="mt-1 text-(--or3-text-muted)">
                    {{ change.impact }}
                </p>
                <dl class="mt-2 grid gap-1 text-(--or3-text-muted) sm:grid-cols-[5.5rem_minmax(0,1fr)]">
                    <dt>Current</dt>
                    <dd class="wrap-break-word font-mono text-(--or3-text)">{{ valueLabel(change.old_value, 'Not shown') }}</dd>
                    <dt>New</dt>
                    <dd class="wrap-break-word font-mono text-green-700">{{ valueLabel(change.new_value, 'Missing') }}</dd>
                </dl>
                <p v-if="change.risk_reason" class="mt-2 text-(--or3-text-muted)">
                    {{ change.risk_reason }}
                </p>
            </li>
        </ul>

        <p
            v-else
            class="rounded-lg border border-(--or3-border) bg-(--or3-surface) px-3 py-2 text-xs leading-5 text-(--or3-text-muted)"
        >
            No readable settings changes were included with this plan.
        </p>

        <details
            v-if="validationFailures.length"
            class="rounded-lg border border-rose-200 bg-white/70"
            open
        >
            <summary class="cursor-pointer px-3 py-2 font-mono text-[11px] uppercase tracking-wide text-rose-800">
                Validation issues
            </summary>
            <ul class="space-y-1 border-t border-rose-200 p-3 text-xs leading-5 text-rose-800">
                <li v-for="result in validationFailures" :key="`${result.check}:${result.message}`">
                    {{ result.message || result.check }}
                </li>
            </ul>
        </details>

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

        <div v-if="$slots.actions" class="flex flex-wrap items-center justify-end gap-2 pt-1">
            <slot name="actions" />
        </div>
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
    status?: string;
    error?: string;
    applyState?: 'ready' | 'needs_fix' | 'applied' | 'rolled_back' | 'failed';
}>();

const title = computed(() => props.plan?.title || props.title || 'Settings change preview');
const summary = computed(() => props.plan?.summary || props.summary || '');
const changes = computed(() => props.plan?.changes ?? props.changes ?? []);
const exactDiff = computed(() => props.plan?.exact_config_diff ?? props.exactDiff ?? []);
const risk = computed(() => props.plan?.risk_level ?? props.riskLevel ?? 'notice');
const validationFailures = computed(() =>
    (props.plan?.validation_results ?? []).filter(
        (result) => result.status === 'fail' || result.status === 'error',
    ),
);
const statusLabel = computed(() => {
    if (props.applyState === 'applied') return 'Applied';
    if (props.applyState === 'rolled_back') return 'Reverted';
    if (props.applyState === 'failed') return 'Failed';
    if (props.applyState === 'ready') return 'Ready to apply';
    if (
        props.applyState === 'needs_fix' ||
        props.error ||
        validationFailures.value.length
    ) {
        return 'Needs fix';
    }
    if (props.status) return props.status;
    if (!risk.value) return '';
    return risk.value.toUpperCase();
});
const statusTone = computed<'green' | 'amber' | 'danger' | 'neutral'>(() => {
    if (props.applyState === 'applied') return 'green';
    if (props.applyState === 'rolled_back') return 'neutral';
    if (props.applyState === 'failed') return 'danger';
    if (props.applyState === 'ready') return 'green';
    if (
        props.applyState === 'needs_fix' ||
        props.error ||
        validationFailures.value.length
    ) {
        return 'danger';
    }
    if (risk.value === 'safe') return 'green';
    if (risk.value === 'danger' || risk.value === 'warning') return 'danger';
    if (risk.value === 'notice') return 'amber';
    return 'neutral';
});

function changePath(change: DoctorSettingsPlanChange) {
    if (change.config_path?.trim()) return change.config_path.trim();
    const section = change.section?.trim();
    const field = change.field?.trim();
    if (section && field) return `${section}.${field}`;
    if (field) return field;
    if (section) return section;
    return 'Unknown setting';
}

function valueLabel(value: DoctorSettingsPlanChange['old_value'], fallback: string) {
    if (!value) return fallback;
    if (value.summary) return value.summary;
    if (value.redacted) return value.present ? 'Configured (hidden)' : 'Hidden';
    if (value.value === null || value.value === undefined || value.value === '') return fallback;
    if (typeof value.value === 'boolean') return value.value ? 'On' : 'Off';
    if (typeof value.value === 'object') return JSON.stringify(value.value);
    return String(value.value);
}
</script>
