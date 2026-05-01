<template>
    <AppShell>
        <AppHeader subtitle="ADVANCED SETTINGS" />

        <div class="space-y-4">
            <SurfaceCard tone="caution" class-name="space-y-2">
                <div class="flex items-start gap-3">
                    <Icon
                        name="i-pixelarticons-warning-box"
                        class="mt-0.5 size-5 shrink-0 text-(--or3-amber)"
                    />
                    <div class="min-w-0 flex-1">
                        <p
                            class="font-mono text-sm font-semibold text-amber-900"
                        >
                            Advanced Settings
                        </p>
                        <p class="mt-1 text-xs leading-5 text-amber-800/85">
                            Advanced Settings are for debugging, hosting, and
                            custom setups. Most people should use
                            <NuxtLink
                                to="/settings"
                                class="font-semibold underline"
                                >Simple Settings</NuxtLink
                            >.
                        </p>
                    </div>
                </div>
            </SurfaceCard>

            <!-- Connection summary card -->
            <SurfaceCard class-name="space-y-3">
                <div class="flex items-start gap-3">
                    <BrandMark size="md" />
                    <div class="min-w-0 flex-1">
                        <div class="flex flex-wrap items-center gap-2">
                            <p
                                class="font-mono text-base font-semibold text-(--or3-text)"
                            >
                                {{
                                    activeHost?.token
                                        ? `Connected to ${activeHost.name || 'My Computer'}`
                                        : 'No computer paired'
                                }}
                            </p>
                            <StatusPill
                                v-if="activeHost?.token"
                                label="Connected"
                                tone="green"
                                pulse
                            />
                        </div>
                        <p
                            class="mt-1 text-sm leading-6 text-(--or3-text-muted)"
                        >
                            {{
                                activeHost?.token
                                    ? 'Your or3-intern app is connected and ready.'
                                    : 'Pair this app to your computer to get started.'
                            }}
                        </p>
                    </div>
                </div>
                <div class="flex items-center gap-2">
                    <code
                        v-if="activeHost?.baseUrl"
                        class="min-w-0 flex-1 truncate rounded-xl border border-(--or3-border) bg-white/70 px-3 py-2 font-mono text-xs text-(--or3-text)"
                        >{{ activeHost.baseUrl }}</code
                    >
                    <UButton
                        label="Pair new computer"
                        icon="i-pixelarticons-link"
                        color="primary"
                        variant="solid"
                        size="sm"
                        class="shrink-0 rounded-full"
                        to="/settings/pair"
                    />
                </div>
            </SurfaceCard>

            <!-- Search -->
            <div class="relative">
                <Icon
                    name="i-pixelarticons-search"
                    class="absolute left-4 top-1/2 size-4 -translate-y-1/2 text-(--or3-text-muted)"
                />
                <input
                    v-model="searchTerm"
                    type="search"
                    placeholder="Search settings, fields, or keys…"
                    class="or3-focus-ring h-12 w-full rounded-2xl border border-(--or3-border) bg-(--or3-surface) pl-11 pr-16 text-base text-(--or3-text) placeholder:text-(--or3-text-muted) sm:text-sm"
                    aria-label="Search settings"
                />
                <span
                    class="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 rounded-md border border-(--or3-border) bg-white px-1.5 py-0.5 font-mono text-[11px] text-(--or3-text-muted)"
                    >⌘K</span
                >
            </div>

            <!-- Categories + highlights (merged) -->
            <SurfaceCard class-name="space-y-3">
                <div class="flex items-center justify-between gap-2">
                    <p
                        class="or3-command text-[11px] uppercase tracking-[0.2em] text-(--or3-green-dark)"
                    >
                        {{ activeFilterLabel }} highlights
                    </p>
                    <span
                        v-if="allFieldsLoading"
                        class="font-mono text-[11px] text-(--or3-text-muted)"
                        >Indexing…</span
                    >
                </div>

                <!-- Filter chips (categories) -->
                <div class="-mx-4 overflow-x-auto px-4">
                    <div class="flex w-max items-center gap-2">
                        <button
                            v-for="filter in filters"
                            :key="filter.key"
                            type="button"
                            class="or3-focus-ring rounded-full border px-4 py-2 font-mono text-xs font-semibold uppercase tracking-wide transition"
                            :class="
                                activeFilter === filter.key
                                    ? 'border-(--or3-green) bg-(--or3-green-soft) text-(--or3-green-dark)'
                                    : 'border-(--or3-border) bg-(--or3-surface) text-(--or3-text)'
                            "
                            @click="activeFilter = filter.key"
                        >
                            {{ filter.label }}
                        </button>
                    </div>
                </div>

                <!-- Highlight grid (only when not searching) -->
                <div
                    v-if="quickSections.length"
                    id="settings-highlights"
                    class="grid grid-cols-2 gap-3 sm:grid-cols-3"
                >
                    <button
                        v-for="section in quickSections"
                        :key="section.key"
                        type="button"
                        class="or3-focus-ring group flex flex-col gap-2 rounded-2xl border border-(--or3-border) bg-white/70 p-3 text-left transition hover:bg-(--or3-green-soft)"
                        @click="openSection(section.key)"
                    >
                        <div class="flex items-start justify-between">
                            <RetroIcon :name="iconFor(section.key)" size="sm" />
                            <Icon
                                name="i-pixelarticons-chevron-right"
                                class="size-4 text-(--or3-text-muted)"
                            />
                        </div>
                        <div class="min-w-0">
                            <p
                                class="font-mono text-sm font-semibold text-(--or3-text)"
                            >
                                {{ section.label }}
                            </p>
                            <p
                                class="mt-0.5 line-clamp-2 text-xs leading-snug text-(--or3-text-muted)"
                            >
                                {{ section.description }}
                            </p>
                        </div>
                    </button>
                </div>
            </SurfaceCard>

            <!-- Field-level search results -->
            <SurfaceCard
                v-if="searchTerm.trim() && fieldMatches.length"
                class-name="space-y-3"
            >
                <p
                    class="or3-command text-[11px] uppercase tracking-[0.2em] text-(--or3-green-dark)"
                >
                    Matching settings ({{ fieldMatches.length }})
                </p>
                <div
                    class="overflow-hidden rounded-2xl border border-(--or3-border) bg-white/70"
                >
                    <button
                        v-for="(match, index) in fieldMatches"
                        :key="`${match.sectionKey}.${match.field.key}`"
                        type="button"
                        class="or3-focus-ring flex w-full items-start gap-3 px-4 py-3 text-left transition hover:bg-(--or3-green-soft)"
                        :class="
                            index < fieldMatches.length - 1
                                ? 'border-b border-(--or3-border)'
                                : ''
                        "
                        @click="openSection(match.sectionKey)"
                    >
                        <RetroIcon
                            :name="iconFor(match.sectionKey)"
                            size="sm"
                        />
                        <div class="min-w-0 flex-1">
                            <div
                                class="flex flex-wrap items-baseline gap-x-2 gap-y-0.5"
                            >
                                <p
                                    class="font-mono text-sm font-semibold text-(--or3-text)"
                                >
                                    {{ match.field.label || match.field.key }}
                                </p>
                                <code
                                    class="rounded bg-(--or3-green-soft) px-1.5 py-0.5 font-mono text-[10px] text-(--or3-green-dark)"
                                    >{{ match.sectionLabel }} ·
                                    {{ match.field.key }}</code
                                >
                            </div>
                            <p
                                v-if="match.field.description"
                                class="mt-0.5 line-clamp-2 text-xs leading-snug text-(--or3-text-muted)"
                            >
                                {{ match.field.description }}
                            </p>
                        </div>
                        <Icon
                            name="i-pixelarticons-chevron-right"
                            class="mt-1 size-5 shrink-0 text-(--or3-text-muted)"
                        />
                    </button>
                </div>
            </SurfaceCard>

            <!-- Settings groups -->
            <SurfaceCard class-name="space-y-3">
                <p
                    class="or3-command text-[11px] uppercase tracking-[0.2em] text-(--or3-green-dark)"
                >
                    Settings groups
                </p>
                <div class="grid gap-3 sm:grid-cols-2">
                    <button
                        v-for="group in groups"
                        :key="group.key"
                        type="button"
                        class="or3-focus-ring flex items-start gap-3 rounded-2xl border p-4 text-left transition"
                        :class="
                            activeFilter === group.key
                                ? 'border-(--or3-green) bg-(--or3-green-soft)'
                                : 'border-(--or3-border) bg-white/70 hover:bg-(--or3-green-soft)'
                        "
                        @click="onGroupClick(group)"
                    >
                        <RetroIcon :name="group.icon" size="sm" />
                        <div class="min-w-0 flex-1">
                            <p
                                class="font-mono text-sm font-semibold text-(--or3-text)"
                            >
                                {{ group.label }}
                            </p>
                            <p
                                class="mt-1 text-xs leading-5 text-(--or3-text-muted)"
                            >
                                {{ group.description }}
                            </p>
                        </div>
                        <Icon
                            name="i-pixelarticons-chevron-right"
                            class="mt-0.5 size-4 shrink-0 text-(--or3-text-muted)"
                        />
                    </button>
                </div>
            </SurfaceCard>

            <!-- All Settings list -->
            <SurfaceCard v-if="listSections.length" class-name="space-y-3">
                <p
                    class="or3-command text-[11px] uppercase tracking-[0.2em] text-(--or3-green-dark)"
                >
                    All settings
                </p>
                <div
                    class="overflow-hidden rounded-2xl border border-(--or3-border) bg-white/70"
                >
                    <button
                        v-for="(section, index) in listSections"
                        :key="section.key"
                        type="button"
                        class="or3-focus-ring flex w-full items-center gap-3 px-4 py-3 text-left transition hover:bg-(--or3-green-soft)"
                        :class="
                            index < listSections.length - 1
                                ? 'border-b border-(--or3-border)'
                                : ''
                        "
                        @click="openSection(section.key)"
                    >
                        <RetroIcon :name="iconFor(section.key)" size="sm" />
                        <div class="min-w-0 flex-1">
                            <p
                                class="font-mono text-sm font-semibold text-(--or3-text)"
                            >
                                {{ section.label }}
                            </p>
                            <p
                                class="mt-0.5 truncate text-xs text-(--or3-text-muted)"
                            >
                                {{ section.description }}
                            </p>
                        </div>
                        <Icon
                            name="i-pixelarticons-chevron-right"
                            class="size-5 shrink-0 text-(--or3-text-muted)"
                        />
                    </button>
                </div>
            </SurfaceCard>

            <!-- Empty state -->
            <SurfaceCard
                v-if="
                    !quickSections.length &&
                    !listSections.length &&
                    !fieldMatches.length
                "
                class-name="text-center text-sm text-(--or3-text-muted) py-6"
            >
                <p v-if="searchTerm.trim()">
                    No settings match "{{ searchTerm }}".
                </p>
                <p v-else>No settings available for this filter.</p>
            </SurfaceCard>

            <NuxtLink
                to="/settings"
                class="or3-focus-ring flex w-full items-start gap-3 rounded-2xl border border-(--or3-border) bg-white/70 p-4 text-left transition hover:bg-(--or3-green-soft)"
            >
                <Icon
                    name="i-pixelarticons-arrow-left"
                    class="mt-0.5 size-5 shrink-0 text-(--or3-text-muted)"
                />
                <div class="min-w-0 flex-1">
                    <p
                        class="font-mono text-sm font-semibold text-(--or3-text)"
                    >
                        Back to Simple Settings
                    </p>
                    <p class="mt-0.5 text-xs leading-5 text-(--or3-text-muted)">
                        Friendly summaries, presets, and impact labels for
                        everyday changes.
                    </p>
                </div>
                <Icon
                    name="i-pixelarticons-chevron-right"
                    class="mt-1 size-5 shrink-0 text-(--or3-text-muted)"
                />
            </NuxtLink>

            <p v-if="configureError" class="text-sm text-(--or3-danger)">
                {{ configureError }}
            </p>

            <p class="or3-command pb-3 text-center text-xs">or3-app v1.0.0</p>
        </div>
    </AppShell>
</template>

<script setup lang="ts">
import { computed, nextTick, onMounted, ref } from 'vue';
import { useRouter } from 'vue-router';
import { useConfigure } from '../../composables/useConfigure';
import { useActiveHost } from '../../composables/useActiveHost';

const router = useRouter();
const searchTerm = ref('');

type FilterKey =
    | 'connection'
    | 'security'
    | 'safety'
    | 'agent-behavior'
    | 'knowledge'
    | 'advanced';
const activeFilter = ref<FilterKey>('connection');

const { sections, configureError, loadSections, fieldsBySection, allFieldsLoading, loadAllFields } = useConfigure();
const { activeHost } = useActiveHost();

const filters: Array<{ key: FilterKey; label: string }> = [
    { key: 'connection', label: 'Connection' },
    { key: 'security', label: 'Security' },
    { key: 'safety', label: 'Safety' },
    { key: 'agent-behavior', label: 'Agent behavior' },
    { key: 'knowledge', label: 'Knowledge' },
    { key: 'advanced', label: 'Advanced' },
];

const groups = [
    {
        key: 'connection',
        label: 'Connection',
        description:
            'Pair devices, review the current computer, and jump back into device trust.',
        icon: 'i-pixelarticons-link',
        route: '/settings/pair',
    },
    {
        key: 'security',
        label: 'Security',
        description:
            'Manage passkeys, signed-in sessions, and owner verification state.',
        icon: 'i-pixelarticons-shield',
        route: '/settings/security',
    },
    {
        key: 'safety',
        label: 'Safety',
        description:
            'Control hardening, session posture, and host protection behavior.',
        icon: 'i-pixelarticons-shield',
        route: null,
    },
    {
        key: 'agent-behavior',
        label: 'Agent Behavior',
        description:
            'Tune providers, runtime behavior, tools, skills, and automation.',
        icon: 'i-pixelarticons-robot',
        route: null,
    },
    {
        key: 'knowledge',
        label: 'Knowledge',
        description:
            'Adjust workspace, storage, indexing, and context-related settings.',
        icon: 'i-pixelarticons-book-open',
        route: null,
    },
    {
        key: 'advanced',
        label: 'Advanced',
        description:
            'Open the low-level section editor when you need direct host controls.',
        icon: 'i-pixelarticons-settings-cog-2',
        route: '/settings/service',
    },
] satisfies Array<{
    key: FilterKey;
    label: string;
    description: string;
    icon: string;
    route: string | null;
}>;

// Sections promoted to the "Quick settings" grid (shown only on Essentials).
const QUICK_KEYS: Record<FilterKey, string[]> = {
    connection: ['workspace', 'storage', 'service'],
    security: ['security', 'session', 'service'],
    safety: ['security', 'hardening', 'session'],
    'agent-behavior': ['provider', 'runtime', 'skills', 'automation'],
    knowledge: ['workspace', 'storage', 'docindex', 'context'],
    advanced: ['service', 'hardening', 'tools'],
};

// Filter membership for chips. `null` means all sections.
const FILTER_MAP: Record<FilterKey, string[] | null> = {
    connection: ['workspace', 'storage', 'service', 'session'],
    security: ['security', 'session', 'service'],
    safety: ['security', 'hardening', 'session', 'service'],
    'agent-behavior': [
        'provider',
        'runtime',
        'context',
        'skills',
        'docindex',
        'tools',
        'automation',
        'channels',
    ],
    knowledge: ['workspace', 'storage', 'docindex', 'context'],
    advanced: ['hardening', 'context', 'docindex', 'tools', 'service'],
};

// Retro-style icons for each known section key.
const ICON_MAP: Record<string, string> = {
    provider: 'i-pixelarticons-cpu',
    workspace: 'i-pixelarticons-folder',
    storage: 'i-pixelarticons-database',
    security: 'i-pixelarticons-shield',
    channels: 'i-pixelarticons-message-text',
    automation: 'i-pixelarticons-zap',
    runtime: 'i-pixelarticons-analytics',
    tools: 'i-pixelarticons-tool-case',
    docindex: 'i-pixelarticons-book-open',
    skills: 'i-pixelarticons-sparkle',
    session: 'i-pixelarticons-users',
    service: 'i-pixelarticons-monitor',
    context: 'i-pixelarticons-card-stack',
    hardening: 'i-pixelarticons-lock',
};

function iconFor(key: string) {
    return ICON_MAP[key] ?? 'i-pixelarticons-settings-cog-2';
}

function matchesSearch(text: string | undefined | null) {
    const query = searchTerm.value.trim().toLowerCase();
    if (!query) return true;
    return String(text ?? '')
        .toLowerCase()
        .includes(query);
}

const filteredSections = computed(() => {
    const allow = FILTER_MAP[activeFilter.value];
    return sections.value.filter((section) => {
        if (allow && !allow.includes(section.key)) return false;
        return [section.label, section.description, section.status].some(
            matchesSearch,
        );
    });
});

const quickSections = computed(() => {
    if (searchTerm.value.trim()) return [];
    return filteredSections.value.filter((section) =>
        QUICK_KEYS[activeFilter.value]?.includes(section.key),
    );
});

const activeFilterLabel = computed(
    () =>
        filters.find((filter) => filter.key === activeFilter.value)?.label ??
        'Selected',
);

const listSections = computed(() => {
    const quickKeys = new Set(
        quickSections.value.map((section) => section.key),
    );
    return filteredSections.value.filter(
        (section) => !quickKeys.has(section.key),
    );
});

// Field-level search across every section. Matches by label, description, or
// the underlying JSON/code key. Limited to a sane number of results so the
// list never overwhelms the page.
const FIELD_MATCH_LIMIT = 25;
const fieldMatches = computed(() => {
    const query = searchTerm.value.trim().toLowerCase();
    if (!query) return [];
    const sectionLookup = new Map(
        sections.value.map((section) => [section.key, section]),
    );
    const allowedSectionKeys = FILTER_MAP[activeFilter.value];
    const results: Array<{
        sectionKey: string;
        sectionLabel: string;
        field: (typeof fieldsBySection.value)[string][number];
    }> = [];
    for (const [sectionKey, sectionFields] of Object.entries(
        fieldsBySection.value,
    )) {
        if (allowedSectionKeys && !allowedSectionKeys.includes(sectionKey))
            continue;
        const sectionLabel = sectionLookup.get(sectionKey)?.label ?? sectionKey;
        for (const field of sectionFields) {
            const haystack = [
                field.label,
                field.description,
                field.key,
                field.placeholder,
                field.emptyHint,
            ]
                .map((value) => String(value ?? '').toLowerCase())
                .join(' \u0001 ');
            if (haystack.includes(query)) {
                results.push({ sectionKey, sectionLabel, field });
                if (results.length >= FIELD_MATCH_LIMIT) return results;
            }
        }
    }
    return results;
});

function openSection(sectionKey: string) {
    void router.push(`/settings/${encodeURIComponent(sectionKey)}`);
}

type SettingsGroup = (typeof groups)[number];

function onGroupClick(group: SettingsGroup) {
    // Always update the active filter so the chips, highlights, and "All settings"
    // list reflect the user's intent.
    activeFilter.value = group.key;
    // If this group has a dedicated landing page, navigate there.
    if (group.route) {
        void router.push(group.route);
        return;
    }
    // Otherwise, scroll the highlights/list into view so it's clear something happened.
    nextTick(() => {
        const el = document.getElementById('settings-highlights');
        el?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
}

onMounted(async () => {
    await loadSections();
    // Build the searchable field index in the background. Errors here are
    // non-fatal; section-level search still works without it.
    void loadAllFields().catch(() => null);
});
</script>
