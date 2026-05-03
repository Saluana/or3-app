<template>
  <AppShell>
    <AppHeader subtitle="SECURITY" />

    <div class="space-y-4">
      <button
        type="button"
        class="or3-focus-ring inline-flex items-center gap-2 rounded-full border border-(--or3-border) bg-(--or3-surface) px-3 py-1.5 font-mono text-xs font-semibold uppercase tracking-wide text-(--or3-text)"
        @click="goBack"
      >
        <Icon name="i-pixelarticons-chevron-left" class="size-4" />
        Settings
      </button>

      <SurfaceCard class-name="space-y-3">
        <div class="flex items-start gap-3">
          <RetroIcon name="i-pixelarticons-shield" />
          <div class="min-w-0 flex-1">
            <p class="font-mono text-base font-semibold text-(--or3-text)">Security dashboard</p>
            <p class="mt-1 text-sm leading-6 text-(--or3-text-muted)">
              Pairing trusts this phone or tablet. Passkeys verify that you are the owner before sensitive changes go through.
            </p>
          </div>
        </div>
        <div class="grid gap-3 sm:grid-cols-2">
          <div class="rounded-2xl border border-(--or3-border) bg-white/70 p-4">
            <p class="text-xs font-semibold uppercase tracking-wide text-(--or3-green-dark)">Passkey status</p>
            <p class="mt-2 font-mono text-lg font-semibold text-(--or3-text)">{{ passkeySummary }}</p>
            <p class="mt-1 text-sm text-(--or3-text-muted)">{{ passkeyDetail }}</p>
          </div>
          <div class="rounded-2xl border border-(--or3-border) bg-white/70 p-4">
            <p class="text-xs font-semibold uppercase tracking-wide text-(--or3-green-dark)">Session policy</p>
            <p class="mt-2 font-mono text-lg font-semibold text-(--or3-text)">{{ capabilities?.passkeyMode || 'unknown' }}</p>
            <p class="mt-1 text-sm text-(--or3-text-muted)">{{ sessionPolicyDetail }}</p>
          </div>
          <div class="rounded-2xl border border-(--or3-border) bg-white/70 p-4">
            <p class="text-xs font-semibold uppercase tracking-wide text-(--or3-green-dark)">Device trust</p>
            <p class="mt-2 font-mono text-lg font-semibold text-(--or3-text)">{{ activeHost?.name || 'No paired computer' }}</p>
            <p class="mt-1 text-sm text-(--or3-text-muted)">{{ deviceTrustDetail }}</p>
          </div>
          <div class="rounded-2xl border border-(--or3-border) bg-white/70 p-4">
            <p class="text-xs font-semibold uppercase tracking-wide text-(--or3-green-dark)">Recovery readiness</p>
            <p class="mt-2 font-mono text-lg font-semibold text-(--or3-text)">{{ recoveryStatus }}</p>
            <p class="mt-1 text-sm text-(--or3-text-muted)">{{ recoveryDetail }}</p>
          </div>
        </div>
      </SurfaceCard>

      <SurfaceCard class-name="space-y-3">
        <DangerCallout v-if="degradedState" :tone="degradedState.tone as 'info' | 'caution' | 'danger' | 'tip'" :title="degradedState.title">
          {{ degradedState.message }}
        </DangerCallout>

        <div class="flex items-start justify-between gap-3">
          <div>
            <p class="font-mono text-base font-semibold text-(--or3-text)">Current session</p>
            <p class="mt-1 text-sm text-(--or3-text-muted)">
              {{ sessionDescription }}
            </p>
          </div>
          <StatusPill :label="sessionStatusLabel" :tone="session?.session?.id ? 'green' : 'amber'" :pulse="Boolean(session?.session?.id)" />
        </div>
        <div class="flex flex-wrap gap-2">
          <UButton label="Refresh session" icon="i-pixelarticons-reload" color="neutral" variant="soft" :loading="loading" @click="refreshAll" />
          <UButton v-if="!session?.session?.id" label="Sign in with passkey" icon="i-pixelarticons-lock" color="primary" :loading="loading" @click="signIn" />
          <UButton v-else label="Verify now" icon="i-pixelarticons-shield" color="primary" variant="soft" :loading="loading" @click="stepUpOpen = true" />
          <UButton v-if="session?.session?.id" label="Sign out" icon="i-pixelarticons-logout" color="neutral" variant="ghost" :loading="loading" @click="signOut" />
        </div>
      </SurfaceCard>

      <SurfaceCard class-name="space-y-3">
        <p class="font-mono text-base font-semibold text-(--or3-text)">Shortcuts</p>
        <div class="grid gap-3 sm:grid-cols-2">
          <NuxtLink class="rounded-2xl border border-(--or3-border) bg-white/70 p-4 transition hover:bg-(--or3-green-soft)" to="/settings/passkeys">
            <p class="font-mono text-sm font-semibold text-(--or3-text)">Manage passkeys</p>
            <p class="mt-1 text-sm text-(--or3-text-muted)">Register, rename, and remove passkeys for this computer.</p>
          </NuxtLink>
          <NuxtLink class="rounded-2xl border border-(--or3-border) bg-white/70 p-4 transition hover:bg-(--or3-green-soft)" to="/settings/pair">
            <p class="font-mono text-sm font-semibold text-(--or3-text)">Trusted devices</p>
            <p class="mt-1 text-sm text-(--or3-text-muted)">Pair new phones and review which devices are allowed to control this computer.</p>
          </NuxtLink>
        </div>
      </SurfaceCard>
    </div>

    <StepUpSheet
      v-model:open="stepUpOpen"
      title="Confirm you’re the owner"
      message="Use your passkey to refresh the recent verification window before changing security-sensitive settings."
      :loading="loading"
      @confirm="verifyNow"
    />
  </AppShell>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useActiveHost } from '~/composables/useActiveHost'
import { useAuthSession } from '~/composables/useAuthSession'
import { useMobileAuthSupport } from '~/composables/useMobileAuthSupport'
import { usePasskeys } from '~/composables/usePasskeys'
import StepUpSheet from '~/components/settings/StepUpSheet.vue'

const router = useRouter()
const { activeHost } = useActiveHost()
const authSession = useAuthSession()
const mobileAuthSupport = useMobileAuthSupport()
const passkeys = usePasskeys()
const loading = ref(false)
const stepUpOpen = ref(false)

const capabilities = computed(() => authSession.capabilities.value)
const session = computed(() => authSession.session.value)
const passkeyCount = computed(() => passkeys.passkeys.value.length)
const passkeySummary = computed(() => passkeyCount.value > 0 ? `${passkeyCount.value} registered` : 'Not set up')
const passkeyDetail = computed(() => passkeyCount.value > 0
  ? 'You can use a passkey to sign in and approve sensitive changes.'
  : 'Add at least one passkey so owner checks can happen without falling back to device trust alone.')
const sessionPolicyDetail = computed(() => {
  if (!capabilities.value) return 'Checking the host policy now.'
  if (capabilities.value.stepUpRequiredForSensitive) return 'Sensitive actions require a recent passkey verification.'
  if (capabilities.value.sessionRequired) return 'A signed-in session is required before most actions.'
  return 'This host still allows legacy paired-device access for everyday actions.'
})
const deviceTrustDetail = computed(() => activeHost.value?.pairedToken
  ? 'This device is enrolled and can reconnect to your computer.'
  : 'Pair this app to a computer before passkeys can be used.')
const recoveryStatus = computed(() => passkeyCount.value > 0 ? 'Ready' : 'Needs setup')
const recoveryDetail = computed(() => passkeyCount.value > 0
  ? 'Keep at least one working passkey and one paired admin device available.'
  : 'Register a passkey and keep a paired admin device handy before tightening enforcement.')
const degradedState = computed(() => mobileAuthSupport.degradedState.value)
const sessionDescription = computed(() => session.value?.session?.id
  ? `Signed in as ${session.value.user.display_name || session.value.user.displayName || session.value.user.id}.`
  : 'No active passkey session yet. You can still pair devices, then sign in when you need stronger verification.')
const sessionStatusLabel = computed(() => session.value?.session?.id ? 'Signed in' : 'Pairing only')

function goBack() {
  void router.push('/settings')
}

async function refreshAll() {
  loading.value = true
  try {
    await authSession.loadCapabilities(true)
    await mobileAuthSupport.refreshSupport()
    await Promise.allSettled([
      authSession.refreshSession(),
      passkeys.listPasskeys(true),
    ])
  } finally {
    loading.value = false
  }
}

async function signIn() {
  loading.value = true
  try {
    await authSession.loginWithPasskey('settings-security')
    await refreshAll()
  } finally {
    loading.value = false
  }
}

async function signOut() {
  loading.value = true
  try {
    await authSession.logout('settings-security')
  } finally {
    loading.value = false
  }
}

async function verifyNow() {
  loading.value = true
  try {
    await authSession.runStepUp('settings-security')
    stepUpOpen.value = false
    await refreshAll()
  } finally {
    loading.value = false
  }
}

onMounted(async () => {
  await refreshAll()
})
</script>
