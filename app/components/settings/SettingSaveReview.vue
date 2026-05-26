<template>
    <div
        class="fixed inset-0 z-[60] flex items-end justify-center bg-(--or3-text)/40 p-4 sm:items-center"
        role="dialog"
        aria-modal="true"
        @click.self="$emit('cancel')"
    >
        <SurfaceCard
            class-name="flex w-full max-w-lg max-h-[min(90dvh,calc(100vh-2rem))] flex-col gap-4 overflow-hidden"
        >
            <div class="flex shrink-0 items-start justify-between gap-3">
                <div class="min-w-0">
                    <p
                        class="font-mono text-base font-semibold text-(--or3-text)"
                    >
                        Review changes
                    </p>
                    <p class="mt-1 text-xs leading-5 text-(--or3-text-muted)">
                        You are changing {{ lines.length }} setting{{
                            lines.length === 1 ? '' : 's'
                        }}.
                    </p>
                </div>
                <button
                    type="button"
                    class="or3-focus-ring rounded-full p-1 text-(--or3-text-muted) hover:bg-white/70"
                    aria-label="Close review"
                    @click="$emit('cancel')"
                >
                    <Icon name="i-pixelarticons-close" class="size-5" />
                </button>
            </div>

            <div
                v-if="overall === 'high' || overall === 'medium'"
                class="shrink-0 rounded-xl border px-3 py-2 text-xs leading-5"
                :class="
                    overall === 'high'
                        ? 'border-rose-200 bg-rose-50 text-rose-800'
                        : 'border-amber-200 bg-amber-50 text-amber-800'
                "
            >
                {{
                    overall === 'high'
                        ? 'Some of these changes are risky.'
                        : 'Some of these changes loosen protection.'
                }}
                Read the list below carefully before saving.
            </div>

            <div class="min-h-0 flex-1 overflow-y-auto overscroll-contain">
                <SettingsChangePreviewCard
                    :title="'Settings change preview'"
                    :summary="`You are changing ${lines.length} setting${lines.length === 1 ? '' : 's'}.`"
                    :changes="previewChanges"
                    :risk-level="previewRisk"
                    :exact-diff="exactDiff"
                />
            </div>

            <div
                v-if="error"
                class="shrink-0 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs leading-5 text-rose-800"
            >
                {{ error }}
            </div>

            <div class="flex shrink-0 items-center justify-end gap-2 border-t border-(--or3-border) pt-1">
                <UButton
                    size="sm"
                    color="neutral"
                    variant="outline"
                    label="Review again"
                    @click="$emit('cancel')"
                />
                <UButton
                    size="sm"
                    color="primary"
                    label="Save changes"
                    icon="i-pixelarticons-save"
                    :loading="saving"
                    @click="$emit('confirm')"
                />
            </div>
        </SurfaceCard>
    </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import type { SimpleSettingChange } from '~/settings/simpleSettings';
import {
    useSettingsDiff,
} from '~/composables/settings/useSettingsDiff';

const props = defineProps<{
    changes: SimpleSettingChange[];
    error?: string | null;
    saving?: boolean;
}>();

defineEmits<{
    confirm: [];
    cancel: [];
}>();

const diff = useSettingsDiff();
const lines = computed(() => diff.describeAll(props.changes));
const overall = computed(() => diff.highestSeverity(lines.value));
const previewRisk = computed(() => {
    if (overall.value === 'high') return 'danger';
    if (overall.value === 'medium') return 'warning';
    if (overall.value === 'low') return 'notice';
    return 'safe';
});
const previewChanges = computed(() =>
    props.changes.map((change, index) => ({
        section: change.section,
        channel: change.channel,
        field: change.field,
        operation: 'set',
        new_value: {
            value: change.value,
            summary: diff.formatValue(change.value),
        },
        impact: lines.value[index]?.text,
        metadata_risk: previewRisk.value,
    })),
);
const exactDiff = computed(() =>
    props.changes.map((change) => ({
        path: `${change.section}.${change.field}`,
        new_value: diff.formatValue(change.value),
    })),
);
</script>
