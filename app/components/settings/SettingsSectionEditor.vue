<template>
  <SurfaceCard class-name="space-y-4">
    <div>
      <SectionHeader :title="title" :subtitle="subtitle" />
      <p class="mt-1 text-sm text-(--or3-text-muted)">{{ description }}</p>
    </div>

    <div v-if="!fields.length" class="rounded-2xl border border-dashed border-(--or3-border) px-4 py-5 text-center text-sm text-(--or3-text-muted)">
      {{ emptyStateText }}
    </div>

    <div v-else class="space-y-3">
      <TelegramChatDiscoveryControl
        v-if="guideContext === 'telegram'"
        :default-chat-id="String(localValues.default_id ?? '')"
        :allowed-chat-ids="String(localValues.allowlist ?? '')"
        :token="String(localValues.token ?? '')"
        @use-chat="useTelegramChat"
      />

      <div v-for="field in visibleFields" :key="field.key" class="rounded-2xl border border-(--or3-border) bg-white/70 p-3">
        <div class="flex items-start justify-between gap-3">
          <div class="min-w-0 flex-1">
            <p class="font-mono text-sm font-semibold">{{ field.label }}</p>
            <p v-if="field.description" class="mt-1 text-xs leading-5 text-(--or3-text-muted)">{{ field.description }}</p>
            <div v-if="fieldGuide(field)" class="mt-3 rounded-2xl border border-(--or3-border) bg-white/60 p-3 text-xs leading-5 text-(--or3-text-muted)">
              <p class="font-mono text-[11px] font-semibold uppercase tracking-wide text-(--or3-text)">{{ fieldGuide(field)?.title }}</p>
              <p class="mt-1">{{ fieldGuide(field)?.body }}</p>
              <ul v-if="fieldGuide(field)?.tips?.length" class="mt-2 space-y-1">
                <li v-for="tip in fieldGuide(field)?.tips" :key="tip" class="flex gap-2">
                  <Icon name="i-pixelarticons-chevron-right" class="mt-0.5 size-3.5 shrink-0 text-(--or3-text-muted)" />
                  <span>{{ tip }}</span>
                </li>
              </ul>
            </div>
          </div>
          <USwitch
            v-if="isToggle(field)"
            :model-value="toggleValue(field)"
            class="shrink-0"
            @update:model-value="(value: boolean) => updateValue(field.key, value)"
          />
          <span v-else-if="field.kind === 'secret'" class="shrink-0 rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-amber-800">
            secret
          </span>
        </div>

        <div v-if="!isToggle(field)" class="mt-2">
          <USelectMenu
            v-if="field.kind === 'choice'"
            value-key="value"
            :items="choiceItems(field)"
            :model-value="String(localValues[field.key] ?? '')"
            @update:model-value="(value: any) => updateValue(field.key, value?.value ?? value)"
          />

          <UTextarea
            v-else-if="field.kind === 'list' && field.key !== 'hardening_exec_allowed_programs' && !isTelegramAllowedChatIds(field)"
            :model-value="String(localValues[field.key] ?? '')"
            autoresize
            :rows="3"
            placeholder="Separate items with commas"
            @update:model-value="(value: string) => updateValue(field.key, value)"
          />

          <SettingCommandProgramsControl
            v-else-if="field.key === 'hardening_exec_allowed_programs'"
            :model-value="String(localValues[field.key] ?? '')"
            :options="COMMON_COMMAND_PROGRAMS"
            @update:model-value="(value: string) => updateValue(field.key, value)"
          />

          <SettingPathControl
            v-else-if="field.kind === 'path' || field.key === 'tools_path_append'"
            :model-value="String(localValues[field.key] ?? '')"
            :label="field.label"
            :placeholder="field.placeholder || field.emptyHint || '/path/to/folder'"
            @update:model-value="(value: string) => updateValue(field.key, value)"
          />

          <SettingSecondsControl
            v-else-if="field.key === 'tools_exec_timeout'"
            :model-value="localValues[field.key]"
            @update:model-value="(value: number) => updateValue(field.key, value)"
          />

          <SettingTokenListControl
            v-else-if="isTelegramAllowedChatIds(field)"
            :model-value="String(localValues[field.key] ?? '')"
            placeholder="Paste a chat ID, e.g. 849393733"
            @update:model-value="(value: string) => updateValue(field.key, value)"
          />

          <UInput
            v-else
            :type="field.kind === 'secret' ? 'password' : 'text'"
            :model-value="String(localValues[field.key] ?? '')"
            :placeholder="field.placeholder || field.emptyHint"
            @update:model-value="(value: string) => updateValue(field.key, value)"
          />
        </div>
      </div>
    </div>

    <div class="flex justify-end">
      <p
        v-if="saveStatus"
        class="mr-auto rounded-xl border px-3 py-2 text-xs leading-5"
        :class="saveStatusClass"
      >
        {{ saveStatus }}
      </p>
      <UButton
        :label="saving ? 'Saving…' : 'Save changes'"
        icon="i-pixelarticons-save"
        color="primary"
        size="lg"
        :loading="saving"
        :disabled="!fields.length"
        @click="emitSave"
      />
    </div>
  </SurfaceCard>
</template>

<script setup lang="ts">
import { computed, reactive, watch } from 'vue'
import type { ConfigureField } from '~/types/or3-api'
import { COMMON_COMMAND_PROGRAMS } from '~/settings/commandPrograms'
import SettingCommandProgramsControl from './SettingCommandProgramsControl.vue'
import SettingPathControl from './SettingPathControl.vue'
import SettingSecondsControl from './SettingSecondsControl.vue'
import SettingTokenListControl from './SettingTokenListControl.vue'
import TelegramChatDiscoveryControl from './TelegramChatDiscoveryControl.vue'

interface FieldGuide {
  title: string
  body: string
  tips?: string[]
}

const props = withDefaults(defineProps<{
  title: string
  subtitle?: string
  description?: string
  fields: ConfigureField[]
  saving?: boolean
  saveStatus?: string
  saveStatusTone?: 'success' | 'warning' | 'error' | 'neutral'
  emptyStateText?: string
  guideContext?: string
}>(), {
  subtitle: 'Remote configure',
  description: 'Edit host settings safely from your phone.',
  saving: false,
  saveStatus: '',
  saveStatusTone: 'neutral',
  emptyStateText: 'Pick a section above to see what you can change.',
  guideContext: '',
})

const emit = defineEmits<{
  save: [values: Record<string, unknown>]
}>()

const localValues = reactive<Record<string, unknown>>({})

const visibleFields = computed(() => {
  if (props.guideContext !== 'telegram') return props.fields
  return props.fields.filter((field) => !isTelegramManagedField(field))
})

const saveStatusClass = computed(() => {
  switch (props.saveStatusTone) {
    case 'success':
      return 'border-green-200 bg-green-50 text-green-900'
    case 'warning':
      return 'border-amber-200 bg-amber-50 text-amber-900'
    case 'error':
      return 'border-rose-200 bg-rose-50 text-rose-900'
    default:
      return 'border-(--or3-border) bg-white/70 text-(--or3-text-muted)'
  }
})

watch(
  () => props.fields,
  (nextFields) => {
    for (const key of Object.keys(localValues)) delete localValues[key]
    for (const field of nextFields) {
      localValues[field.key] = Array.isArray(field.value) ? field.value.join(', ') : field.value ?? ''
    }
  },
  { immediate: true },
)

function choiceItems(field: ConfigureField) {
  return (field.choices ?? []).map((choice) => {
    if (typeof choice === 'string') return { label: choice, value: choice }
    return { label: choice.label ?? choice.value, value: choice.value }
  })
}

function isToggle(field: ConfigureField) {
  const kind = String(field.kind ?? '').toLowerCase()
  return ['toggle', 'boolean', 'bool', 'switch', 'checkbox'].includes(kind) || typeof field.value === 'boolean'
}

// Backend may emit either a real boolean (current contract) or the legacy
// 'on' / 'off' / 'true' / 'false' string. Normalize to a clean boolean so
// USwitch can never end up stuck "on" because of `Boolean('off') === true`.
function toggleValue(field: ConfigureField) {
  const raw = localValues[field.key]
  if (typeof raw === 'boolean') return raw
  if (typeof raw === 'string') {
    const normalized = raw.trim().toLowerCase()
    return normalized === 'true' || normalized === 'on' || normalized === '1' || normalized === 'yes'
  }
  return Boolean(raw)
}

function updateValue(key: string, value: unknown) {
  localValues[key] = value
}

function fieldText(field: ConfigureField) {
  return `${field.key.toLowerCase()} ${field.label.toLowerCase()}`
}

function isTelegramAllowedChatIds(field: ConfigureField) {
  const text = fieldText(field)
  return props.guideContext === 'telegram' && text.includes('allowed') && text.includes('chat') && text.includes('id')
}

function isTelegramManagedField(field: ConfigureField) {
  if (props.guideContext !== 'telegram') return false
  return field.key === 'default_id' || field.key === 'allowlist' || field.key === 'access'
}

function addTelegramAllowedChatId(value: string) {
  const next = String(value ?? '').trim()
  if (!next) return
  const current = String(localValues.allowlist ?? '')
    .split(/[\s,]+/)
    .map((item) => item.trim())
    .filter(Boolean)
  if (!current.includes(next)) current.push(next)
  localValues.allowlist = current.join(',')
}

function useTelegramChat(value: string, options: { primary?: boolean } = {}) {
  const chatId = String(value ?? '').trim()
  if (!chatId) return
  if (options.primary || !String(localValues.default_id ?? '').trim()) {
    localValues.default_id = chatId
  }
  addTelegramAllowedChatId(chatId)
  localValues.access = 'allowlist'
  localValues.enabled = true
}

function fieldGuide(field: ConfigureField): FieldGuide | null {
  if (props.guideContext !== 'telegram') return null
  const text = fieldText(field)

  if (text.includes('default') && text.includes('chat') && text.includes('id')) {
    return {
      title: 'Where does this ID come from?',
      body: 'Telegram creates this number for each private chat or group. OR3-intern only stores it so it knows where it is allowed to send messages.',
      tips: [
        'Message your OR3 bot in Telegram first.',
        'Then use Telegram getUpdates or a chat ID helper bot to see the chat.id value.',
        'For a one-person setup, use the same ID here and in Allowed chat IDs.',
      ],
    }
  }

  if (text.includes('allowed') && text.includes('chat') && text.includes('id')) {
    return {
      title: 'Trusted Telegram chats',
      body: 'These are the Telegram chats allowed to send commands to OR3. Add them as chips instead of typing a comma-separated string.',
      tips: [
        'Private chats usually look like 849393733.',
        'Groups often start with -100.',
        'Include your Default chat ID here for personal setups.',
      ],
    }
  }

  if (text.includes('inbound') && text.includes('access')) {
    return {
      title: 'Recommended: allowlist',
      body: 'Allowlist means only the chat IDs you enter below can message OR3. That is the safest choice for a personal bot.',
      tips: [
        'Avoid open access unless you understand who can reach the bot.',
        'Use deny if you want Telegram sending only, with no inbound commands.',
      ],
    }
  }

  return null
}

function emitSave() {
  emit('save', { ...localValues })
}
</script>
