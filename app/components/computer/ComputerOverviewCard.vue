<template>
  <SurfaceCard class-name="space-y-4">
    <div class="flex items-start justify-between gap-3">
      <div>
        <p class="or3-label text-sm font-semibold">Computer</p>
        <h2 class="mt-1 font-mono text-xl font-semibold text-(--or3-text)">{{ hostName }}</h2>
        <p class="mt-1 text-sm text-(--or3-text-muted)">{{ baseUrl }}</p>
      </div>
      <StatusPill :label="statusLabel" :tone="online ? 'green' : 'amber'" />
    </div>

    <div class="grid grid-cols-2 gap-3">
      <div class="rounded-2xl border border-(--or3-border) bg-white/50 p-3">
        <p class="or3-command text-xs">Runtime</p>
        <p class="mt-1 font-mono text-sm">{{ runtimeProfile }}</p>
      </div>
      <div class="rounded-2xl border border-(--or3-border) bg-white/50 p-3">
        <p class="or3-command text-xs">Approvals</p>
        <p class="mt-1 font-mono text-sm">{{ approvals }}</p>
      </div>
    </div>
  </SurfaceCard>
</template>

<script setup lang="ts">
import type { CapabilitiesResponse, HealthResponse } from '~/types/or3-api'

const props = defineProps<{
  hostName?: string
  baseUrl?: string
  health?: HealthResponse | null
  capabilities?: CapabilitiesResponse | null
}>()

const online = computed(() => props.health?.status === 'ok' || props.health?.status === 'healthy')
const statusLabel = computed(() => online.value ? 'online' : 'check host')
const runtimeProfile = computed(() => props.capabilities?.runtimeProfile || 'unknown')
const approvals = computed(() => {
  const modes = props.capabilities?.approvalModes
  if (!modes) return props.health?.approvalBrokerAvailable ? 'available' : 'unknown'
  return Object.entries(modes).slice(0, 1).map(([key, value]) => `${key}: ${value}`).join(', ')
})
</script>
