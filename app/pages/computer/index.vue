<template>
    <AppShell>
        <AppHeader subtitle="COMPUTER" />

        <div class="space-y-5">
            <ComputerOverviewCard
                :host-name="hostName"
                :base-url="baseUrl"
                :health="health"
                :readiness="readiness"
                :capabilities="capabilities"
                :connected="connected"
                active-tab="/computer"
            />

            <!-- What you can do -->
            <section>
                <p class="or3-section-label">WHAT YOU CAN DO</p>
                <div class="mt-3 grid grid-cols-2 gap-3">
                    <NuxtLink
                        v-for="item in actions"
                        :key="item.to"
                        :to="item.to"
                        class="or3-action-card"
                    >
                        <span class="or3-action-card__icon">
                            <Icon :name="item.icon" class="size-5" />
                        </span>
                        <span class="or3-action-card__title">
                            {{ item.label }}
                        </span>
                        <span class="or3-action-card__desc">
                            {{ item.description }}
                        </span>
                    </NuxtLink>
                </div>
            </section>

            <DangerCallout
                v-if="showConnectingHelp"
                tone="caution"
                title="Still checking the connection"
            >
                The app has a saved pairing token, but it has not confirmed the
                computer health yet. Check that the address below is the
                computer's Tailscale address, not 127.0.0.1.
                <template #actions>
                    <NuxtLink to="/settings/pair" class="or3-callout-link">
                        Review pairing
                    </NuxtLink>
                </template>
            </DangerCallout>

            <DangerCallout
                v-if="readiness && !readiness.ready"
                tone="caution"
                title="Your computer needs attention"
            >
                <p>{{ readinessMessage }}</p>
                <p
                    v-if="mergedConnectionWarningMessage"
                    class="mt-2 text-sm leading-6 text-current/80"
                >
                    {{ mergedConnectionWarningMessage }}
                </p>
                <template #actions>
                    <NuxtLink to="/computer/attention" class="or3-callout-link">
                        Learn more
                    </NuxtLink>
                    <NuxtLink
                        :to="readinessGuidance.action.href"
                        class="or3-callout-link or3-callout-link--secondary"
                    >
                        {{ readinessGuidance.action.label }}
                    </NuxtLink>
                </template>
            </DangerCallout>

            <DangerCallout
                v-if="showBootstrapWarningCard"
                :tone="bootstrapWarningTone"
                title="Connection warning"
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

            <!-- Connection details -->
            <section>
                <p class="or3-section-label">CONNECTION DETAILS</p>
                <div class="mt-3 or3-detail-card">
                    <div class="grid grid-cols-2 gap-3">
                        <div class="or3-detail-row">
                            <span class="or3-detail-row__icon">
                                <Icon
                                    name="i-pixelarticons-monitor"
                                    class="size-4"
                                />
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
                                <Icon
                                    name="i-pixelarticons-shield"
                                    class="size-4"
                                />
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
                            :aria-label="
                                copied ? 'Address copied' : 'Copy address'
                            "
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

                    <NuxtLink to="/settings" class="or3-pair-button">
                        <Icon name="i-pixelarticons-link" class="size-4" />
                        <span>{{
                            connected
                                ? 'Manage or Pair Computer'
                                : 'Pair Computer'
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
                            restartingService
                                ? 'Restarting…'
                                : 'Restart or3-intern'
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

            <!-- Recent activity -->
            <section>
                <div class="flex items-center justify-between">
                    <p class="or3-section-label">RECENT ACTIVITY</p>
                    <NuxtLink
                        to="/activity"
                        class="inline-flex items-center gap-1 text-sm font-medium text-(--or3-green-dark)"
                    >
                        <span>View all</span>
                        <Icon
                            name="i-pixelarticons-chevron-right"
                            class="size-4"
                        />
                    </NuxtLink>
                </div>

                <div class="mt-3 space-y-2">
                    <div v-if="!activity.length" class="or3-activity-empty">
                        <Icon
                            name="i-pixelarticons-timeline"
                            class="size-4 text-(--or3-text-muted)"
                        />
                        <span
                            >No activity yet. Try a command or browse
                            files.</span
                        >
                    </div>

                    <div
                        v-for="entry in activity"
                        :key="entry.id"
                        class="or3-activity-row"
                    >
                        <span class="or3-activity-row__icon">
                            <Icon :name="entry.icon" class="size-4" />
                        </span>
                        <p class="or3-activity-row__text">
                            <span class="or3-activity-row__label">{{
                                entry.label
                            }}</span>
                            <span class="or3-activity-row__detail">{{
                                entry.detail
                            }}</span>
                        </p>
                        <span class="or3-activity-row__time">
                            {{ entry.time }}
                        </span>
                        <span
                            class="or3-activity-row__dot"
                            :data-tone="entry.tone"
                        />
                    </div>
                </div>
            </section>
        </div>
    </AppShell>
</template>

<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue';
import type { HealthResponse } from '~/types/or3-api';
import {
    getBootstrapWarningGuidance,
    getReadinessGuidance,
    isDuplicateReadinessWarning,
} from '~/utils/or3/computerAttention';
import { formatReadinessDetail } from '~/utils/or3/readiness';

const { activeHost, isConnected } = useActiveHost();
const {
    health,
    readiness,
    capabilities,
    bootstrap,
    restartAction,
    loadingStatus,
    refreshStatus,
} = useComputerStatus();
const { jobs } = useJobs();
const { approvals: approvalItems, loadApprovals } = useApprovals();
const {
    restartService,
    restartingService,
    restartError,
    restartPendingApprovalId,
} = useServiceRestart();
const toast = useToast();

const copied = ref(false);

const connected = computed(() => Boolean(isConnected.value));
const showConnectingHelp = computed(
    () => connected.value && loadingStatus.value && !health.value,
);
const hostName = computed(() => activeHost.value?.name || 'My Computer');
const baseUrl = computed(() => activeHost.value?.baseUrl || '');
const readinessMessage = computed(() => formatReadinessDetail(readiness.value));
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
const mergedConnectionWarningMessage = computed(() => {
    if (!isDuplicateReadinessWarning(bootstrapWarning.value, readiness.value)) {
        return '';
    }

    return 'Connection note: the computer is reachable, but it still has readiness issues to resolve before everything is fully available.';
});
const showBootstrapWarningCard = computed(
    () =>
        Boolean(bootstrapWarning.value) &&
        !isDuplicateReadinessWarning(bootstrapWarning.value, readiness.value),
);
const readinessGuidance = computed(() => getReadinessGuidance(readiness.value));
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

const actions = [
    {
        label: 'Browse Files',
        description: 'Explore and manage files on your computer.',
        icon: 'i-pixelarticons-folder',
        to: '/computer/files',
    },
    {
        label: 'Run Terminal',
        description: 'Open a terminal and run commands securely.',
        icon: 'i-pixelarticons-terminal',
        to: '/computer/terminal',
    },
    {
        label: 'Review Approvals',
        description: 'See what or3-intern wants to do.',
        icon: 'i-pixelarticons-shield',
        to: '/approvals',
    },
    {
        label: 'Scheduled Tasks',
        description: 'Manage recurring or future work.',
        icon: 'i-pixelarticons-clock',
        to: '/scheduled',
    },
    {
        label: 'Adjust Preferences',
        description: 'Tune how or3-intern behaves.',
        icon: 'i-pixelarticons-settings-cog',
        to: '/settings',
    },
];

interface ActivityEntry {
    id: string;
    label: string;
    detail: string;
    icon: string;
    time: string;
    tone: 'green' | 'amber' | 'danger' | 'neutral';
}

const activity = computed<ActivityEntry[]>(() => {
    const entries: ActivityEntry[] = [];

    for (const job of jobs.value.slice(0, 5)) {
        entries.push({
            id: `job:${job.job_id}`,
            label: jobLabel(job.kind),
            detail: trimSnippet(job.final_text || job.kind || ''),
            icon: jobIcon(job.kind),
            time: formatTime(job.updated_at || job.created_at),
            tone:
                job.status === 'failed' || job.status === 'aborted'
                    ? 'danger'
                    : job.status === 'completed'
                      ? 'green'
                      : 'amber',
        });
    }

    for (const approval of approvalItems.value.slice(0, 5)) {
        entries.push({
            id: `appr:${approval.id}`,
            label: 'Approval requested:',
            detail: approvalDetail(approval),
            icon: 'i-pixelarticons-shield',
            time: formatTime(approval.created_at),
            tone:
                approval.status === 'pending'
                    ? 'amber'
                    : approval.status === 'approved'
                      ? 'green'
                      : approval.status === 'denied'
                        ? 'danger'
                        : 'neutral',
        });
    }

    entries.sort((a, b) => (a.time < b.time ? 1 : -1));
    return entries.slice(0, 8);
});

function jobLabel(kind?: string): string {
    if (!kind) return 'Activity:';
    if (kind === 'turn') return 'Assistant reply:';
    if (kind === 'subagent') return 'Subagent run:';
    if (kind === 'exec' || kind === 'terminal') return 'Executed:';
    if (kind === 'file_list') return 'Listed files in';
    return `${kind.replace(/_/g, ' ')}:`;
}

function jobIcon(kind?: string): string {
    if (kind === 'exec' || kind === 'terminal')
        return 'i-pixelarticons-terminal';
    if (kind === 'file_list' || kind === 'file_write')
        return 'i-pixelarticons-folder';
    if (kind === 'turn' || kind === 'subagent') return 'i-pixelarticons-robot';
    return 'i-pixelarticons-analytics';
}

function approvalDetail(a: { type?: string; subject?: unknown }): string {
    const subj = (a.subject ?? {}) as Record<string, unknown>;
    const candidate =
        (subj.command as string) ||
        (subj.path as string) ||
        (subj.file as string) ||
        (subj.url as string) ||
        '';
    if (candidate) return trimSnippet(candidate);
    if (a.type === 'exec') return 'shell command';
    if (a.type === 'file_write') return 'file change';
    return a.type || 'action';
}

function trimSnippet(input: string): string {
    const flat = input.replace(/\s+/g, ' ').trim();
    return flat.length > 48 ? flat.slice(0, 45) + '…' : flat;
}

function formatTime(input?: string): string {
    if (!input) return '';
    const ts = Date.parse(input);
    if (!Number.isFinite(ts)) return '';
    const d = new Date(ts);
    const now = new Date();
    const sameDay =
        d.getFullYear() === now.getFullYear() &&
        d.getMonth() === now.getMonth() &&
        d.getDate() === now.getDate();
    const time = d.toLocaleTimeString([], {
        hour: 'numeric',
        minute: '2-digit',
    });
    if (sameDay) return `Today, ${time}`;
    const yest = new Date(now);
    yest.setDate(now.getDate() - 1);
    const isYest =
        d.getFullYear() === yest.getFullYear() &&
        d.getMonth() === yest.getMonth() &&
        d.getDate() === yest.getDate();
    if (isYest) return `Yesterday, ${time}`;
    return d.toLocaleDateString();
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

watch(
    () => activeHost.value?.token,
    (token) => {
        if (token) void refreshStatus().catch(() => {});
    },
);

onMounted(async () => {
    if (activeHost.value?.token) {
        void refreshStatus().catch(() => {});
    }
    void loadApprovals().catch(() => {});
});
</script>

<style scoped>
.or3-section-label {
    font-family:
        ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas,
        'Liberation Mono', 'Courier New', monospace;
    font-size: 0.78rem;
    font-weight: 600;
    letter-spacing: 0.18em;
    text-transform: uppercase;
    color: var(--or3-green-dark);
}

.or3-action-card {
    display: flex;
    flex-direction: column;
    gap: 0.4rem;
    padding: 0.95rem 1rem;
    border-radius: 18px;
    background: var(--or3-surface);
    border: 1px solid var(--or3-border);
    box-shadow: var(--or3-shadow-soft);
    text-decoration: none;
    color: var(--or3-text);
    transition:
        transform 0.15s ease,
        box-shadow 0.15s ease,
        border-color 0.15s ease;
}
.or3-action-card:hover {
    box-shadow: var(--or3-shadow);
    border-color: color-mix(
        in srgb,
        var(--or3-green) 25%,
        var(--or3-border) 75%
    );
}
.or3-action-card:active {
    transform: scale(0.99);
}

.or3-action-card__icon {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 36px;
    height: 36px;
    border-radius: 12px;
    background: color-mix(in srgb, var(--or3-surface-soft) 70%, white 30%);
    border: 1px solid var(--or3-border);
    color: var(--or3-text);
}

.or3-action-card__title {
    font-family:
        ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas,
        'Liberation Mono', 'Courier New', monospace;
    font-size: 0.95rem;
    font-weight: 600;
    line-height: 1.25;
}

.or3-action-card__desc {
    font-size: 0.8rem;
    line-height: 1.35rem;
    color: var(--or3-text-muted);
}

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

.or3-activity-empty {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.85rem 1rem;
    border-radius: 14px;
    border: 1px dashed var(--or3-border);
    background: color-mix(in srgb, var(--or3-surface) 80%, white 20%);
    color: var(--or3-text-muted);
    font-size: 0.85rem;
}

.or3-activity-row {
    display: flex;
    align-items: center;
    gap: 0.65rem;
    padding: 0.7rem 0.85rem;
    border-radius: 14px;
    background: var(--or3-surface);
    border: 1px solid var(--or3-border);
    box-shadow: var(--or3-shadow-soft);
}

.or3-activity-row__icon {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 32px;
    height: 32px;
    border-radius: 10px;
    background: color-mix(in srgb, var(--or3-surface-soft) 70%, white 30%);
    border: 1px solid var(--or3-border);
    color: var(--or3-text);
    flex-shrink: 0;
}

.or3-activity-row__text {
    font-family:
        ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
    font-size: 0.85rem;
    color: var(--or3-text);
    min-width: 0;
    flex: 1;
    display: flex;
    gap: 0.35rem;
    align-items: baseline;
    overflow: hidden;
    white-space: nowrap;
    text-overflow: ellipsis;
}
.or3-activity-row__label {
    font-weight: 600;
}
.or3-activity-row__detail {
    color: var(--or3-text-muted);
    overflow: hidden;
    text-overflow: ellipsis;
}

.or3-activity-row__time {
    font-family:
        ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
    font-size: 0.75rem;
    color: var(--or3-text-muted);
    white-space: nowrap;
}

.or3-activity-row__dot {
    display: inline-block;
    width: 8px;
    height: 8px;
    border-radius: 9999px;
    background: var(--or3-green);
    flex-shrink: 0;
}
.or3-activity-row__dot[data-tone='amber'] {
    background: var(--or3-amber);
}
.or3-activity-row__dot[data-tone='danger'] {
    background: var(--or3-danger);
}
.or3-activity-row__dot[data-tone='neutral'] {
    background: var(--or3-text-muted);
    opacity: 0.5;
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
    border-color: color-mix(in srgb, currentColor 24%, transparent);
    transform: translateY(-1px);
}

.or3-callout-link--secondary {
    background: transparent;
}
</style>
