<template>
    <div
        class="fixed inset-0 z-[60] flex items-end justify-center bg-(--or3-text)/40 p-4 sm:items-center"
        role="dialog"
        aria-modal="true"
        @click.self="$emit('cancel')"
    >
        <SurfaceCard class-name="w-full max-w-lg space-y-4">
            <div class="flex items-start justify-between gap-3">
                <div class="min-w-0">
                    <p class="font-mono text-base font-semibold text-(--or3-text)">Review changes</p>
                    <p class="mt-1 text-xs leading-5 text-(--or3-text-muted)">
                        You are changing {{ lines.length }} setting{{ lines.length === 1 ? '' : 's' }}.
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
                class="rounded-xl border px-3 py-2 text-xs leading-5"
                :class="overall === 'high' ? 'border-rose-200 bg-rose-50 text-rose-800' : 'border-amber-200 bg-amber-50 text-amber-800'"
            >
                {{ overall === 'high' ? 'Some of these changes are risky.' : 'Some of these changes loosen protection.' }}
                Read the list below carefully before saving.
            </div>

            <ul class="space-y-2">
                <li
                    v-for="(line, index) in lines"
                    :key="index"
                    class="flex items-start gap-2 rounded-xl border px-3 py-2 text-sm"
                    :class="toneFor(line.severity)"
                >
                    <Icon :name="iconFor(line.severity)" class="mt-0.5 size-4 shrink-0" />
                    <span class="leading-5">{{ line.text }}</span>
                </li>
            </ul>

            <div class="flex items-center justify-end gap-2">
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
import { computed } from 'vue'
import type { SimpleSettingChange } from '~/settings/simpleSettings'
import { useSettingsDiff, type DiffLine } from '~/composables/settings/useSettingsDiff'

const props = defineProps<{
    changes: SimpleSettingChange[]
    saving?: boolean
}>()

defineEmits<{
    confirm: []
    cancel: []
}>()

const diff = useSettingsDiff()
const lines = computed(() => diff.describeAll(props.changes))
const overall = computed(() => diff.highestSeverity(lines.value))

function toneFor(s: DiffLine['severity']): string {
    switch (s) {
        case 'high':
            return 'border-rose-200 bg-rose-50 text-rose-800'
        case 'medium':
            return 'border-amber-200 bg-amber-50 text-amber-800'
        case 'low':
            return 'border-amber-100 bg-amber-50/60 text-amber-800'
        case 'info':
        default:
            return 'border-(--or3-border) bg-white/70 text-(--or3-text)'
    }
}

function iconFor(s: DiffLine['severity']): string {
    switch (s) {
        case 'high':
            return 'i-pixelarticons-warning-box'
        case 'medium':
        case 'low':
            return 'i-pixelarticons-alert'
        default:
            return 'i-pixelarticons-arrow-right'
    }
}
</script>
