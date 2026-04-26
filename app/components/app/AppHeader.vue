<template>
  <header class="flex items-center justify-between gap-3 pb-5">
    <div class="flex items-center gap-3">
      <div class="grid size-14 place-items-center text-4xl" aria-hidden="true">▣</div>
      <div>
        <div class="flex items-center gap-2">
          <h1 class="font-mono text-2xl font-semibold tracking-tight text-(--or3-text)">or3-intern</h1>
          <span class="size-2 rounded-full bg-(--or3-green)" aria-label="online" />
        </div>
        <p class="or3-command text-xs uppercase tracking-[0.18em]">{{ subtitle }}</p>
      </div>
    </div>

    <div class="flex items-center gap-2">
      <UButton
        icon="i-lucide-shield-check"
        color="neutral"
        variant="ghost"
        class="or3-touch-target relative rounded-2xl border border-(--or3-border) bg-(--or3-surface)"
        aria-label="Open approvals"
        to="/approvals"
      >
        <span v-if="pendingCount" class="absolute -right-1 -top-1 rounded-full bg-(--or3-amber) px-1.5 py-0.5 text-[10px] font-semibold text-white">{{ pendingCount }}</span>
      </UButton>
      <UButton
        icon="i-lucide-settings"
        color="neutral"
        variant="ghost"
        class="or3-touch-target rounded-2xl border border-(--or3-border) bg-(--or3-surface)"
        aria-label="Open settings"
        to="/settings"
      />
    </div>
  </header>
</template>

<script setup lang="ts">
import { onBeforeUnmount, onMounted } from 'vue'
import { useApprovals } from '~/composables/useApprovals'

withDefaults(defineProps<{ subtitle?: string }>(), {
  subtitle: 'AI COMPUTER',
})

const { pendingCount, loadPendingCount, startPolling, stopPolling } = useApprovals()

onMounted(async () => {
  await loadPendingCount()
  startPolling()
})

onBeforeUnmount(() => {
  stopPolling()
})
</script>
