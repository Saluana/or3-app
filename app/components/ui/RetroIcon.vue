<template>
  <span :class="['or3-icon-frame', sizeClass]" aria-hidden="true">
    <Icon :name="name" :class="iconClass" />
  </span>
</template>

<script setup lang="ts">
const props = withDefaults(defineProps<{
  name: string
  size?: 'sm' | 'md' | 'lg'
}>(), {
  size: 'md',
})

const sizeClass = computed(() => ({
  sm: 'size-9',
  md: 'size-11',
  lg: 'size-14',
}[props.size]))

const iconClass = computed(() => ({
  sm: 'size-4 text-(--or3-text)',
  md: 'size-5 text-(--or3-text)',
  lg: 'size-7 text-(--or3-text)',
}[props.size]))
</script>
