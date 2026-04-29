<template>
  <div :class="['rounded-2xl border p-3 text-sm leading-6', toneClass]">
    <div class="flex items-start gap-3">
      <div :class="['mt-0.5 grid size-8 shrink-0 place-items-center rounded-xl', iconBg]">
        <Icon :name="iconName" :class="['size-4', iconColor]" />
      </div>
      <div class="min-w-0 flex-1">
        <p :class="['font-semibold', titleColor]">{{ title }}</p>
        <p v-if="$slots.default || description" :class="['mt-1', bodyColor]">
          <slot>{{ description }}</slot>
        </p>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
const props = withDefaults(
  defineProps<{
    title: string;
    description?: string;
    /** info = blue, tip = green, caution = amber, danger = red */
    tone?: 'info' | 'tip' | 'caution' | 'danger';
  }>(),
  { tone: 'caution' },
);

const toneClass = computed(
  () =>
    ({
      info: 'border-sky-200 bg-sky-50/80',
      tip: 'border-green-200 bg-green-50/80',
      caution: 'border-amber-200 bg-amber-50/80',
      danger: 'border-rose-200 bg-rose-50/80',
    })[props.tone],
);

const iconBg = computed(
  () =>
    ({
      info: 'bg-sky-100',
      tip: 'bg-green-100',
      caution: 'bg-amber-100',
      danger: 'bg-rose-100',
    })[props.tone],
);

const iconColor = computed(
  () =>
    ({
      info: 'text-sky-700',
      tip: 'text-green-700',
      caution: 'text-amber-700',
      danger: 'text-rose-700',
    })[props.tone],
);

const titleColor = computed(
  () =>
    ({
      info: 'text-sky-900',
      tip: 'text-green-900',
      caution: 'text-amber-900',
      danger: 'text-rose-900',
    })[props.tone],
);

const bodyColor = computed(
  () =>
    ({
      info: 'text-sky-900/80',
      tip: 'text-green-900/80',
      caution: 'text-amber-900/85',
      danger: 'text-rose-900/85',
    })[props.tone],
);

const iconName = computed(
  () =>
    ({
      info: 'i-pixelarticons-info-box',
      tip: 'i-pixelarticons-sparkles',
      caution: 'i-pixelarticons-warning-box',
      danger: 'i-pixelarticons-shield-off',
    })[props.tone],
);
</script>
