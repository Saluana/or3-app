<template>
  <header class="flex items-center justify-between gap-3 pb-5">
    <NuxtLink to="/" class="flex items-center gap-3 outline-none or3-focus-ring rounded-2xl" aria-label="Go to chat home">
      <BrandMark size="lg" />
      <div>
        <div class="flex items-center gap-2">
          <h1 class="font-mono text-xl font-semibold tracking-tight text-(--or3-text) sm:text-2xl">or3-intern</h1>
          <span class="or3-live-dot" :aria-label="connected ? 'Connected' : 'Not connected'" :title="connected ? 'Connected to your computer' : 'No computer paired yet'" />
        </div>
        <p class="or3-command text-[11px] uppercase tracking-[0.18em]">{{ subtitle }}</p>
      </div>
    </NuxtLink>

    <div class="flex items-center gap-2">
      <UButton
        icon="i-lucide-shield-check"
        color="neutral"
        variant="ghost"
        class="or3-touch-target relative rounded-2xl border border-(--or3-border) bg-(--or3-surface)"
        :aria-label="pendingCount ? `${pendingCount} approval requests waiting` : 'Open approval requests'"
        to="/approvals"
      >
        <span
          v-if="pendingCount"
          class="absolute -right-1 -top-1 min-w-4.5 rounded-full bg-(--or3-amber) px-1.5 py-0.5 text-center text-[10px] font-semibold leading-none text-white shadow-sm"
        >{{ pendingCount > 99 ? '99+' : pendingCount }}</span>
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
import { computed, onBeforeUnmount, onMounted } from 'vue';
import { useApprovals } from '~/composables/useApprovals';

withDefaults(defineProps<{ subtitle?: string }>(), {
  subtitle: 'YOUR AI ASSISTANT',
});

const { pendingCount, loadPendingCount, startPolling, stopPolling } = useApprovals();
const { activeHost } = useActiveHost();
const connected = computed(() => Boolean(activeHost.value?.token));

onMounted(async () => {
  await loadPendingCount();
  startPolling();
});

onBeforeUnmount(() => {
  stopPolling();
});
</script>

