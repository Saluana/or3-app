<template>
    <UApp :toaster="toaster">
        <NuxtRouteAnnouncer />
        <div
            :class="showUnlockOverlay ? 'invisible pointer-events-none select-none' : ''"
            :aria-hidden="showUnlockOverlay ? 'true' : undefined"
        >
            <NuxtPage :keepalive="{ max: 12 }" />
        </div>
        <PinUnlockOverlay
            :visible="showUnlockOverlay"
            @unlocked="onUnlocked"
            @reset="onResetPinLock"
        />
    </UApp>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { useKeyboardOpen } from './composables/useKeyboardOpen'
import { useElectronHostSetup } from './composables/useElectronHostSetup'
import { bootstrapHostApiGate } from './composables/useHostApiGate'
import { bootstrapPinLock, resetPinLock, touchPinActivity, usePinLockState } from './composables/usePinLock'
import { canUseHostApi } from './composables/useSecureHostTokens'
import { useLocalCache } from './composables/useLocalCache'
import { useActiveHost } from './composables/useActiveHost'
import { bootstrapHostWorkspace } from './composables/useHostWorkspaceBootstrap'
import { useSessionHistory } from './composables/useSessionHistory'
import { useApprovals } from './composables/useApprovals'
import { useWhenHostApiReady } from './composables/useWhenHostApiReady'

const toaster = {
  position: 'top-right',
  duration: 2600,
  max: 3,
  expand: true,
} as const

bootstrapPinLock()
bootstrapHostApiGate()

useKeyboardOpen()
const electronHost = useElectronHostSetup()

const pinLock = usePinLockState()
const { activeHost } = useActiveHost()
const { startPolling, stopPolling } = useApprovals()
const pinStateReady = ref(false)
const showUnlockOverlay = computed(() => pinStateReady.value && pinLock.needsUnlock.value)

function refreshElectronHost() {
  void electronHost.ensureLoaded().catch(() => undefined)
}

function onWindowFocus() {
  refreshElectronHost()
}

function onVisibilityChange() {
  if (document.visibilityState === 'visible') refreshElectronHost()
}

onMounted(() => {
  const standalone =
    window.matchMedia?.('(display-mode: standalone)').matches ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true

  document.documentElement.classList.toggle('or3-standalone', Boolean(standalone))
  pinLock.refresh()
  refreshElectronHost()
  if (canUseHostApi(activeHost.value)) {
    void bootstrapHostWorkspace()
  }
  window.addEventListener('focus', onWindowFocus)
  document.addEventListener('visibilitychange', onVisibilityChange)
  pinStateReady.value = true
})

onBeforeUnmount(() => {
  window.removeEventListener('focus', onWindowFocus)
  document.removeEventListener('visibilitychange', onVisibilityChange)
  stopPolling()
})

useWhenHostApiReady(() => {
  startPolling()
})

function onUnlocked() {
  touchPinActivity()
  const sessionHistory = useSessionHistory()
  sessionHistory.error.value = null
  void sessionHistory.refresh()
}

function onResetPinLock() {
  resetPinLock()
  useLocalCache().forceReload()
}
</script>
