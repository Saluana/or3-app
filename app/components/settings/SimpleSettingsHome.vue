<template>
    <div class="space-y-4">
        <SurfaceCard class-name="space-y-2">
            <div class="flex items-start gap-3">
                <RetroIcon name="i-pixelarticons-sliders" size="sm" />
                <div class="min-w-0 flex-1">
                    <p class="font-mono text-base font-semibold text-(--or3-text)">What OR3 can do</p>
                    <p class="mt-1 text-xs leading-5 text-(--or3-text-muted)">
                        Plain-language controls grouped by what they actually affect. Open “Advanced details” on
                        any control to see the raw config keys.
                    </p>
                </div>
            </div>
        </SurfaceCard>

        <p v-if="loading && !sections.length" class="text-center font-mono text-xs text-(--or3-text-muted)">Loading settings…</p>

        <NuxtLink
            v-for="section in sections"
            :key="section.key"
            :to="`/settings/section/${section.key}`"
            class="or3-focus-ring block"
        >
            <SurfaceCard class-name="space-y-3 transition hover:bg-(--or3-green-soft)">
                <div class="flex items-start gap-3">
                    <RetroIcon :name="section.icon" size="sm" />
                    <div class="min-w-0 flex-1">
                        <p class="font-mono text-sm font-semibold text-(--or3-text)">{{ section.label }}</p>
                        <p class="mt-0.5 text-xs leading-5 text-(--or3-text-muted)">{{ section.description }}</p>
                    </div>
                    <Icon name="i-pixelarticons-chevron-right" class="mt-1 size-5 shrink-0 text-(--or3-text-muted)" />
                </div>
                <p class="rounded-xl border border-(--or3-border) bg-white/70 px-3 py-2 font-mono text-xs leading-5 text-(--or3-text)">
                    {{ summaries[section.key] ?? section.description }}
                </p>
            </SurfaceCard>
        </NuxtLink>

        <SurfaceCard class-name="space-y-3">
            <p class="or3-command text-[11px] uppercase tracking-[0.2em] text-(--or3-green-dark)">Useful checks</p>
            <div class="grid gap-2 sm:grid-cols-2">
                <NuxtLink
                    to="/settings/health"
                    class="or3-focus-ring rounded-xl border border-(--or3-border) bg-white/70 p-3 text-sm hover:bg-(--or3-green-soft)"
                >
                    <p class="font-mono font-semibold text-(--or3-text)">Settings health check</p>
                    <p class="mt-0.5 text-xs text-(--or3-text-muted)">What needs attention.</p>
                </NuxtLink>
                <NuxtLink
                    to="/settings/permissions"
                    class="or3-focus-ring rounded-xl border border-(--or3-border) bg-white/70 p-3 text-sm hover:bg-(--or3-green-soft)"
                >
                    <p class="font-mono font-semibold text-(--or3-text)">What OR3 can access</p>
                    <p class="mt-0.5 text-xs text-(--or3-text-muted)">Permissions receipt in plain text.</p>
                </NuxtLink>
            </div>
        </SurfaceCard>

        <NuxtLink
            to="/settings/advanced"
            class="or3-focus-ring flex w-full items-start gap-3 rounded-2xl border border-amber-200 bg-amber-50/70 p-4 text-left transition hover:bg-amber-100/80"
        >
            <Icon name="i-pixelarticons-warning-box" class="mt-0.5 size-5 shrink-0 text-(--or3-amber)" />
            <div class="min-w-0 flex-1">
                <p class="font-mono text-sm font-semibold text-amber-900">Advanced Settings</p>
                <p class="mt-0.5 text-xs leading-5 text-amber-800/80">
                    Advanced Settings are for debugging, hosting, and custom setups. Most people should use
                    Simple Settings.
                </p>
            </div>
            <Icon name="i-pixelarticons-chevron-right" class="mt-1 size-5 shrink-0 text-amber-700/70" />
        </NuxtLink>
    </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useSimpleSettings } from '~/composables/settings/useSimpleSettings'

const simple = useSimpleSettings()
const loading = ref(false)

const sections = computed(() => simple.availableSections.value)
const summaries = computed(() => {
    const out: Record<string, string> = {}
    for (const s of sections.value) out[s.key] = simple.summaryFor(s)
    return out
})

onMounted(async () => {
    loading.value = true
    try {
        await simple.ensureLoaded()
    } finally {
        loading.value = false
    }
})
</script>
