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
                    <span class="font-medium">{{ part.name || 'tool' }}</span>
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
                part.argumentsPreview ||
                part.resultPreview ||
                part.errorPreview ||
                part.publicCode
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
                    >{{ pretty(part.argumentsPreview) }}</pre
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
                    >{{ truncate(pretty(part.resultPreview), 800) }}</pre
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

const props = defineProps<{ part: ChatMessagePart }>();

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

const subtitle = computed(() => {
    if (props.part.status === 'running')
        return 'or3-intern is using this tool right now.';
    if (props.part.status === 'attention')
        return 'This tool call is waiting for your approval.';
    if (props.part.status === 'error')
        return 'This tool call ended with an error.';
    return 'This tool call finished successfully.';
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
</script>
