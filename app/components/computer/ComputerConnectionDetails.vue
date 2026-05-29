<template>
    <div class="space-y-4">
        <DangerCallout
            v-if="showConnectingHelpCallout"
            tone="caution"
            title="Still checking the connection"
            dismissible
            @dismiss="dismissConnectingCallout"
        >
            The app has a saved pairing token, but it has not confirmed the
            computer health yet. Check that the address below is the computer's
            Tailscale address, not 127.0.0.1.
            <template #actions>
                <NuxtLink to="/settings/pair" class="or3-callout-link">
                    Review pairing
                </NuxtLink>
            </template>
        </DangerCallout>

        <DangerCallout
            v-if="showBootstrapWarningCallout"
            :tone="bootstrapWarningTone"
            title="Connection warning"
            dismissible
            @dismiss="dismissBootstrapCallout"
        >
            {{ bootstrapWarningMessage }}
            <template #actions>
                <NuxtLink
                    :to="bootstrapGuidance.action.href"
                    class="or3-callout-link"
                >
                    {{ bootstrapGuidance.action.label }}
                </NuxtLink>
                <NuxtLink
                    v-if="bootstrapGuidance.secondaryAction"
                    :to="bootstrapGuidance.secondaryAction.href"
                    class="or3-callout-link or3-callout-link--secondary"
                >
                    {{ bootstrapGuidance.secondaryAction.label }}
                </NuxtLink>
            </template>
        </DangerCallout>

        <section>
            <p class="or3-section-label">CONNECTION DETAILS</p>
            <div class="mt-3 or3-detail-card">
                <div class="grid grid-cols-2 gap-3">
                    <div class="or3-detail-row">
                        <span class="or3-detail-row__icon">
                            <Icon name="i-pixelarticons-monitor" class="size-4" />
                        </span>
                        <div class="min-w-0">
                            <p class="or3-detail-row__label">Mode</p>
                            <p class="or3-detail-row__value">
                                {{ runtimeProfile }}
                            </p>
                        </div>
                    </div>
                    <div class="or3-detail-row">
                        <span class="or3-detail-row__icon">
                            <Icon name="i-pixelarticons-shield" class="size-4" />
                        </span>
                        <div class="min-w-0">
                            <p class="or3-detail-row__label">Approvals</p>
                            <p class="or3-detail-row__value">
                                {{ approvalsLabel }}
                            </p>
                        </div>
                    </div>
                </div>

                <div class="mt-3 or3-detail-row or3-detail-row--full">
                    <span class="or3-detail-row__icon">
                        <Icon name="i-pixelarticons-globe" class="size-4" />
                    </span>
                    <div class="min-w-0 flex-1">
                        <p class="or3-detail-row__label">Address</p>
                        <p
                            class="or3-detail-row__value or3-detail-row__value--mono truncate"
                        >
                            {{ baseUrl || 'Not paired yet' }}
                        </p>
                    </div>
                    <button
                        v-if="baseUrl"
                        type="button"
                        class="or3-icon-button"
                        :aria-label="copied ? 'Address copied' : 'Copy address'"
                        @click="copyAddress"
                    >
                        <Icon
                            :name="
                                copied
                                    ? 'i-pixelarticons-check'
                                    : 'i-pixelarticons-copy'
                            "
                            class="size-4"
                        />
                    </button>
                </div>

                <NuxtLink to="/settings/pair" class="or3-pair-button">
                    <Icon name="i-pixelarticons-link" class="size-4" />
                    <span>{{
                        connected ? 'Manage or Pair Computer' : 'Pair Computer'
                    }}</span>
                </NuxtLink>

                <button
                    type="button"
                    class="or3-pair-button or3-pair-button--secondary"
                    :disabled="!restartButtonEnabled"
                    @click="handleRestartService"
                >
                    <Icon
                        :name="
                            restartingService
                                ? 'i-pixelarticons-loader'
                                : 'i-pixelarticons-reload'
                        "
                        :class="[
                            'size-4',
                            restartingService ? 'animate-spin' : '',
                        ]"
                    />
                    <span>{{
                        restartingService ? 'Restarting…' : 'Restart or3-intern'
                    }}</span>
                </button>

                <p class="mt-2 text-xs leading-5 text-(--or3-text-muted)">
                    {{ restartHelperText }}
                </p>
                <p
                    v-if="restartPendingApprovalId"
                    class="mt-1 text-xs leading-5 text-(--or3-green-dark)"
                >
                    Approve request #{{ restartPendingApprovalId }} on the
                    Approvals screen, then try again.
                </p>
                <p
                    v-if="restartError"
                    class="mt-1 text-xs leading-5 text-(--or3-danger)"
                >
                    {{ restartError }}
                </p>
            </div>
        </section>
    </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue';
import { useToast } from '@nuxt/ui/composables';
import type { HealthResponse } from '~/types/or3-api';
import { useActiveHost } from '~/composables/useActiveHost';
import { useComputerStatus } from '~/composables/useComputerStatus';
import { useComputerCalloutDismiss } from '~/composables/useComputerCalloutDismiss';
import { useServiceRestart } from '~/composables/useServiceRestart';
import { getBootstrapWarningGuidance, isDuplicateReadinessWarning } from '~/utils/or3/computerAttention';
import {
    bootstrapCalloutFingerprint,
    connectingCalloutFingerprint,
} from '~/utils/or3/computerCalloutDismiss';

const { activeHost, isConnected } = useActiveHost();
const hostId = computed(() => activeHost.value?.id ?? 'default');
const calloutDismiss = useComputerCalloutDismiss(hostId);
const {
    health,
    readiness,
    capabilities,
    bootstrap,
    restartAction,
    loadingStatus,
    refreshStatus,
} = useComputerStatus();
const {
    restartService,
    restartingService,
    restartError,
    restartPendingApprovalId,
} = useServiceRestart();
const toast = useToast();

const copied = ref(false);
const connected = computed(() => Boolean(isConnected.value));
const baseUrl = computed(() => activeHost.value?.baseUrl || '');

const showConnectingHelp = computed(
    () => connected.value && loadingStatus.value && !health.value,
);
const bootstrapWarning = computed(
    () => bootstrap.value?.status?.warnings?.[0] ?? null,
);
const bootstrapWarningTone = computed(() => {
    const severity = bootstrapWarning.value?.severity;
    if (severity === 'error') return 'danger';
    if (severity === 'info') return 'info';
    return 'caution';
});
const bootstrapWarningMessage = computed(
    () =>
        bootstrapWarning.value?.message ??
        'The computer reported a connection-related warning.',
);
const showBootstrapWarningCard = computed(
    () =>
        Boolean(bootstrapWarning.value) &&
        !isDuplicateReadinessWarning(bootstrapWarning.value, readiness.value),
);
const bootstrapCalloutFingerprintValue = computed(() =>
    bootstrapCalloutFingerprint(bootstrapWarning.value),
);
const connectingCalloutFingerprintValue = computed(() =>
    connectingCalloutFingerprint(),
);
const showBootstrapWarningCallout = computed(
    () =>
        showBootstrapWarningCard.value &&
        !calloutDismiss.isDismissed(
            'bootstrap',
            bootstrapCalloutFingerprintValue.value,
        ),
);
const showConnectingHelpCallout = computed(
    () =>
        showConnectingHelp.value &&
        !calloutDismiss.isDismissed(
            'connecting',
            connectingCalloutFingerprintValue.value,
        ),
);
const bootstrapGuidance = computed(() =>
    getBootstrapWarningGuidance(bootstrapWarning.value, readiness.value),
);

const runtimeProfile = computed(
    () =>
        capabilities.value?.runtimeProfile ||
        (connected.value ? 'local-dev' : 'unknown'),
);
const approvalsLabel = computed(() => {
    if (!connected.value) return 'off';
    if (health.value?.approvalBrokerAvailable === false) return 'off';
    return 'on';
});

const restartButtonEnabled = computed(() => {
    if (!connected.value || restartingService.value) return false;
    if (restartAction.value) return restartAction.value.available;
    return capabilities.value?.shellModeAvailable !== false;
});
const restartHelperText = computed(() => {
    if (!connected.value) {
        return 'Pair a computer first, then you can bounce the local or3-intern service from here.';
    }
    if (restartAction.value && !restartAction.value.available) {
        return (
            restartAction.value.disabled_reason ||
            'Restart is not available on this computer right now.'
        );
    }
    if (capabilities.value?.shellModeAvailable === false) {
        return 'Shell mode is turned off on this computer, so restart has to happen locally for now.';
    }
    return 'Request a restart from the host and wait for the computer to reconnect.';
});

function dismissBootstrapCallout() {
    calloutDismiss.dismiss('bootstrap', bootstrapCalloutFingerprintValue.value);
}
function dismissConnectingCallout() {
    calloutDismiss.dismiss('connecting', connectingCalloutFingerprintValue.value);
}

async function copyAddress() {
    if (!baseUrl.value) return;
    try {
        if (navigator?.clipboard?.writeText) {
            await navigator.clipboard.writeText(baseUrl.value);
        } else {
            const ta = document.createElement('textarea');
            ta.value = baseUrl.value;
            ta.style.position = 'fixed';
            ta.style.opacity = '0';
            document.body.appendChild(ta);
            ta.select();
            document.execCommand('copy');
            document.body.removeChild(ta);
        }
        copied.value = true;
        setTimeout(() => (copied.value = false), 1500);
    } catch {
        /* noop */
    }
}

function delay(ms: number) {
    return new Promise((resolve) => window.setTimeout(resolve, ms));
}
function isHealthyResponse(value: HealthResponse | null | undefined) {
    return value?.status === 'ok' || value?.status === 'healthy';
}
function serviceHealthGeneration(value: HealthResponse | null | undefined) {
    const processId = value?.processId;
    const startedAt = value?.startedAt?.trim();
    if (typeof processId === 'number' && Number.isFinite(processId)) {
        return `${processId}:${startedAt || ''}`;
    }
    return startedAt || null;
}
async function waitForServiceRecovery(previousGeneration: string | null) {
    const deadline = Date.now() + 60000;
    const earliestLegacySuccess = Date.now() + 3000;
    let sawDisconnect = false;
    while (Date.now() < deadline) {
        try {
            await refreshStatus();
            if (!isHealthyResponse(health.value)) {
                sawDisconnect = true;
            } else {
                const nextGeneration = serviceHealthGeneration(health.value);
                if (
                    previousGeneration &&
                    nextGeneration &&
                    nextGeneration !== previousGeneration
                ) {
                    return true;
                }
                if (previousGeneration && !nextGeneration && sawDisconnect) {
                    return true;
                }
                if (
                    !previousGeneration &&
                    (sawDisconnect || Date.now() >= earliestLegacySuccess)
                ) {
                    return true;
                }
            }
        } catch {
            sawDisconnect = true;
        }
        await delay(1500);
    }
    return false;
}
function restartWarningDescription(
    result: Awaited<ReturnType<typeof restartService>>,
) {
    if (result.mode === 'action' && result.logPath) {
        return `The service may still be coming back. Restart log: ${result.logPath}`;
    }
    return 'The service may still be coming back. Refresh if it stays offline.';
}

async function handleRestartService() {
    if (!restartButtonEnabled.value) return;
    const previousGeneration = serviceHealthGeneration(health.value);
    try {
        const result = await restartService();
        toast.add({
            title: 'Restart started',
            description:
                result.mode === 'terminal'
                    ? `Using ${result.root.label}. Waiting for your computer to come back online…`
                    : 'Waiting for your computer to come back online…',
            color: 'neutral',
        });
        const recovered = await waitForServiceRecovery(previousGeneration);
        if (recovered) {
            toast.add({
                title: 'or3-intern restarted',
                description: 'The computer is responding again.',
                color: 'success',
            });
            return;
        }
        toast.add({
            title: 'Restart sent',
            description: restartWarningDescription(result),
            color: 'warning',
        });
    } catch (error: any) {
        await refreshStatus().catch(() => {});
        toast.add({
            title: 'Could not restart or3-intern',
            description:
                restartError.value ||
                error?.message ||
                'The restart command could not be sent.',
            color: 'error',
        });
    }
}
</script>

<style scoped>
.or3-detail-card {
    background: var(--or3-surface);
    border: 1px solid var(--or3-border);
    border-radius: var(--or3-radius-card);
    box-shadow: var(--or3-shadow-soft);
    padding: 1rem;
}

.or3-detail-row {
    display: flex;
    align-items: center;
    gap: 0.6rem;
    padding: 0.6rem 0.75rem;
    border-radius: 14px;
    background: color-mix(in srgb, var(--or3-surface) 88%, white 12%);
    border: 1px solid color-mix(in srgb, var(--or3-border) 80%, white 20%);
}
.or3-detail-row--full {
    width: 100%;
}

.or3-detail-row__icon {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 32px;
    height: 32px;
    border-radius: 10px;
    background: color-mix(in srgb, var(--or3-green-soft) 60%, white 40%);
    color: var(--or3-green-dark);
    flex-shrink: 0;
}

.or3-detail-row__label {
    font-family:
        ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
    font-size: 0.72rem;
    text-transform: uppercase;
    letter-spacing: 0.12em;
    color: var(--or3-text-muted);
}
.or3-detail-row__value {
    font-family:
        ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
    font-size: 0.9rem;
    color: var(--or3-text);
    font-weight: 500;
}
.or3-detail-row__value--mono {
    font-size: 0.82rem;
}

.or3-icon-button {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 36px;
    height: 36px;
    border-radius: 12px;
    background: white;
    border: 1px solid var(--or3-border);
    color: var(--or3-text);
    cursor: pointer;
    transition:
        background 0.15s ease,
        border-color 0.15s ease;
    flex-shrink: 0;
}
.or3-icon-button:hover {
    background: color-mix(in srgb, var(--or3-surface-soft) 70%, white 30%);
    border-color: color-mix(
        in srgb,
        var(--or3-green) 30%,
        var(--or3-border) 70%
    );
}

.or3-pair-button {
    margin-top: 0.85rem;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 0.5rem;
    padding: 0.7rem 1rem;
    border-radius: 14px;
    background: color-mix(in srgb, var(--or3-green-soft) 70%, white 30%);
    border: 1px solid color-mix(in srgb, var(--or3-green) 28%, white 72%);
    color: var(--or3-green-dark);
    font-weight: 600;
    text-decoration: none;
    transition:
        background 0.15s ease,
        transform 0.15s ease;
}
.or3-pair-button--secondary {
    width: 100%;
    background: color-mix(in srgb, var(--or3-surface-soft) 70%, white 30%);
    border: 1px solid var(--or3-border);
    color: var(--or3-text);
}
.or3-pair-button--secondary:disabled {
    opacity: 0.6;
    cursor: not-allowed;
    transform: none;
}
.or3-pair-button:hover {
    background: color-mix(in srgb, var(--or3-green-soft) 50%, white 50%);
}
.or3-pair-button:active {
    transform: scale(0.99);
}

.or3-callout-link {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    min-height: 2rem;
    padding: 0.35rem 0.75rem;
    border-radius: 999px;
    border: 1px solid color-mix(in srgb, currentColor 16%, transparent);
    background: rgba(255, 255, 255, 0.6);
    font-size: 0.72rem;
    font-weight: 700;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    text-decoration: none;
    transition:
        transform 0.12s ease,
        background 0.15s ease,
        border-color 0.15s ease;
}
.or3-callout-link:hover {
    background: rgba(255, 255, 255, 0.86);
}
</style>
