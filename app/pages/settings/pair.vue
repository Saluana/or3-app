<template>
  <AppShell>
    <AppHeader subtitle="PAIR DEVICE" />

    <div class="space-y-4">
      <button
        type="button"
        class="or3-focus-ring inline-flex items-center gap-2 rounded-full border border-(--or3-border) bg-(--or3-surface) px-3 py-1.5 font-mono text-xs font-semibold uppercase tracking-wide text-(--or3-text)"
        @click="goBack"
      >
        <Icon name="i-pixelarticons-chevron-left" class="size-4" />
        Settings
      </button>

      <HostConnectionCard />
      <DeviceManagementCard />
    </div>
  </AppShell>
</template>

<script setup lang="ts">
const router = useRouter()

function goBack() {
  void router.push('/settings')
}
</script>
