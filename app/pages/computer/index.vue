<template>
  <AppShell>
    <AppHeader subtitle="COMPUTER" />

    <div class="space-y-5">
      <ComputerOverviewCard
        :host-name="activeHost?.name || 'No computer paired'"
        :base-url="activeHost?.baseUrl || 'Pair a computer in Settings to begin'"
        :health="health"
        :capabilities="capabilities"
      />

      <SectionHeader title="What you can do" subtitle="Browse, run things, and review activity" />
      <div class="grid grid-cols-2 gap-3">
        <NuxtLink v-for="item in items" :key="item.to" :to="item.to">
          <SurfaceCard interactive class-name="min-h-32">
            <RetroIcon :name="item.icon" />
            <p class="mt-3 font-mono text-sm font-semibold">{{ item.label }}</p>
            <p class="mt-1 text-xs leading-5 text-(--or3-text-muted)">{{ item.description }}</p>
          </SurfaceCard>
        </NuxtLink>
      </div>

      <DangerCallout
        v-if="readiness && !readiness.ready"
        tone="caution"
        title="Your computer needs attention"
      >
        {{ readiness.summary || "or3-intern noticed something during startup. Open Settings on your computer to take a look." }}
      </DangerCallout>
    </div>
  </AppShell>
</template>

<script setup lang="ts">
const { activeHost } = useActiveHost()
const { health, readiness, capabilities, refreshStatus } = useComputerStatus()

const items = [
  { label: 'Files', description: 'Browse folders on your computer.', icon: 'i-lucide-folder', to: '/computer/files' },
  { label: 'Terminal', description: 'Run commands. Advanced — use with care.', icon: 'i-lucide-terminal-square', to: '/computer/terminal' },
  { label: 'Approvals', description: 'Review what or3-intern wants to do.', icon: 'i-lucide-shield-check', to: '/approvals' },
  { label: 'Preferences', description: 'Tune how or3-intern behaves.', icon: 'i-lucide-settings', to: '/settings' },
]

onMounted(() => {
  if (activeHost.value?.token) void refreshStatus().catch(() => {})
})
</script>
