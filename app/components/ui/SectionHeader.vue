<template>
  <div class="mb-3 flex items-center justify-between gap-3">
    <div>
      <p class="or3-label text-base font-semibold">{{ title }}</p>
      <p v-if="subtitle" class="mt-1 text-sm text-(--or3-text-muted)">{{ subtitle }}</p>
    </div>
    <slot name="action" />
  </div>
</template>

<script setup lang="ts">
interface Props {
  title: string
  subtitle?: string
}

defineProps<Props>()
</script>
