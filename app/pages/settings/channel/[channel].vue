<template>
    <AppShell
    desktop-title="Settings"
    desktop-subtitle="Configure or3-intern."
  >
    <template #sidebar><SettingsSidebar /></template>
        <AppHeader subtitle="SETTINGS · CONNECTED APP" />

        <div class="space-y-4">
            <SurfaceCard class-name="space-y-3">
                <button
                    type="button"
                    class="inline-flex items-center gap-1 rounded-full px-2 py-1 text-sm font-medium text-(--or3-green) transition hover:bg-(--or3-green-soft)"
                    @click="$router.push('/settings/section/connections')"
                >
                    <Icon name="i-pixelarticons-chevron-left" class="size-4" />
                    Connected Apps
                </button>

                <div class="flex items-start gap-3">
                    <RetroIcon :name="iconForChannel" size="sm" />
                    <div class="min-w-0 flex-1">
                        <p class="font-mono text-base font-semibold text-(--or3-text)">{{ channelLabel }}</p>
                        <p class="mt-1 text-sm leading-6 text-(--or3-text-muted)">
                            {{ channelMeta.intro }}
                        </p>
                    </div>
                </div>

                <div class="grid gap-2 sm:grid-cols-3">
                    <div
                        v-for="(step, index) in channelMeta.steps"
                        :key="step.title"
                        class="rounded-2xl border border-(--or3-border) bg-white/70 p-3"
                    >
                        <p class="font-mono text-[11px] font-semibold uppercase tracking-wide text-(--or3-text-muted)">
                            Step {{ index + 1 }}
                        </p>
                        <p class="mt-1 font-mono text-sm font-semibold text-(--or3-text)">{{ step.title }}</p>
                        <p class="mt-1 text-xs leading-5 text-(--or3-text-muted)">{{ step.body }}</p>
                    </div>
                </div>

                <div class="rounded-2xl border border-(--or3-border) bg-white/60 px-3 py-2 text-xs leading-5 text-(--or3-text-muted)">
                    {{ channelMeta.reassurance }}
                </div>

                <div v-if="channelMeta.resources?.length" class="flex flex-wrap gap-2">
                    <UButton
                        v-for="resource in channelMeta.resources"
                        :key="resource.href"
                        size="sm"
                        color="neutral"
                        variant="soft"
                        icon="i-pixelarticons-external-link"
                        :label="resource.label"
                        :to="resource.href"
                        target="_blank"
                    />
                </div>

                <p v-if="configureError" class="text-sm text-rose-600">{{ configureError }}</p>
            </SurfaceCard>

            <SettingsSectionEditor
                :title="`${channelLabel} settings`"
                subtitle="Guided setup"
                :description="channelMeta.formDescription"
                :fields="fields"
                :saving="configureSaving"
                :save-status="saveStatus"
                :save-status-tone="saveStatusTone"
                :guide-context="channelKey"
                empty-state-text="This host does not expose any fields for this connected app yet."
                @save="onSave"
            />
        </div>
    </AppShell>
</template>

<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import type { ConfigureChange, ConfigureField } from '~/types/or3-api'
import { useConfigure } from '~/composables/useConfigure'

const route = useRoute()

const channelKey = computed(() => String(route.params.channel ?? '').toLowerCase())

interface ChannelSetupMeta {
    label: string
    icon: string
    intro: string
    formDescription: string
    reassurance: string
    steps: Array<{ title: string; body: string }>
    resources?: Array<{ label: string; href: string }>
}

const CHANNEL_META: Record<string, ChannelSetupMeta> = {
    telegram: {
        label: 'Telegram',
        icon: 'i-pixelarticons-message-text',
        intro: 'Connect Telegram in a few steps: create a bot, paste the token, then tell OR3 which Telegram chats are trusted.',
        formDescription: 'Paste the bot token, message your bot, then use Find chats to choose the conversation OR3 should trust.',
        reassurance: 'You should not need to manually find or type Telegram IDs. Message the bot once, then let OR3 discover recent chats from Telegram.',
        steps: [
            { title: 'Create bot', body: 'Open BotFather in Telegram and create a bot for OR3.' },
            { title: 'Paste token', body: 'Copy the token BotFather gives you into the token field.' },
            { title: 'Choose chat', body: 'Send the bot a message, then pick that conversation from OR3’s discovered chats.' },
        ],
    },
    slack: {
        label: 'Slack',
        icon: 'i-pixelarticons-message-text',
        intro: 'Connect Slack by saving your app credentials once, then OR3 can participate in the workspace you choose.',
        formDescription: 'Add the Slack app tokens and signing secret from your Slack app page.',
        reassurance: 'Keep this page open while copying values from Slack; secrets stay masked after save.',
        steps: [
            { title: 'Create app', body: 'Create a Slack app or open the app you already use for OR3.' },
            { title: 'Copy secrets', body: 'Paste bot token, app token, and signing secret.' },
            { title: 'Install app', body: 'Install it to your workspace and turn Slack on here.' },
        ],
    },
    discord: {
        label: 'Discord',
        icon: 'i-pixelarticons-message-text',
        intro: 'Connect Discord with one bot token, then invite the bot to a server or DM it directly. OR3 replies in the same Discord conversation automatically, so you should not need to hunt for raw IDs during normal setup.',
        formDescription: 'Paste the bot token, save, restart or3-intern, then DM the bot once or send one message in a server channel and choose that conversation here.',
        reassurance: 'Turn on Message Content Intent in the Discord Bot tab or OR3 may see the event but not your message text. DMs should reply directly. In server channels, OR3 may require an @mention if Require mention stays on. The default destination is only for outbound sends started outside Discord.',
        steps: [
            { title: 'Create bot', body: 'Open the Discord developer portal, create or open your application, go to Bot, turn on Message Content Intent, then reset and copy the bot token.' },
            { title: 'Invite bot', body: 'Open OAuth2 → URL Generator, select bot and applications.commands, then grant at least View Channels, Send Messages, and Read Message History before authorizing your server.' },
            { title: 'Save and test', body: 'Paste the token below, save it, restart or3-intern, then DM the bot once or send one server message. If server replies stay quiet, mention the bot like @YourBot hello.' },
        ],
        resources: [
            { label: 'Open Discord developer portal', href: 'https://discord.com/developers/applications' },
        ],
    },
    whatsapp: {
        label: 'WhatsApp',
        icon: 'i-pixelarticons-message-text',
        intro: 'Connect WhatsApp through a separate bridge service. OR3 does not talk to WhatsApp directly — the bridge stays signed into WhatsApp and forwards messages to OR3 over WebSocket.',
        formDescription: 'Add the bridge URL for your WhatsApp bridge, then save any optional bridge token and sender defaults this host uses.',
        reassurance: 'A bridge is a small companion service that stays logged into WhatsApp Web and exposes a WebSocket endpoint for OR3. The bridge URL is that endpoint, usually something like ws://host:3001/ws. This repo currently expects a compatible external bridge rather than shipping one built in.',
        steps: [
            { title: 'Run a bridge', body: 'Start or deploy a WhatsApp bridge service first. That bridge is the part that actually connects to WhatsApp and stays paired with your phone or WhatsApp account.' },
            { title: 'Copy bridge details', body: 'Paste the bridge URL here. If your bridge uses Bearer auth, also paste the bridge token. A plain base URL is often fine because OR3 normalizes it to the WebSocket /ws endpoint.' },
            { title: 'Save and test', body: 'Enable WhatsApp, save, then send a test message to the bridged WhatsApp account. Use Allowed senders or pairing if you want OR3 to answer only specific people.' },
        ],
        resources: [
            { label: 'Example bridge setup (whatsapp-web.js)', href: 'https://wwebjs.dev/guide/creating-your-bot/' },
            { label: 'Go WhatsApp library (whatsmeow)', href: 'https://github.com/tulir/whatsmeow' },
        ],
    },
    email: {
        label: 'Email',
        icon: 'i-pixelarticons-mail',
        intro: 'Connect an inbox so OR3 can send or receive replies without extra apps.',
        formDescription: 'Add the email sending and receiving details this host exposes.',
        reassurance: 'Use an app password when your email provider offers one.',
        steps: [
            { title: 'Choose inbox', body: 'Pick the email account OR3 should use.' },
            { title: 'Add mail details', body: 'Paste SMTP and receiving settings from your provider.' },
            { title: 'Test message', body: 'Save, turn it on, then send a simple test.' },
        ],
    },
}

const fallbackMeta = computed<ChannelSetupMeta>(() => ({
    label: channelKey.value,
    icon: 'i-pixelarticons-message-text',
    intro: `Connect ${channelKey.value} by saving the required details, then turning it on.`,
    formDescription: 'Add the setup details exposed by this host.',
    reassurance: 'You can pause the app later without deleting saved details.',
    steps: [
        { title: 'Open setup', body: 'Review the fields this app needs.' },
        { title: 'Save details', body: 'Paste the credentials or trusted identities.' },
        { title: 'Turn on', body: 'Enable the app once setup is complete.' },
    ],
}))

const channelMeta = computed(() => CHANNEL_META[channelKey.value] ?? fallbackMeta.value)
const channelLabel = computed(() => channelMeta.value.label)
const iconForChannel = computed(() => channelMeta.value.icon)

const { fields, configureSaving, configureError, loadFields, applyChanges } = useConfigure()
const saveStatus = ref('')
const saveStatusTone = ref<'success' | 'warning' | 'error' | 'neutral'>('neutral')

async function load() {
    if (!channelKey.value) return
    await loadFields('channels', channelKey.value).catch(() => null)
}

async function onSave(values: Record<string, unknown>) {
    saveStatus.value = ''
    saveStatusTone.value = 'neutral'
    const changes: ConfigureChange[] = fields.value.flatMap((field: ConfigureField): ConfigureChange[] => {
        const value = values[field.key]
        if (field.kind === 'toggle' || field.kind === 'boolean') {
            if (Boolean(value) === Boolean(field.value)) return []
            return [{ section: 'channels', channel: channelKey.value, field: field.key, op: 'toggle' }]
        }
        if (field.kind === 'choice') {
            if (String(value ?? '') === String(field.value ?? '')) return []
            return [{ section: 'channels', channel: channelKey.value, field: field.key, op: 'choose', value }]
        }
        const normalizedValue = field.kind === 'list' && typeof value === 'string'
            ? value.split(',').map((item) => item.trim()).filter(Boolean)
            : value
        const currentValue = Array.isArray(field.value) ? field.value.join(',') : field.value
        const nextValue = Array.isArray(normalizedValue) ? normalizedValue.join(',') : normalizedValue
        if (String(nextValue ?? '') === String(currentValue ?? '')) return []
        return [{ section: 'channels', channel: channelKey.value, field: field.key, op: 'set', value: normalizedValue }]
    })

    if (!changes.length) {
        saveStatus.value = 'No changes to save.'
        saveStatusTone.value = 'neutral'
        return
    }
    await applyChanges(changes).catch(() => null)
    if (configureError.value) {
        saveStatus.value = configureError.value
        saveStatusTone.value = 'error'
        return
    }
    saveStatus.value = channelKey.value === 'telegram'
        ? 'Saved. Restart or3-intern once so the Telegram listener starts with these settings.'
        : channelKey.value === 'discord'
            ? 'Saved. Restart or3-intern once so Discord reconnects and recent conversations can be discovered here.'
            : 'Saved.'
    saveStatusTone.value = channelKey.value === 'telegram' || channelKey.value === 'discord' ? 'warning' : 'success'
    await load()
}

watch(channelKey, () => {
    saveStatus.value = ''
    saveStatusTone.value = 'neutral'
    void load()
})

onMounted(() => {
    void load()
})
</script>
