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

    <div class="flex shrink-0 items-center gap-3 self-start">
      <NuxtLink
        to="/approvals"
        class="or3-focus-ring or3-touch-target relative inline-flex size-12 items-center justify-center rounded-[1.35rem] border border-(--or3-border) bg-(--or3-surface) shadow-[0_1px_0_rgba(255,255,255,0.65)_inset,0_8px_20px_rgba(42,35,25,0.05)] transition hover:border-(--or3-green)/30 hover:bg-white/95"
        :aria-label="pendingCount ? `${pendingCount} approval requests waiting` : 'Open approval requests'"
      >
        <img src="/computer-icons/security.png" alt="" class="or3-header-action-icon or3-header-action-icon--approvals" />
        <span
          v-if="pendingCount"
          class="absolute -right-1 -top-1 min-w-4.5 rounded-full bg-(--or3-amber) px-1.5 py-0.5 text-center text-[10px] font-semibold leading-none text-white shadow-sm"
        >{{ pendingCount > 99 ? '99+' : pendingCount }}</span>
      </NuxtLink>
      <NuxtLink
        to="/settings"
        class="or3-focus-ring or3-touch-target inline-flex size-12 items-center justify-center rounded-[1.35rem] border border-(--or3-border) bg-(--or3-surface) shadow-[0_1px_0_rgba(255,255,255,0.65)_inset,0_8px_20px_rgba(42,35,25,0.05)] transition hover:border-(--or3-green)/30 hover:bg-white/95"
        aria-label="Open settings"
      >
        <img src="/computer-icons/settings.png" alt="" class="or3-header-action-icon" />
      </NuxtLink>
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

<style scoped>
.or3-header-action-icon {
  display: block;
  width: auto;
  height: 22px;
  max-width: 24px;
  object-fit: contain;
  image-rendering: pixelated;
}

.or3-header-action-icon--approvals {
  height: 24px;
  max-width: 22px;
}
</style>

