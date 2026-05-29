<template>
    <div v-if="showReadinessCallout" class="or3-doctor-warning">
        <span class="or3-doctor-warning__icon">
            <Icon name="i-pixelarticons-warning-box" class="size-4" />
        </span>
        <div class="min-w-0 flex-1 space-y-1">
            <p class="or3-doctor-warning__title">
                Your computer needs attention
            </p>
            <p class="or3-doctor-warning__body">{{ readinessMessage }}</p>
            <p
                v-if="mergedConnectionWarningMessage"
                class="or3-doctor-warning__body"
            >
                {{ mergedConnectionWarningMessage }}
            </p>
            <NuxtLink to="/settings/health" class="or3-doctor-warning__link">
                See what's wrong
                <Icon name="i-pixelarticons-chevron-right" class="size-3.5" />
            </NuxtLink>
        </div>
    </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { useActiveHost } from '~/composables/useActiveHost';
import { useComputerStatus } from '~/composables/useComputerStatus';
import { useComputerCalloutDismiss } from '~/composables/useComputerCalloutDismiss';
import { isDuplicateReadinessWarning } from '~/utils/or3/computerAttention';
import { readinessCalloutFingerprint } from '~/utils/or3/computerCalloutDismiss';
import { formatReadinessDetail } from '~/utils/or3/readiness';

const { activeHost } = useActiveHost();
const hostId = computed(() => activeHost.value?.id ?? 'default');
const calloutDismiss = useComputerCalloutDismiss(hostId);
const { readiness, bootstrap } = useComputerStatus();

const readinessMessage = computed(() => formatReadinessDetail(readiness.value));
const bootstrapWarning = computed(
    () => bootstrap.value?.status?.warnings?.[0] ?? null,
);
const mergedConnectionWarningMessage = computed(() => {
    if (!isDuplicateReadinessWarning(bootstrapWarning.value, readiness.value)) {
        return '';
    }
    return 'Connection note: the computer is reachable, but it still has readiness issues to resolve before everything is fully available.';
});
const readinessCalloutFingerprintValue = computed(() =>
    readinessCalloutFingerprint(
        readiness.value,
        mergedConnectionWarningMessage.value,
    ),
);
const showReadinessCallout = computed(
    () =>
        Boolean(readiness.value && !readiness.value.ready) &&
        !calloutDismiss.isDismissed(
            'readiness',
            readinessCalloutFingerprintValue.value,
        ),
);
</script>

<style scoped>
.or3-doctor-warning {
    display: flex;
    align-items: flex-start;
    gap: 0.65rem;
    padding: 0.75rem 0.85rem;
    border-radius: 14px;
    background: color-mix(in srgb, var(--or3-amber) 14%, white 86%);
    border: 1px solid color-mix(in srgb, var(--or3-amber) 38%, white 62%);
}

.or3-doctor-warning__icon {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
    width: 1.75rem;
    height: 1.75rem;
    border-radius: 9px;
    background: color-mix(in srgb, var(--or3-amber) 28%, white 72%);
    color: color-mix(in srgb, var(--or3-amber) 65%, black 35%);
}

.or3-doctor-warning__title {
    font-weight: 600;
    font-size: 0.85rem;
    line-height: 1.3;
    color: color-mix(in srgb, var(--or3-amber) 60%, black 40%);
}

.or3-doctor-warning__body {
    font-size: 0.8rem;
    line-height: 1.4;
    color: color-mix(in srgb, var(--or3-amber) 45%, black 55%);
}

.or3-doctor-warning__link {
    display: inline-flex;
    align-items: center;
    gap: 0.15rem;
    margin-top: 0.15rem;
    font-size: 0.72rem;
    font-weight: 700;
    letter-spacing: 0.06em;
    text-transform: uppercase;
    text-decoration: none;
    color: color-mix(in srgb, var(--or3-amber) 60%, black 40%);
    transition: opacity 0.15s ease;
}

.or3-doctor-warning__link:hover {
    opacity: 0.75;
}
</style>
