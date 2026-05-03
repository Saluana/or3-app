<template>
  <div class="or3-fb-toolbar">
    <!-- Row 1: back, breadcrumbs, search toggle, settings -->
    <div class="or3-fb-row">
      <button
        type="button"
        class="or3-fb-icon-btn or3-focus-ring"
        :disabled="!canGoBack"
        :aria-label="canGoBack ? 'Go up one folder' : 'Already at top level'"
        @click="emit('back')"
      >
        <Icon name="i-pixelarticons-arrow-left" class="size-4" />
      </button>

      <!-- Compact root selector + breadcrumbs -->
      <div class="or3-fb-pathwrap">
        <UDropdownMenu :items="rootMenuItems" :content="{ align: 'start', sideOffset: 6 }">
          <button
            type="button"
            class="or3-fb-rootbtn or3-focus-ring h-8"
            :aria-label="`Switch area, current: ${activeRoot?.label || 'unknown'}`"
          >
            <Icon name="i-pixelarticons-device-laptop" class="size-3.5 shrink-0" />
            <span class="truncate or3-fb-rootlabel">{{ activeRoot?.label || 'Area' }}</span>
            <Icon name="i-pixelarticons-chevron-down" class="size-3.5 shrink-0 opacity-70" />
          </button>
        </UDropdownMenu>

        <FileBreadcrumbs
          class="or3-fb-crumbs"
          :path="currentPath"
          :root-label="activeRoot?.label || 'Root'"
          @navigate="(path) => emit('navigate', path)"
        />
      </div>

      <button
        type="button"
        class="or3-fb-icon-btn or3-focus-ring"
        :class="{ 'is-active': searchOpen }"
        aria-label="Search files"
        @click="emit('toggle-search')"
      >
        <Icon name="i-pixelarticons-search" class="size-4" />
      </button>

      <UDropdownMenu :items="overflowItems" :content="{ align: 'end', sideOffset: 6 }">
        <button
          type="button"
          class="or3-fb-icon-btn or3-focus-ring"
          aria-label="More actions"
        >
          <Icon name="i-pixelarticons-more-horizontal" class="size-4" />
        </button>
      </UDropdownMenu>
    </div>

    <!-- Row 2: search bar (collapsible) -->
    <Transition name="or3-fb-fade">
      <div v-if="searchOpen" class="or3-fb-searchrow">
        <div class="or3-fb-searchmodes" role="tablist" aria-label="Search mode">
          <button
            v-for="mode in modes"
            :key="mode.id"
            type="button"
            role="tab"
            class="or3-fb-modebtn"
            :class="{ 'is-active': searchMode === mode.id }"
            :aria-selected="searchMode === mode.id"
            @click="emit('update:searchMode', mode.id)"
          >
            <Icon :name="mode.icon" class="size-3.5" />
            <span>{{ mode.label }}</span>
          </button>
        </div>

        <UInput
          ref="searchInputRef"
          :model-value="searchQuery"
          class="or3-fb-searchinput"
          :placeholder="searchPlaceholder"
          :loading="searchingFiles"
          icon="i-pixelarticons-search"
          @update:model-value="(value: string | number) => emit('update:searchQuery', String(value))"
          @keydown.enter.prevent="emit('submit-search')"
          @keydown.escape.prevent="emit('toggle-search')"
        />

        <UButton
          v-if="searchQuery"
          icon="i-pixelarticons-close"
          color="neutral"
          variant="ghost"
          size="sm"
          aria-label="Clear search"
          @click="emit('clear-search')"
        />
      </div>
    </Transition>
  </div>
</template>

<script setup lang="ts">
import { computed, nextTick, ref, watch } from 'vue'
import type { FileRoot } from '~/types/or3-api'

type SearchMode = 'folder' | 'path'

const props = withDefaults(defineProps<{
  roots: FileRoot[]
  activeRoot: FileRoot | null
  currentPath: string
  searchOpen: boolean
  searchQuery: string
  searchMode: SearchMode
  searchingFiles: boolean
  isWritableRoot: boolean
}>(), {
  searchOpen: false,
  searchingFiles: false,
  isWritableRoot: false,
})

const emit = defineEmits<{
  back: []
  navigate: [path: string]
  'switch-root': [rootId: string]
  'toggle-search': []
  'update:searchQuery': [value: string]
  'update:searchMode': [mode: SearchMode]
  'submit-search': []
  'clear-search': []
  upload: []
  'new-folder': []
  refresh: []
  'open-terminal': []
  'open-memory-tools': []
}>()

const searchInputRef = ref<{ inputRef?: HTMLInputElement } | null>(null)

const canGoBack = computed(() => props.currentPath !== '.' && props.currentPath !== '')

const modes: Array<{ id: SearchMode; label: string; icon: string }> = [
  { id: 'folder', label: 'Here', icon: 'i-pixelarticons-folder' },
  { id: 'path', label: 'Path', icon: 'i-pixelarticons-file-alt' },
]

const searchPlaceholder = computed(() =>
  props.searchMode === 'path'
    ? 'Type a full path, e.g. internal/uxstate/uxstate.go'
    : `Search in ${props.activeRoot?.label || 'this area'}…`,
)

const rootMenuItems = computed(() => [
  props.roots.map((root) => ({
    label: root.label,
    icon: root.id === props.activeRoot?.id ? 'i-pixelarticons-check' : 'i-pixelarticons-folder',
    onSelect: () => emit('switch-root', root.id),
  })),
])

const overflowItems = computed(() => [
  [
    {
      label: 'Upload files',
      icon: 'i-pixelarticons-upload',
      disabled: !props.isWritableRoot,
      onSelect: () => emit('upload'),
    },
    {
      label: 'New folder',
      icon: 'i-pixelarticons-folder-plus',
      disabled: !props.isWritableRoot,
      onSelect: () => emit('new-folder'),
    },
  ],
  [
    {
      label: 'Refresh',
      icon: 'i-pixelarticons-reload',
      onSelect: () => emit('refresh'),
    },
    {
      label: 'Open terminal here',
      icon: 'i-pixelarticons-terminal',
      onSelect: () => emit('open-terminal'),
    },
  ],
  [
    {
      label: 'Memory tools',
      icon: 'i-pixelarticons-database',
      onSelect: () => emit('open-memory-tools'),
    },
  ],
])

// Auto-focus search field when it becomes visible
watch(
  () => props.searchOpen,
  async (open) => {
    if (!open) return
    await nextTick()
    searchInputRef.value?.inputRef?.focus()
  },
)
</script>

<style scoped>
.or3-fb-toolbar {
  position: sticky;
  top: calc(var(--or3-safe-top) + 0.25rem);
  z-index: 20;
  border-radius: 1.25rem;
  border: 1px solid var(--or3-border);
  background: color-mix(in srgb, var(--or3-surface) 92%, white 8%);
  backdrop-filter: blur(10px);
  box-shadow: 0 1px 0 rgba(255, 255, 255, 0.65) inset, 0 6px 16px rgba(42, 35, 25, 0.05);
  padding: 0.4rem 0.5rem;
  display: flex;
  flex-direction: column;
  gap: 0.4rem;
}

.or3-fb-row {
  display: flex;
  align-items: center;
  gap: 0.4rem;
  min-width: 0;
}

.or3-fb-pathwrap {
  display: flex;
  align-items: center;
  gap: 0.35rem;
  min-width: 0;
  flex: 1 1 auto;
  overflow: hidden;
}

.or3-fb-rootbtn {
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
  max-width: 9rem;
  padding: 0.32rem 0.55rem;
  border-radius: 0.75rem;
  background: var(--or3-surface-soft);
  border: 1px solid var(--or3-border);
  font-size: 0.78rem;
  font-weight: 500;
  color: var(--or3-text);
}
.or3-fb-rootbtn:hover { background: color-mix(in srgb, var(--or3-green-soft) 50%, var(--or3-surface-soft)); }
.or3-fb-rootbtn span { white-space: nowrap; }

.or3-fb-crumbs {
  flex: 1 1 auto;
  min-width: 0;
}

.or3-fb-icon-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 2rem;
  height: 2rem;
  flex-shrink: 0;
  border-radius: 0.75rem;
  color: var(--or3-text-muted);
  background: transparent;
  border: 1px solid transparent;
  transition: background 140ms ease, color 140ms ease, border-color 140ms ease;
}
.or3-fb-icon-btn:hover:not(:disabled) {
  background: color-mix(in srgb, var(--or3-green-soft) 50%, transparent);
  color: var(--or3-text);
  border-color: color-mix(in srgb, var(--or3-green) 22%, transparent);
}
.or3-fb-icon-btn:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}
.or3-fb-icon-btn.is-active {
  background: var(--or3-green-soft);
  color: var(--or3-green-dark, var(--or3-text));
  border-color: color-mix(in srgb, var(--or3-green) 30%, transparent);
}

.or3-fb-searchrow {
  display: flex;
  align-items: center;
  gap: 0.4rem;
  padding: 0.15rem 0.1rem 0.1rem;
  min-width: 0;
}

.or3-fb-searchinput {
  flex: 1 1 auto;
  min-width: 0;
}

.or3-fb-searchmodes {
  display: inline-flex;
  align-items: center;
  padding: 2px;
  border-radius: 0.75rem;
  background: var(--or3-surface-soft);
  border: 1px solid var(--or3-border);
  flex-shrink: 0;
}
.or3-fb-modebtn {
  display: inline-flex;
  align-items: center;
  gap: 0.3rem;
  padding: 0.28rem 0.55rem;
  border-radius: 0.6rem;
  font-size: 0.74rem;
  font-weight: 500;
  color: var(--or3-text-muted);
  background: transparent;
  white-space: nowrap;
  transition: background 140ms ease, color 140ms ease;
}
.or3-fb-modebtn:hover:not(.is-active) { color: var(--or3-text); }
.or3-fb-modebtn.is-active {
  background: var(--or3-surface);
  color: var(--or3-green-dark, var(--or3-text));
  box-shadow: 0 1px 0 rgba(255, 255, 255, 0.7) inset, 0 1px 2px rgba(42, 35, 25, 0.06);
}

@media (max-width: 480px) {
  .or3-fb-modebtn { padding: 0.28rem 0.5rem; font-size: 0.7rem; }
  .or3-fb-rootbtn { max-width: 4.5rem; padding: 0.32rem 0.45rem; }
  .or3-fb-rootbtn .or3-fb-rootlabel { display: none; }
}

/* Fade transition for search row */
.or3-fb-fade-enter-active,
.or3-fb-fade-leave-active {
  transition: opacity 140ms ease, transform 140ms ease;
}
.or3-fb-fade-enter-from,
.or3-fb-fade-leave-to {
  opacity: 0;
  transform: translateY(-4px);
}
</style>
