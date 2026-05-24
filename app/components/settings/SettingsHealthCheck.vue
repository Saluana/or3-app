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

        <div
            v-if="health.doctorStatus.value"
            class="rounded-xl border border-(--or3-border) bg-white/70 px-3 py-2 text-xs leading-5 text-(--or3-text-muted)"
        >
            <span class="font-mono font-semibold text-(--or3-text)">Basic Doctor</span>
            is running.
            <span v-if="adminBrainLabel">Admin Brain: {{ adminBrainLabel }}.</span>
        </div>
        <ManualFallbackCard
            v-else-if="health.doctorUnavailable.value"
            message="Basic Doctor is not reachable, so the app is showing local health checks and connection recovery actions."
        />

        <ul class="space-y-3">
            <li
                v-for="finding in health.findings.value"
                :key="finding.id"
            >
                <template v-if="finding.doctorCard">
                    <DoctorDiagnosticResultCard :card="finding.doctorCard" />
                    <RecommendedFixCard class="mt-2" :card="finding.doctorCard" />
                </template>
                <div
                    v-else
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
                </div>
            </li>
        </ul>

        <div class="space-y-3 rounded-xl border border-(--or3-border) bg-white/70 p-3">
            <div class="flex items-start justify-between gap-3">
                <div class="min-w-0">
                    <p class="font-mono text-sm font-semibold text-(--or3-text)">Ask Admin Assistant</p>
                    <p class="mt-1 text-xs leading-5 text-(--or3-text-muted)">
                        Describe what is broken. Basic Doctor will answer even when Admin Brain is unavailable.
                    </p>
                </div>
                <StatusPill :label="adminBrainStatus" :tone="adminBrainTone" />
            </div>

            <div v-if="chat.messages.value.length" class="max-h-64 space-y-2 overflow-auto">
                <div
                    v-for="message in chat.messages.value"
                    :key="message.id ?? `${message.role}:${message.content}`"
                    class="rounded-lg px-3 py-2 text-xs leading-5"
                    :class="message.role === 'user' ? 'bg-(--or3-green-soft) text-(--or3-green-dark)' : 'bg-(--or3-surface) text-(--or3-text-muted)'"
                >
                    <p class="font-mono text-[11px] uppercase tracking-wide">{{ message.role || 'assistant' }}</p>
                    <p>{{ message.content }}</p>
                </div>
            </div>

            <form class="flex gap-2" @submit.prevent="sendDoctorMessage">
                <input
                    v-model="problemText"
                    class="or3-focus-ring min-w-0 flex-1 rounded-xl border border-(--or3-border) bg-white px-3 py-2 text-sm"
                    placeholder="Tell Doctor what is going wrong…"
                    aria-label="Doctor problem statement"
                />
                <UButton
                    type="submit"
                    size="sm"
                    color="primary"
                    icon="i-pixelarticons-message-text"
                    label="Ask"
                    :loading="chat.loading.value"
                />
            </form>
            <p v-if="chat.error.value" class="text-xs leading-5 text-rose-700">{{ chat.error.value }}</p>
        </div>

        <p v-if="health.lastRun.value" class="font-mono text-[11px] text-(--or3-text-muted)">
            Last checked {{ formattedLastRun }}
        </p>
    </SurfaceCard>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useSettingsHealth, type HealthStatus } from '~/composables/settings/useSettingsHealth'
import { useDoctorAdminChat } from '~/composables/useDoctorAdminChat'

const health = useSettingsHealth()
const chat = useDoctorAdminChat()
const problemText = ref('')

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

const adminBrainLabel = computed(() => {
    const brain = health.doctorStatus.value?.admin_brain
    if (!brain) return ''
    return brain.available
        ? brain.display_name || brain.kind || 'available'
        : brain.reason || 'Basic Doctor only'
})
const adminBrainStatus = computed(() =>
    chat.adminBrain.value?.available ? 'Admin Brain available' : 'Basic Doctor',
)
const adminBrainTone = computed<'green' | 'amber'>(() =>
    chat.adminBrain.value?.available ? 'green' : 'amber',
)

async function sendDoctorMessage() {
    const content = problemText.value.trim()
    if (!content) return
    problemText.value = ''
    await chat.sendMessage(content).catch(() => undefined)
}

onMounted(() => {
    void health.run()
    void chat.loadAdminBrain().catch(() => undefined)
})
</script>
