<template>
  <header class="or3-app-header-mobile flex items-center justify-between gap-3 pb-5">
    <div class="flex min-w-0 items-center gap-2">
      <button
        v-if="showBackButton"
        type="button"
        class="or3-focus-ring or3-touch-target inline-flex size-11 shrink-0 items-center justify-center rounded-[1.2rem] border border-(--or3-border) bg-(--or3-surface) text-(--or3-text-muted) shadow-[0_1px_0_rgba(255,255,255,0.65)_inset,0_8px_20px_rgba(42,35,25,0.05)] transition hover:border-(--or3-green)/30 hover:bg-white/95 hover:text-(--or3-green-dark)"
        aria-label="Go back"
        @click="goBack"
      >
        <Icon name="i-pixelarticons-chevron-left" class="size-5" />
      </button>

      <NuxtLink to="/" class="flex min-w-0 items-center gap-3 outline-none or3-focus-ring rounded-2xl" aria-label="Go to chat home">
        <BrandMark size="lg" />
        <div class="min-w-0">
          <div class="flex items-center gap-2">
            <h1 class="or3-display-title text-3xl tracking-[0.01em] text-(--or3-text) sm:text-4xl">or3</h1>
          </div>
          <p class="or3-command truncate text-[11px] uppercase tracking-[0.18em]">{{ subtitle }}</p>
        </div>
      </NuxtLink>
    </div>

    <div class="flex shrink-0 items-center gap-3 self-start">
      <button
        type="button"
        class="or3-focus-ring or3-touch-target relative inline-flex size-12 items-center justify-center rounded-[1.35rem] border border-(--or3-border) bg-(--or3-surface) shadow-[0_1px_0_rgba(255,255,255,0.65)_inset,0_8px_20px_rgba(42,35,25,0.05)] transition hover:border-(--or3-green)/30 hover:bg-white/95"
        :aria-label="pendingCount ? `${pendingCount} approval requests waiting` : 'Open approval requests'"
        @click="approvalsOpen = true"
      >
        <img src="/computer-icons/security.png" alt="" class="or3-header-action-icon or3-header-action-icon--approvals" />
        <span
          v-if="pendingCount"
          class="absolute -right-1 -top-1 min-w-4.5 rounded-full bg-(--or3-amber) px-1.5 py-0.5 text-center text-[10px] font-semibold leading-none text-white shadow-sm"
        >{{ pendingCount > 99 ? '99+' : pendingCount }}</span>
      </button>
      <NuxtLink
        to="/settings"
        class="or3-focus-ring or3-touch-target inline-flex size-12 items-center justify-center rounded-[1.35rem] border border-(--or3-border) bg-(--or3-surface) shadow-[0_1px_0_rgba(255,255,255,0.65)_inset,0_8px_20px_rgba(42,35,25,0.05)] transition hover:border-(--or3-green)/30 hover:bg-white/95"
        aria-label="Open settings"
      >
        <img src="/computer-icons/settings.png" alt="" class="or3-header-action-icon" />
      </NuxtLink>
    </div>

    <ApprovalsSlideover v-model:open="approvalsOpen" />
  </header>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue';
import { useApprovals } from '~/composables/useApprovals';

withDefaults(defineProps<{ subtitle?: string }>(), {
  subtitle: 'YOUR AI ASSISTANT',
});

const approvalsOpen = ref(false);
const { pendingCount, loadPendingCount, startPolling, stopPolling } = useApprovals();
const route = useRoute();
const router = useRouter();

const showBackButton = computed(() => route.path.startsWith('/settings'));

function goBack() {
  if (window.history.length > 1) {
    router.back();
    return;
  }
  void router.push('/');
}

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
