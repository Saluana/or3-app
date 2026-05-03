<template>
  <div class="or3-md-editor">
    <!-- Sticky topbar: back, mode toggle, info, overflow -->
    <div class="or3-md-topbar">
      <div class="or3-md-topbar-row">
        <button
          v-if="showBack"
          type="button"
          class="or3-md-topbar-back or3-focus-ring"
          :aria-label="backLabel"
          @click="emit('back')"
        >
          <Icon name="i-pixelarticons-arrow-left" class="size-4" />
          <span class="hidden sm:inline">{{ backLabel }}</span>
        </button>

        <div class="or3-md-mode" role="tablist" aria-label="View mode">
          <button
            type="button"
            role="tab"
            class="or3-md-mode-btn"
            :class="{ 'is-active': mode === 'edit' }"
            :aria-selected="mode === 'edit'"
            :disabled="Boolean(unsupportedMessage)"
            @click="setMode('edit')"
          >
            <Icon name="i-pixelarticons-edit" class="size-3.5" />
            <span>Edit</span>
          </button>
          <button
            type="button"
            role="tab"
            class="or3-md-mode-btn"
            :class="{ 'is-active': mode === 'read' }"
            :aria-selected="mode === 'read'"
            @click="setMode('read')"
          >
            <Icon name="i-pixelarticons-book-open" class="size-3.5" />
            <span>Read</span>
          </button>
        </div>

        <div class="or3-md-topbar-spacer" />

        <slot name="topbar-extra" />

        <span class="or3-md-status" :data-state="statusState" :title="statusTitle">
          <span class="or3-md-status-dot" />
          <span class="hidden md:inline">{{ statusText }}</span>
        </span>

        <UPopover :content="{ align: 'end', sideOffset: 10 }">
          <button type="button" class="or3-md-icon-btn or3-focus-ring" aria-label="File info">
            <Icon name="i-pixelarticons-info-box" class="size-4" />
          </button>
          <template #content>
            <div class="or3-md-info-panel">
              <div class="or3-md-info-head">
                <Icon name="i-pixelarticons-file-text" class="size-4 text-(--or3-text-muted)" />
                <p class="or3-md-info-title">{{ title }}</p>
              </div>
              <p class="or3-md-info-path" :title="path">{{ path }}</p>

              <div class="or3-md-info-meta">
                <span class="or3-md-info-chip" :data-state="statusState">
                  <span class="or3-md-status-dot" />
                  {{ statusText }}
                </span>
                <span v-if="statusLabel" class="or3-md-info-chip">{{ statusLabel }}</span>
                <span v-if="metadataLabel" class="or3-md-info-chip">{{ metadataLabel }}</span>
              </div>

              <p v-if="readOnly" class="or3-md-info-note">
                Read-only file: edits won't overwrite the original. Use “Save Copy” to keep your changes.
              </p>
              <p v-if="unsupportedMessage" class="or3-md-info-note or3-md-info-note--warn">
                {{ unsupportedMessage }}
              </p>
            </div>
          </template>
        </UPopover>

        <UDropdownMenu :items="overflowItems" :content="{ align: 'end', sideOffset: 10 }">
          <button type="button" class="or3-md-icon-btn or3-focus-ring" aria-label="More actions">
            <Icon name="i-pixelarticons-more-horizontal" class="size-4" />
          </button>
        </UDropdownMenu>
      </div>
    </div>

    <!-- Conflict banner (kept prominent for safety) -->
    <DangerCallout v-if="conflictMessage" tone="danger" title="The file changed on disk" class-name="or3-md-conflict">
      <div class="space-y-3">
        <p>{{ conflictMessage }}</p>
        <div class="flex flex-wrap gap-2">
          <UButton label="Reload" icon="i-pixelarticons-reload" color="neutral" variant="soft" size="sm" @click="emit('reload')" />
          <UButton label="Save Copy" icon="i-pixelarticons-copy" color="primary" size="sm" @click="emit('saveCopy')" />
          <UButton label="Keep editing" icon="i-pixelarticons-close" color="neutral" variant="ghost" size="sm" @click="emit('dismissConflict')" />
        </div>
      </div>
    </DangerCallout>

    <!-- Editor canvas: clean, full-bleed prose -->
    <div class="or3-md-canvas" :data-mode="mode">
      <div v-if="!editor && !unsupportedMessage" class="or3-md-skeleton" />
      <div v-else-if="unsupportedMessage" class="or3-md-unsupported">
        <Icon name="i-pixelarticons-alert" class="size-5 text-(--or3-text-muted)" />
        <p>{{ unsupportedMessage }}</p>
      </div>
      <EditorContent
        v-else-if="editor"
        :editor="editor"
        class="or3-markdown-editor"
      />
    </div>

    <!-- Spacer so editor content doesn't end up under the floating toolbar -->
    <div v-if="showFormattingToolbar" class="or3-md-toolbar-spacer" aria-hidden="true" />

    <!-- Floating formatting toolbar -->
    <Transition name="or3-md-toolbar-fade">
      <div v-if="showFormattingToolbar" class="or3-md-toolbar-wrap">
        <div class="or3-md-toolbar">
          <template v-for="action in primaryFormatActions" :key="action.id">
            <UPopover
              v-if="action.id === 'heading'"
              :content="{ align: 'center', side: 'top', sideOffset: 10 }"
            >
              <button
                type="button"
                class="or3-md-tool-btn or3-focus-ring"
                :class="{ 'is-active': activeHeadingLevel !== null }"
                :aria-label="action.label"
                :title="action.label"
              >
                <Icon :name="activeHeadingIcon" class="size-4" />
              </button>
              <template #content>
                <div class="or3-md-heading-popover" role="group" aria-label="Heading level">
                  <button
                    v-for="level in HEADING_LEVELS"
                    :key="level"
                    type="button"
                    class="or3-md-tool-btn or3-focus-ring"
                    :class="{ 'is-active': activeHeadingLevel === level }"
                    :disabled="!canSetHeading(level)"
                    :aria-label="`Heading ${level}`"
                    :aria-pressed="activeHeadingLevel === level"
                    :title="`Heading ${level}`"
                    @click="setHeadingLevel(level)"
                  >
                    <Icon :name="`gridicons:heading-h${level}`" class="size-4" />
                  </button>
                </div>
              </template>
            </UPopover>
            <button
              v-else
              type="button"
              class="or3-md-tool-btn or3-focus-ring"
              :class="{ 'is-active': action.isActive }"
              :disabled="action.disabled"
              :aria-label="action.label"
              :title="action.label"
              @click="runAction(action)"
            >
              <Icon :name="action.icon" class="size-4" />
            </button>
          </template>

          <div class="or3-md-tool-divider" aria-hidden="true" />

          <UDropdownMenu :items="moreFormatItems" :content="{ align: 'end', side: 'top', sideOffset: 10 }">
            <button type="button" class="or3-md-tool-btn or3-focus-ring" aria-label="More formatting and actions">
              <Icon name="i-pixelarticons-more-horizontal" class="size-4" />
            </button>
          </UDropdownMenu>
        </div>
      </div>
    </Transition>
  </div>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, shallowRef, watch } from 'vue'
import Placeholder from '@tiptap/extension-placeholder'
import { Editor, EditorContent } from '@tiptap/vue-3'
import type { EditorCommandAction } from '~/composables/useEditorCommands'
import { useEditorCommands } from '~/composables/useEditorCommands'
import { createMarkdownEditorExtensions, editorToMarkdown, markdownToEditorContent } from '~/utils/editor/markdown'

const props = withDefaults(defineProps<{
  modelValue: string
  title?: string
  path: string
  statusLabel?: string
  metadataLabel?: string
  saving?: boolean
  readOnly?: boolean
  unsupportedMessage?: string | null
  conflictMessage?: string | null
  autosave?: boolean
  showBack?: boolean
  backLabel?: string
}>(), {
  title: 'Markdown editor',
  statusLabel: '',
  metadataLabel: '',
  saving: false,
  readOnly: false,
  unsupportedMessage: null,
  conflictMessage: null,
  autosave: true,
  showBack: true,
  backLabel: 'Back',
})

const emit = defineEmits<{
  'update:modelValue': [value: string]
  save: [reason: 'manual' | 'autosave']
  saveCopy: []
  reload: []
  dismissConflict: []
  dirtyChange: [value: boolean]
  back: []
}>()

const toast = useToast()
const editor = shallowRef<Editor | null>(null)
const dirty = ref(false)
const mode = ref<'edit' | 'read'>(props.readOnly ? 'read' : 'edit')
let lastCommittedValue = props.modelValue
let syncFromProps = false
let autosaveTimer: ReturnType<typeof setTimeout> | null = null

const statusState = computed<'saving' | 'dirty' | 'saved' | 'readonly'>(() => {
  if (props.saving) return 'saving'
  if (props.readOnly) return 'readonly'
  if (dirty.value) return 'dirty'
  return 'saved'
})

const statusText = computed(() => {
  switch (statusState.value) {
    case 'saving': return 'Saving…'
    case 'dirty': return 'Unsaved'
    case 'readonly': return 'Read-only'
    default: return 'Saved'
  }
})

const statusTitle = computed(() => {
  if (props.statusLabel) return `${statusText.value} • ${props.statusLabel}`
  return statusText.value
})

const actionSuccessMessages: Record<string, { title: string, description: string }> = {
  bold: {
    title: 'Bold updated',
    description: 'The current selection was toggled as bold.',
  },
  italic: {
    title: 'Italic updated',
    description: 'The current selection was toggled as italic.',
  },
  heading: {
    title: 'Heading updated',
    description: 'The current block was toggled as a heading.',
  },
  'bullet-list': {
    title: 'Bullet list updated',
    description: 'The current block was toggled as a bullet list.',
  },
  'ordered-list': {
    title: 'Numbered list updated',
    description: 'The current block was toggled as a numbered list.',
  },
  'inline-code': {
    title: 'Inline code updated',
    description: 'Inline code formatting was toggled for the selection.',
  },
  'code-block': {
    title: 'Code block updated',
    description: 'The current block was toggled as a code block.',
  },
  'horizontal-rule': {
    title: 'Divider inserted',
    description: 'A divider was added to the document.',
  },
  undo: {
    title: 'Undo complete',
    description: 'The previous editor change was reverted.',
  },
  redo: {
    title: 'Redo complete',
    description: 'The last reverted editor change was restored.',
  },
}

const actionSuccessIcons: Record<string, string> = {
  bold: 'gridicons:bold',
  italic: 'gridicons:italic',
  heading: 'gridicons:heading',
  'bullet-list': 'i-pixelarticons-list',
  'ordered-list': 'i-pixelarticons-list',
  'inline-code': 'i-pixelarticons-code',
  'code-block': 'i-pixelarticons-terminal',
  'horizontal-rule': 'i-pixelarticons-minus',
  undo: 'i-pixelarticons-undo',
  redo: 'i-pixelarticons-redo',
}

const showFormattingToolbar = computed(() => {
  return mode.value === 'edit'
    && !props.unsupportedMessage
    && !props.readOnly
    && Boolean(editor.value)
})

function setMode(next: 'edit' | 'read') {
  if (next === mode.value) {
    toast.add({
      title: `${next === 'edit' ? 'Edit' : 'Read'} mode already active`,
      description: next === 'edit'
        ? 'You can keep typing in the editor.'
        : 'You are already viewing the clean reading mode.',
      color: 'neutral',
      icon: next === 'edit' ? 'i-pixelarticons-edit' : 'i-pixelarticons-book-open',
      close: true,
      duration: 2200,
    })
    return
  }
  if (next === 'edit' && props.unsupportedMessage) {
    toast.add({
      title: 'Edit mode unavailable',
      description: props.unsupportedMessage,
      color: 'error',
      icon: 'i-pixelarticons-alert',
      close: true,
      duration: 3200,
    })
    return
  }
  mode.value = next
  toast.add({
    title: next === 'edit' ? 'Edit mode enabled' : 'Reading mode enabled',
    description: next === 'edit'
      ? 'Formatting tools are ready and the document is editable.'
      : 'The editor switched to a cleaner read-only view.',
    color: 'success',
    icon: next === 'edit' ? 'i-pixelarticons-edit' : 'i-pixelarticons-book-open',
    close: true,
    duration: 2200,
  })
}

watch(() => props.readOnly, (ro) => {
  if (ro) mode.value = 'read'
})

watch(() => props.unsupportedMessage, (msg) => {
  if (msg) mode.value = 'read'
})

function clearAutosaveTimer() {
  if (autosaveTimer) {
    clearTimeout(autosaveTimer)
    autosaveTimer = null
  }
}

async function copyMarkdown() {
  if (!import.meta.client || !editor.value) throw new Error('Clipboard access is unavailable here.')
  await navigator.clipboard.writeText(editorToMarkdown(editor.value))
  toast.add({
    title: 'Markdown copied',
    description: 'The Markdown source is on your clipboard.',
    color: 'success',
    icon: 'i-pixelarticons-copy',
    close: true,
    duration: 2200,
  })
}

async function copyPlainText() {
  if (!import.meta.client || !editor.value) throw new Error('Clipboard access is unavailable here.')
  await navigator.clipboard.writeText(editor.value.getText({ blockSeparator: '\n\n' }))
  toast.add({
    title: 'Text copied',
    description: 'The plain text version is on your clipboard.',
    color: 'success',
    icon: 'i-pixelarticons-article',
    close: true,
    duration: 2200,
  })
}

const commandActions = useEditorCommands(editor, {
  copyMarkdown,
  copyPlainText,
  save: () => emit('save', 'manual'),
  saving: computed(() => props.saving),
})

// Primary inline format buttons in the floating toolbar (most common, mobile-first)
const PRIMARY_FORMAT_IDS = ['bold', 'italic', 'heading', 'bullet-list', 'ordered-list', 'inline-code']
const primaryFormatActions = computed(() =>
  commandActions.value.filter((action) => PRIMARY_FORMAT_IDS.includes(action.id)),
)

// Heading popover: H1–H4 quick selection
const HEADING_LEVELS = [1, 2, 3, 4] as const
type HeadingLevel = (typeof HEADING_LEVELS)[number]

function isHeadingActive(level: HeadingLevel): boolean {
  try {
    return editor.value?.isActive('heading', { level }) === true
  } catch {
    return false
  }
}

function canSetHeading(level: HeadingLevel): boolean {
  try {
    return editor.value?.can().chain().focus().toggleHeading({ level }).run() === true
  } catch {
    return false
  }
}

const activeHeadingLevel = computed<HeadingLevel | null>(() => {
  // Read commandActions so this recomputes on the same cadence as other toolbar buttons.
  void commandActions.value
  for (const lvl of HEADING_LEVELS) {
    if (isHeadingActive(lvl)) return lvl
  }
  return null
})

const activeHeadingIcon = computed(() => {
  const lvl = activeHeadingLevel.value
  return lvl ? `gridicons:heading-h${lvl}` : 'gridicons:heading'
})

function setHeadingLevel(level: HeadingLevel) {
  if (!editor.value) return
  if (!canSetHeading(level)) return
  editor.value.chain().focus().toggleHeading({ level }).run()
  toast.add({
    title: `Heading ${level} updated`,
    description: 'The current block was toggled as a heading.',
    color: 'success',
    icon: `gridicons:heading-h${level}`,
    close: true,
    duration: 2000,
  })
}

// Everything else lives behind the toolbar "..." menu
const SECONDARY_FORMAT_IDS = ['code-block', 'horizontal-rule', 'undo', 'redo']
const secondaryFormatActions = computed(() =>
  commandActions.value.filter((action) => SECONDARY_FORMAT_IDS.includes(action.id)),
)

function toMenuItem(action: EditorCommandAction) {
  return {
    label: action.label,
    icon: action.icon,
    disabled: action.disabled,
    onSelect: () => { void runAction(action) },
  }
}

// Bottom toolbar overflow: secondary formatting + clipboard helpers
const moreFormatItems = computed(() => {
  const groups: any[][] = []
  const fmt = secondaryFormatActions.value.map(toMenuItem)
  if (fmt.length) groups.push(fmt)
  const clipboard = commandActions.value
    .filter((action) => action.id === 'copy-markdown' || action.id === 'copy-text')
    .map(toMenuItem)
  if (clipboard.length) groups.push(clipboard)
  return groups
})

// Top-bar "..." menu: file actions (save copy / reload / save / read-only copy etc.)
const overflowItems = computed(() => {
  const fileActions: any[] = []

  if (!props.readOnly && !props.unsupportedMessage) {
    fileActions.push({
      label: props.saving ? 'Saving…' : 'Save',
      icon: 'i-pixelarticons-save',
      kbds: undefined,
      disabled: props.saving || (!dirty.value && !props.readOnly),
      onSelect: () => { emit('save', 'manual') },
    })
  }

  fileActions.push({
    label: 'Save Copy',
    icon: 'i-pixelarticons-copy',
    disabled: Boolean(props.unsupportedMessage) || props.saving,
    onSelect: () => { emit('saveCopy') },
  })

  fileActions.push({
    label: 'Reload',
    icon: 'i-pixelarticons-reload',
    onSelect: () => { emit('reload') },
  })

  const clipboard = commandActions.value
    .filter((action) => action.id === 'copy-markdown' || action.id === 'copy-text')
    .map(toMenuItem)

  const groups: any[][] = [fileActions]
  if (clipboard.length) groups.push(clipboard)
  return groups
})

function updateDirtyState(nextValue: string) {
  const nextDirty = nextValue !== lastCommittedValue
  if (dirty.value === nextDirty) return
  dirty.value = nextDirty
  emit('dirtyChange', nextDirty)
}

function scheduleAutosave() {
  clearAutosaveTimer()
  if (!props.autosave || props.saving || props.readOnly || props.unsupportedMessage || !dirty.value) return
  autosaveTimer = setTimeout(() => {
    emit('save', 'autosave')
  }, 1200)
}

function applyExternalValue(value: string) {
  if (!editor.value) return
  syncFromProps = true
  editor.value.commands.setContent(markdownToEditorContent(value), false)
  syncFromProps = false
  lastCommittedValue = value
  updateDirtyState(value)
}

async function runAction(action: EditorCommandAction) {
  if (action.disabled) return
  try {
    await action.run()
    const successMessage = actionSuccessMessages[action.id]
    if (successMessage) {
      toast.add({
        ...successMessage,
        color: 'success',
        icon: actionSuccessIcons[action.id] || 'i-pixelarticons-save',
        close: true,
        duration: 2200,
      })
    }
  } catch (error: any) {
    toast.add({
      title: 'Action unavailable',
      description: error?.message || 'That editor action could not finish.',
      color: 'error',
      icon: 'i-pixelarticons-alert',
      close: true,
      duration: 3200,
    })
  }
}

watch(() => props.modelValue, (value) => {
  if (syncFromProps) return
  if (value === lastCommittedValue && !dirty.value) return
  if (editor.value && editorToMarkdown(editor.value) !== value) {
    applyExternalValue(value)
  } else {
    lastCommittedValue = value
    updateDirtyState(value)
  }
})

watch(() => props.saving, (saving) => {
  if (!saving) {
    lastCommittedValue = props.modelValue
    updateDirtyState(props.modelValue)
    return
  }
  clearAutosaveTimer()
})

onMounted(() => {
  editor.value = new Editor({
    editable: !props.readOnly && !props.unsupportedMessage && mode.value === 'edit',
    content: markdownToEditorContent(props.modelValue),
    extensions: [
      ...createMarkdownEditorExtensions(),
      Placeholder.configure({ placeholder: 'Start writing…' }),
    ],
    editorProps: {
      attributes: {
        class: 'or3-md-prose outline-none',
      },
    },
    onUpdate: ({ editor: instance }) => {
      if (syncFromProps) return
      const markdown = editorToMarkdown(instance)
      emit('update:modelValue', markdown)
      updateDirtyState(markdown)
      scheduleAutosave()
    },
  })
})

watch(() => [props.readOnly, props.unsupportedMessage, mode.value] as const, ([readOnly, unsupported, m]) => {
  editor.value?.setEditable(!readOnly && !unsupported && m === 'edit')
})

onBeforeUnmount(() => {
  clearAutosaveTimer()
  editor.value?.destroy()
})
</script>

<style scoped>
.or3-md-editor {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

/* ── Top bar ────────────────────────────────────────────────────── */
.or3-md-topbar {
  position: sticky;
  top: calc(var(--or3-safe-top) + 0.25rem);
  z-index: 20;
  border-radius: 1.25rem;
  border: 1px solid var(--or3-border);
  background: color-mix(in srgb, var(--or3-surface) 92%, white 8%);
  backdrop-filter: blur(10px);
  box-shadow: 0 1px 0 rgba(255, 255, 255, 0.65) inset, 0 6px 16px rgba(42, 35, 25, 0.04);
}

.or3-md-topbar-row {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.45rem 0.55rem;
}

.or3-md-topbar-spacer {
  flex: 1 1 auto;
  min-width: 0;
}

.or3-md-topbar-back {
  display: inline-flex;
  align-items: center;
  gap: 0.4rem;
  padding: 0.4rem 0.6rem;
  border-radius: 0.85rem;
  font-size: 0.85rem;
  font-weight: 500;
  color: var(--or3-text);
  background: transparent;
  border: 1px solid transparent;
  transition: background 140ms ease, border-color 140ms ease, color 140ms ease;
}
.or3-md-topbar-back:hover {
  background: color-mix(in srgb, var(--or3-green-soft) 60%, transparent);
  border-color: color-mix(in srgb, var(--or3-green) 24%, transparent);
}

.or3-md-icon-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 2rem;
  height: 2rem;
  border-radius: 0.75rem;
  color: var(--or3-text-muted);
  background: transparent;
  border: 1px solid transparent;
  transition: background 140ms ease, color 140ms ease, border-color 140ms ease;
}
.or3-md-icon-btn:hover {
  background: color-mix(in srgb, var(--or3-green-soft) 50%, transparent);
  color: var(--or3-text);
  border-color: color-mix(in srgb, var(--or3-green) 22%, transparent);
}

/* Mode toggle (segmented) */
.or3-md-mode {
  display: inline-flex;
  align-items: center;
  padding: 3px;
  border-radius: 0.85rem;
  background: var(--or3-surface-soft);
  border: 1px solid var(--or3-border);
}
.or3-md-mode-btn {
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
  padding: 0.32rem 0.7rem;
  border-radius: 0.65rem;
  font-size: 0.8rem;
  font-weight: 500;
  color: var(--or3-text-muted);
  background: transparent;
  transition: background 160ms ease, color 160ms ease, box-shadow 160ms ease;
}
.or3-md-mode-btn:hover:not(.is-active):not(:disabled) {
  color: var(--or3-text);
}
.or3-md-mode-btn.is-active {
  background: var(--or3-surface);
  color: var(--or3-green-dark, var(--or3-text));
  box-shadow: 0 1px 0 rgba(255, 255, 255, 0.7) inset, 0 1px 2px rgba(42, 35, 25, 0.06);
}
.or3-md-mode-btn:disabled {
  opacity: 0.45;
  cursor: not-allowed;
}

/* Status pill */
.or3-md-status {
  display: inline-flex;
  align-items: center;
  gap: 0.4rem;
  padding: 0.25rem 0.55rem;
  border-radius: 999px;
  font-size: 0.72rem;
  font-weight: 500;
  color: var(--or3-text-muted);
  background: var(--or3-surface-soft);
  border: 1px solid var(--or3-border);
  white-space: nowrap;
}
.or3-md-status-dot {
  width: 0.45rem;
  height: 0.45rem;
  border-radius: 999px;
  background: color-mix(in srgb, var(--or3-text-muted) 40%, transparent);
}
.or3-md-status[data-state='saved'] .or3-md-status-dot { background: var(--or3-green, #4caf50); }
.or3-md-status[data-state='dirty'] .or3-md-status-dot { background: var(--or3-amber, #f59e0b); }
.or3-md-status[data-state='saving'] .or3-md-status-dot {
  background: var(--or3-green, #4caf50);
  animation: or3-md-pulse 1s ease-in-out infinite;
}
.or3-md-status[data-state='readonly'] .or3-md-status-dot { background: color-mix(in srgb, var(--or3-text-muted) 60%, transparent); }

@keyframes or3-md-pulse {
  0%, 100% { opacity: 1; transform: scale(1); }
  50% { opacity: 0.55; transform: scale(0.85); }
}

/* Info popover */
.or3-md-info-panel {
  width: min(20rem, 80vw);
  padding: 0.85rem 0.95rem;
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}
.or3-md-info-head {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  min-width: 0;
}
.or3-md-info-title {
  font-family: var(--font-mono, ui-monospace, monospace);
  font-weight: 600;
  font-size: 0.92rem;
  color: var(--or3-text);
  word-break: break-word;
}
.or3-md-info-path {
  font-size: 0.72rem;
  color: var(--or3-text-muted);
  word-break: break-all;
  line-height: 1.4;
}
.or3-md-info-meta {
  display: flex;
  flex-wrap: wrap;
  gap: 0.35rem;
}
.or3-md-info-chip {
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
  padding: 0.2rem 0.55rem;
  font-size: 0.7rem;
  border-radius: 999px;
  border: 1px solid var(--or3-border);
  background: var(--or3-surface-soft);
  color: var(--or3-text-muted);
}
.or3-md-info-chip[data-state='saved'] { color: var(--or3-green-dark, var(--or3-text)); }
.or3-md-info-chip[data-state='dirty'] { color: var(--or3-amber-dark, var(--or3-text)); }
.or3-md-info-note {
  font-size: 0.75rem;
  line-height: 1.5;
  color: var(--or3-text-muted);
  padding-top: 0.25rem;
  border-top: 1px solid var(--or3-border);
}
.or3-md-info-note--warn {
  color: var(--or3-amber-dark, #b45309);
}

/* ── Conflict callout spacing ───────────────────────────────────── */
:deep(.or3-md-conflict) {
  margin-top: 0;
}

/* ── Editor canvas ──────────────────────────────────────────────── */
.or3-md-canvas {
  flex: 1 1 auto;
  min-height: 60vh;
  padding: 1.25rem 0.25rem 0;
}
.or3-md-canvas[data-mode='read'] {
  /* Slightly more breathing room and a "page" feel in read mode */
  padding-top: 1.5rem;
}
.or3-md-skeleton {
  height: 60vh;
  border-radius: 1rem;
  background: var(--or3-surface-soft);
  animation: or3-md-skel 1.4s ease-in-out infinite;
}
@keyframes or3-md-skel {
  0%, 100% { opacity: 0.7; }
  50% { opacity: 1; }
}
.or3-md-unsupported {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 0.75rem;
  text-align: center;
  min-height: 50vh;
  padding: 2rem 1.5rem;
  color: var(--or3-text-muted);
  font-size: 0.9rem;
  line-height: 1.55;
}

/* ── Floating bottom toolbar ────────────────────────────────────── */
.or3-md-toolbar-spacer {
  height: 4.5rem;
  flex-shrink: 0;
}
.or3-md-toolbar-wrap {
  position: fixed;
  left: 50%;
  transform: translateX(-50%);
  bottom: calc(var(--or3-safe-bottom) + 5.25rem);
  z-index: 35;
  pointer-events: none;
  width: max-content;
  max-width: calc(100vw - 1.5rem);
}
.or3-md-toolbar {
  pointer-events: auto;
  display: inline-flex;
  align-items: center;
  gap: 0.15rem;
  padding: 0.3rem;
  border-radius: 1rem;
  background: color-mix(in srgb, var(--or3-surface) 96%, white 4%);
  border: 1px solid var(--or3-border);
  box-shadow: 0 8px 28px rgba(42, 35, 25, 0.12), 0 1px 0 rgba(255, 255, 255, 0.65) inset;
  backdrop-filter: blur(10px);
}

/* When the on-screen keyboard pushes the bottom nav away, drop the toolbar lower */
@media (max-width: 767px) {
  body:has(.ProseMirror:focus) .or3-md-toolbar-wrap {
    bottom: calc(var(--or3-safe-bottom) + 0.6rem);
  }
}

/* On wider screens the bottom nav stays put; sit comfortably above it */
@media (min-width: 1024px) {
  .or3-md-toolbar-wrap {
    bottom: calc(var(--or3-safe-bottom) + 1.5rem);
  }
}

.or3-md-tool-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 2.25rem;
  height: 2.25rem;
  border-radius: 0.7rem;
  color: var(--or3-text-muted);
  background: transparent;
  border: 1px solid transparent;
  transition: background 140ms ease, color 140ms ease, border-color 140ms ease, transform 120ms ease;
}
.or3-md-tool-btn:hover:not(:disabled) {
  background: color-mix(in srgb, var(--or3-green-soft) 70%, transparent);
  color: var(--or3-text);
  border-color: color-mix(in srgb, var(--or3-green) 24%, transparent);
}
.or3-md-tool-btn:active:not(:disabled) {
  transform: scale(0.94);
}
.or3-md-tool-btn.is-active {
  background: var(--or3-green-soft);
  color: var(--or3-green-dark, var(--or3-text));
  border-color: color-mix(in srgb, var(--or3-green) 30%, transparent);
}
.or3-md-tool-btn:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}
.or3-md-tool-divider {
  width: 1px;
  height: 1.4rem;
  margin: 0 0.2rem;
  background: var(--or3-border);
}

/* Heading popover (H1–H4 quick picker) */
.or3-md-heading-popover {
  display: flex;
  align-items: center;
  gap: 0.25rem;
  padding: 0.3rem;
}

/* Toolbar enter/exit */
.or3-md-toolbar-fade-enter-active,
.or3-md-toolbar-fade-leave-active {
  transition: opacity 180ms ease, transform 220ms cubic-bezier(0.2, 0.8, 0.2, 1);
}
.or3-md-toolbar-fade-enter-from,
.or3-md-toolbar-fade-leave-to {
  opacity: 0;
  transform: translateX(-50%) translateY(0.6rem);
}

/* ── Prose styling (Notion-ish) ─────────────────────────────────── */
:deep(.or3-markdown-editor) {
  color: var(--or3-text);
}
:deep(.or3-markdown-editor .ProseMirror) {
  min-height: 50vh;
  outline: none;
  white-space: pre-wrap;
  word-break: break-word;
  font-size: 1rem;
  line-height: 1.7;
  max-width: 46rem;
  margin: 0 auto;
  padding: 0 0.5rem 2rem;
}

@media (min-width: 768px) {
  :deep(.or3-markdown-editor .ProseMirror) {
    font-size: 1.0625rem;
    padding: 0 1rem 3rem;
  }
}

.or3-md-canvas[data-mode='read'] :deep(.or3-markdown-editor .ProseMirror) {
  cursor: default;
}

:deep(.or3-markdown-editor .ProseMirror p:first-child.is-editor-empty::before) {
  content: attr(data-placeholder);
  float: left;
  color: var(--or3-text-muted);
  pointer-events: none;
  height: 0;
}

:deep(.or3-markdown-editor .ProseMirror h1),
:deep(.or3-markdown-editor .ProseMirror h2),
:deep(.or3-markdown-editor .ProseMirror h3) {
  font-weight: 700;
  line-height: 1.25;
  letter-spacing: -0.01em;
  margin: 1.6em 0 0.5em;
  color: var(--or3-text);
}
:deep(.or3-markdown-editor .ProseMirror h1) { font-size: 1.875rem; }
:deep(.or3-markdown-editor .ProseMirror h2) { font-size: 1.5rem; }
:deep(.or3-markdown-editor .ProseMirror h3) { font-size: 1.2rem; }

:deep(.or3-markdown-editor .ProseMirror p),
:deep(.or3-markdown-editor .ProseMirror ul),
:deep(.or3-markdown-editor .ProseMirror ol),
:deep(.or3-markdown-editor .ProseMirror pre) {
  margin: 0.65em 0;
}

:deep(.or3-markdown-editor .ProseMirror ul),
:deep(.or3-markdown-editor .ProseMirror ol) {
  padding-left: 1.4rem;
}
:deep(.or3-markdown-editor .ProseMirror li > p) { margin: 0.15em 0; }

:deep(.or3-markdown-editor .ProseMirror code) {
  border-radius: 0.4rem;
  background: color-mix(in srgb, var(--or3-surface-soft) 88%, white 12%);
  padding: 0.1rem 0.35rem;
  font-size: 0.92em;
}
:deep(.or3-markdown-editor .ProseMirror pre) {
  overflow: auto;
  border-radius: 0.85rem;
  background: var(--or3-surface-soft);
  border: 1px solid var(--or3-border);
  padding: 0.9rem 1rem;
  font-size: 0.9em;
  line-height: 1.55;
}
:deep(.or3-markdown-editor .ProseMirror pre code) {
  background: transparent;
  padding: 0;
}
:deep(.or3-markdown-editor .ProseMirror hr) {
  margin: 1.5rem 0;
  border: 0;
  border-top: 1px solid var(--or3-border);
}
:deep(.or3-markdown-editor .ProseMirror blockquote) {
  margin: 1rem 0;
  border-left: 3px solid color-mix(in srgb, var(--or3-green) 60%, var(--or3-border));
  padding: 0.1rem 0 0.1rem 0.95rem;
  color: var(--or3-text-muted);
  font-style: italic;
}
:deep(.or3-markdown-editor .ProseMirror a) {
  color: var(--or3-green-dark, var(--or3-green, #2f7a4f));
  text-decoration: underline;
  text-underline-offset: 2px;
}
</style>