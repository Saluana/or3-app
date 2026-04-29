<template>
  <SurfaceCard class-name="space-y-4">
    <div class="flex items-start gap-3">
      <RetroIcon name="i-pixelarticons-link" />
      <div class="min-w-0 flex-1">
        <p class="font-mono text-base font-semibold text-(--or3-text)">Connect to your computer</p>
        <p class="mt-1 text-sm leading-6 text-(--or3-text-muted)">
          Pairing enrolls this phone or tablet as a trusted device. Passkeys are a separate owner check that you can add later for sensitive changes.
        </p>
      </div>
    </div>

    <DangerCallout tone="info" title="One-time setup">
      You'll get a short code below. On your computer, approve that code once to trust this device. After pairing, you can add passkeys to confirm the owner during sensitive actions.
    </DangerCallout>

    <DangerCallout v-if="activeHost?.token" tone="tip" title="Connected">
      This app is connected to
      <span class="font-semibold">{{ activeHost.name || 'your computer' }}</span>
      at
      <span class="font-mono">{{ activeHost.baseUrl }}</span>.
    </DangerCallout>

    <UForm :state="formState" class="space-y-4" @submit.prevent="start">
      <div class="space-y-3">
        <UFormField
          label="Your computer's address"
          name="baseUrl"
          description="It usually starts with http:// — your computer screen will show the right one."
        >
          <UInput
            v-model="formState.baseUrl"
            class="w-full font-mono"
            placeholder="http://127.0.0.1:9100"
            inputmode="url"
            autocapitalize="off"
            autocorrect="off"
          />
        </UFormField>
        <UFormField
          label="A friendly name for the computer"
          name="displayName"
          description="So you can tell it apart later. Example: 'Studio Mac' or 'Office PC'."
        >
          <UInput v-model="formState.displayName" class="w-full" placeholder="Studio Mac" />
        </UFormField>
        <UFormField
          label="What should we call this phone?"
          name="deviceName"
          description="Shown in the trusted devices list on your computer."
        >
          <UInput v-model="formState.deviceName" class="w-full" placeholder="Brendon's iPhone" />
        </UFormField>
      </div>

      <UButton
        label="Get pairing code"
        icon="i-pixelarticons-lock"
        type="submit"
        size="lg"
        block
        :loading="loading"
      />
    </UForm>

    <div v-if="pendingPairing" class="rounded-2xl border border-(--or3-green)/40 bg-(--or3-green-soft) p-4">
      <p class="text-xs font-semibold uppercase tracking-wide text-(--or3-green-dark)">Your pairing code</p>
      <p class="mt-1 font-mono text-3xl font-bold tracking-[0.3em] text-(--or3-green-dark)">{{ pendingPairing.code }}</p>
      <p class="mt-2 text-sm text-(--or3-text-muted)">
        On your computer, run:
      </p>
      <p class="mt-2 rounded-xl bg-white/70 px-3 py-2 font-mono text-sm text-(--or3-green-dark)">
        or3-intern pairing approve-code {{ pendingPairing.code }}
      </p>
      <p class="mt-2 text-sm text-(--or3-text-muted)">
        Leave this screen open. After you approve it, this app will connect automatically.
      </p>
      <div class="mt-3 flex items-center gap-2 text-sm font-semibold text-(--or3-green-dark)">
        <span class="or3-live-dot" />
        Waiting for approval...
      </div>
      <UButton label="Try now" icon="i-pixelarticons-check" color="primary" variant="soft" class="mt-3" block :loading="loading" @click="exchange" />
    </div>

    <p v-if="pairingError" class="text-sm text-(--or3-danger)">{{ pairingError }}</p>
  </SurfaceCard>
</template>

<script setup lang="ts">
import { onBeforeUnmount, ref } from 'vue'
import { usePairing } from '~/composables/usePairing'
import { useActiveHost } from '~/composables/useActiveHost'

const { pendingPairing, pairingError, startPairing, exchangeCode } = usePairing()
const { activeHost } = useActiveHost()
let autoFinishTimer: ReturnType<typeof setInterval> | null = null
const formState = reactive({
  baseUrl: 'http://127.0.0.1:9100',
  displayName: 'My Computer',
  deviceName: 'or3-app',
})
const loading = ref(false)

async function start() {
  loading.value = true
  try {
    await startPairing({
      baseUrl: formState.baseUrl,
      displayName: formState.displayName,
      deviceName: formState.deviceName,
    })
    startAutoFinish()
  } catch {
    // Error text is already exposed by usePairing.
  } finally {
    loading.value = false
  }
}

async function exchange() {
  loading.value = true
  try {
    await exchangeCode()
    stopAutoFinish()
  } catch {
    // Error text is already exposed by usePairing.
  } finally {
    loading.value = false
  }
}

function startAutoFinish() {
  stopAutoFinish()
  autoFinishTimer = setInterval(async () => {
    if (!pendingPairing.value) {
      stopAutoFinish()
      return
    }
    try {
      await exchangeCode(undefined, { quietPending: true })
      stopAutoFinish()
    } catch {
      // Still waiting for the computer to approve the code.
    }
  }, 2500)
}

function stopAutoFinish() {
  if (!autoFinishTimer) return
  clearInterval(autoFinishTimer)
  autoFinishTimer = null
}

onBeforeUnmount(stopAutoFinish)
</script>
