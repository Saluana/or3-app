<template>
    <details class="group rounded-xl border border-(--or3-border) bg-white/50">
        <summary class="or3-focus-ring flex cursor-pointer list-none items-center justify-between gap-2 px-3 py-2 font-mono text-[11px] uppercase tracking-wide text-(--or3-text-muted)">
            <span class="inline-flex items-center gap-1">
                <Icon name="i-pixelarticons-chevron-right" class="size-3 transition group-open:rotate-90" />
                Advanced details
            </span>
            <NuxtLink
                v-if="resolvedAdvancedHref"
                :to="resolvedAdvancedHref"
                class="font-semibold text-(--or3-green-dark) hover:underline"
                @click.stop
            >Open in advanced</NuxtLink>
        </summary>

        <div class="border-t border-(--or3-border) p-3">
            <p v-if="!entries.length" class="text-xs text-(--or3-text-muted)">No advanced fields are exposed for this control.</p>
            <ul v-else class="space-y-1.5">
                <li
                    v-for="entry in entries"
                    :key="entry.key"
                    class="flex items-start justify-between gap-3 font-mono text-[11px]"
                >
                    <code class="min-w-0 break-all text-(--or3-text-muted)">{{ entry.key }}</code>
                    <code class="shrink-0 text-(--or3-text)">{{ format(entry.value) }}</code>
                </li>
            </ul>
        </div>
    </details>
</template>

<script setup lang="ts">
import { computed } from 'vue'

const props = defineProps<{
    advancedKeys?: string[]
    valueIndex: Record<string, unknown>
    /** Optional explicit deep link. When omitted, derived from advancedKeys[0]. */
    advancedHref?: string
}>()

const entries = computed(() => {
    return (props.advancedKeys ?? []).map((key) => ({
        key,
        value: props.valueIndex[key],
    }))
})

const resolvedAdvancedHref = computed(() => {
    if (props.advancedHref) return props.advancedHref
    const first = (props.advancedKeys ?? [])[0]
    if (!first) return '/settings/advanced'
    const sectionKey = first.split('.')[0]
    return sectionKey ? `/settings/${encodeURIComponent(sectionKey)}` : '/settings/advanced'
})

function format(value: unknown): string {
    if (value === undefined) return '—'
    if (value === null) return 'null'
    if (typeof value === 'boolean') return value ? 'on' : 'off'
    if (Array.isArray(value)) return value.length ? value.join(', ') : '[]'
    if (typeof value === 'string' && value.length > 64) return value.slice(0, 60) + '…'
    return String(value)
}
</script>
