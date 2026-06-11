<template>
    <AppShell
        desktop-title="My Computer"
        desktop-subtitle="Connection status, files, terminal, and approvals for your paired computer."
    >
        <template #sidebar>
            <ComputerSidebar />
        </template>
        <AppHeader subtitle="COMPUTER" />

        <div class="space-y-5">
            <ComputerOverviewCard
                :host-name="hostName"
                :base-url="baseUrl"
                :health="health"
                :readiness="readiness"
                :capabilities="capabilities"
                :paired="isPaired"
                :connected="connected"
                active-tab="/computer"
            />

            <!-- What you can do -->
            <ComputerQuickActions :items="actions" />

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
import { computed, onMounted, watch } from 'vue';

const { activeHost, isConnected, isPaired } = useActiveHost();
const { health, readiness, capabilities, refreshStatus } = useComputerStatus();
const { jobs } = useJobs();
const { approvals: approvalItems, loadApprovals } = useApprovals();

const connected = computed(() => Boolean(isConnected.value));
const hostName = computed(() => activeHost.value?.name || 'My Computer');
const baseUrl = computed(() => activeHost.value?.baseUrl || '');

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
        label: 'Manage agents',
        description: 'Start, monitor, and manage agent runs.',
        icon: 'i-pixelarticons-robot',
        to: '/agents',
    },
    {
        label: 'Automatic check-ins',
        description: 'Let OR3 run a recurring background checklist for this computer.',
        icon: 'tabler:activity-heartbeat',
        to: '/settings/heartbeat',
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
    if (kind === 'subagent') return 'Legacy task:';
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

watch(
    isPaired,
    (paired) => {
        if (paired) void refreshStatus().catch(() => {});
    },
);

onMounted(async () => {
    if (isPaired.value) {
        void refreshStatus().catch(() => {});
    }
    void loadApprovals().catch(() => {});
});
</script>

<style scoped>
/* `.or3-section-label` and `.or3-action-card*` are defined globally in
   app/assets/css/main.css so that child components (e.g. ComputerQuickActions)
   render them correctly. Keep page-specific styles below. */

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
</style>
