<template>
    <div class="space-y-2">
        <div class="flex items-center justify-between gap-3">
            <p class="font-mono text-xs uppercase tracking-wide text-(--or3-text-muted)">{{ label }}</p>
            <span
                v-if="activePresetLabel"
                class="rounded-full border border-(--or3-border) bg-white/70 px-2 py-0.5 font-mono text-[11px] text-(--or3-text)"
            >{{ activePresetLabel }}</span>
        </div>

        <div class="grid gap-1" :style="{ gridTemplateColumns: `repeat(${slots.length}, minmax(0, 1fr))` }">
            <button
                v-for="(slot, i) in slots"
                :key="slot.id"
                type="button"
                class="or3-focus-ring rounded-xl border px-2 py-2 text-center font-mono text-[11px] uppercase tracking-wide transition"
                :class="slot.id === activeId
                    ? 'border-(--or3-green) bg-(--or3-green-soft) text-(--or3-green-dark)'
                    : 'border-(--or3-border) bg-white/70 text-(--or3-text) hover:bg-(--or3-green-soft)'"
                :aria-pressed="slot.id === activeId"
                @click="onSelect(slot)"
            >{{ slot.label }}<span v-if="i === 0" class="sr-only"> (lowest)</span></button>
        </div>

        <p v-if="activeDescription" class="text-xs leading-5 text-(--or3-text-muted)">
            {{ activeDescription }}
        </p>
    </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import type { SimpleSettingPreset } from '~/settings/simpleSettings'

interface Slot {
    id: string
    label: string
    description?: string
    preset?: SimpleSettingPreset
}

const props = defineProps<{
    label: string
    presets: SimpleSettingPreset[]
    /** id of the matching preset, or null when the slider is in Custom. */
    activeId: string | null
    /** Whether to show the trailing Custom slot. */
    showCustom?: boolean
}>()

const emit = defineEmits<{
    select: [preset: SimpleSettingPreset]
    custom: []
}>()

const slots = computed<Slot[]>(() => {
    const base: Slot[] = props.presets.map((p) => ({
        id: p.id,
        label: p.label,
        description: p.description,
        preset: p,
    }))
    if (props.showCustom !== false) {
        base.push({ id: 'custom', label: 'Custom', description: 'Use Advanced Settings to fine-tune.' })
    }
    return base
})

const activePresetLabel = computed(() => {
    const found = slots.value.find((s) => s.id === props.activeId)
    return found?.label ?? 'Custom'
})

const activeDescription = computed(() => {
    const found = slots.value.find((s) => s.id === props.activeId)
    return found?.description ?? ''
})

function onSelect(slot: Slot) {
    if (slot.preset) emit('select', slot.preset)
    else emit('custom')
}
</script>
