<template>
    <details
        class="overflow-hidden rounded-2xl border border-(--or3-border) bg-(--or3-surface-soft)"
    >
        <summary
            class="flex cursor-pointer items-start gap-2 px-3 py-2.5 text-sm text-(--or3-text)"
        >
            <span
                class="mt-0.5 inline-flex size-5 shrink-0 items-center justify-center rounded-full"
                :class="statusClasses"
            >
                <Icon
                    :name="icon"
                    :class="
                        part.status === 'running'
                            ? 'size-3 animate-spin'
                            : 'size-3'
                    "
                />
            </span>
            <div class="min-w-0 flex-1">
                <div class="flex flex-wrap items-center gap-x-2 gap-y-1">
                    <span class="font-medium">{{ displayName }}</span>
                    <span
                        class="font-mono text-[11px] uppercase tracking-[0.14em] text-(--or3-text-muted)"
                    >
                        {{ label }}
                    </span>
                </div>
                <p class="mt-0.5 text-xs leading-5 text-(--or3-text-muted)">
                    {{ subtitle }}
                </p>
            </div>
        </summary>

        <div
            v-if="
                !compactTelemetry &&
                (part.argumentsPreview ||
                    part.resultPreview ||
                    part.errorPreview ||
                    part.publicCode)
            "
            class="space-y-2 border-t border-(--or3-border) px-3 py-2.5 text-xs leading-5 text-(--or3-text-muted)"
        >
            <div v-if="part.argumentsPreview">
                <p
                    class="mb-1 font-mono uppercase tracking-[0.14em] text-(--or3-green-dark)"
                >
                    Arguments
                </p>
                <pre
                    class="overflow-x-auto rounded-xl bg-(--or3-surface) px-3 py-2 whitespace-pre-wrap text-(--or3-text-muted)"
                    >{{ displayPreview(part.argumentsPreview) }}</pre
                >
            </div>
            <div v-if="part.resultPreview">
                <p
                    class="mb-1 font-mono uppercase tracking-[0.14em] text-(--or3-green-dark)"
                >
                    Result
                </p>
                <pre
                    class="overflow-x-auto rounded-xl bg-(--or3-surface) px-3 py-2 whitespace-pre-wrap text-(--or3-text-muted)"
                    >{{ displayPreview(part.resultPreview) }}</pre
                >
            </div>
            <div v-if="part.errorPreview">
                <p
                    class="mb-1 font-mono uppercase tracking-[0.14em]"
                    :class="
                        part.status === 'attention'
                            ? 'text-amber-700'
                            : 'text-(--or3-danger)'
                    "
                >
                    {{ part.status === 'attention' ? 'Approval' : 'Error' }}
                </p>
                <pre
                    class="overflow-x-auto rounded-xl bg-(--or3-surface) px-3 py-2 whitespace-pre-wrap"
                    :class="
                        part.status === 'attention'
                            ? 'text-amber-700'
                            : 'text-(--or3-danger)'
                    "
                    >{{ truncate(part.errorPreview, 800) }}</pre
                >
            </div>
            <p
                v-if="part.publicCode"
                class="font-mono uppercase tracking-[0.14em]"
            >
                {{ part.publicCode }}
            </p>
        </div>
    </details>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import type { ChatMessagePart } from '~/types/app-state';

const props = withDefaults(
    defineProps<{ part: ChatMessagePart; compactTelemetry?: boolean }>(),
    { compactTelemetry: false },
);

const icon = computed(() => {
    if (props.part.status === 'running') return 'i-pixelarticons-loader';
    if (props.part.status === 'attention') return 'i-pixelarticons-shield';
    if (props.part.status === 'error') return 'i-pixelarticons-alert';
    return 'i-pixelarticons-check';
});

const label = computed(() => {
    if (props.part.status === 'running') return 'RUNNING';
    if (props.part.status === 'attention') return 'WAITING';
    if (props.part.status === 'error') return 'FAILED';
    return 'DONE';
});

const displayName = computed(() =>
    deriveDisplayName(
        props.part.name,
        props.part.argumentsPreview,
        props.part.resultPreview,
    ),
);

const doctorTelemetrySummary = computed(() => {
    if (!props.compactTelemetry || props.part.status === 'running') return '';
    const parsed = parsePreview(props.part.resultPreview);
    if (parsed) {
        const summary =
            typeof parsed.summary === 'string' ? parsed.summary.trim() : '';
        if (summary) return summary;
    }
    const preview = String(props.part.resultPreview ?? '').trim();
    const match = preview.match(/"summary"\s*:\s*"([^"\\]*(?:\\.[^"\\]*)*)"/);
    if (match?.[1]) {
        return match[1].replace(/\\"/g, '"').replace(/\\n/g, ' ').trim();
    }
    return '';
});

const subtitle = computed(() => {
    if (doctorTelemetrySummary.value) return doctorTelemetrySummary.value;
    const specific = describeToolAction(
        props.part.name,
        props.part.status,
        props.part.argumentsPreview,
    );
    if (specific) return specific;
    if (props.part.status === 'running')
        return 'or3-intern is using this tool right now.';
    if (props.part.status === 'attention')
        return 'This tool call is waiting for your approval.';
    if (props.part.status === 'error')
        return 'This tool call ended with an error.';
    return props.compactTelemetry
        ? 'Checked OR3 in the background.'
        : 'This tool call finished successfully.';
});

const statusClasses = computed(() => {
    if (props.part.status === 'running')
        return 'bg-(--or3-green-soft) text-(--or3-green-dark)';
    if (props.part.status === 'attention') return 'bg-amber-100 text-amber-700';
    if (props.part.status === 'error')
        return 'bg-(--or3-danger-soft) text-(--or3-danger)';
    return 'bg-(--or3-surface) text-(--or3-green)';
});

function pretty(value: string) {
    try {
        return JSON.stringify(JSON.parse(value), null, 2);
    } catch {
        return value;
    }
}

function truncate(value: string, limit: number) {
    return value.length > limit ? `${value.slice(0, limit)}\n...` : value;
}

function displayPreview(value: string, limit = 800) {
    return truncate(pretty(value), limit);
}

function parsePreview(value?: string) {
    if (!value) return undefined;
    try {
        const parsed = JSON.parse(value);
        return parsed && typeof parsed === 'object'
            ? (parsed as Record<string, unknown>)
            : undefined;
    } catch {
        return undefined;
    }
}

function describeToolAction(
    name?: string,
    status?: ChatMessagePart['status'],
    argumentsPreview?: string,
) {
    const tool = String(name ?? '').trim().toLowerCase();
    const parsed = parsePreview(argumentsPreview);
    const url =
        typeof parsed?.url === 'string'
            ? parsed.url.trim()
            : typeof parsed?.['source_url'] === 'string'
              ? String(parsed.source_url).trim()
              : '';
    const command =
        typeof parsed?.command === 'string'
            ? parsed.command.trim()
            : typeof parsed?.program === 'string'
              ? String(parsed.program).trim()
              : '';

    if ((tool === 'webfetch' || tool === 'web_search') && url) {
        return status === 'running' ? `Fetching ${url}` : `Fetched ${url}`;
    }
    if ((tool === 'exec' || tool === 'bash' || tool === 'command') && command) {
        return status === 'running'
            ? `Running ${command}`
            : `Ran ${command}`;
    }
    return '';
}

function deriveDisplayName(
    name?: string,
    argumentsPreview?: string,
    resultPreview?: string,
) {
    const normalized = String(name ?? '').trim();
    if (
        normalized &&
        normalized.toLowerCase() !== 'runner activity' &&
        normalized.toLowerCase() !== 'tool' &&
        normalized.toLowerCase() !== 'tool call'
    ) {
        return normalized;
    }
    const parsed = parsePreview(argumentsPreview) || parsePreview(resultPreview);
    if (!parsed) return normalized || 'tool';
    if (typeof parsed.url === 'string' && parsed.url.trim()) return 'webfetch';
    if (typeof parsed.command === 'string' && parsed.command.trim()) return 'command';
    if (typeof parsed.program === 'string' && parsed.program.trim()) return 'command';
    if (typeof parsed.path === 'string' && parsed.path.trim()) return 'file';
    return normalized || 'tool';
}
</script>
