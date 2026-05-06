<template>
    <USlideover
        :open="open"
        :side="side"
        :ui="{ content: contentClass }"
        @update:open="emit('update:open', $event)"
    >
        <template #content>
            <div
                ref="sheetRef"
                class="or3-cwd-sheet"
                :class="side === 'bottom' ? 'is-bottom' : 'is-side'"
            >
                <!-- Drag handle on mobile -->
                <div
                    v-if="side === 'bottom'"
                    ref="handleRef"
                    class="or3-cwd-handle"
                    aria-label="Drag down to close"
                    role="button"
                    tabindex="0"
                >
                    <span />
                </div>

                <!-- Header -->
                <header class="or3-cwd-head">
                    <div class="or3-cwd-head__main">
                        <span class="or3-cwd-head__icon">
                            <Icon
                                name="i-pixelarticons-folder"
                                class="size-5"
                            />
                        </span>
                        <div class="or3-cwd-head__text">
                            <p class="or3-label or3-cwd-head__eyebrow">
                                WORKING DIRECTORY
                            </p>
                            <h2 class="or3-cwd-head__title">Choose a folder</h2>
                            <p class="or3-cwd-head__subtitle">
                                Pick where the external CLI agent will run.
                            </p>
                        </div>
                    </div>
                    <UButton
                        color="neutral"
                        variant="ghost"
                        icon="i-pixelarticons-close"
                        size="sm"
                        square
                        aria-label="Close"
                        class="or3-cwd-head__close"
                        @click="emit('update:open', false)"
                    />
                </header>

                <!-- Body -->
                <div class="or3-cwd-body">
                    <!-- Path field -->
                    <div class="or3-cwd-field">
                        <label
                            for="or3-cwd-path-input"
                            class="or3-label or3-cwd-field__label"
                            >CURRENT PATH</label
                        >
                        <UInput
                            id="or3-cwd-path-input"
                            v-model="draftPath"
                            placeholder="e.g. /workspace/my-project"
                            icon="i-pixelarticons-folder"
                            size="md"
                            class="or3-cwd-field__input"
                            :ui="{
                                base: 'font-mono !ps-[3.35rem] !pe-[3.2rem]',
                            }"
                            @keydown.enter.prevent="applyDraftPath"
                        >
                            <template #trailing>
                                <UButton
                                    color="neutral"
                                    variant="ghost"
                                    size="xs"
                                    icon="i-pixelarticons-arrow-right"
                                    square
                                    aria-label="Go to path"
                                    class="or3-cwd-field__go"
                                    @click="applyDraftPath"
                                />
                            </template>
                        </UInput>
                    </div>

                    <!-- Breadcrumbs -->
                    <div
                        class="or3-cwd-crumbs"
                        role="navigation"
                        aria-label="Folder breadcrumbs"
                    >
                        <template v-if="atRootList">
                            <Icon
                                name="i-pixelarticons-device-laptop"
                                class="or3-cwd-crumbs__home-icon"
                            />
                            <span class="or3-cwd-crumbs__home-label"
                                >Approved areas</span
                            >
                        </template>
                        <template v-else>
                            <button
                                type="button"
                                class="or3-cwd-crumbs__chip"
                                @click="navigateToRoot"
                            >
                                <Icon
                                    name="i-pixelarticons-device-laptop"
                                    class="size-3.5"
                                />
                                <span class="truncate">{{
                                    currentRootLabel
                                }}</span>
                            </button>
                            <span
                                v-for="(part, i) in breadcrumbParts"
                                :key="part.path"
                                class="or3-cwd-crumbs__item"
                            >
                                <Icon
                                    name="i-pixelarticons-chevron-right"
                                    class="or3-cwd-crumbs__sep"
                                />
                                <button
                                    type="button"
                                    class="or3-cwd-crumbs__chip"
                                    :class="{
                                        'is-active':
                                            i === breadcrumbParts.length - 1,
                                    }"
                                    @click="navigateToBreadcrumb(i)"
                                >
                                    <span class="truncate">{{
                                        part.name
                                    }}</span>
                                </button>
                            </span>
                        </template>
                    </div>

                    <!-- Current-level search -->
                    <UInput
                        v-model="searchQuery"
                        :placeholder="
                            atRootList
                                ? 'Search approved areas'
                                : 'Search current folder'
                        "
                        icon="i-pixelarticons-search"
                        size="md"
                        class="or3-cwd-search"
                        :ui="{
                            base: 'font-mono !ps-[3.35rem] !pe-[3.2rem]',
                        }"
                    >
                        <template #trailing>
                            <UButton
                                v-if="searchQuery"
                                color="neutral"
                                variant="ghost"
                                size="xs"
                                icon="i-pixelarticons-close"
                                square
                                aria-label="Clear search"
                                class="or3-cwd-search__clear"
                                @click="clearSearch"
                            />
                        </template>
                    </UInput>

                    <!-- List card -->
                    <div class="or3-cwd-list">
                        <!-- Loading -->
                        <div v-if="loading" class="or3-cwd-empty">
                            <Icon
                                name="i-pixelarticons-loader"
                                class="size-5 animate-spin text-(--or3-text-muted)"
                            />
                            <p class="or3-cwd-empty__text">Loading…</p>
                        </div>

                        <!-- Error -->
                        <div v-else-if="error" class="or3-cwd-empty">
                            <Icon
                                name="i-pixelarticons-alert"
                                class="size-5 text-(--or3-red)"
                            />
                            <p class="or3-cwd-empty__text text-(--or3-red)">
                                {{ error }}
                            </p>
                        </div>

                        <!-- Root list -->
                        <template v-else-if="atRootList">
                            <div
                                v-if="roots.length === 0"
                                class="or3-cwd-empty"
                            >
                                <Icon
                                    name="i-pixelarticons-folder-x"
                                    class="size-5 text-(--or3-text-muted)"
                                />
                                <p class="or3-cwd-empty__text">
                                    No approved areas available.
                                </p>
                            </div>
                            <div
                                v-else-if="filteredRoots.length === 0"
                                class="or3-cwd-empty"
                            >
                                <Icon
                                    name="i-pixelarticons-search"
                                    class="size-5 text-(--or3-text-muted)"
                                />
                                <p class="or3-cwd-empty__text">
                                    No matching approved areas.
                                </p>
                            </div>
                            <button
                                v-for="root in filteredRoots"
                                v-else
                                :key="root.id"
                                type="button"
                                class="or3-cwd-row or3-cwd-row--root"
                                @click="openRoot(root)"
                            >
                                <span
                                    class="or3-cwd-row__icon or3-cwd-row__icon--accent"
                                >
                                    <Icon
                                        name="i-pixelarticons-folder"
                                        class="size-4"
                                    />
                                </span>
                                <div class="or3-cwd-row__text">
                                    <p class="or3-cwd-row__title">
                                        {{ root.label }}
                                    </p>
                                    <p class="or3-cwd-row__meta">
                                        {{ root.path || root.id }}
                                    </p>
                                </div>
                                <Icon
                                    name="i-pixelarticons-chevron-right"
                                    class="or3-cwd-row__chev"
                                />
                            </button>
                        </template>

                        <!-- Directory list -->
                        <template v-else>
                            <div
                                v-if="directoryEntries.length === 0"
                                class="or3-cwd-empty"
                            >
                                <Icon
                                    name="i-pixelarticons-folder"
                                    class="size-5 text-(--or3-text-muted)"
                                />
                                <p class="or3-cwd-empty__text">
                                    This folder has no sub-folders.
                                </p>
                            </div>
                            <div
                                v-else-if="visibleDirectoryEntries.length === 0"
                                class="or3-cwd-empty"
                            >
                                <Icon
                                    name="i-pixelarticons-search"
                                    class="size-5 text-(--or3-text-muted)"
                                />
                                <p class="or3-cwd-empty__text">
                                    No matching folders in this directory.
                                </p>
                            </div>
                            <button
                                v-for="entry in visibleDirectoryEntries"
                                v-else
                                :key="entry.path"
                                type="button"
                                class="or3-cwd-row"
                                @click="onEntryOpen(entry)"
                            >
                                <span class="or3-cwd-row__icon">
                                    <Icon
                                        name="i-pixelarticons-folder"
                                        class="size-4"
                                    />
                                </span>
                                <div class="or3-cwd-row__text">
                                    <p class="or3-cwd-row__title font-mono">
                                        {{ entry.name }}
                                    </p>
                                </div>
                                <Icon
                                    name="i-pixelarticons-chevron-right"
                                    class="or3-cwd-row__chev"
                                />
                            </button>
                        </template>
                    </div>
                </div>

                <!-- Footer -->
                <footer class="or3-cwd-foot">
                    <div
                        class="or3-cwd-foot__selected"
                        :class="{ 'is-empty': !previewPath }"
                        :title="previewPath || 'No folder selected'"
                    >
                        <span class="or3-cwd-foot__selected-label"
                            >SELECTED</span
                        >
                        <Icon
                            name="i-pixelarticons-folder"
                            class="or3-cwd-foot__selected-icon"
                        />
                        <span
                            class="or3-cwd-foot__selected-path truncate font-mono"
                        >
                            {{ previewPath || 'Tap a folder to select' }}
                        </span>
                    </div>
                    <div class="or3-cwd-foot__actions">
                        <UButton
                            v-if="!atRootList"
                            color="neutral"
                            variant="soft"
                            icon="i-pixelarticons-arrow-up"
                            size="md"
                            label="Up"
                            class="or3-cwd-foot__btn-up"
                            @click="navigateUp"
                        />
                        <UButton
                            color="primary"
                            variant="solid"
                            size="md"
                            :icon="
                                atRootList
                                    ? 'i-pixelarticons-check'
                                    : 'i-pixelarticons-check-double'
                            "
                            :label="
                                atRootList ? 'Open area' : 'Use this folder'
                            "
                            :disabled="!canSelect"
                            class="or3-cwd-foot__btn-primary"
                            @click="selectCurrent"
                        />
                    </div>
                </footer>
            </div>
        </template>
    </USlideover>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import type { FileEntry, FileListResponse, FileRoot } from '~/types/or3-api';
import { useOr3Api } from '~/composables/useOr3Api';
import { useAuthSession } from '~/composables/useAuthSession';
import { useIsDesktop } from '~/composables/useViewport';
import { useSheetSwipeDismiss } from '~/composables/useSheetSwipeDismiss';

const props = defineProps<{
    open: boolean;
    initialPath?: string;
}>();

const emit = defineEmits<{
    'update:open': [value: boolean];
    select: [path: string];
}>();

const api = useOr3Api();
const authSession = useAuthSession();
const isDesktop = useIsDesktop();

const side = computed<'bottom' | 'right'>(() =>
    isDesktop.value ? 'right' : 'bottom',
);
const contentClass = computed(() =>
    side.value === 'bottom'
        ? // Fixed height on mobile so the sheet doesn't grow/shrink as the inner
          // list and breadcrumbs change between root view and folder view.
          'or3-fb-sheet-shell or3-fb-sheet-shell--bottom h-[88dvh] rounded-t-3xl'
        : 'or3-fb-sheet-shell or3-fb-sheet-shell--side sm:max-w-lg',
);

const sheetRef = ref<HTMLElement | null>(null);
const handleRef = ref<HTMLElement | null>(null);
const swipeEnabled = computed(() => props.open && side.value === 'bottom');
useSheetSwipeDismiss({
    handle: handleRef,
    sheet: sheetRef,
    enabled: swipeEnabled,
    onDismiss: () => emit('update:open', false),
});

// Local state (not shared with the main file browser)
const roots = ref<FileRoot[]>([]);
const entries = ref<FileEntry[]>([]);
const currentRootId = ref('');
const currentPath = ref('.');
const loading = ref(false);
const error = ref<string | null>(null);
const draftPath = ref('');
const searchQuery = ref('');

const atRootList = computed(() => currentRootId.value === '');

const currentRoot = computed(() =>
    roots.value.find((r) => r.id === currentRootId.value),
);

const currentRootLabel = computed(
    () => currentRoot.value?.label ?? currentRootId.value,
);

const directoryEntries = computed(() =>
    entries.value.filter((e) => e.type === 'directory'),
);

const normalizedSearch = computed(() => searchQuery.value.trim().toLowerCase());

const filteredRoots = computed(() => {
    const query = normalizedSearch.value;
    if (!query) return roots.value;
    return roots.value.filter((root) =>
        [root.label, root.path, root.id].some((value) =>
            (value ?? '').toLowerCase().includes(query),
        ),
    );
});

const visibleDirectoryEntries = computed(() => {
    const query = normalizedSearch.value;
    if (!query) return directoryEntries.value;
    return directoryEntries.value.filter((entry) =>
        [entry.name, entry.path].some((value) =>
            (value ?? '').toLowerCase().includes(query),
        ),
    );
});

const breadcrumbParts = computed(() => {
    if (currentPath.value === '.' || currentPath.value === '') return [];
    const parts = currentPath.value.split('/').filter(Boolean);
    return parts.map((name, i) => ({
        name,
        path: parts.slice(0, i + 1).join('/'),
    }));
});

const canSelect = computed(() => {
    if (atRootList.value) return roots.value.length > 0;
    return currentRoot.value != null;
});

const previewPath = computed(() => buildFullPath());

async function loadRoots() {
    loading.value = true;
    error.value = null;
    try {
        const response = await authSession.retryWithAuth(
            (onAuthChallenge) =>
                api.request<{ items?: FileRoot[] } | FileRoot[]>(
                    '/internal/v1/files/roots',
                    {
                        onAuthChallenge,
                    },
                ),
            'files-browse',
        );
        roots.value = Array.isArray(response)
            ? response
            : (response.items ?? []);
    } catch (err: any) {
        roots.value = [];
        error.value = err?.message ?? 'Could not load approved areas.';
    } finally {
        loading.value = false;
    }
}

function sortEntries(items: FileEntry[]) {
    return [...items].sort((left, right) => {
        if (left.type !== right.type) return left.type === 'directory' ? -1 : 1;
        return left.name.localeCompare(right.name, undefined, {
            numeric: true,
            sensitivity: 'base',
        });
    });
}

async function listDirectory(rootId: string, path: string) {
    loading.value = true;
    error.value = null;
    try {
        const params = new URLSearchParams({ root_id: rootId, path });
        const response = await authSession.retryWithAuth(
            (onAuthChallenge) =>
                api.request<FileListResponse>(
                    `/internal/v1/files/list?${params.toString()}`,
                    {
                        onAuthChallenge,
                    },
                ),
            'files-browse',
        );
        entries.value = sortEntries(response.entries ?? []);
        currentPath.value = response.path || path;
    } catch (err: any) {
        entries.value = [];
        error.value = err?.message ?? 'Could not open that folder.';
    } finally {
        loading.value = false;
    }
}

function openRoot(root: FileRoot) {
    clearSearch();
    currentRootId.value = root.id;
    currentPath.value = '.';
    listDirectory(root.id, '.');
    syncDraftFromNav();
}

function navigateToRoot() {
    clearSearch();
    currentRootId.value = '';
    currentPath.value = '.';
    entries.value = [];
    error.value = null;
    syncDraftFromNav();
}

function navigateUp() {
    if (atRootList.value) return;
    clearSearch();
    const parts = breadcrumbParts.value;
    if (parts.length === 0) {
        navigateToRoot();
        return;
    }
    if (parts.length === 1) {
        currentPath.value = '.';
        listDirectory(currentRootId.value, '.');
    } else {
        const target = parts[parts.length - 2];
        if (!target) return;
        currentPath.value = target.path;
        listDirectory(currentRootId.value, target.path);
    }
    syncDraftFromNav();
}

function onEntryOpen(entry: FileEntry) {
    if (entry.type !== 'directory') return;
    clearSearch();
    currentPath.value = entry.path;
    listDirectory(currentRootId.value, entry.path);
    syncDraftFromNav();
}

function navigateToBreadcrumb(index: number) {
    const parts = breadcrumbParts.value;
    if (index < 0 || index >= parts.length) return;
    const part = parts[index];
    if (!part) return;
    clearSearch();
    currentPath.value = part.path;
    listDirectory(currentRootId.value, part.path);
    syncDraftFromNav();
}

function clearSearch() {
    searchQuery.value = '';
}

function syncDraftFromNav() {
    draftPath.value = buildFullPath();
}

function buildFullPath(): string {
    if (atRootList.value) return '';
    const rootPath = currentRoot.value?.path;
    if (!rootPath) return currentPath.value === '.' ? '' : currentPath.value;
    if (currentPath.value === '.' || currentPath.value === '') return rootPath;
    // Strip a trailing slash from the root (e.g. Computer = "/") so we don't
    // produce paths like "//bin" when joining the relative segment.
    const base = rootPath.endsWith('/') ? rootPath.slice(0, -1) : rootPath;
    return base + '/' + currentPath.value;
}

async function applyDraftPath() {
    const raw = draftPath.value.trim();
    clearSearch();
    if (!raw) {
        navigateToRoot();
        return;
    }

    for (const root of roots.value) {
        if (!root.path) continue;
        const base = root.path.endsWith('/')
            ? root.path.slice(0, -1)
            : root.path;
        // Special-case the Computer root whose path is "/" so that any
        // absolute path matches it without producing "//" in the prefix.
        const matchesRoot =
            raw === root.path ||
            raw === base ||
            raw.startsWith(base + '/') ||
            (root.path === '/' && raw.startsWith('/'));
        if (!matchesRoot) continue;
        const relPath =
            raw === root.path || raw === base
                ? '.'
                : raw.slice(base.length + 1);
        currentRootId.value = root.id;
        currentPath.value = relPath || '.';
        await listDirectory(root.id, relPath || '.');
        return;
    }
}

function selectCurrent() {
    const path = buildFullPath();
    emit('select', path);
    emit('update:open', false);
}

watch(
    () => props.open,
    (isOpen) => {
        if (!isOpen) return;
        currentRootId.value = '';
        currentPath.value = '.';
        entries.value = [];
        draftPath.value = props.initialPath ?? '';
        searchQuery.value = '';
        loadRoots();
    },
    { immediate: true },
);
</script>

<style scoped>
/* ── Sheet shell ────────────────────────────────────────────────── */
.or3-cwd-sheet {
    display: flex;
    flex-direction: column;
    height: 100%;
    min-height: 0;
}

/* ── Drag handle (mobile) ───────────────────────────────────────── */
.or3-cwd-handle {
    display: flex;
    align-items: center;
    justify-content: center;
    height: 1.6rem;
    padding: 0.55rem 0 0.4rem;
    cursor: grab;
    touch-action: none;
    user-select: none;
    flex-shrink: 0;
}
.or3-cwd-handle:active {
    cursor: grabbing;
}
.or3-cwd-handle span {
    display: block;
    width: 2.6rem;
    height: 5px;
    border-radius: 999px;
    background: color-mix(in srgb, var(--or3-text-muted) 45%, transparent);
    transition:
        background 140ms ease,
        width 140ms ease;
}
.or3-cwd-handle:hover span {
    background: color-mix(in srgb, var(--or3-text-muted) 65%, transparent);
    width: 3rem;
}

/* ── Header ─────────────────────────────────────────────────────── */
.or3-cwd-head {
    display: flex;
    align-items: flex-start;
    gap: 0.75rem;
    padding: 1rem 1.25rem 0.9rem;
    border-bottom: 1px solid var(--or3-border);
    background: var(--or3-surface);
    flex-shrink: 0;
}
.or3-cwd-head__main {
    display: flex;
    align-items: flex-start;
    gap: 0.75rem;
    min-width: 0;
    flex: 1 1 auto;
}
.or3-cwd-head__icon {
    display: grid;
    place-items: center;
    width: 2.75rem;
    height: 2.75rem;
    flex-shrink: 0;
    border-radius: 1rem;
    background: var(--or3-green-soft);
    color: var(--or3-green-dark);
    border: 1px solid color-mix(in srgb, var(--or3-green) 18%, transparent);
}
.or3-cwd-head__text {
    min-width: 0;
    flex: 1 1 auto;
}
.or3-cwd-head__eyebrow {
    font-size: 10px;
    font-weight: 600;
    letter-spacing: 0.18em;
    color: var(--or3-text-muted);
}
.or3-cwd-head__title {
    margin-top: 0.2rem;
    font-family:
        ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
    font-size: 1.05rem;
    font-weight: 600;
    color: var(--or3-text);
    line-height: 1.2;
}
.or3-cwd-head__subtitle {
    margin-top: 0.25rem;
    font-size: 0.78rem;
    line-height: 1.45;
    color: var(--or3-text-muted);
}
.or3-cwd-head__close {
    flex-shrink: 0;
}

/* ── Body (flex column, no scroll — list scrolls) ──────────────── */
.or3-cwd-body {
    flex: 1 1 auto;
    min-height: 0;
    display: flex;
    flex-direction: column;
    gap: 0.85rem;
    padding: 0.9rem 1.25rem 0.4rem;
}

/* ── Path field ─────────────────────────────────────────────────── */
.or3-cwd-field {
    display: flex;
    flex-direction: column;
    gap: 0.4rem;
    flex-shrink: 0;
}
.or3-cwd-field__label {
    font-size: 10px;
    font-weight: 600;
    letter-spacing: 0.18em;
    color: var(--or3-text-muted);
}
.or3-cwd-field__input :deep([data-slot='leading']) {
    padding-inline-start: 1rem;
}
.or3-cwd-field__input :deep([data-slot='trailing']) {
    padding-inline-end: 0.95rem;
}
.or3-cwd-field__input :deep([data-slot='leadingIcon']) {
    width: 1.1rem;
    height: 1.1rem;
}
.or3-cwd-field__input :deep(input) {
    font-family:
        ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
}
.or3-cwd-field__input :deep(.or3-cwd-field__go) {
    min-width: 2.2rem;
    min-height: 2.2rem;
}

/* ── Breadcrumbs ────────────────────────────────────────────────── */
.or3-cwd-crumbs {
    display: flex;
    align-items: center;
    gap: 0.25rem;
    overflow-x: auto;
    padding: 0.15rem 0.1rem 0.35rem;
    flex-shrink: 0;
    scrollbar-width: thin;
}
.or3-cwd-crumbs::-webkit-scrollbar {
    height: 4px;
}
.or3-cwd-crumbs__item {
    display: inline-flex;
    align-items: center;
    gap: 0.25rem;
    flex-shrink: 0;
}
.or3-cwd-crumbs__home-icon {
    width: 1rem;
    height: 1rem;
    color: var(--or3-text-muted);
    flex-shrink: 0;
}
.or3-cwd-crumbs__home-label {
    font-size: 0.8rem;
    color: var(--or3-text-muted);
}
.or3-cwd-crumbs__sep {
    width: 0.7rem;
    height: 0.7rem;
    color: color-mix(in srgb, var(--or3-text-muted) 70%, transparent);
    flex-shrink: 0;
}
.or3-cwd-crumbs__chip {
    display: inline-flex;
    align-items: center;
    gap: 0.3rem;
    flex-shrink: 0;
    max-width: 12rem;
    padding: 0.3rem 0.55rem;
    border-radius: 0.55rem;
    font-size: 0.75rem;
    font-weight: 500;
    color: var(--or3-text-muted);
    background: transparent;
    transition:
        background 120ms ease,
        color 120ms ease;
}
.or3-cwd-crumbs__chip:hover {
    background: var(--or3-surface-soft);
    color: var(--or3-text);
}
.or3-cwd-crumbs__chip.is-active {
    background: var(--or3-green-soft);
    color: var(--or3-green-dark);
    font-weight: 600;
}

/* ── Search ─────────────────────────────────────────────────────── */
.or3-cwd-search {
    flex-shrink: 0;
}
.or3-cwd-search :deep([data-slot='leading']) {
    padding-inline-start: 1rem;
}
.or3-cwd-search :deep([data-slot='trailing']) {
    padding-inline-end: 0.95rem;
}
.or3-cwd-search :deep([data-slot='leadingIcon']) {
    width: 1.1rem;
    height: 1.1rem;
}
.or3-cwd-search :deep(input) {
    font-family:
        ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
}
.or3-cwd-search :deep(.or3-cwd-search__clear) {
    min-width: 2.2rem;
    min-height: 2.2rem;
}

/* ── List card ──────────────────────────────────────────────────── */
.or3-cwd-list {
    flex: 1 1 auto;
    min-height: 0;
    overflow-y: auto;
    border-radius: 1rem;
    border: 1px solid var(--or3-border);
    background: color-mix(in srgb, var(--or3-surface) 60%, white 40%);
}
.or3-cwd-list::-webkit-scrollbar {
    width: 6px;
}
.or3-cwd-list::-webkit-scrollbar-thumb {
    background: color-mix(in srgb, var(--or3-text-muted) 35%, transparent);
    border-radius: 999px;
}

/* Rows */
.or3-cwd-row {
    display: flex;
    width: 100%;
    align-items: center;
    gap: 0.75rem;
    padding: 0.7rem 0.85rem;
    border-bottom: 1px solid
        color-mix(in srgb, var(--or3-border) 70%, transparent);
    text-align: left;
    transition: background 120ms ease;
}
.or3-cwd-row:last-child {
    border-bottom: 0;
}
.or3-cwd-row:hover {
    background: color-mix(in srgb, var(--or3-green-soft) 55%, transparent);
}
.or3-cwd-row:focus-visible {
    outline: 2px solid var(--or3-green);
    outline-offset: -2px;
}
.or3-cwd-row__icon {
    display: grid;
    place-items: center;
    width: 2rem;
    height: 2rem;
    flex-shrink: 0;
    border-radius: 0.65rem;
    background: var(--or3-surface-soft);
    color: var(--or3-text-muted);
    border: 1px solid color-mix(in srgb, var(--or3-border) 80%, transparent);
}
.or3-cwd-row__icon--accent {
    background: color-mix(in srgb, var(--or3-green-soft) 90%, white 10%);
    color: var(--or3-green-dark);
    border-color: color-mix(in srgb, var(--or3-green) 22%, transparent);
}
.or3-cwd-row__text {
    min-width: 0;
    flex: 1 1 auto;
}
.or3-cwd-row__title {
    margin: 0;
    font-size: 0.85rem;
    font-weight: 500;
    color: var(--or3-text);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
}
.or3-cwd-row__meta {
    margin-top: 0.15rem;
    font-size: 0.7rem;
    color: var(--or3-text-muted);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    font-family:
        ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
}
.or3-cwd-row__chev {
    width: 1rem;
    height: 1rem;
    color: var(--or3-text-muted);
    flex-shrink: 0;
}
.or3-cwd-row--root {
    padding: 0.85rem;
}

/* Empty / loading */
.or3-cwd-empty {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 0.5rem;
    padding: 2.25rem 1rem;
    text-align: center;
}
.or3-cwd-empty__text {
    font-size: 0.8rem;
    color: var(--or3-text-muted);
    margin: 0;
}

/* ── Footer ─────────────────────────────────────────────────────── */
.or3-cwd-foot {
    display: flex;
    flex-direction: column;
    gap: 0.65rem;
    padding: 0.75rem 1.25rem calc(env(safe-area-inset-bottom, 0px) + 1rem);
    border-top: 1px solid var(--or3-border);
    background: color-mix(in srgb, var(--or3-surface) 80%, white 20%);
    flex-shrink: 0;
}
.or3-cwd-foot__selected {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    min-width: 0;
    padding: 0.45rem 0.65rem;
    border-radius: 0.7rem;
    background: var(--or3-surface-soft);
    border: 1px solid color-mix(in srgb, var(--or3-border) 80%, transparent);
    font-size: 0.78rem;
    color: var(--or3-text);
}
.or3-cwd-foot__selected.is-empty {
    background: color-mix(in srgb, var(--or3-surface-soft) 60%, transparent);
    color: var(--or3-text-muted);
}
.or3-cwd-foot__selected-label {
    font-size: 9px;
    font-weight: 700;
    letter-spacing: 0.2em;
    color: var(--or3-text-muted);
    flex-shrink: 0;
}
.or3-cwd-foot__selected-icon {
    width: 1rem;
    height: 1rem;
    color: var(--or3-green-dark);
    flex-shrink: 0;
}
.or3-cwd-foot__selected.is-empty .or3-cwd-foot__selected-icon {
    color: var(--or3-text-muted);
}
.or3-cwd-foot__selected-path {
    min-width: 0;
    flex: 1 1 auto;
    font-size: 0.78rem;
}
.or3-cwd-foot__actions {
    display: flex;
    gap: 0.5rem;
}
.or3-cwd-foot__btn-up {
    flex: 0 0 auto;
}
.or3-cwd-foot__btn-primary {
    flex: 1 1 auto;
    justify-content: center;
}
</style>
