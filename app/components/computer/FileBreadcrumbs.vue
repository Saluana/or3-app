<template>
  <div class="flex items-center gap-2 overflow-x-auto text-sm">
    <UButton color="neutral" variant="ghost" class="or3-command shrink-0 rounded-xl px-2 py-1" type="button" @click="emit('navigate', '.')">{{ rootLabel }}</UButton>
    <template v-for="part in parts" :key="part.path">
      <Icon name="i-lucide-chevron-right" class="size-4 shrink-0 text-(--or3-text-muted)" />
      <UButton color="neutral" variant="ghost" class="shrink-0 rounded-xl px-2 py-1 font-mono text-(--or3-text)" type="button" @click="emit('navigate', part.path)">{{ part.name }}</UButton>
    </template>
  </div>
</template>

<script setup lang="ts">
const props = defineProps<{ path: string; rootLabel: string }>()
const emit = defineEmits<{ navigate: [path: string] }>()

const parts = computed(() => {
  if (!props.path || props.path === '.') return []
  const names = props.path.split('/').filter(Boolean)
  return names.map((name, index) => ({ name, path: names.slice(0, index + 1).join('/') }))
})
</script>
