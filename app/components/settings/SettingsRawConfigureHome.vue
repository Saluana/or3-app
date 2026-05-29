<template>
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
                            Super Advanced Settings
                        </p>
                        <p class="mt-1 text-xs leading-5 text-amber-800/85">
                            Raw config keys for debugging, hosting, and custom
                            setups. Most people should use
                            <NuxtLink
                                to="/settings/advanced"
                                class="font-semibold underline"
                                >Advanced Settings</NuxtLink
                            >.
                        </p>
                    </div>
                </div>
            </SurfaceCard>

            <SettingsConnectionBlock unpaired-layout="compact" />

            <SurfaceCard class-name="space-y-3">
                <div class="flex items-start gap-3">
                    <Icon
                        name="i-pixelarticons-monitor"
                        class="mt-0.5 size-5 shrink-0 text-(--or3-green)"
                    />
                    <div class="min-w-0 flex-1">
                        <p
                            class="font-mono text-base font-semibold text-(--or3-text)"
                        >
                            Observability
                        </p>
                        <p
                            class="mt-1 text-sm leading-6 text-(--or3-text-muted)"
                        >
                            Open live app events, trace IDs, and paired-host
                            service logs on a dedicated page.
                        </p>
                    </div>
                </div>
                <div class="flex items-center justify-end">
                    <UButton
                        label="Open observability"
                        icon="i-pixelarticons-chevron-right"
                        color="neutral"
                        variant="soft"
                        size="sm"
                        to="/settings/observability"
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
                            <div
                                v-if="metadataFor(match.sectionKey, match.field.key)"
                                class="mt-2 flex flex-wrap items-center gap-2"
                            >
                                <StatusPill
                                    :label="metadataFor(match.sectionKey, match.field.key)?.risk_level || 'metadata'"
                                    :tone="riskTone(metadataFor(match.sectionKey, match.field.key)?.risk_level)"
                                />
                                <span
                                    v-if="metadataFor(match.sectionKey, match.field.key)?.restart_required"
                                    class="font-mono text-[11px] text-amber-700"
                                >
                                    restart required
                                </span>
                                <NuxtLink
                                    v-if="metadataFor(match.sectionKey, match.field.key)?.user_intents?.length"
                                    to="/settings/health"
                                    class="rounded-full border border-(--or3-border) px-2 py-0.5 font-mono text-[11px] text-(--or3-green-dark)"
                                    @click.stop
                                >
                                    Ask Admin Assistant to change this
                                </NuxtLink>
                            </div>
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
                to="/settings/advanced"
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
                        Back to Advanced Settings
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
</template>

<script setup lang="ts">
import { nextTick, onMounted, ref } from 'vue';
import { useRouter } from 'vue-router';
import { useConfigure } from '~/composables/useConfigure';
import {
    iconForRawConfigureSection,
    RAW_CONFIGURE_FILTERS,
    RAW_CONFIGURE_GROUPS,
    riskToneForField,
    useSettingsRawConfigureSearch,
    type RawConfigureFilterKey,
} from '~/composables/settings/useSettingsRawConfigureSearch';

const router = useRouter();
const searchTerm = ref('');
const activeFilter = ref<RawConfigureFilterKey>('connection');

const configure = useConfigure();
const {
    configureError,
    loadSections,
    allFieldsLoading,
    loadAllFields,
    loadMetadata,
    metadataFor,
} = configure;

const {
    quickSections,
    activeFilterLabel,
    listSections,
    fieldMatches,
} = useSettingsRawConfigureSearch(configure, searchTerm, activeFilter);

const filters = RAW_CONFIGURE_FILTERS;
const groups = RAW_CONFIGURE_GROUPS;

function iconFor(key: string) {
    return iconForRawConfigureSection(key);
}

function riskTone(risk?: string) {
    return riskToneForField(risk);
}

function openSection(sectionKey: string) {
    void router.push(`/settings/${encodeURIComponent(sectionKey)}`);
}

type SettingsGroup = (typeof groups)[number];

function onGroupClick(group: SettingsGroup) {
    activeFilter.value = group.key;
    if (group.route) {
        void router.push(group.route);
        return;
    }
    nextTick(() => {
        const el = document.getElementById('settings-highlights');
        el?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
}

onMounted(async () => {
    await loadSections();
    void loadMetadata().catch(() => null);
    void loadAllFields().catch(() => null);
});
</script>
