<template>
    <AppShell>
        <AppHeader subtitle="COMPUTER · ATTENTION" />

        <div class="space-y-4">
            <button
                type="button"
                class="or3-attention-back"
                @click="$router.push('/computer')"
            >
                <Icon name="i-pixelarticons-chevron-left" class="size-4" />
                Back to computer
            </button>

            <SurfaceCard class-name="or3-attention-hero space-y-4">
                <div class="flex items-start gap-3">
                    <div class="or3-attention-hero__icon">
                        <Icon name="i-pixelarticons-warning-box" class="size-5" />
                    </div>
                    <div class="min-w-0 flex-1">
                        <p class="or3-section-label">WHAT'S GOING ON</p>
                        <h2 class="or3-attention-hero__title">{{ primaryGuidance.title }}</h2>
                        <p class="or3-attention-hero__body">{{ primaryGuidance.summary }}</p>
                        <p v-if="primaryGuidance.detail" class="or3-attention-hero__detail">
                            {{ primaryGuidance.detail }}
                        </p>
                    </div>
                </div>

                <div class="or3-attention-actions">
                    <NuxtLink :to="primaryGuidance.action.href" class="or3-attention-button">
                        {{ primaryGuidance.action.label }}
                    </NuxtLink>
                    <NuxtLink
                        v-if="primaryGuidance.secondaryAction"
                        :to="primaryGuidance.secondaryAction.href"
                        class="or3-attention-button or3-attention-button--secondary"
                    >
                        {{ primaryGuidance.secondaryAction.label }}
                    </NuxtLink>
                </div>
            </SurfaceCard>

            <SurfaceCard class-name="space-y-4">
                <div>
                    <p class="or3-section-label">CURRENT STATUS</p>
                    <p class="mt-2 text-sm leading-6 text-(--or3-text-muted)">
                        A plain-language summary of what the connected computer reported.
                    </p>
                </div>

                <div class="space-y-3">
                    <DangerCallout
                        v-if="readiness && !readiness.ready"
                        tone="caution"
                        title="Readiness checks are not passing yet"
                    >
                        {{ readinessMessage }}
                    </DangerCallout>

                    <DangerCallout
                        v-if="showBootstrapWarningCard"
                        :tone="bootstrapTone"
                        title="Connection warning"
                    >
                        {{ bootstrapWarning?.message }}
                    </DangerCallout>

                    <DangerCallout
                        v-if="!readiness && !bootstrapWarning"
                        tone="info"
                        title="No structured warning was returned"
                    >
                        The app does not have a detailed readiness payload yet, so start with pairing and connection checks.
                    </DangerCallout>
                </div>
            </SurfaceCard>

            <SurfaceCard class-name="space-y-4">
                <div>
                    <p class="or3-section-label">RECOMMENDED NEXT STEPS</p>
                    <p class="mt-2 text-sm leading-6 text-(--or3-text-muted)">
                        Start with the fix that best matches the host warning, then come back here if you want the raw report.
                    </p>
                </div>

                <div class="grid gap-3 sm:grid-cols-2">
                    <NuxtLink
                        v-for="step in nextSteps"
                        :key="`${step.href}:${step.label}`"
                        :to="step.href"
                        class="or3-attention-step"
                    >
                        <span class="or3-attention-step__title">{{ step.label }}</span>
                        <span class="or3-attention-step__href">{{ step.href }}</span>
                    </NuxtLink>
                </div>
            </SurfaceCard>
        </div>
    </AppShell>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import {
    getBootstrapWarningGuidance,
    getReadinessGuidance,
    isDuplicateReadinessWarning,
} from '~/utils/or3/computerAttention'
import { formatReadinessDetail } from '~/utils/or3/readiness'

const { bootstrap, readiness } = useComputerStatus()

const bootstrapWarning = computed(() => bootstrap.value?.status?.warnings?.[0] ?? null)
const readinessMessage = computed(() => formatReadinessDetail(readiness.value))
const readinessGuidance = computed(() => getReadinessGuidance(readiness.value))
const bootstrapGuidance = computed(() => getBootstrapWarningGuidance(bootstrapWarning.value, readiness.value))

const bootstrapTone = computed<'info' | 'tip' | 'caution' | 'danger'>(() => {
    const severity = bootstrapWarning.value?.severity
    if (severity === 'error') return 'danger'
    if (severity === 'info') return 'info'
    return 'caution'
})
const showBootstrapWarningCard = computed(
    () =>
        Boolean(bootstrapWarning.value) &&
        !isDuplicateReadinessWarning(bootstrapWarning.value, readiness.value),
)

const primaryGuidance = computed(() => {
    if (readiness.value && !readiness.value.ready) return readinessGuidance.value
    if (bootstrapWarning.value) return bootstrapGuidance.value
    return {
        title: 'Your computer looks mostly healthy',
        summary: 'This page is here whenever the app needs to explain a connection or readiness warning in plain language.',
        detail: 'If a warning appears again, come back here for quick actions and the raw report.',
        action: { href: '/computer', label: 'Back to computer' },
        secondaryAction: { href: '/settings/health', label: 'Open health report' },
    }
})

const nextSteps = computed(() => {
    const items = [primaryGuidance.value.action]
    if (primaryGuidance.value.secondaryAction) {
        items.push(primaryGuidance.value.secondaryAction)
    }
    items.push({ href: '/settings/health', label: 'View raw health checks' })
    items.push({ href: '/settings/pair', label: 'Review pairing details' })

    return items.filter(
        (item, index, array) =>
            array.findIndex((candidate) => candidate.href === item.href) === index,
    )
})
</script>

<style scoped>
.or3-attention-back {
    display: inline-flex;
    align-items: center;
    gap: 0.35rem;
    border-radius: 999px;
    padding: 0.4rem 0.75rem;
    font-size: 0.9rem;
    font-weight: 600;
    color: var(--or3-green-dark);
    transition: background 0.15s ease;
}

.or3-attention-back:hover {
    background: var(--or3-green-soft);
}

.or3-attention-hero {
    background:
        radial-gradient(circle at top right, color-mix(in srgb, var(--or3-green-soft) 55%, transparent) 0%, transparent 35%),
        linear-gradient(180deg, rgba(255, 255, 255, 0.65), rgba(255, 255, 255, 0.4));
}

.or3-attention-hero__icon {
    display: grid;
    place-items: center;
    width: 2.5rem;
    height: 2.5rem;
    flex-shrink: 0;
    border-radius: 0.9rem;
    background: color-mix(in srgb, var(--or3-green-soft) 40%, white 60%);
    color: var(--or3-green-dark);
}

.or3-attention-hero__title {
    margin-top: 0.45rem;
    font-family: var(--or3-font-display, Georgia, serif);
    font-size: clamp(1.5rem, 4vw, 2rem);
    line-height: 1.05;
    color: var(--or3-text);
}

.or3-attention-hero__body,
.or3-attention-hero__detail {
    margin-top: 0.65rem;
    font-size: 0.98rem;
    line-height: 1.7;
    color: var(--or3-text-muted);
}

.or3-attention-actions {
    display: flex;
    flex-wrap: wrap;
    gap: 0.75rem;
}

.or3-attention-button {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    min-height: 2.5rem;
    padding: 0.55rem 0.95rem;
    border-radius: 999px;
    background: var(--or3-green-soft);
    color: var(--or3-green-dark);
    font-size: 0.8rem;
    font-weight: 700;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    text-decoration: none;
    border: 1px solid color-mix(in srgb, var(--or3-green) 18%, transparent);
}

.or3-attention-button--secondary {
    background: transparent;
    color: var(--or3-text);
    border-color: var(--or3-border);
}

.or3-attention-step {
    display: flex;
    flex-direction: column;
    gap: 0.35rem;
    border-radius: 1rem;
    border: 1px solid var(--or3-border);
    background: rgba(255, 255, 255, 0.72);
    padding: 0.95rem 1rem;
    text-decoration: none;
    transition:
        transform 0.12s ease,
        border-color 0.15s ease,
        background 0.15s ease;
}

.or3-attention-step:hover {
    transform: translateY(-1px);
    border-color: color-mix(in srgb, var(--or3-green) 26%, var(--or3-border));
    background: rgba(255, 255, 255, 0.92);
}

.or3-attention-step__title {
    font-weight: 700;
    color: var(--or3-text);
}

.or3-attention-step__href {
    font-family: 'JetBrains Mono', ui-monospace, SFMono-Regular, Menlo, monospace;
    font-size: 0.72rem;
    color: var(--or3-text-muted);
}
</style>