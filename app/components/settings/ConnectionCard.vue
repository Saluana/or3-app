<template>
    <div class="rounded-xl border border-(--or3-border) bg-white/70 p-3">
        <div class="flex items-start justify-between gap-3">
            <div class="min-w-0 flex-1">
                <p class="font-mono text-sm font-semibold text-(--or3-text)">{{ control.label }}</p>
                <p class="mt-0.5 text-xs leading-5 text-(--or3-text-muted)">{{ control.description }}</p>
            </div>
            <StatusPill v-if="enabled" label="Connected" tone="green" />
            <StatusPill v-else label="Not connected" tone="neutral" />
        </div>

        <div class="mt-3 flex items-center justify-between gap-2">
            <USwitch :model-value="enabled" @update:model-value="onToggle" />
            <UButton
                size="xs"
                color="neutral"
                variant="outline"
                :label="enabled ? 'Manage' : 'Connect'"
                icon="i-pixelarticons-arrow-right"
                :to="manageHref"
            />
        </div>

        <p v-if="advancedSummary" class="mt-2 font-mono text-[11px] text-(--or3-text-muted)">
            {{ advancedSummary }}
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

const manageHref = computed(() => {
    const ch = props.control.connection?.channelKey
    return ch ? `/settings/channel/${encodeURIComponent(ch)}` : '/settings/section/connections'
})

const advancedSummary = computed(() => {
    const keys = props.control.advancedKeys ?? []
    if (!keys.length) return ''
    const present = keys.filter((k) => props.valueIndex[k] !== undefined && props.valueIndex[k] !== null && props.valueIndex[k] !== '')
    if (!present.length) return 'No connection details set yet.'
    return `${present.length} of ${keys.length} connection details set.`
})

function onToggle(value: boolean) {
    const ref = props.control.fieldRefs[0]
    if (!ref) return
    emit('change', { section: ref.section, field: ref.field, channel: ref.channel, value })
}
</script>
