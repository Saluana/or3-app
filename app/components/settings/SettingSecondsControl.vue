<template>
    <div class="space-y-2">
        <div
            class="flex flex-wrap items-center gap-2 rounded-lg border border-(--or3-border) bg-white/65 p-2"
        >
            <UButton
                color="neutral"
                variant="soft"
                icon="i-pixelarticons-minus"
                size="sm"
                square
                aria-label="Decrease timeout"
                :disabled="seconds <= step"
                @click="setSeconds(seconds - step)"
            />
            <div class="min-w-24 flex-1 text-center">
                <p class="font-mono text-sm font-semibold text-(--or3-text)">
                    {{ formattedSeconds }}
                </p>
                <p class="text-[10px] uppercase tracking-wide text-(--or3-text-muted)">
                    seconds
                </p>
            </div>
            <UButton
                color="neutral"
                variant="soft"
                icon="i-pixelarticons-plus"
                size="sm"
                square
                aria-label="Increase timeout"
                @click="setSeconds(seconds + step)"
            />
        </div>

        <div class="flex flex-wrap gap-1.5">
            <button
                v-for="preset in presets"
                :key="preset.value"
                type="button"
                class="rounded-full border px-2 py-1 font-mono text-[11px] transition"
                :class="
                    seconds === preset.value
                        ? 'border-(--or3-green) bg-(--or3-green-soft) text-(--or3-text)'
                        : 'border-(--or3-border) bg-white/75 text-(--or3-text-muted) hover:border-(--or3-green)'
                "
                @click="setSeconds(preset.value)"
            >
                {{ preset.label }}
            </button>
        </div>
    </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import type { SimpleSettingSecondsPreset } from '~/settings/simpleSettings';

const props = withDefaults(
    defineProps<{
        modelValue: unknown;
        presets?: SimpleSettingSecondsPreset[];
        step?: number;
    }>(),
    {
        presets: () => [
            { value: 15, label: '15s' },
            { value: 45, label: '45s' },
            { value: 120, label: '2m' },
            { value: 300, label: '5m' },
        ],
        step: 15,
    },
);

const emit = defineEmits<{
    'update:modelValue': [value: number];
}>();

const seconds = computed(() => {
    const raw =
        typeof props.modelValue === 'number'
            ? props.modelValue
            : Number(String(props.modelValue ?? '').trim());
    return Number.isFinite(raw) && raw > 0 ? Math.round(raw) : 45;
});

const formattedSeconds = computed(() => seconds.value.toLocaleString());

function setSeconds(next: number) {
    emit('update:modelValue', Math.max(props.step, Math.round(next)));
}
</script>
