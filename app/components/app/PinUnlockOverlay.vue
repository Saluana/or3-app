<template>
  <Teleport to="body">
    <div
      v-if="visible"
      class="fixed inset-0 z-[100] flex flex-col items-center justify-center bg-(--or3-background) p-6"
    >
      <div class="mx-auto w-full max-w-sm space-y-8">
        <div class="space-y-3 text-center">
          <div
            class="mx-auto grid size-16 place-items-center rounded-2xl border-2 border-(--or3-border) bg-(--or3-surface)"
          >
            <Icon
              name="i-pixelarticons-lock"
              class="size-8 text-(--or3-green)"
            />
          </div>
          <p class="font-mono text-lg font-semibold text-(--or3-text)">
            Unlock or3
          </p>
          <p class="font-mono text-xs leading-5 text-(--or3-text-muted)">
            Enter your PIN to access your paired computers.
          </p>
        </div>

        <div
          v-if="lockedOut"
          class="space-y-3 rounded-2xl border border-amber-200 bg-amber-50/70 p-4 text-center"
        >
          <Icon
            name="i-pixelarticons-clock"
            class="mx-auto size-6 text-(--or3-amber)"
          />
          <p class="font-mono text-sm font-semibold text-amber-900">
            Too many attempts
          </p>
          <p class="font-mono text-xs text-amber-800">
            Try again in {{ countdownFormatted }}
          </p>
          <button
            type="button"
            class="w-full rounded-xl border border-(--or3-border) bg-white px-4 py-2.5 font-mono text-xs transition hover:bg-(--or3-green-soft)"
            @click="$emit('reset')"
          >
            Reset &amp; Re-pair
          </button>
        </div>

        <div v-else class="space-y-6">
          <div
            class="mx-auto flex w-fit items-center gap-3"
            aria-label="PIN entry"
          >
            <span
              v-for="i in 6"
              :key="i"
              :class="[
                'inline-grid size-5 place-items-center rounded-full border transition-colors',
                i <= pin.length
                  ? 'border-(--or3-green) bg-(--or3-green)'
                  : 'border-(--or3-border) bg-transparent',
              ]"
            />
          </div>

          <p
            v-if="error"
            class="text-center font-mono text-xs text-rose-700"
          >
            {{ error }}
          </p>
          <p
            v-else-if="attemptsRemaining > 0 && attemptsRemaining < 5"
            class="text-center font-mono text-xs text-(--or3-text-muted)"
          >
            {{ attemptsRemaining }} attempt{{ attemptsRemaining === 1 ? '' : 's' }} remaining
          </p>

          <div
            class="mx-auto grid w-[280px] select-none grid-cols-3 gap-3"
          >
            <button
              v-for="digit in digits"
              :key="digit"
              type="button"
              :disabled="pin.length >= 6"
              class="or3-key aspect-square rounded-2xl border-2 border-(--or3-border) bg-(--or3-surface) font-mono text-2xl font-semibold text-(--or3-text) shadow-(--or3-shadow-soft) transition-all active:scale-95 active:bg-(--or3-green-soft) enabled:hover:border-(--or3-green) enabled:hover:text-(--or3-green-dark) disabled:opacity-30"
              @click="addDigit(digit)"
            >
              {{ digit }}
            </button>
            <button
              type="button"
              class="or3-key aspect-square rounded-2xl border-2 border-(--or3-border) bg-(--or3-surface) shadow-(--or3-shadow-soft) transition-all active:scale-95 active:bg-(--or3-green-soft) enabled:hover:border-(--or3-green)"
              @click="backspace"
            >
              <Icon
                name="i-pixelarticons-delete"
                class="mx-auto size-5 text-(--or3-text-muted)"
              />
            </button>
            <button
              type="button"
              class="aspect-square rounded-2xl border-2 border-(--or3-border) bg-(--or3-surface) font-mono text-2xl font-semibold text-(--or3-text) shadow-(--or3-shadow-soft) transition-all active:scale-95 enabled:hover:border-(--or3-green) enabled:hover:text-(--or3-green-dark) disabled:opacity-30"
              :disabled="pin.length === 0 || pin.length < 4"
              @click="submit"
            >
              <Icon
                name="i-pixelarticons-arrow-right"
                class="mx-auto size-6 text-(--or3-green)"
              />
            </button>
          </div>

          <button
            type="button"
            class="mx-auto block w-fit rounded-full border border-(--or3-border) bg-white px-4 py-1.5 font-mono text-xs text-(--or3-text-muted) transition hover:bg-(--or3-green-soft)"
            @click="$emit('reset')"
          >
            Reset &amp; Re-pair
          </button>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import {
  getAttemptsRemaining,
  getLockoutRemainingMs,
  isLockedOut,
  unlock,
} from '~/composables/usePinLock'

const props = defineProps<{ visible: boolean }>()

const emit = defineEmits<{
  unlocked: []
  reset: []
}>()

const pin = ref('')
const error = ref<string | null>(null)
const submitting = ref(false)
const lockedOut = ref(false)
const countdown = ref(0)

function refreshLockout() {
  lockedOut.value = isLockedOut()
  countdown.value = getLockoutRemainingMs()
}

const countdownFormatted = computed(() => {
  const total = Math.ceil(countdown.value / 1000)
  const m = Math.floor(total / 60)
  const s = total % 60
  return `${m}:${s.toString().padStart(2, '0')}`
})

let countdownTimer: ReturnType<typeof setInterval> | null = null

function startCountdown() {
  if (countdownTimer) return
  countdownTimer = setInterval(() => {
    countdown.value = getLockoutRemainingMs()
    if (countdown.value <= 0) {
      if (countdownTimer) clearInterval(countdownTimer)
      countdownTimer = null
      lockedOut.value = false
    }
  }, 1000)
}

function stopCountdown() {
  if (countdownTimer) clearInterval(countdownTimer)
  countdownTimer = null
}

watch(
  () => props.visible,
  (visible) => {
    if (visible) {
      pin.value = ''
      error.value = null
      refreshLockout()
      if (lockedOut.value) startCountdown()
    } else {
      stopCountdown()
    }
  },
)

const attemptsRemaining = computed(() => {
  refreshLockout()
  return getAttemptsRemaining()
})

const digits = [1, 2, 3, 4, 5, 6, 7, 8, 9, 0]

function addDigit(digit: number) {
  if (pin.value.length >= 6) return
  pin.value += String(digit)
  error.value = null
}

function backspace() {
  pin.value = pin.value.slice(0, -1)
  error.value = null
}

async function submit() {
  if (submitting.value) return
  if (pin.value.length < 4) return
  submitting.value = true
  error.value = null
  try {
    const result = await unlock(pin.value)
    if (result.success) {
      emit('unlocked')
    } else {
      error.value = result.error ?? 'Incorrect PIN.'
      pin.value = ''
      refreshLockout()
      if (lockedOut.value) startCountdown()
    }
  } finally {
    submitting.value = false
  }
}

onBeforeUnmount(() => {
  stopCountdown()
})
</script>

<style scoped>
.or3-key {
  position: relative;
}

.or3-key::after {
  content: '';
  position: absolute;
  inset: 1px;
  border-radius: 14px;
  background: linear-gradient(
    180deg,
    rgba(255, 255, 255, 0.6) 0%,
    rgba(255, 255, 255, 0) 40%
  );
  pointer-events: none;
}
</style>
