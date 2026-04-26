<template>
  <span :class="['or3-brand-mark', size === 'lg' ? 'or3-brand-mark--lg' : '']" aria-hidden="true">
    <span class="or3-brand-mark__dot" />
    <span class="or3-brand-mark__dot" />
    <span class="or3-brand-mark__dot" />
    <span class="or3-brand-mark__dot or3-brand-mark__dot--accent" />
  </span>
</template>

<script setup lang="ts">
withDefaults(defineProps<{ size?: 'md' | 'lg' }>(), { size: 'md' });
</script>

<style scoped>
.or3-brand-mark {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  grid-template-rows: repeat(2, 1fr);
  gap: 3px;
  width: 38px;
  height: 38px;
  padding: 6px;
  border-radius: 12px;
  border: 1px solid var(--or3-border);
  background: var(--or3-surface);
  box-shadow: var(--or3-shadow-soft);
}
.or3-brand-mark--lg {
  width: 48px;
  height: 48px;
  padding: 8px;
  gap: 4px;
  border-radius: 14px;
}
.or3-brand-mark__dot {
  background: var(--or3-text);
  border-radius: 3px;
}
.or3-brand-mark__dot--accent {
  background: var(--or3-green);
}
</style>
