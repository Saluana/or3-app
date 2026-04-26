<template>
  <div class="rounded-2xl border border-dashed border-(--or3-border) bg-white/60 px-5 py-8 text-center">
    <div v-if="icon" class="mx-auto mb-3 grid size-12 place-items-center rounded-2xl bg-(--or3-green-soft) text-(--or3-green)">
      <Icon :name="icon" class="size-6" />
    </div>
    <p class="font-mono text-sm font-semibold text-(--or3-text)">{{ title }}</p>
    <p v-if="description" class="mx-auto mt-2 max-w-sm text-sm leading-6 text-(--or3-text-muted)">{{ description }}</p>
    <div v-if="$slots.default" class="mt-4 flex flex-wrap justify-center gap-2">
      <slot />
    </div>
  </div>
</template>

<script setup lang="ts">
defineProps<{
  title: string;
  description?: string;
  icon?: string;
}>();
</script>
