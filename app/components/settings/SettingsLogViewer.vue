<template>
    <SurfaceCard class-name="space-y-3">
        <div class="flex flex-wrap items-start justify-between gap-3">
            <div class="min-w-0">
                <p
                    class="or3-command text-[11px] uppercase tracking-[0.2em] text-(--or3-green-dark)"
                >
                    {{ title }}
                </p>
                <p
                    v-if="subtitle"
                    class="mt-1 text-xs leading-5 text-(--or3-text-muted)"
                >
                    {{ subtitle }}
                </p>
                <p v-if="error" class="mt-1 text-xs text-(--or3-danger)">
                    {{ error }}
                </p>
            </div>
            <div class="flex shrink-0 flex-wrap items-center justify-end gap-2">
                <UButton
                    v-if="connectable"
                    :label="streaming ? 'Disconnect' : 'Connect'"
                    :icon="
                        streaming
                            ? 'i-pixelarticons-close'
                            : 'i-pixelarticons-play'
                    "
                    size="xs"
                    variant="soft"
                    color="neutral"
                    @click="streaming ? emit('disconnect') : emit('connect')"
                />
                <UButton
                    label="Copy"
                    icon="i-pixelarticons-copy"
                    size="xs"
                    variant="soft"
                    color="neutral"
                    @click="copyFiltered"
                />
                <UButton
                    label="Clear"
                    icon="i-pixelarticons-close"
                    size="xs"
                    variant="ghost"
                    color="neutral"
                    @click="emit('clear')"
                />
            </div>
        </div>

        <div class="flex flex-wrap items-center gap-2">
            <button
                v-for="level in levelOptions"
                :key="level.value"
                type="button"
                class="or3-focus-ring rounded-full border px-3 py-1 font-mono text-[11px] font-semibold uppercase tracking-wide transition"
                :class="
                    selectedLevel === level.value
                        ? 'border-(--or3-green) bg-(--or3-green-soft) text-(--or3-green-dark)'
                        : 'border-(--or3-border) bg-white/70 text-(--or3-text-muted)'
                "
                @click="selectedLevel = level.value"
            >
                {{ level.label }}
            </button>
            <input
                v-model="componentQuery"
                type="search"
                placeholder="Component"
                class="or3-focus-ring h-8 min-w-0 flex-1 rounded-xl border border-(--or3-border) bg-white/70 px-3 font-mono text-xs text-(--or3-text) placeholder:text-(--or3-text-muted)"
            />
            <input
                v-model="traceQuery"
                type="search"
                placeholder="Trace"
                class="or3-focus-ring h-8 min-w-0 flex-1 rounded-xl border border-(--or3-border) bg-white/70 px-3 font-mono text-xs text-(--or3-text) placeholder:text-(--or3-text-muted)"
            />
        </div>

        <div
            class="max-h-72 overflow-auto rounded-xl border border-(--or3-border) bg-white/70"
        >
            <div
                v-if="!filteredEntries.length"
                class="px-4 py-3 text-xs text-(--or3-text-muted)"
            >
                {{ emptyText }}
            </div>
            <details
                v-for="entry in filteredEntries.slice(0, limit)"
                :key="entry.id"
                class="group border-b border-(--or3-border) px-4 py-2 last:border-b-0"
            >
                <summary
                    class="or3-focus-ring flex cursor-pointer list-none flex-wrap items-center gap-2 rounded-md py-1"
                >
                    <span
                        class="rounded px-1.5 py-0.5 font-mono text-[10px] font-semibold uppercase"
                        :class="levelClass(entryLevel(entry))"
                    >
                        {{ entryLevel(entry) }}
                    </span>
                    <code
                        class="rounded bg-(--or3-green-soft) px-1.5 py-0.5 font-mono text-[10px] text-(--or3-green-dark)"
                    >
                        {{ entryComponent(entry) }}
                    </code>
                    <span
                        class="min-w-0 flex-1 truncate font-mono text-xs font-semibold text-(--or3-text)"
                    >
                        {{ entryName(entry) }}
                    </span>
                    <span class="font-mono text-[10px] text-(--or3-text-muted)">
                        {{ entryTime(entry) }}
                    </span>
                </summary>
                <p
                    v-if="entryMessage(entry)"
                    class="mt-1 text-xs leading-5 text-(--or3-text-muted)"
                >
                    {{ entryMessage(entry) }}
                </p>
                <div
                    v-if="entryTrace(entry)"
                    class="mt-1 font-mono text-[10px] text-(--or3-text-muted)"
                >
                    trace={{ entryTrace(entry) }}
                </div>
                <pre
                    v-if="entryPayload(entry)"
                    class="mt-2 whitespace-pre-wrap break-all rounded-lg bg-(--or3-surface-muted) p-2 font-mono text-[10px] leading-4 text-(--or3-text-muted)"
                    >{{ entryPayload(entry) }}</pre
                >
            </details>
        </div>
    </SurfaceCard>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue';

type LogLevel = 'debug' | 'info' | 'warn' | 'error';
type LevelFilter = LogLevel | 'all';

export interface SettingsLogViewerEntry {
    id: string;
    createdAt?: string;
    timestamp?: string;
    level?: LogLevel;
    area?: string;
    component?: string;
    event?: string;
    message?: string;
    detail?: string;
    traceId?: string;
    session?: string;
    data?: Record<string, unknown>;
    fields?: Record<string, unknown>;
}

const props = withDefaults(
    defineProps<{
        title: string;
        subtitle?: string;
        entries: SettingsLogViewerEntry[];
        emptyText: string;
        limit?: number;
        streaming?: boolean;
        error?: string | null;
        connectable?: boolean;
    }>(),
    {
        subtitle: '',
        limit: 80,
        streaming: false,
        error: null,
        connectable: false,
    },
);

const emit = defineEmits<{
    clear: [];
    connect: [];
    disconnect: [];
}>();

const selectedLevel = ref<LevelFilter>('all');
const componentQuery = ref('');
const traceQuery = ref('');
const levelOptions: Array<{ value: LevelFilter; label: string }> = [
    { value: 'all', label: 'All' },
    { value: 'debug', label: 'Debug' },
    { value: 'info', label: 'Info' },
    { value: 'warn', label: 'Warn' },
    { value: 'error', label: 'Error' },
];

function entryLevel(entry: SettingsLogViewerEntry): LogLevel {
    return entry.level ?? 'info';
}

function entryComponent(entry: SettingsLogViewerEntry) {
    return entry.component || entry.area || 'app';
}

function entryName(entry: SettingsLogViewerEntry) {
    return entry.event || entry.message || 'event';
}

function entryMessage(entry: SettingsLogViewerEntry) {
    return entry.detail || (entry.event ? entry.message : '');
}

function entryTime(entry: SettingsLogViewerEntry) {
    return entry.createdAt || entry.timestamp || '';
}

function entryTrace(entry: SettingsLogViewerEntry) {
    return entry.traceId || '';
}

function entryPayload(entry: SettingsLogViewerEntry) {
    const payload = entry.data || entry.fields;
    return payload ? JSON.stringify(payload, null, 2) : '';
}

const filteredEntries = computed(() => {
    const component = componentQuery.value.trim().toLowerCase();
    const trace = traceQuery.value.trim().toLowerCase();
    return props.entries.filter((entry) => {
        if (
            selectedLevel.value !== 'all' &&
            entryLevel(entry) !== selectedLevel.value
        )
            return false;
        if (
            component &&
            !entryComponent(entry).toLowerCase().includes(component)
        )
            return false;
        if (trace && !entryTrace(entry).toLowerCase().includes(trace))
            return false;
        return true;
    });
});

function levelClass(level: LogLevel) {
    if (level === 'error') return 'bg-red-100 text-red-800';
    if (level === 'warn') return 'bg-amber-100 text-amber-800';
    if (level === 'debug') return 'bg-slate-100 text-slate-700';
    return 'bg-emerald-100 text-emerald-800';
}

async function copyFiltered() {
    await navigator.clipboard?.writeText(
        JSON.stringify(filteredEntries.value, null, 2),
    );
}
</script>
