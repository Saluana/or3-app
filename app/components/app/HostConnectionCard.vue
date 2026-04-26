<template>
  <SurfaceCard class-name="space-y-4">
    <div>
      <p class="or3-label text-sm font-semibold">Host Connection</p>
      <p class="mt-1 text-sm leading-6 text-(--or3-text-muted)">Pair this app with an or3-intern service on your trusted computer or private network.</p>
    </div>

    <div class="space-y-3">
      <label class="block text-sm font-medium">
        Computer URL
        <input v-model="baseUrl" class="mt-1 w-full rounded-2xl border border-(--or3-border) bg-white/70 px-3 py-3 font-mono text-sm outline-none focus:border-(--or3-green)" placeholder="http://127.0.0.1:9100" />
      </label>
      <label class="block text-sm font-medium">
        Display name
        <input v-model="displayName" class="mt-1 w-full rounded-2xl border border-(--or3-border) bg-white/70 px-3 py-3 text-sm outline-none focus:border-(--or3-green)" placeholder="Studio Mac" />
      </label>
      <label class="block text-sm font-medium">
        Device label
        <input v-model="deviceName" class="mt-1 w-full rounded-2xl border border-(--or3-border) bg-white/70 px-3 py-3 text-sm outline-none focus:border-(--or3-green)" placeholder="Brendon's iPhone" />
      </label>
    </div>

    <UButton label="Start pairing" icon="i-lucide-link" class="w-full justify-center bg-(--or3-green) text-white" :loading="loading" @click="start" />

    <div v-if="pendingPairing" class="rounded-2xl border border-(--or3-border) bg-(--or3-green-soft) p-3">
      <p class="font-mono text-sm font-semibold text-(--or3-green-dark)">Pairing code: {{ pendingPairing.code }}</p>
      <p class="mt-1 text-xs text-(--or3-text-muted)">Approve this request on the computer, then exchange the code.</p>
      <UButton label="Exchange approved code" icon="i-lucide-check" color="neutral" variant="soft" class="mt-3" @click="exchange" />
    </div>

    <p v-if="pairingError" class="text-sm text-(--or3-danger)">{{ pairingError }}</p>
  </SurfaceCard>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { usePairing } from '~/composables/usePairing'

const { pendingPairing, pairingError, startPairing, exchangeCode } = usePairing()
const baseUrl = ref('http://127.0.0.1:9100')
const displayName = ref('My Computer')
const deviceName = ref('or3-app')
const loading = ref(false)

async function start() {
  loading.value = true
  try {
    await startPairing({ baseUrl: baseUrl.value, displayName: displayName.value, deviceName: deviceName.value })
  } finally {
    loading.value = false
  }
}

async function exchange() {
  loading.value = true
  try {
    await exchangeCode()
  } finally {
    loading.value = false
  }
}
</script>
