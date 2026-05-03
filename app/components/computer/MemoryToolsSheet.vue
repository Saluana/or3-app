<template>
  <USlideover
    :open="open"
    :side="side"
    :ui="{ content: contentClass }"
    @update:open="(value: boolean) => emit('update:open', value)"
  >
    <template #content>
      <div ref="sheetRef" class="or3-fb-sheet" :class="side === 'bottom' ? 'is-bottom' : 'is-side'">
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

        <header class="or3-fb-sheet-head">
          <div class="flex min-w-0 flex-1 items-start gap-3">
            <span class="grid size-11 shrink-0 place-items-center rounded-2xl bg-white text-(--or3-green)">
              <Icon name="i-pixelarticons-database" class="size-5" />
            </span>
            <div class="min-w-0 flex-1">
              <p class="font-mono text-base font-semibold text-(--or3-text)">Memory tools</p>
              <p class="mt-1 text-xs leading-5 text-(--or3-text-muted)">
                Check the memory index, re-scan when notes change, and verify the activity log.
              </p>
            </div>
          </div>
          <button
            type="button"
            class="or3-focus-ring grid size-9 shrink-0 place-items-center rounded-full text-(--or3-text-muted) hover:bg-(--or3-surface-soft) hover:text-(--or3-text)"
            aria-label="Close memory tools"
            @click="emit('update:open', false)"
          >
            <Icon name="i-pixelarticons-close" class="size-4" />
          </button>
        </header>

        <div class="or3-fb-sheet-body">
          <DangerCallout v-if="memoryError" tone="caution" title="Memory tools need attention">
            {{ memoryError }}
          </DangerCallout>

          <section class="rounded-2xl border border-(--or3-border) bg-(--or3-surface-soft) p-4">
            <p class="or3-label text-[10px] font-semibold tracking-[0.18em]">MEMORY INDEX</p>
            <p class="mt-2 font-mono text-sm font-semibold text-(--or3-text)">{{ embeddingStatusTitle }}</p>
            <p class="mt-1 text-xs leading-5 text-(--or3-text-muted)">{{ embeddingStatusDescription }}</p>
            <div class="mt-3 flex flex-wrap gap-2">
              <UButton size="sm" label="Refresh" icon="i-pixelarticons-reload" color="neutral" variant="soft" :loading="memoryLoading" @click="emit('refresh-memory')" />
              <UButton size="sm" label="Re-scan notes" icon="i-pixelarticons-database" color="primary" :loading="memoryLoading" @click="emit('rebuild', 'memory')" />
              <UButton size="sm" label="Re-scan documents" icon="i-pixelarticons-files" color="neutral" variant="soft" :loading="memoryLoading" @click="emit('rebuild', 'docs')" />
            </div>
          </section>

          <section class="rounded-2xl border border-(--or3-border) bg-(--or3-surface-soft) p-4">
            <p class="or3-label text-[10px] font-semibold tracking-[0.18em]">ACTIVITY LOG</p>
            <p class="mt-2 font-mono text-sm font-semibold text-(--or3-text)">{{ auditStatusTitle }}</p>
            <p class="mt-1 text-xs leading-5 text-(--or3-text-muted)">{{ auditStatusDescription }}</p>
            <div class="mt-3 flex flex-wrap gap-2">
              <UButton size="sm" label="Refresh" icon="i-pixelarticons-shield" color="neutral" variant="soft" :loading="memoryLoading" @click="emit('refresh-audit')" />
              <UButton size="sm" label="Verify log" icon="i-pixelarticons-check-double" color="primary" :loading="memoryLoading" @click="emit('verify-audit')" />
              <UButton size="sm" label="Open memory page" icon="i-pixelarticons-link" to="/memory" color="neutral" variant="ghost" />
            </div>
          </section>

          <section v-if="shortcuts.length" class="space-y-2">
            <p class="or3-label text-[10px] font-semibold tracking-[0.18em]">MEMORY SHORTCUTS</p>
            <div class="grid gap-2 sm:grid-cols-2">
              <button
                v-for="shortcut in shortcuts"
                :key="shortcut.path"
                type="button"
                class="or3-focus-ring rounded-2xl border border-(--or3-border) bg-white/70 p-3 text-left transition hover:border-(--or3-green) hover:bg-(--or3-green-soft)"
                @click="emit('open-shortcut', shortcut)"
              >
                <p class="truncate font-mono text-sm font-semibold text-(--or3-text)">{{ shortcut.label }}</p>
                <p class="mt-1 text-xs leading-5 text-(--or3-text-muted)">{{ shortcut.description }}</p>
              </button>
            </div>
          </section>

          <details class="rounded-2xl border border-(--or3-border) bg-white/70 p-3">
            <summary class="cursor-pointer select-none text-[10px] font-semibold uppercase tracking-wider text-(--or3-text-muted)">
              Show technical details
            </summary>
            <pre class="mt-2 max-h-64 overflow-auto whitespace-pre-wrap break-all text-[10px] leading-5 text-(--or3-text-muted)">{{ debugDetails }}</pre>
          </details>
        </div>
      </div>
    </template>
  </USlideover>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import { useIsDesktop } from '~/composables/useViewport'
import { useSheetSwipeDismiss } from '~/composables/useSheetSwipeDismiss'

export interface MemoryShortcut {
  label: string
  description: string
  path: string
  type: 'file' | 'directory'
  rootId: string
}

const props = withDefaults(defineProps<{
  open: boolean
  embeddingsStatus: Record<string, unknown> | null
  auditStatus: Record<string, unknown> | null
  memoryLoading: boolean
  memoryError: string | null
  shortcuts: MemoryShortcut[]
}>(), {
  embeddingsStatus: null,
  auditStatus: null,
  memoryLoading: false,
  memoryError: null,
  shortcuts: () => [],
})

const emit = defineEmits<{
  'update:open': [value: boolean]
  'refresh-memory': []
  'rebuild': [target: 'memory' | 'docs']
  'refresh-audit': []
  'verify-audit': []
  'open-shortcut': [shortcut: MemoryShortcut]
}>()

const isDesktop = useIsDesktop()
const side = computed<'bottom' | 'right'>(() => (isDesktop.value ? 'right' : 'bottom'))
const contentClass = computed(() =>
  side.value === 'bottom'
    ? 'or3-fb-sheet-shell or3-fb-sheet-shell--bottom max-h-[88dvh] sm:max-h-[80dvh] rounded-t-3xl'
    : 'or3-fb-sheet-shell or3-fb-sheet-shell--side sm:max-w-md',
)

const sheetRef = ref<HTMLElement | null>(null)
const handleRef = ref<HTMLElement | null>(null)
const swipeEnabled = computed(() => props.open && side.value === 'bottom')
useSheetSwipeDismiss({
  handle: handleRef,
  sheet: sheetRef,
  enabled: swipeEnabled,
  onDismiss: () => emit('update:open', false),
})

const embeddingStatusTitle = computed(() => {
  const status = String(props.embeddingsStatus?.status || '').trim().toLowerCase()
  if (status === 'ok') return 'Memory search looks healthy'
  if (status === 'mismatch') return 'Memory embeddings need a refresh'
  if (status === 'legacy-unknown') return 'Memory index is from an older setup'
  return 'Memory status is unavailable'
})

const embeddingStatusDescription = computed(() => {
  const status = String(props.embeddingsStatus?.status || '').trim().toLowerCase()
  const dims = Number(props.embeddingsStatus?.memoryVectorDims || 0)
  if (status === 'ok') {
    const docsEnabled = props.embeddingsStatus?.docIndexEnabled ? ' Document search is on.' : ''
    return dims > 0
      ? `Your saved memory vectors are ready (${dims} dimensions).${docsEnabled}`
      : `The index reports as healthy.${docsEnabled}`
  }
  if (status === 'mismatch') return 'The embedding model changed since the last build. Re-scan notes and documents so recall stays accurate.'
  if (status === 'legacy-unknown') return 'OR3 found older vectors without a matching fingerprint. A re-scan will normalize them.'
  return 'Refresh to see whether memory search and document indexing are ready.'
})

const auditStatusTitle = computed(() => {
  const status = String(props.auditStatus?.status || '').trim().toLowerCase()
  if (props.auditStatus?.verified === true) return 'Activity log verified'
  if (status === 'ok') return 'Activity log is available'
  if (status === 'disabled') return 'Activity log is turned off'
  if (status === 'unavailable') return 'Activity log is unavailable'
  return 'Activity log status is unavailable'
})

const auditStatusDescription = computed(() => {
  const eventCount = Number(props.auditStatus?.eventCount || 0)
  if (props.auditStatus?.verified === true) return `The integrity check passed across ${eventCount} recorded events.`
  if (props.auditStatus?.status === 'ok') {
    return eventCount > 0
      ? `${eventCount} events are recorded. Run Verify log if you want to confirm nothing was tampered with.`
      : 'Logging is available, but no events have been recorded yet.'
  }
  if (props.auditStatus?.status === 'disabled') return 'Turn audit logging on in OR3 if you want a tamper-checkable activity trail.'
  if (props.auditStatus?.status === 'unavailable') return 'OR3 could not reach its audit logger. Check the memory tools page for deeper diagnostics.'
  return 'Refresh to see whether OR3 can read and verify its activity trail.'
})

const debugDetails = computed(() =>
  JSON.stringify({ embeddings: props.embeddingsStatus, audit: props.auditStatus }, null, 2),
)
</script>

<style scoped>
.or3-fb-sheet { display: flex; flex-direction: column; height: 100%; min-height: 0; }
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
</style>
