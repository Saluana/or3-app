<template>
  <AppShell>
    <AppHeader subtitle="COMPUTER" />

    <div class="space-y-5">
      <ComputerOverviewCard :host-name="activeHost?.name || 'No computer paired'" :base-url="activeHost?.baseUrl || 'Pair a host to begin'" :health="health" :capabilities="capabilities" />

      <div class="grid grid-cols-2 gap-3">
        <NuxtLink v-for="item in items" :key="item.to" :to="item.to">
          <SurfaceCard interactive class-name="min-h-28">
            <RetroIcon :name="item.icon" />
            <p class="mt-3 font-mono text-sm font-semibold">{{ item.label }}</p>
            <p class="mt-1 text-xs text-(--or3-text-muted)">{{ item.description }}</p>
          </SurfaceCard>
        </NuxtLink>
      </div>

      <SurfaceCard v-if="readiness && !readiness.ready" class-name="border-amber-200 bg-amber-50">
        <p class="font-mono text-sm font-semibold text-amber-900">Readiness warning</p>
        <p class="mt-1 text-sm text-amber-900">{{ readiness.summary || 'The host reported startup findings.' }}</p>
      </SurfaceCard>
    </div>
  </AppShell>
</template>

<script setup lang="ts">
const { activeHost } = useActiveHost()
const { health, readiness, capabilities, refreshStatus } = useComputerStatus()

const items = [
  { label: 'Files', description: 'Browse folders', icon: 'i-lucide-folder', to: '/computer/files' },
  { label: 'Terminal', description: 'Command control', icon: 'i-lucide-terminal-square', to: '/computer/terminal' },
  { label: 'Approvals', description: 'Review requests', icon: 'i-lucide-shield-check', to: '/approvals' },
  { label: 'Settings', description: 'Tune intern', icon: 'i-lucide-settings', to: '/settings' },
]

onMounted(() => {
  if (activeHost.value?.token) void refreshStatus()
})
</script>
