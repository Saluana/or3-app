<template>
    <UApp :toaster="toaster">
        <NuxtRouteAnnouncer />
        <div
            :class="showUnlockOverlay ? 'invisible pointer-events-none select-none' : ''"
            :aria-hidden="showUnlockOverlay ? 'true' : undefined"
        >
            <NuxtPage />
        </div>
        <PinUnlockOverlay
            :visible="showUnlockOverlay"
            @unlocked="onUnlocked"
            @reset="onResetPinLock"
        />
    </UApp>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useKeyboardOpen } from './composables/useKeyboardOpen'
import { resetPinLock, usePinLockState } from './composables/usePinLock'
import { useLocalCache } from './composables/useLocalCache'

const toaster = {
  position: 'top-right',
  duration: 2600,
  max: 3,
  expand: true,
} as const

useKeyboardOpen()

const pinLock = usePinLockState()
const pinStateReady = ref(false)
const showUnlockOverlay = computed(() => pinStateReady.value && pinLock.needsUnlock.value)

onMounted(() => {
  pinLock.refresh()
  pinStateReady.value = true
})

function onUnlocked() {
  useLocalCache().forceReload()
}

function onResetPinLock() {
  resetPinLock()
  useLocalCache().forceReload()
}
</script>
