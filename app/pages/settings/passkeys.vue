<template>
  <AppShell>
    <AppHeader subtitle="PASSKEYS" />

    <div class="space-y-4">
      <button
        type="button"
        class="or3-focus-ring inline-flex items-center gap-2 rounded-full border border-(--or3-border) bg-(--or3-surface) px-3 py-1.5 font-mono text-xs font-semibold uppercase tracking-wide text-(--or3-text)"
        @click="goBack"
      >
        <Icon name="i-pixelarticons-chevron-left" class="size-4" />
        Security
      </button>

      <SurfaceCard class-name="space-y-3">
        <div class="flex items-start gap-3">
          <RetroIcon name="i-pixelarticons-lock" />
          <div class="min-w-0 flex-1">
            <p class="font-mono text-base font-semibold text-(--or3-text)">Passkeys protect the owner</p>
            <p class="mt-1 text-sm leading-6 text-(--or3-text-muted)">
              Pairing enrolls this phone or tablet. Passkeys prove that you are the person holding it before sensitive security changes happen.
            </p>
          </div>
        </div>

        <DangerCallout tone="info" title="Unknown passkey?">
          If you see a passkey you do not recognize, remove it right away. Keep at least one working passkey and one paired admin device so you do not lock yourself out.
        </DangerCallout>

        <div class="grid gap-3 sm:grid-cols-[1fr_auto] sm:items-end">
          <UFormField label="New passkey label" name="nickname" description="Helpful names make it easier to spot the right laptop, phone, or security key later.">
            <UInput v-model="registerForm.nickname" placeholder="Brendon's iPhone passkey" class="w-full" />
          </UFormField>
          <UButton label="Add passkey" icon="i-pixelarticons-plus" color="primary" :loading="loading" @click="register" />
        </div>
      </SurfaceCard>

      <SurfaceCard class-name="space-y-3">
        <div class="flex items-center justify-between gap-3">
          <div>
            <p class="font-mono text-base font-semibold text-(--or3-text)">Registered passkeys</p>
            <p class="mt-1 text-sm text-(--or3-text-muted)">Use a recent passkey check before renaming or revoking a credential.</p>
          </div>
          <UButton label="Refresh" icon="i-pixelarticons-reload" color="neutral" variant="ghost" :loading="loading" @click="refresh" />
        </div>

        <div v-if="!passkeyItems.length" class="rounded-2xl border border-dashed border-(--or3-border) bg-white/60 px-4 py-6 text-center text-sm text-(--or3-text-muted)">
          No passkeys yet. Add one now so this app can verify the owner before sensitive changes.
        </div>

        <div v-else class="space-y-3">
          <div v-for="passkey in passkeyItems" :key="passkey.id" class="rounded-2xl border border-(--or3-border) bg-white/70 p-4">
            <div class="flex items-start justify-between gap-3">
              <div class="min-w-0 flex-1">
                <p class="truncate font-mono text-sm font-semibold text-(--or3-text)">{{ passkey.nickname || 'Unnamed passkey' }}</p>
                <p class="mt-1 text-xs text-(--or3-text-muted)">
                  {{ passkey.device_id || 'No device linked' }} · last used {{ formatTimestamp(passkey.last_used_at || passkey.updated_at || passkey.created_at) }}
                </p>
              </div>
              <StatusPill :label="passkey.revoked_at ? 'Removed' : 'Active'" :tone="passkey.revoked_at ? 'amber' : 'green'" />
            </div>
            <div class="mt-3 grid gap-3 sm:grid-cols-[1fr_auto_auto] sm:items-end">
              <UFormField label="Label" :name="`nickname-${passkey.id}`">
                <UInput v-model="nicknameDrafts[passkey.id]" class="w-full" placeholder="Friendly passkey name" />
              </UFormField>
              <UButton label="Save label" color="neutral" variant="soft" :disabled="!canSaveNickname(passkey)" @click="prepareRename(passkey)" />
              <UButton label="Remove" color="error" variant="soft" @click="prepareRevoke(passkey)" />
            </div>
          </div>
        </div>

        <p v-if="errorMessage" class="text-sm text-(--or3-danger)">{{ errorMessage }}</p>
      </SurfaceCard>
    </div>

    <StepUpSheet
      v-model:open="stepUpOpen"
      :title="stepUpTitle"
      :message="stepUpMessage"
      :loading="loading"
      @confirm="confirmSensitiveAction"
    />
  </AppShell>
</template>

<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue'
import type { AuthPasskey } from '~/types/auth'
import StepUpSheet from '~/components/settings/StepUpSheet.vue'
import { useAuthSession } from '~/composables/useAuthSession'
import { usePasskeys } from '~/composables/usePasskeys'

const router = useRouter()
const authSession = useAuthSession()
const passkeys = usePasskeys()
const loading = ref(false)
const registerForm = reactive({ nickname: '' })
const nicknameDrafts = reactive<Record<string, string>>({})
const stepUpOpen = ref(false)
const pendingAction = ref<{ type: 'rename' | 'revoke'; passkey: AuthPasskey; nickname?: string } | null>(null)

const passkeyItems = computed(() => passkeys.passkeys.value)
const errorMessage = computed(() => passkeys.errorMessage.value)
const stepUpTitle = computed(() => pendingAction.value?.type === 'revoke' ? 'Verify before removing this passkey' : 'Verify before renaming this passkey')
const stepUpMessage = computed(() => pendingAction.value?.type === 'revoke'
  ? 'Removing a passkey is sensitive. Confirm with your passkey first, then the selected credential will be revoked.'
  : 'Renaming a passkey changes your security inventory. Confirm with your passkey first, then the label will be updated.')

function goBack() {
  void router.push('/settings/security')
}

function formatTimestamp(value?: number) {
  if (!value) return 'recently'
  return new Date(value).toLocaleString()
}

function syncDrafts() {
  for (const passkey of passkeyItems.value) {
    nicknameDrafts[passkey.id] = passkey.nickname || ''
  }
}

function canSaveNickname(passkey: AuthPasskey) {
  return (nicknameDrafts[passkey.id] || '').trim() !== (passkey.nickname || '').trim()
}

async function refresh() {
  loading.value = true
  try {
    await Promise.allSettled([
      authSession.loadCapabilities(true),
      authSession.refreshSession().catch(() => undefined),
      passkeys.listPasskeys(true),
    ])
    syncDrafts()
  } finally {
    loading.value = false
  }
}

async function register() {
  loading.value = true
  try {
    await passkeys.registerPasskey({ nickname: registerForm.nickname || undefined, reason: 'settings-passkeys-register' })
    registerForm.nickname = ''
    await refresh()
  } finally {
    loading.value = false
  }
}

function prepareRename(passkey: AuthPasskey) {
  pendingAction.value = { type: 'rename', passkey, nickname: nicknameDrafts[passkey.id] }
  stepUpOpen.value = true
}

function prepareRevoke(passkey: AuthPasskey) {
  pendingAction.value = { type: 'revoke', passkey }
  stepUpOpen.value = true
}

async function confirmSensitiveAction() {
  if (!pendingAction.value) return
  loading.value = true
  try {
    await authSession.runStepUp(`passkeys-${pendingAction.value.type}`)
    if (pendingAction.value.type === 'rename') {
      await passkeys.renamePasskey(pendingAction.value.passkey.id, pendingAction.value.nickname || '')
    } else {
      await passkeys.revokePasskey(pendingAction.value.passkey.id, 'user-revoked')
    }
    stepUpOpen.value = false
    pendingAction.value = null
    await refresh()
  } finally {
    loading.value = false
  }
}

onMounted(async () => {
  await refresh()
})
</script>
