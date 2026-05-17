<template>
  <div class="space-y-3 rounded-2xl border border-(--or3-border) bg-white/60 p-3">
    <div class="flex flex-wrap items-start justify-between gap-3">
      <div class="min-w-0 flex-1">
        <p class="font-mono text-sm font-semibold text-(--or3-text)">Connect your Discord conversations</p>
        <p class="mt-1 text-xs leading-5 text-(--or3-text-muted)">
          Easiest path: turn on Message Content Intent in Discord, save the bot token here, restart or3-intern, then DM the bot once or send one message in a server channel and pick that conversation here. If a server message gets ignored, try mentioning the bot.
        </p>
      </div>
      <UButton
        size="sm"
        color="neutral"
        variant="soft"
        icon="i-pixelarticons-search"
        label="Find conversations"
        :loading="loading"
        @click="loadTargets"
      />
    </div>

    <div v-if="warning" class="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs leading-5 text-amber-900">
      {{ warning }}
    </div>

    <div v-if="error" class="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs leading-5 text-rose-900">
      {{ error }}
    </div>

    <div v-if="displayItems.length" class="space-y-2">
      <div
        v-for="item in displayItems"
        :key="item.channelId"
        class="rounded-xl border border-(--or3-border) bg-white/80 p-3"
      >
        <div class="flex flex-wrap items-start justify-between gap-2">
          <div class="min-w-0 flex-1">
            <p class="truncate font-mono text-sm font-semibold text-(--or3-text)">{{ item.displayName }}</p>
            <p class="mt-0.5 text-xs text-(--or3-text-muted)">{{ conversationMeta(item) }}</p>
            <p v-if="item.lastMessageText" class="mt-1 truncate text-xs text-(--or3-text-muted)">Last message: {{ item.lastMessageText }}</p>
          </div>
          <div class="flex shrink-0 flex-wrap gap-1.5">
            <UButton
              size="xs"
              color="primary"
              variant="solid"
              icon="i-pixelarticons-check"
              :label="conversationActionLabel(item.channelId)"
              :disabled="isPrimaryConversation(item.channelId)"
              @click="emit('use-conversation', item.channelId, item.userId || undefined)"
            />
            <UButton
              v-if="item.userId"
              size="xs"
              color="neutral"
              variant="soft"
              icon="i-pixelarticons-user"
              :label="trustActionLabel(item.userId)"
              :disabled="isTrustedUser(item.userId)"
              @click="emit('trust-user', item.userId)"
            />
          </div>
        </div>
      </div>
    </div>

    <div class="rounded-xl border border-(--or3-border) bg-white/70 p-3">
      <p class="font-mono text-[11px] font-semibold uppercase tracking-wide text-(--or3-text-muted)">Primary destination</p>
      <div class="mt-2 flex flex-col gap-2 sm:flex-row">
        <UInput
          v-model="manualChannelId"
          class="min-w-0 flex-1"
          placeholder="Discord channel ID"
          size="sm"
        />
        <UButton
          size="sm"
          color="primary"
          variant="soft"
          icon="i-pixelarticons-check"
          label="Set primary"
          :disabled="!manualChannelId.trim() || manualChannelId.trim() === normalizedDefaultChannelId"
          @click="setManualPrimaryDestination"
        />
      </div>
      <p class="mt-2 text-[11px] leading-5 text-(--or3-text-muted)">
        Scheduled tasks use this when sending Discord results.
      </p>
    </div>

    <div v-if="trustedUsers.length" class="rounded-xl border border-(--or3-border) bg-white/70 p-3">
      <p class="font-mono text-[11px] font-semibold uppercase tracking-wide text-(--or3-text-muted)">Trusted people</p>
      <div class="mt-2 flex flex-wrap gap-2">
        <span
          v-for="user in trustedUsers"
          :key="user.id"
          class="inline-flex items-center rounded-full border border-(--or3-border) bg-white/80 px-2.5 py-1 text-xs text-(--or3-text)"
        >
          {{ user.label }}
        </span>
      </div>
      <p class="mt-2 text-[11px] leading-5 text-(--or3-text-muted)">
        Trusted people are the Discord users allowed to trigger OR3 when inbound access is limited to your allowlist.
      </p>
    </div>

    <p v-if="loaded && !error && !displayItems.length" class="rounded-xl border border-dashed border-(--or3-border) px-3 py-3 text-center text-xs leading-5 text-(--or3-text-muted)">
      No Discord conversations found yet. Save the token, restart or3-intern, invite or DM the bot once, then try again.
    </p>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useAuthSession } from '~/composables/useAuthSession'
import { useOr3Api } from '~/composables/useOr3Api'

interface DiscordTargetCandidate {
  channelId: string
  userId?: string
  guildId?: string
  kind?: string
  displayName: string
  userDisplayName?: string
  channelName?: string
  guildName?: string
  lastMessageText?: string
  isPrivate?: boolean
}

const props = defineProps<{
  defaultChannelId: string
  allowedUserIds: string
  token: string
}>()

const emit = defineEmits<{
  'use-conversation': [channelId: string, userId?: string]
  'trust-user': [userId: string]
}>()

const api = useOr3Api()
const authSession = useAuthSession()
const loading = ref(false)
const loaded = ref(false)
const error = ref('')
const warning = ref('')
const items = ref<DiscordTargetCandidate[]>([])
const manualChannelId = ref('')

const normalizedDefaultChannelId = computed(() => String(props.defaultChannelId ?? '').trim())

const allowedIds = computed(() =>
  String(props.allowedUserIds ?? '')
    .split(/[\s,]+/)
    .map((item) => item.trim())
    .filter(Boolean),
)

const knownPrimaryItem = computed<DiscordTargetCandidate[]>(() => {
  const id = normalizedDefaultChannelId.value
  if (!id) return []
  return [{ channelId: id, kind: 'saved', displayName: 'Primary Discord destination', lastMessageText: 'Saved in OR3 settings.' }]
})

const displayItems = computed(() => {
  const byId = new Map<string, DiscordTargetCandidate>()
  for (const item of knownPrimaryItem.value) byId.set(item.channelId, item)
  for (const item of items.value) byId.set(item.channelId, item)
  return [...byId.values()]
})

const trustedUsers = computed(() => {
  const labelsById = new Map<string, string>()
  for (const item of displayItems.value) {
    const id = String(item.userId ?? '').trim()
    if (!id) continue
    const label = item.userDisplayName || item.displayName || id
    if (!labelsById.has(id)) labelsById.set(id, label)
  }
  return allowedIds.value.map((id) => ({ id, label: labelsById.get(id) || `Trusted user ${id}` }))
})

watch(
  normalizedDefaultChannelId,
  (nextValue) => {
    manualChannelId.value = nextValue
  },
  { immediate: true },
)

function isPrimaryConversation(channelId: string) {
  return normalizedDefaultChannelId.value === channelId
}

function isTrustedUser(userId: string) {
  return allowedIds.value.includes(userId)
}

function conversationActionLabel(channelId: string) {
  if (isPrimaryConversation(channelId)) return 'Default destination'
  return props.defaultChannelId ? 'Make default' : 'Use this conversation'
}

function trustActionLabel(userId: string) {
  return isTrustedUser(userId) ? 'Trusted sender' : 'Trust sender'
}

function conversationMeta(item: DiscordTargetCandidate) {
  if (item.kind === 'saved') return 'Saved primary Discord destination'
  if (item.kind === 'dm' || item.isPrivate) {
    return item.userDisplayName ? `Private chat · ${item.userDisplayName}` : 'Private chat'
  }
  const parts = ['Server channel']
  if (item.guildName) parts.push(item.guildName)
  if (item.userDisplayName) parts.push(`last sender: ${item.userDisplayName}`)
  return parts.join(' · ')
}

function setManualPrimaryDestination() {
  const channelId = manualChannelId.value.trim()
  if (!channelId) return
  emit('use-conversation', channelId)
}

async function loadTargets() {
  loading.value = true
  loaded.value = false
  error.value = ''
  warning.value = ''
  try {
    const response = await authSession.retryWithAuth(
      (onAuthChallenge) => api.request<{ items?: DiscordTargetCandidate[]; warning?: string }>('/internal/v1/configure/channels/discord/targets', {
        method: 'POST',
        body: { token: props.token, limit: 20 },
        onAuthChallenge,
      }),
      'settings-change',
    )
    items.value = response.items ?? []
    warning.value = response.warning ?? ''
    loaded.value = true
  } catch (err: any) {
    items.value = []
    loaded.value = true
    error.value = err?.message ?? 'Could not ask Discord for recent conversations.'
  } finally {
    loading.value = false
  }
}
</script>
