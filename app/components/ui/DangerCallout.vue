<template>
    <div :class="['rounded-2xl border p-3 text-sm leading-6', toneClass]">
        <div class="flex items-start gap-3">
            <div
                :class="[
                    'mt-0.5 grid size-8 shrink-0 place-items-center rounded-xl',
                    iconBg,
                ]"
            >
                <Icon :name="iconName" :class="['size-4', iconColor]" />
            </div>
            <div class="min-w-0 flex-1">
                <div class="flex items-start justify-between gap-2">
                    <p :class="['font-semibold', titleColor]">{{ title }}</p>
                    <button
                        v-if="dismissible"
                        type="button"
                        class="or3-callout-dismiss or3-focus-ring"
                        :aria-label="dismissLabel"
                        @click="$emit('dismiss')"
                    >
                        <Icon name="i-pixelarticons-close" class="size-4" />
                    </button>
                </div>
                <div
                    v-if="$slots.default || description"
                    :class="['mt-1', bodyColor]"
                >
                    <slot>{{ description }}</slot>
                </div>
                <div
                    v-if="$slots.actions"
                    class="mt-3 flex flex-wrap justify-end gap-2"
                >
                    <slot name="actions" />
                </div>
            </div>
        </div>
    </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';

defineEmits<{
    dismiss: [];
}>();

const props = withDefaults(
    defineProps<{
        title: string;
        description?: string;
        /** info = blue, tip = green, caution = amber, danger = red */
        tone?: 'info' | 'tip' | 'caution' | 'warning' | 'danger';
        dismissible?: boolean;
        dismissLabel?: string;
    }>(),
    {
        tone: 'caution',
        dismissible: false,
        dismissLabel: 'Dismiss',
    },
);

const resolvedTone = computed(() =>
    props.tone === 'warning' ? 'caution' : props.tone,
);

const toneClass = computed(
    () =>
        ({
            info: 'border-sky-200 bg-sky-50/80',
            tip: 'border-green-200 bg-green-50/80',
            caution: 'border-amber-200 bg-amber-50/80',
            danger: 'border-rose-200 bg-rose-50/80',
        })[resolvedTone.value],
);

const iconBg = computed(
    () =>
        ({
            info: 'bg-sky-100',
            tip: 'bg-green-100',
            caution: 'bg-amber-100',
            danger: 'bg-rose-100',
        })[resolvedTone.value],
);

const iconColor = computed(
    () =>
        ({
            info: 'text-sky-700',
            tip: 'text-green-700',
            caution: 'text-amber-700',
            danger: 'text-rose-700',
        })[resolvedTone.value],
);

const titleColor = computed(
    () =>
        ({
            info: 'text-sky-900',
            tip: 'text-green-900',
            caution: 'text-amber-900',
            danger: 'text-rose-900',
        })[resolvedTone.value],
);

const bodyColor = computed(
    () =>
        ({
            info: 'text-sky-900/80',
            tip: 'text-green-900/80',
            caution: 'text-amber-900/85',
            danger: 'text-rose-900/85',
        })[resolvedTone.value],
);

const iconName = computed(
    () =>
        ({
            info: 'i-pixelarticons-info-box',
            tip: 'i-pixelarticons-sparkles',
            caution: 'i-pixelarticons-warning-box',
            danger: 'i-pixelarticons-shield-off',
        })[resolvedTone.value],
);
</script>

<style scoped>
.or3-callout-dismiss {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 1.75rem;
    height: 1.75rem;
    flex-shrink: 0;
    border-radius: 999px;
    border: 1px solid color-mix(in srgb, currentColor 14%, transparent);
    background: rgba(255, 255, 255, 0.55);
    color: inherit;
    opacity: 0.72;
    transition:
        opacity 0.15s ease,
        background 0.15s ease,
        border-color 0.15s ease;
}

.or3-callout-dismiss:hover {
    opacity: 1;
    background: rgba(255, 255, 255, 0.9);
}
</style>
