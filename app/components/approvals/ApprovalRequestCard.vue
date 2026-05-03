<template>
    <article class="or3-approval-card">
        <!-- Header -->
        <header class="flex items-start gap-3">
            <span class="or3-approval-card__icon">
                <Icon
                    :name="kindIcon"
                    class="size-5 text-(--or3-text)"
                />
                <span class="or3-approval-card__icon-dot" />
            </span>
            <div class="min-w-0 flex-1 pt-0.5">
                <p
                    class="font-mono text-[1.05rem] font-semibold leading-tight text-(--or3-text)"
                >
                    {{ kindLabel }}
                </p>
                <p class="mt-1 text-sm leading-6 text-(--or3-text-muted)">
                    {{ description }}
                </p>
            </div>
            <span
                class="or3-risk-pill"
                :data-tone="risk.tone"
            >
                <Icon :name="risk.icon" class="size-3.5" />
                <span>{{ risk.label }}</span>
            </span>
        </header>

        <!-- Subject preview -->
        <div v-if="subjectPreview" class="or3-approval-card__preview">
            <code class="font-mono text-[13px] leading-6 text-(--or3-green-dark)">
                {{ subjectPreview }}
            </code>
        </div>

        <!-- Meta row -->
        <div
            class="mt-3 flex flex-wrap items-center gap-x-5 gap-y-1.5 text-xs text-(--or3-text-muted)"
        >
            <span class="inline-flex items-center gap-1.5">
                <Icon name="i-pixelarticons-user" class="size-3.5" />
                <span>Source: {{ sourceLabel }}</span>
            </span>
            <span class="inline-flex items-center gap-1.5">
                <Icon name="i-pixelarticons-clock" class="size-3.5" />
                <span>{{ timeLabel }}</span>
            </span>
        </div>

        <!-- Action buttons -->
        <div
            v-if="approval.status === 'pending'"
            class="mt-4 grid grid-cols-3 gap-2"
        >
            <button
                type="button"
                class="or3-btn or3-btn--approve"
                :disabled="busy"
                @click="$emit('approve', false)"
            >
                <Icon name="i-pixelarticons-check" class="size-4" />
                <span>Approve</span>
            </button>
            <button
                type="button"
                class="or3-btn or3-btn--neutral"
                :disabled="busy"
                @click="$emit('deny')"
            >
                <Icon name="i-pixelarticons-close" class="size-4" />
                <span>Deny</span>
            </button>
            <button
                type="button"
                class="or3-btn or3-btn--remember"
                :disabled="busy"
                @click="$emit('approve', true)"
            >
                <Icon name="i-pixelarticons-bookmark" class="size-4" />
                <span class="text-center leading-tight">
                    Approve &amp;<br />remember
                </span>
            </button>
        </div>

        <!-- Status pill for non-pending -->
        <div v-else class="mt-4 flex items-center justify-between gap-3">
            <StatusPill
                :label="statusLabel"
                :tone="statusTone"
            />
            <button
                type="button"
                class="or3-link-btn"
                @click="$emit('details')"
            >
                Details
                <Icon name="i-pixelarticons-chevron-right" class="size-4" />
            </button>
        </div>
    </article>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import type { ApprovalRequest } from '~/types/or3-api';
import {
    approvalStatusLabel,
    approvalStatusTone,
    formatApprovalSubjectPreview,
} from '~/utils/or3/approval-display';

const props = defineProps<{
    approval: ApprovalRequest;
    busy?: boolean;
}>();

defineEmits<{
    approve: [remember: boolean];
    deny: [];
    details: [];
}>();

const kind = computed(
    () => props.approval.type || props.approval.domain || 'approval',
);

const kindLabel = computed(() => {
    const t = kind.value;
    if (t === 'exec') return 'Run command';
    if (t === 'file_write') return 'Write file';
    if (t === 'network') return 'Reach the internet';
    return t.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
});

const kindIcon = computed(() => {
    const t = kind.value;
    if (t === 'exec') return 'i-pixelarticons-terminal';
    if (t === 'file_write') return 'i-pixelarticons-file-text';
    if (t === 'network') return 'i-pixelarticons-globe';
    return 'i-pixelarticons-shield';
});

const description = computed(() => {
    const t = kind.value;
    if (t === 'exec') return 'or3-intern wants to run a shell command.';
    if (t === 'file_write')
        return 'or3-intern wants to create or update a file.';
    if (t === 'network')
        return 'or3-intern wants to reach an external service.';
    return 'or3-intern is asking for permission to continue.';
});

const subjectPreview = computed(() => {
    return formatApprovalSubjectPreview(props.approval);
});

const risk = computed(() => {
    const subj = (props.approval.subject ?? {}) as Record<string, unknown>;
    const explicit = String(subj.risk ?? subj.severity ?? '').toLowerCase();
    let level: 'low' | 'medium' | 'high' = 'low';
    if (explicit === 'high' || explicit === 'critical') level = 'high';
    else if (explicit === 'medium' || explicit === 'moderate') level = 'medium';
    else if (kind.value === 'exec' || kind.value === 'network') level = 'medium';

    if (level === 'high')
        return {
            label: 'High risk',
            tone: 'danger' as const,
            icon: 'i-pixelarticons-shield-off',
        };
    if (level === 'medium')
        return {
            label: 'Medium risk',
            tone: 'amber' as const,
            icon: 'i-pixelarticons-shield-off',
        };
    return {
        label: 'Low risk',
        tone: 'green' as const,
        icon: 'i-pixelarticons-shield',
    };
});

const sourceLabel = computed(() => {
    const subj = (props.approval.subject ?? {}) as Record<string, unknown>;
    return (
        (subj.source as string) ||
        (subj.agent as string) ||
        (subj.actor as string) ||
        'or3-intern'
    );
});

const timeLabel = computed(() => relativeTime(props.approval.created_at));

const statusLabel = computed(() => {
    return approvalStatusLabel(props.approval.status);
});

const statusTone = computed<'green' | 'amber' | 'danger' | 'neutral'>(() => {
    return approvalStatusTone(props.approval.status);
});

function relativeTime(value?: string): string {
    if (!value) return 'Requested just now';
    const ts = Date.parse(value);
    if (!Number.isFinite(ts)) return 'Requested just now';
    const diffMs = Date.now() - ts;
    const sec = Math.max(0, Math.round(diffMs / 1000));
    if (sec < 30) return 'Requested just now';
    if (sec < 60) return `${sec} sec ago`;
    const min = Math.round(sec / 60);
    if (min < 60) return `${min} min ago`;
    const hr = Math.round(min / 60);
    if (hr < 24) return `${hr} hr ago`;
    const day = Math.round(hr / 24);
    if (day < 7) return `${day} day${day === 1 ? '' : 's'} ago`;
    return new Date(ts).toLocaleDateString();
}
</script>

<style scoped>
.or3-approval-card {
    background: var(--or3-surface);
    border: 1px solid var(--or3-border);
    border-radius: var(--or3-radius-card);
    padding: 1rem 1.1rem 1.1rem;
    box-shadow: var(--or3-shadow-soft);
}

.or3-approval-card__icon {
    position: relative;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 44px;
    height: 44px;
    border-radius: 14px;
    background: #1f1f1d;
    color: white;
    flex-shrink: 0;
    box-shadow: 0 2px 6px rgba(31, 31, 29, 0.25);
}

.or3-approval-card__icon :deep(svg) {
    color: #f1eddf;
}

.or3-approval-card__icon-dot {
    position: absolute;
    bottom: 6px;
    right: 6px;
    width: 6px;
    height: 6px;
    border-radius: 9999px;
    background: var(--or3-green);
    box-shadow: 0 0 0 1.5px #1f1f1d;
}

/* When kind icon is "file" / non-exec, use soft surface instead */
.or3-approval-card__icon[data-tone='soft'] {
    background: var(--or3-green-soft);
    color: var(--or3-green-dark);
    box-shadow: var(--or3-shadow-soft);
}

.or3-approval-card__preview {
    margin-top: 0.85rem;
    padding: 0.65rem 0.85rem;
    background: color-mix(in srgb, var(--or3-surface-soft) 75%, white 25%);
    border: 1px solid color-mix(in srgb, var(--or3-border) 80%, white 20%);
    border-radius: 12px;
    overflow-x: auto;
    white-space: nowrap;
}

.or3-risk-pill {
    display: inline-flex;
    align-items: center;
    gap: 0.3rem;
    padding: 0.3rem 0.6rem;
    border-radius: 9999px;
    font-size: 0.72rem;
    font-weight: 600;
    border: 1px solid var(--or3-border);
    background: white;
    color: var(--or3-text);
    flex-shrink: 0;
    white-space: nowrap;
}
.or3-risk-pill[data-tone='amber'] {
    background: var(--or3-amber-soft);
    border-color: color-mix(in srgb, var(--or3-amber) 30%, white 70%);
    color: #8a5a14;
}
.or3-risk-pill[data-tone='green'] {
    background: var(--or3-green-soft);
    border-color: color-mix(in srgb, var(--or3-green) 30%, white 70%);
    color: var(--or3-green-dark);
}
.or3-risk-pill[data-tone='danger'] {
    background: var(--or3-danger-soft);
    border-color: color-mix(in srgb, var(--or3-danger) 30%, white 70%);
    color: #8a2e2e;
}

.or3-btn {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 0.35rem;
    min-height: 44px;
    padding: 0.55rem 0.65rem;
    border-radius: 14px;
    font-size: 0.85rem;
    font-weight: 600;
    border: 1px solid var(--or3-border);
    background: white;
    color: var(--or3-text);
    transition:
        transform 0.12s ease,
        background 0.15s ease,
        border-color 0.15s ease,
        box-shadow 0.15s ease;
    cursor: pointer;
}
.or3-btn:hover {
    box-shadow: var(--or3-shadow-soft);
}
.or3-btn:active {
    transform: scale(0.98);
}
.or3-btn:disabled {
    opacity: 0.55;
    cursor: not-allowed;
}

.or3-btn--approve {
    background: var(--or3-green);
    border-color: var(--or3-green-dark);
    color: white;
    box-shadow: 0 2px 4px rgba(40, 98, 59, 0.18);
}
.or3-btn--approve:hover {
    background: var(--or3-green-dark);
}

.or3-btn--remember {
    background: white;
    border-color: color-mix(in srgb, var(--or3-green) 30%, var(--or3-border) 70%);
    color: var(--or3-green-dark);
}

.or3-btn--neutral {
    background: white;
    color: var(--or3-text);
}

.or3-link-btn {
    display: inline-flex;
    align-items: center;
    gap: 0.25rem;
    font-size: 0.85rem;
    font-weight: 500;
    color: var(--or3-text-muted);
    background: transparent;
    border: none;
    cursor: pointer;
}
.or3-link-btn:hover {
    color: var(--or3-text);
}
</style>
