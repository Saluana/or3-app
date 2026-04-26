<template>
  <SurfaceCard class-name="space-y-4">
    <div class="flex items-center justify-between gap-3">
      <div class="flex items-start gap-3">
        <RetroIcon name="i-lucide-smartphone" />
        <div>
          <p class="font-mono text-base font-semibold text-(--or3-text)">Phones &amp; tablets</p>
          <p class="mt-1 text-sm text-(--or3-text-muted)">Devices that are allowed to control this computer.</p>
        </div>
      </div>
      <UButton icon="i-lucide-refresh-cw" color="neutral" variant="ghost" aria-label="Refresh devices" @click="refresh" />
    </div>

    <div v-if="!devices.length" class="rounded-2xl border border-dashed border-(--or3-border) bg-white/60 px-4 py-6 text-center text-sm text-(--or3-text-muted)">
      No paired devices yet. Pair this phone above to get started.
    </div>

    <div v-else class="divide-y divide-(--or3-border) overflow-hidden rounded-2xl border border-(--or3-border) bg-white/70">
      <div v-for="device in devices" :key="device.device_id" class="flex items-center gap-3 p-3">
        <div class="grid size-10 place-items-center rounded-xl bg-(--or3-green-soft) text-(--or3-green)">
          <Icon name="i-lucide-smartphone" class="size-5" />
        </div>
        <div class="min-w-0 flex-1">
          <p class="truncate font-mono text-sm font-semibold">{{ device.display_name || device.device_id }}</p>
          <p class="text-xs text-(--or3-text-muted)">{{ friendlyRole(device.role) }} · {{ friendlyStatus(device.status) }}</p>
        </div>
        <UButton
          icon="i-lucide-x"
          color="error"
          variant="soft"
          size="sm"
          aria-label="Remove device"
          @click="askRevoke(device)"
        />
      </div>
    </div>

    <UModal v-model:open="confirmOpen" :ui="{ content: 'sm:max-w-md' }">
      <template #content>
        <div class="space-y-4 p-5">
          <DangerCallout tone="danger" title="Remove this device?">
            This will sign out
            <span class="font-semibold">{{ pendingDevice?.display_name || pendingDevice?.device_id }}</span>
            right away. You can pair it again later, but it will need a new code.
          </DangerCallout>
          <div class="flex justify-end gap-2">
            <UButton label="Cancel" color="neutral" variant="ghost" @click="confirmOpen = false" />
            <UButton label="Yes, remove" color="error" :loading="revoking" @click="confirmRevoke" />
          </div>
        </div>
      </template>
    </UModal>
  </SurfaceCard>
</template>

<script setup lang="ts">
import { onMounted, ref } from 'vue'
import type { DeviceInfo } from '~/types/or3-api'
import { usePairing } from '~/composables/usePairing'

const { listDevices, revokeDevice } = usePairing()
const devices = ref<DeviceInfo[]>([])
const confirmOpen = ref(false)
const pendingDevice = ref<DeviceInfo | null>(null)
const revoking = ref(false)

function friendlyRole(role?: string) {
  if (!role) return 'User'
  if (role === 'operator') return 'Operator'
  if (role === 'admin') return 'Admin'
  return role
}

function friendlyStatus(status?: string) {
  if (!status) return 'Active'
  if (status === 'active') return 'Active'
  if (status === 'revoked') return 'Removed'
  return status
}

async function refresh() {
  devices.value = await listDevices().catch(() => [])
}

function askRevoke(device: DeviceInfo) {
  pendingDevice.value = device
  confirmOpen.value = true
}

async function confirmRevoke() {
  if (!pendingDevice.value) return
  revoking.value = true
  try {
    await revokeDevice(pendingDevice.value.device_id).catch(() => null)
    await refresh()
    confirmOpen.value = false
    pendingDevice.value = null
  } finally {
    revoking.value = false
  }
}

onMounted(refresh)
</script>
