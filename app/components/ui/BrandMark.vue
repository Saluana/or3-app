<template>
  <span :class="['or3-brand-mark', size === 'lg' ? 'or3-brand-mark--lg' : '']" aria-hidden="true">
    <img class="or3-brand-mark__image" src="/or3-brand-mark.png" alt="" />
  </span>
</template>

<script setup lang="ts">
withDefaults(defineProps<{ size?: 'md' | 'lg' }>(), { size: 'md' });
</script>

<style scoped>
.or3-brand-mark {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 38px;
  height: 38px;
}
.or3-brand-mark--lg {
  width: 48px;
  height: 48px;
}
.or3-brand-mark__image {
  display: block;
  width: 100%;
  height: 100%;
  object-fit: contain;
  image-rendering: pixelated;
}
</style>
