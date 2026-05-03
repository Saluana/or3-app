<template>
  <USlideover
    :open="open"
    :side="side"
    :ui="{ content: contentClass }"
    @update:open="(value: boolean) => emit('update:open', value)"
  >
    <template #content>
      <div v-if="entry" ref="sheetRef" class="or3-fb-sheet" :class="side === 'bottom' ? 'is-bottom' : 'is-side'">
        <!-- Drag handle on mobile (also acts as the swipe-to-dismiss surface) -->
        <div
          v-if="side === 'bottom'"
          ref="handleRef"
          class="or3-fb-handle"
          aria-label="Drag down to close"
          role="button"
          tabindex="0"
        >
          <span />
        </div>

        <!-- Header -->
        <header class="or3-fb-sheet-head">
          <div class="flex min-w-0 flex-1 items-start gap-3">
            <span class="grid size-11 shrink-0 place-items-center rounded-2xl bg-white text-(--or3-green)">
              <Icon :name="iconName" class="size-5" />
            </span>
            <div class="min-w-0 flex-1">
              <p class="or3-display-title or3-display-title--sm truncate text-2xl text-(--or3-text)" :title="entry.name">
                {{ entry.name }}
              </p>
              <p class="mt-1 break-all text-xs text-(--or3-text-muted)" :title="entry.path">
                {{ areaLabel }}/{{ entry.path }}
              </p>
            </div>
          </div>
          <button
            type="button"
            class="or3-focus-ring grid size-9 shrink-0 place-items-center rounded-full text-(--or3-text-muted) hover:bg-(--or3-surface-soft) hover:text-(--or3-text)"
            aria-label="Close details"
            @click="emit('update:open', false)"
          >
            <Icon name="i-pixelarticons-close" class="size-4" />
          </button>
        </header>

        <!-- Body (scrollable) -->
        <div class="or3-fb-sheet-body">
          <!-- Info chips -->
          <section class="grid grid-cols-2 gap-2" aria-label="File summary">
            <div class="rounded-2xl border border-(--or3-border) bg-(--or3-surface-soft) px-3 py-2.5">
              <p class="font-mono text-[10px] font-semibold uppercase tracking-wider text-(--or3-text-muted)">Type</p>
              <p class="mt-1 truncate text-sm font-medium text-(--or3-text)">
                {{ entry.type === 'directory' ? 'Folder' : 'File' }}
              </p>
            </div>
            <div class="rounded-2xl border border-(--or3-border) bg-(--or3-surface-soft) px-3 py-2.5">
              <p class="font-mono text-[10px] font-semibold uppercase tracking-wider text-(--or3-text-muted)">Size</p>
              <p class="mt-1 truncate text-sm font-medium text-(--or3-text)">{{ sizeLabel }}</p>
            </div>
            <div class="rounded-2xl border border-(--or3-border) bg-(--or3-surface-soft) px-3 py-2.5">
              <p class="font-mono text-[10px] font-semibold uppercase tracking-wider text-(--or3-text-muted)">Updated</p>
              <p class="mt-1 truncate text-sm font-medium text-(--or3-text)">{{ updatedLabel }}</p>
            </div>
            <div class="rounded-2xl border border-(--or3-border) bg-(--or3-surface-soft) px-3 py-2.5">
              <p class="font-mono text-[10px] font-semibold uppercase tracking-wider text-(--or3-text-muted)">Area</p>
              <p class="mt-1 truncate text-sm font-medium text-(--or3-text)">{{ areaLabel }}</p>
            </div>
          </section>

          <!-- Action grid (compact icon tiles) -->
          <section class="grid grid-cols-3 gap-2 sm:grid-cols-5" aria-label="Actions">
            <button
              v-for="action in actions"
              :key="action.id"
              type="button"
              class="or3-fb-action or3-focus-ring"
              :disabled="action.loading"
              :aria-label="action.label"
              :title="action.label"
              @click="action.onSelect"
            >
              <Icon :name="action.icon" class="size-5" :class="action.loading ? 'animate-pulse' : ''" />
              <span class="mt-1 block truncate text-[11px] font-medium leading-tight">{{ action.label }}</span>
            </button>
          </section>

          <!-- Preview -->
          <section v-if="entry.type === 'file'" aria-label="Preview" class="or3-fb-preview-card">
            <header class="or3-fb-preview-head">
              <span class="font-mono text-[10px] font-semibold uppercase tracking-wider text-(--or3-text-muted)">Preview</span>
              <span v-if="preview.kind === 'text' && preview.text" class="text-[10px] text-(--or3-text-muted)">
                {{ preview.text.length.toLocaleString() }} chars
              </span>
            </header>
            <div class="or3-fb-preview-body">
              <div v-if="preview.loading" class="h-32 w-full rounded-xl bg-(--or3-surface-soft)" />
              <div v-else-if="preview.kind === 'image' && preview.url" class="grid place-items-center bg-white">
                <img :src="preview.url" :alt="entry.name" class="max-h-72 w-auto max-w-full object-contain" />
              </div>
              <pre
                v-else-if="preview.kind === 'text'"
                class="or3-fb-codeblock"
              >{{ preview.text }}</pre>
              <p v-else class="px-3 py-4 text-xs text-(--or3-text-muted)">
                {{ preview.message || 'Preview is not available for this file type yet.' }}
              </p>
            </div>
          </section>

          <p v-else class="rounded-2xl border border-dashed border-(--or3-border) bg-white/60 px-4 py-5 text-center text-sm leading-6 text-(--or3-text-muted)">
            Open this folder to browse inside it, or launch a terminal here if you want to work in it directly.
          </p>
        </div>
      </div>
    </template>
  </USlideover>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import type { FileEntry } from '~/types/or3-api'
import { useIsDesktop } from '~/composables/useViewport'
import { useSheetSwipeDismiss } from '~/composables/useSheetSwipeDismiss'

interface SheetAction {
  id: string
  label: string
  icon: string
  loading?: boolean
  onSelect: () => void
}

interface PreviewState {
  kind: 'empty' | 'text' | 'image' | 'unavailable'
  text: string
  url: string
  message: string
  loading: boolean
}

const props = withDefaults(defineProps<{
  open: boolean
  entry: FileEntry | null
  preview: PreviewState
  actions: SheetAction[]
  areaLabel: string
}>(), {
  areaLabel: '',
})

const emit = defineEmits<{
  'update:open': [value: boolean]
}>()

const isDesktop = useIsDesktop()
const side = computed<'bottom' | 'right'>(() => (isDesktop.value ? 'right' : 'bottom'))

const sheetRef = ref<HTMLElement | null>(null)
const handleRef = ref<HTMLElement | null>(null)
const swipeEnabled = computed(() => props.open && side.value === 'bottom')
useSheetSwipeDismiss({
  handle: handleRef,
  sheet: sheetRef,
  enabled: swipeEnabled,
  onDismiss: () => emit('update:open', false),
})

const contentClass = computed(() =>
  side.value === 'bottom'
    ? 'or3-fb-sheet-shell or3-fb-sheet-shell--bottom max-h-[88dvh] sm:max-h-[80dvh] rounded-t-3xl'
    : 'or3-fb-sheet-shell or3-fb-sheet-shell--side sm:max-w-md',
)

const iconName = computed(() => {
  if (!props.entry) return 'i-pixelarticons-file'
  if (props.entry.type === 'directory') return 'i-pixelarticons-folder'
  const mime = props.entry.mime_type || ''
  if (mime.includes('image')) return 'i-pixelarticons-image'
  if (props.entry.name.endsWith('.md')) return 'i-pixelarticons-file-text'
  return 'i-pixelarticons-file'
})

function formatBytes(size?: number) {
  if (!size) return ''
  if (size < 1024) return `${size} B`
  const units = ['KB', 'MB', 'GB', 'TB']
  let value = size / 1024
  let unitIndex = 0
  while (value >= 1024 && unitIndex < units.length - 1) {
    value /= 1024
    unitIndex += 1
  }
  const precision = value >= 10 ? 0 : 1
  return `${value.toFixed(precision)} ${units[unitIndex]}`
}

function formatDate(value?: string) {
  if (!value) return ''
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return date.toLocaleString()
}

const sizeLabel = computed(() => {
  if (!props.entry) return '—'
  if (props.entry.type === 'directory') return 'Folder'
  return formatBytes(props.entry.size) || 'Unknown'
})

const updatedLabel = computed(() => formatDate(props.entry?.modified_at) || 'Unknown')
</script>

<style scoped>
.or3-fb-sheet {
  display: flex;
  flex-direction: column;
  height: 100%;
  min-height: 0;
}

.or3-fb-handle {
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
.or3-fb-handle:active { cursor: grabbing; }
.or3-fb-handle span {
  display: block;
  width: 2.6rem;
  height: 5px;
  border-radius: 999px;
  background: color-mix(in srgb, var(--or3-text-muted) 45%, transparent);
  transition: background 140ms ease, width 140ms ease;
}
.or3-fb-handle:hover span { background: color-mix(in srgb, var(--or3-text-muted) 65%, transparent); width: 3rem; }

.or3-fb-sheet-head {
  display: flex;
  align-items: flex-start;
  gap: 0.75rem;
  padding: 1rem 1.25rem 0.85rem;
  border-bottom: 1px solid var(--or3-border);
  background: var(--or3-surface);
}

.or3-fb-sheet-body {
  flex: 1 1 auto;
  min-height: 0;
  overflow-y: auto;
  padding: 1rem 1.25rem 1.5rem;
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

/* Action tiles */
.or3-fb-action {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 0.1rem;
  min-height: 60px;
  padding: 0.55rem 0.4rem;
  border-radius: 1rem;
  background: var(--or3-surface-soft);
  border: 1px solid var(--or3-border);
  color: var(--or3-text);
  text-align: center;
  transition: background 140ms ease, border-color 140ms ease, transform 140ms ease;
}
.or3-fb-action:hover:not(:disabled) {
  background: var(--or3-green-soft);
  border-color: color-mix(in srgb, var(--or3-green) 30%, transparent);
}
.or3-fb-action:active:not(:disabled) { transform: scale(0.97); }
.or3-fb-action:disabled { opacity: 0.5; cursor: not-allowed; }
.or3-fb-action span { width: 100%; }

/* Preview block */
.or3-fb-preview-card {
  border-radius: 1rem;
  border: 1px solid var(--or3-border);
  background: var(--or3-surface);
  overflow: hidden;
}
.or3-fb-preview-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0.55rem 0.85rem;
  border-bottom: 1px solid var(--or3-border);
  background: var(--or3-surface-soft);
}
.or3-fb-preview-body { width: 100%; }

/* Critical: code preview must NEVER force the sheet to grow horizontally
   or vertically. Cap the height, scroll in both axes, and wrap long lines. */
.or3-fb-codeblock {
  max-height: 22rem;
  overflow: auto;
  margin: 0;
  padding: 0.75rem 0.9rem;
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace;
  font-size: 0.75rem;
  line-height: 1.55;
  color: var(--or3-text);
  background: var(--or3-surface-soft);
  white-space: pre;
  word-break: normal;
  overflow-wrap: normal;
}
</style>
