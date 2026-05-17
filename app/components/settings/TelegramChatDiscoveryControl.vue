<template>
  <div class="space-y-3 rounded-2xl border border-(--or3-border) bg-white/60 p-3">
    <div class="flex flex-wrap items-start justify-between gap-3">
      <div class="min-w-0 flex-1">
        <p class="font-mono text-sm font-semibold text-(--or3-text)">Connect your Telegram chat</p>
        <p class="mt-1 text-xs leading-5 text-(--or3-text-muted)">
          Paste the bot token above, send your bot any message in Telegram, then find and choose your primary chat. After that, you can trust more recent chats from this same list.
        </p>
      </div>
      <UButton
        size="sm"
        color="neutral"
        variant="soft"
        icon="i-pixelarticons-search"
        label="Find chats"
        :loading="loading"
        @click="loadChats"
      />
    </div>

    <div v-if="error" class="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs leading-5 text-amber-900">
      {{ error }}
    </div>

    <div v-if="items.length" class="space-y-2">
      <div
        v-for="item in items"
        :key="item.id"
        class="rounded-xl border border-(--or3-border) bg-white/80 p-3"
      >
        <div class="flex flex-wrap items-start justify-between gap-2">
          <div class="min-w-0 flex-1">
            <p class="truncate font-mono text-sm font-semibold text-(--or3-text)">{{ item.displayName }}</p>
            <p class="mt-0.5 font-mono text-xs text-(--or3-text-muted)">{{ item.type || 'chat' }} · ID saved automatically</p>
            <p v-if="item.lastMessageText" class="mt-1 truncate text-xs text-(--or3-text-muted)">Last message: {{ item.lastMessageText }}</p>
          </div>
          <div class="flex shrink-0 flex-wrap gap-1.5">
            <UButton
              size="xs"
              color="primary"
              variant="solid"
              icon="i-pixelarticons-check"
              :label="chatActionLabel(item.id)"
              :disabled="isPrimaryChat(item.id) || isTrustedChat(item.id)"
              @click="emit('use-chat', item.id, { primary: !defaultChatId })"
            />
          </div>
        </div>
      </div>
    </div>

    <p v-else-if="loaded && !error" class="rounded-xl border border-dashed border-(--or3-border) px-3 py-3 text-center text-xs leading-5 text-(--or3-text-muted)">
      No recent chats found. Open Telegram, send your bot a message, wait a second, then try again.
    </p>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import { useAuthSession } from '~/composables/useAuthSession'
import { useOr3Api } from '~/composables/useOr3Api'

interface TelegramChatCandidate {
  id: string
  type?: string
  displayName: string
  lastMessageText?: string
}

const props = defineProps<{
  defaultChatId: string
  allowedChatIds: string
  token: string
}>()

const emit = defineEmits<{
  'use-chat': [value: string, options?: { primary?: boolean }]
}>()

const api = useOr3Api()
const authSession = useAuthSession()
const loading = ref(false)
const loaded = ref(false)
const error = ref('')
const items = ref<TelegramChatCandidate[]>([])

const allowedIds = computed(() =>
  String(props.allowedChatIds ?? '')
    .split(/[\s,]+/)
    .map((item) => item.trim())
    .filter(Boolean),
)

function isPrimaryChat(id: string) {
  return props.defaultChatId === id
}

function isTrustedChat(id: string) {
  return allowedIds.value.includes(id)
}

function chatActionLabel(id: string) {
  if (isPrimaryChat(id)) return 'Primary chat'
  if (isTrustedChat(id)) return 'Trusted'
  return props.defaultChatId ? 'Trust chat' : 'Use this chat'
}

async function loadChats() {
  loading.value = true
  loaded.value = false
  error.value = ''
  try {
    const response = await authSession.retryWithAuth(
      (onAuthChallenge) => api.request<{ items?: TelegramChatCandidate[] }>('/internal/v1/configure/channels/telegram/chats', {
        method: 'POST',
        body: { token: props.token, limit: 20 },
        onAuthChallenge,
      }),
      'settings-change',
    )
    items.value = response.items ?? []
    loaded.value = true
  } catch (err: any) {
    items.value = []
    loaded.value = true
    error.value = err?.message ?? 'Could not ask Telegram for recent chats.'
  } finally {
    loading.value = false
  }
}
</script>
