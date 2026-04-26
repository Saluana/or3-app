<template>
  <span :class="['inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium', toneClass]">
    <span :class="['size-1.5 rounded-full', dotClass, pulse ? 'or3-live-dot' : '']" />
    {{ label }}
  </span>
</template>

<script setup lang="ts">
const props = withDefaults(
  defineProps<{
    label: string;
    tone?: 'green' | 'amber' | 'danger' | 'neutral';
    /** Adds a soft pulsing animation around the dot. */
    pulse?: boolean;
  }>(),
  {
    tone: 'neutral',
    pulse: false,
  },
);

const toneClass = computed(
  () =>
    ({
      green: 'border-green-200 bg-green-50 text-green-800',
      amber: 'border-amber-200 bg-amber-50 text-amber-800',
      danger: 'border-rose-200 bg-rose-50 text-rose-800',
      neutral: 'border-stone-200 bg-stone-50 text-stone-700',
    })[props.tone],
);

const dotClass = computed(
  () =>
    ({
      green: 'bg-(--or3-green)',
      amber: 'bg-(--or3-amber)',
      danger: 'bg-(--or3-danger)',
      neutral: 'bg-(--or3-text-muted)',
    })[props.tone],
);
</script>

