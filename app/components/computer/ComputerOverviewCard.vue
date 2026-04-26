<template>
  <SurfaceCard class-name="space-y-4">
    <div class="flex items-start justify-between gap-3">
      <div class="min-w-0">
        <p class="or3-command text-xs">Connected to</p>
        <h2 class="mt-1 font-mono text-xl font-semibold text-(--or3-text) truncate">{{ hostName }}</h2>
        <p class="mt-1 text-sm text-(--or3-text-muted) truncate">{{ baseUrl }}</p>
      </div>
      <StatusPill :label="statusLabel" :tone="online ? 'green' : 'amber'" :pulse="online" />
    </div>

    <div class="grid grid-cols-2 gap-3">
      <div class="rounded-2xl border border-(--or3-border) bg-white/60 p-3">
        <p class="or3-command text-xs">Mode</p>
        <p class="mt-1 font-mono text-sm">{{ runtimeProfile }}</p>
      </div>
      <div class="rounded-2xl border border-(--or3-border) bg-white/60 p-3">
        <p class="or3-command text-xs">Approvals</p>
        <p class="mt-1 font-mono text-sm">{{ approvals }}</p>
      </div>
    </div>
  </SurfaceCard>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import type { CapabilitiesResponse, HealthResponse } from '~/types/or3-api'

const props = defineProps<{
  hostName?: string
  baseUrl?: string
  health?: HealthResponse | null
  capabilities?: CapabilitiesResponse | null
}>()

const online = computed(() => props.health?.status === 'ok' || props.health?.status === 'healthy')
const statusLabel = computed(() => online.value ? 'online' : 'check connection')
const runtimeProfile = computed(() => props.capabilities?.runtimeProfile || 'unknown')
const approvals = computed(() => {
  const modes = props.capabilities?.approvalModes
  if (!modes) return props.health?.approvalBrokerAvailable ? 'on' : 'unknown'
  return Object.entries(modes).slice(0, 1).map(([key, value]) => `${key}: ${value}`).join(', ')
})
</script>
