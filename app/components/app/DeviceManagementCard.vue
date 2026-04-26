<template>
  <SurfaceCard class-name="space-y-4">
    <div class="flex items-center justify-between gap-3">
      <div>
        <p class="or3-label text-sm font-semibold">Paired Devices</p>
        <p class="mt-1 text-sm text-(--or3-text-muted)">Review trusted clients for this computer.</p>
      </div>
      <UButton icon="i-lucide-refresh-cw" color="neutral" variant="ghost" aria-label="Refresh devices" @click="refresh" />
    </div>

    <div class="divide-y divide-(--or3-border) overflow-hidden rounded-2xl border border-(--or3-border) bg-white/60">
      <div v-for="device in devices" :key="device.device_id" class="flex items-center gap-3 p-3">
        <RetroIcon name="i-lucide-smartphone" size="sm" />
        <div class="min-w-0 flex-1">
          <p class="truncate font-mono text-sm">{{ device.display_name || device.device_id }}</p>
          <p class="text-xs text-(--or3-text-muted)">{{ device.role || 'operator' }} · {{ device.status || 'active' }}</p>
        </div>
        <UButton icon="i-lucide-ban" color="error" variant="ghost" aria-label="Revoke device" @click="revoke(device.device_id)" />
      </div>
      <p v-if="!devices.length" class="p-4 text-sm text-(--or3-text-muted)">No devices loaded yet.</p>
    </div>
  </SurfaceCard>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import type { DeviceInfo } from '~/types/or3-api'
import { usePairing } from '~/composables/usePairing'

const { listDevices, revokeDevice } = usePairing()
const devices = ref<DeviceInfo[]>([])

async function refresh() {
  devices.value = await listDevices().catch(() => [])
}

async function revoke(deviceId: string) {
  if (!confirm('Revoke this paired device? It will need to pair again.')) return
  await revokeDevice(deviceId)
  await refresh()
}
</script>
