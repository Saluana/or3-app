<template>
  <section :class="['or3-surface p-4', padded && 'p-5', interactive && 'transition active:scale-[0.99]', className]">
    <slot />
  </section>
</template>

<script setup lang="ts">
interface Props {
  padded?: boolean
  interactive?: boolean
  className?: string
}

defineProps<Props>()
</script>
