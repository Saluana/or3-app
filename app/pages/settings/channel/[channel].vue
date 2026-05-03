<template>
    <AppShell>
        <AppHeader subtitle="SETTINGS · CHANNEL" />

        <div class="space-y-4">
            <SurfaceCard class-name="space-y-2">
                <button
                    type="button"
                    class="inline-flex items-center gap-1 rounded-full px-2 py-1 text-sm font-medium text-(--or3-green) transition hover:bg-(--or3-green-soft)"
                    @click="$router.push('/settings/section/connections')"
                >
                    <Icon name="i-pixelarticons-chevron-left" class="size-4" />
                    Devices &amp; Connections
                </button>

                <div class="flex items-start gap-3">
                    <RetroIcon :name="iconForChannel" size="sm" />
                    <div class="min-w-0 flex-1">
                        <p class="font-mono text-base font-semibold text-(--or3-text)">{{ channelLabel }}</p>
                        <p class="mt-1 text-sm leading-6 text-(--or3-text-muted)">
                            Manage how OR3 talks to {{ channelLabel }}. Fields below come straight from the host
                            configuration for the <code class="font-mono">channels</code> section.
                        </p>
                    </div>
                </div>

                <p v-if="configureError" class="text-sm text-rose-600">{{ configureError }}</p>
            </SurfaceCard>

            <SettingsSectionEditor
                :title="`${channelLabel} settings`"
                subtitle="Channel configuration"
                :description="`Wire up bot tokens, signing secrets, allowed identities, and inbound policy for ${channelLabel}.`"
                :fields="fields"
                :saving="configureSaving"
                empty-state-text="This host does not expose any fields for this channel yet."
                @save="onSave"
            />
        </div>
    </AppShell>
</template>

<script setup lang="ts">
import { computed, onMounted, watch } from 'vue'
import type { ConfigureChange, ConfigureField } from '~/types/or3-api'
import { useConfigure } from '~/composables/useConfigure'

const route = useRoute()

const channelKey = computed(() => String(route.params.channel ?? '').toLowerCase())

const CHANNEL_META: Record<string, { label: string; icon: string }> = {
    telegram: { label: 'Telegram', icon: 'i-pixelarticons-message-text' },
    slack: { label: 'Slack', icon: 'i-pixelarticons-message-text' },
    discord: { label: 'Discord', icon: 'i-pixelarticons-message-text' },
    whatsapp: { label: 'WhatsApp', icon: 'i-pixelarticons-message-text' },
    email: { label: 'Email', icon: 'i-pixelarticons-mail' },
}

const channelLabel = computed(() => CHANNEL_META[channelKey.value]?.label ?? channelKey.value)
const iconForChannel = computed(() => CHANNEL_META[channelKey.value]?.icon ?? 'i-pixelarticons-message-text')

const { fields, configureSaving, configureError, loadFields, applyChanges } = useConfigure()

async function load() {
    if (!channelKey.value) return
    await loadFields('channels', channelKey.value).catch(() => null)
}

async function onSave(values: Record<string, unknown>) {
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

    if (!changes.length) return
    await applyChanges(changes).catch(() => null)
    if (!configureError.value) await load()
}

watch(channelKey, () => {
    void load()
})

onMounted(() => {
    void load()
})
</script>
