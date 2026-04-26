<template>
  <section
    :class="[
      'or3-surface',
      tone !== 'default' && toneClass,
      padded ? 'p-5' : 'p-4',
      interactive && 'or3-pressable cursor-pointer',
      className,
    ]"
  >
    <slot />
  </section>
</template>

<script setup lang="ts">
interface Props {
  padded?: boolean;
  interactive?: boolean;
  className?: string;
  /** Visual tone: default | tip (green) | caution (amber) | danger (rose) */
  tone?: 'default' | 'tip' | 'caution' | 'danger';
}

const props = withDefaults(defineProps<Props>(), { tone: 'default' });

const toneClass = computed(
  () =>
    ({
      default: '',
      tip: 'border-green-200 bg-green-50/70',
      caution: 'border-amber-200 bg-amber-50/70',
      danger: 'border-rose-200 bg-rose-50/70',
    })[props.tone],
);
</script>

