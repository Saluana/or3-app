<template>
    <SurfaceCard class-name="space-y-3">
        <div class="flex items-start justify-between gap-3">
            <div class="min-w-0">
                <p class="font-mono text-base font-semibold text-(--or3-text)">Health check</p>
                <p class="mt-1 text-xs leading-5 text-(--or3-text-muted)">
                    What needs your attention right now.
                </p>
            </div>
            <UButton
                size="xs"
                color="neutral"
                variant="outline"
                label="Run again"
                icon="i-pixelarticons-reload"
                :loading="health.loading.value"
                @click="health.run"
            />
        </div>

        <StatusPill
            v-if="health.findings.value.length"
            :label="overallLabel"
            :tone="overallTone"
            class="self-start"
        />

        <ul class="space-y-2">
            <li
                v-for="finding in health.findings.value"
                :key="finding.id"
                class="rounded-xl border px-3 py-2 text-sm"
                :class="toneFor(finding.status)"
            >
                <div class="flex items-start gap-2">
                    <Icon :name="iconFor(finding.status)" class="mt-0.5 size-4 shrink-0" />
                    <div class="min-w-0 flex-1">
                        <p class="font-mono font-semibold">{{ finding.label }}</p>
                        <p class="mt-0.5 text-xs leading-5">{{ finding.detail }}</p>
                    </div>
                    <NuxtLink
                        v-if="finding.fixHref"
                        :to="finding.fixHref"
                        class="shrink-0 rounded-full border border-current px-2 py-0.5 font-mono text-[11px] uppercase tracking-wide hover:bg-white/40"
                    >{{ finding.fixLabel ?? 'Open' }}</NuxtLink>
                </div>
            </li>
        </ul>

        <p v-if="health.lastRun.value" class="font-mono text-[11px] text-(--or3-text-muted)">
            Last checked {{ formattedLastRun }}
        </p>
    </SurfaceCard>
</template>

<script setup lang="ts">
import { computed, onMounted } from 'vue'
import { useSettingsHealth, type HealthStatus } from '~/composables/settings/useSettingsHealth'

const health = useSettingsHealth()

const overallLabel = computed(() => {
    switch (health.overall.value) {
        case 'ok':
            return 'All checks pass'
        case 'warning':
            return 'Some warnings'
        case 'error':
            return 'Action needed'
        default:
            return 'Checking…'
    }
})

const overallTone = computed<'green' | 'amber' | 'danger' | 'neutral'>(() => {
    switch (health.overall.value) {
        case 'ok':
            return 'green'
        case 'warning':
            return 'amber'
        case 'error':
            return 'danger'
        default:
            return 'neutral'
    }
})

function toneFor(s: HealthStatus): string {
    switch (s) {
        case 'ok':
            return 'border-green-200 bg-green-50/70 text-green-800'
        case 'warning':
            return 'border-amber-200 bg-amber-50/70 text-amber-800'
        case 'error':
            return 'border-rose-200 bg-rose-50/70 text-rose-800'
        default:
            return 'border-(--or3-border) bg-white/70 text-(--or3-text-muted)'
    }
}

function iconFor(s: HealthStatus): string {
    switch (s) {
        case 'ok':
            return 'i-pixelarticons-check'
        case 'warning':
            return 'i-pixelarticons-alert'
        case 'error':
            return 'i-pixelarticons-warning-box'
        default:
            return 'i-pixelarticons-loader'
    }
}

const formattedLastRun = computed(() => {
    if (!health.lastRun.value) return ''
    try {
        return new Date(health.lastRun.value).toLocaleTimeString()
    } catch {
        return health.lastRun.value
    }
})

onMounted(() => {
    void health.run()
})
</script>
