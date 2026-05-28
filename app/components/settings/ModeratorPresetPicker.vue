<template>
    <div class="space-y-3">
        <div class="grid gap-2 sm:grid-cols-2">
            <button
                v-for="preset in presets"
                :key="preset.id"
                type="button"
                class="or3-preset-option"
                :class="{ 'or3-preset-option--active': modelValue === preset.id }"
                @click="selectPreset(preset.id)"
            >
                <span class="flex items-center gap-2">
                    <span class="font-mono text-sm font-semibold text-(--or3-text)">
                        {{ preset.label }}
                    </span>
                    <UBadge
                        v-if="preset.recommended"
                        color="success"
                        variant="subtle"
                    >
                        Recommended
                    </UBadge>
                </span>
            </button>
            <button
                v-if="modelValue === 'custom'"
                key="custom"
                type="button"
                class="or3-preset-option or3-preset-option--active"
            >
                <span class="font-mono text-sm font-semibold text-(--or3-text)">
                    Custom
                </span>
            </button>
        </div>
        <p
            v-if="selectedPreset"
            class="rounded-2xl border border-(--or3-border) bg-white/70 px-4 py-3 text-sm leading-6 text-(--or3-text-muted)"
        >
            {{ selectedPreset.description }}
        </p>
        <p
            v-else-if="modelValue === 'custom'"
            class="rounded-2xl border border-amber-200 bg-amber-50/80 px-4 py-3 text-sm leading-6 text-amber-900"
        >
            Custom: your per-risk overrides do not match a preset. Advanced
            controls below show the effective behavior.
        </p>
    </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import {
    MODERATOR_UI_PRESETS,
    presetById,
    type ModeratorBackendPreset,
} from '~/utils/or3/moderator-settings';

const props = defineProps<{
    modelValue: ModeratorBackendPreset | 'custom';
}>();

const emit = defineEmits<{
    select: [ModeratorBackendPreset | 'custom'];
}>();

const presets = MODERATOR_UI_PRESETS;

const selectedPreset = computed(() => {
    if (props.modelValue === 'custom') return null;
    return presetById(String(props.modelValue));
});

function selectPreset(id: ModeratorBackendPreset) {
    emit('select', id);
}
</script>

<style scoped>
.or3-preset-option {
    display: block;
    width: 100%;
    text-align: left;
    padding: 0.85rem 1rem;
    border-radius: 16px;
    border: 1px solid var(--or3-border);
    background: white;
    transition:
        border-color 0.15s ease,
        background 0.15s ease,
        box-shadow 0.15s ease;
}
.or3-preset-option:hover {
    border-color: color-mix(in srgb, var(--or3-green) 35%, var(--or3-border) 65%);
}
.or3-preset-option--active {
    border-color: var(--or3-green);
    background: var(--or3-green-soft);
    box-shadow: var(--or3-shadow-soft);
}
</style>
