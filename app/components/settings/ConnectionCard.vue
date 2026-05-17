<template>
    <div class="rounded-2xl border border-(--or3-border) bg-white/75 p-4 shadow-sm">
        <div class="flex items-start gap-3">
            <span class="grid size-10 shrink-0 place-items-center rounded-2xl border border-(--or3-border) bg-(--or3-surface-soft) text-(--or3-green-dark)">
                <Icon :name="meta.icon" class="size-5" />
            </span>
            <div class="min-w-0 flex-1">
                <div class="flex flex-wrap items-center gap-2">
                    <p class="font-mono text-sm font-semibold text-(--or3-text)">{{ control.label }}</p>
                    <StatusPill :label="statusLabel" :tone="statusTone" />
                </div>
                <p class="mt-1 text-xs leading-5 text-(--or3-text-muted)">{{ meta.promise }}</p>
            </div>
        </div>

        <div class="mt-3 rounded-xl border border-(--or3-border) bg-white/65 p-3">
            <p class="font-mono text-[11px] font-semibold uppercase tracking-wide text-(--or3-text-muted)">
                {{ enabled ? 'Live connection' : setupStateTitle }}
            </p>
            <ol class="mt-2 space-y-1.5 text-xs leading-5 text-(--or3-text)">
                <li v-for="step in visibleSteps" :key="step" class="flex gap-2">
                    <Icon name="i-pixelarticons-check" class="mt-0.5 size-3.5 shrink-0 text-(--or3-green-dark)" />
                    <span>{{ step }}</span>
                </li>
            </ol>
        </div>

        <div class="mt-3 flex flex-wrap items-center gap-2">
            <UButton
                size="sm"
                color="primary"
                variant="solid"
                :label="primaryActionLabel"
                icon="i-pixelarticons-arrow-right"
                :to="manageHref"
            />
            <UButton
                v-if="meta.helpHref"
                size="sm"
                color="neutral"
                variant="soft"
                icon="i-pixelarticons-external-link"
                :label="meta.helpLabel || 'Learn more'"
                :to="meta.helpHref"
                target="_blank"
            />
            <UButton
                v-if="canEnableFromCard"
                size="sm"
                color="neutral"
                variant="soft"
                label="Turn on"
                icon="i-pixelarticons-power"
                @click="onToggle(true)"
            />
            <UButton
                v-else-if="enabled"
                size="sm"
                color="neutral"
                variant="soft"
                label="Pause"
                icon="i-pixelarticons-pause"
                @click="onToggle(false)"
            />
        </div>

        <p class="mt-2 text-[11px] leading-5 text-(--or3-text-muted)">
            {{ detailSummary }}
        </p>
    </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import type { SimpleSettingChange, SimpleSettingControl } from '~/settings/simpleSettings'

const props = defineProps<{
    control: SimpleSettingControl
    currentValue: unknown
    valueIndex: Record<string, unknown>
}>()

const emit = defineEmits<{ change: [change: SimpleSettingChange] }>()

const enabled = computed(() => Boolean(props.currentValue))

interface ChannelCardMeta {
    icon: string
    promise: string
    setupSteps: string[]
    connectedSteps: string[]
    helpLabel?: string
    helpHref?: string
}

const CHANNEL_CARD_META: Record<string, ChannelCardMeta> = {
    telegram: {
        icon: 'i-pixelarticons-message-text',
        promise: 'Start chats from Telegram once a bot token and trusted chat are saved.',
        setupSteps: ['Create a bot with BotFather.', 'Paste the bot token.', 'Send one message, then save the allowed chat.'],
        connectedSteps: ['Telegram is enabled.', 'Trusted chat details are saved.', 'You can manage or pause it anytime.'],
    },
    slack: {
        icon: 'i-pixelarticons-message-text',
        promise: 'Bring OR3 into a Slack workspace for team messages and approvals.',
        setupSteps: ['Create or open your Slack app.', 'Paste the bot, app, and signing secrets.', 'Install the app to your workspace.'],
        connectedSteps: ['Slack is enabled.', 'Workspace credentials are saved.', 'You can manage or pause it anytime.'],
    },
    discord: {
        icon: 'i-pixelarticons-message-text',
        promise: 'Let OR3 answer in a Discord server channel or a private DM after the bot receives one message there.',
        setupSteps: ['Create the bot, turn on Message Content Intent, and copy the bot token.', 'Use OAuth2 → URL Generator to invite the bot with bot + applications.commands.', 'Save the token here, restart, then DM the bot or send one server message and pick the conversation.'],
        connectedSteps: ['Discord is enabled.', 'Bot credentials are saved.', 'You can manage or pause it anytime.'],
        helpLabel: 'Developer portal',
        helpHref: 'https://discord.com/developers/applications',
    },
    whatsapp: {
        icon: 'i-pixelarticons-message-text',
        promise: 'Connect OR3 to a separate WhatsApp bridge service so it can receive and send WhatsApp messages.',
        setupSteps: ['Set up or run a WhatsApp bridge service first — OR3 does not include one by itself.', 'Paste the bridge URL, and a bridge token if your bridge requires auth.', 'Save, enable WhatsApp, then message the bridged WhatsApp account and confirm the trusted sender rules.'],
        connectedSteps: ['WhatsApp is enabled.', 'Provider details are saved.', 'You can manage or pause it anytime.'],
        helpLabel: 'Bridge docs',
        helpHref: 'https://wwebjs.dev/guide/creating-your-bot/',
    },
    email: {
        icon: 'i-pixelarticons-mail',
        promise: 'Use an inbox for OR3 replies, updates, and handoffs.',
        setupSteps: ['Choose the email account OR3 should use.', 'Add sending and receiving details.', 'Save, then send a test message.'],
        connectedSteps: ['Email is enabled.', 'Mail server details are saved.', 'You can manage or pause it anytime.'],
    },
}

const channelKey = computed(() => props.control.connection?.channelKey ?? '')
const meta = computed<ChannelCardMeta>(() => CHANNEL_CARD_META[channelKey.value] ?? {
    icon: 'i-pixelarticons-link',
    promise: props.control.description,
    setupSteps: ['Open setup.', 'Add the requested details.', 'Save and turn it on.'],
    connectedSteps: ['This app is enabled.', 'Connection details are saved.', 'You can manage or pause it anytime.'],
})

const manageHref = computed(() => {
    const ch = channelKey.value
    return ch ? `/settings/channel/${encodeURIComponent(ch)}` : '/settings/section/connections'
})

const completedDetailCount = computed(() => {
    const keys = props.control.advancedKeys ?? []
    return keys.filter((k) => props.valueIndex[k] !== undefined && props.valueIndex[k] !== null && props.valueIndex[k] !== '').length
})

const requiredDetailCount = computed(() => props.control.advancedKeys?.length ?? 0)
const hasAnyDetails = computed(() => completedDetailCount.value > 0)
const hasAllDetails = computed(() => requiredDetailCount.value > 0 && completedDetailCount.value >= requiredDetailCount.value)
const canEnableFromCard = computed(() => !enabled.value && hasAllDetails.value)

const statusLabel = computed(() => {
    if (enabled.value) return 'Connected'
    if (hasAnyDetails.value) return 'Finish setup'
    return 'Not connected'
})

const statusTone = computed(() => {
    if (enabled.value) return 'green'
    if (hasAnyDetails.value) return 'amber'
    return 'neutral'
})

const setupStateTitle = computed(() => hasAnyDetails.value ? 'Almost there' : 'Quick setup')
const visibleSteps = computed(() => enabled.value ? meta.value.connectedSteps : meta.value.setupSteps)
const primaryActionLabel = computed(() => {
    if (enabled.value) return 'Manage'
    if (hasAnyDetails.value) return 'Finish setup'
    return `Connect ${props.control.label}`
})

const detailSummary = computed(() => {
    if (!requiredDetailCount.value) return 'Open setup to see what this app needs.'
    if (enabled.value) return `${completedDetailCount.value} setup detail${completedDetailCount.value === 1 ? '' : 's'} saved.`
    if (!completedDetailCount.value) return 'No setup details saved yet — the next screen walks you through it.'
    return `${completedDetailCount.value} of ${requiredDetailCount.value} setup details saved.`
})

function onToggle(value: boolean) {
    const ref = props.control.fieldRefs[0]
    if (!ref) return
    emit('change', { section: ref.section, field: ref.field, channel: ref.channel, value })
}
</script>
