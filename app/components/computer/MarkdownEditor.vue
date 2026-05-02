<template>
  <div class="space-y-4">
    <SurfaceCard class-name="space-y-4">
      <div class="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div class="min-w-0 space-y-2">
          <div class="flex items-center gap-2">
            <RetroIcon name="i-pixelarticons-file-text" />
            <p class="font-mono text-base font-semibold text-(--or3-text)">{{ title }}</p>
          </div>
          <p class="break-all text-sm leading-6 text-(--or3-text-muted)">{{ path }}</p>
          <div class="flex flex-wrap gap-2 text-xs text-(--or3-text-muted)">
            <span class="rounded-full border border-(--or3-border) bg-white/70 px-2 py-1">{{ saving ? 'Saving…' : dirty ? 'Unsaved changes' : 'Saved' }}</span>
            <span v-if="statusLabel" class="rounded-full border border-(--or3-border) bg-white/70 px-2 py-1">{{ statusLabel }}</span>
            <span v-if="metadataLabel" class="rounded-full border border-(--or3-border) bg-white/70 px-2 py-1">{{ metadataLabel }}</span>
          </div>
        </div>

        <div class="flex flex-wrap gap-2">
          <UButton
            v-for="action in primaryActions"
            :key="action.id"
            :label="action.label"
            :icon="action.icon"
            color="neutral"
            :variant="action.id === 'save' ? 'solid' : action.isActive ? 'soft' : 'ghost'"
            :disabled="action.disabled"
            @click="runAction(action)"
          />
        </div>
      </div>

      <DangerCallout v-if="unsupportedMessage" tone="caution" title="This file can't be edited here yet">
        {{ unsupportedMessage }}
      </DangerCallout>

      <DangerCallout v-else-if="readOnly" tone="info" title="This file is read-only">
        You can review the content, copy it, and save a separate copy, but edits won't overwrite the original file.
      </DangerCallout>

      <DangerCallout v-if="conflictMessage" tone="danger" title="The file changed on disk">
        <div class="space-y-3">
          <p>{{ conflictMessage }}</p>
          <div class="flex flex-wrap gap-2">
            <UButton label="Reload" icon="i-pixelarticons-reload" color="neutral" variant="soft" @click="emit('reload')" />
            <UButton label="Save Copy" icon="i-pixelarticons-copy" color="primary" @click="emit('saveCopy')" />
            <UButton label="Keep Editing" icon="i-pixelarticons-close" color="neutral" variant="ghost" @click="emit('dismissConflict')" />
          </div>
        </div>
      </DangerCallout>

      <div class="flex flex-wrap gap-2 rounded-2xl border border-(--or3-border) bg-white/70 p-2">
        <UButton
          v-for="action in formattingActions"
          :key="action.id"
          :label="action.label"
          :icon="action.icon"
          color="neutral"
          size="sm"
          :variant="action.isActive ? 'soft' : 'ghost'"
          :disabled="action.disabled || Boolean(unsupportedMessage)"
          @click="runAction(action)"
        />
      </div>

      <div class="rounded-[1.75rem] border border-(--or3-border) bg-white/80 p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.7)]">
        <div v-if="!editor && !unsupportedMessage" class="h-80 animate-pulse rounded-[1.35rem] bg-(--or3-surface-soft)" />
        <div
          v-else-if="unsupportedMessage"
          class="flex min-h-80 items-center justify-center rounded-[1.35rem] bg-(--or3-surface-soft) px-6 text-center text-sm leading-6 text-(--or3-text-muted)"
        >
          {{ unsupportedMessage }}
        </div>
        <EditorContent
          v-else-if="editor"
          :editor="editor"
          class="or3-markdown-editor min-h-80 text-base leading-7 text-(--or3-text)"
        />
        <div v-else class="h-80 animate-pulse rounded-[1.35rem] bg-(--or3-surface-soft)" />
      </div>

      <div class="flex flex-wrap items-center justify-between gap-3">
        <p class="text-xs leading-5 text-(--or3-text-muted)">
          {{ footerMessage }}
        </p>
        <div class="flex flex-wrap gap-2">
          <UButton label="Reload" icon="i-pixelarticons-reload" color="neutral" variant="ghost" @click="emit('reload')" />
          <UButton
            label="Save Copy"
            icon="i-pixelarticons-copy"
            color="neutral"
            variant="soft"
            :disabled="Boolean(unsupportedMessage) || saving"
            @click="emit('saveCopy')"
          />
          <UButton
            :label="saving ? 'Saving…' : 'Save'"
            icon="i-pixelarticons-save"
            color="primary"
            :disabled="Boolean(unsupportedMessage) || saving || (!dirty && !readOnly)"
            @click="emit('save', 'manual')"
          />
        </div>
      </div>
    </SurfaceCard>
  </div>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, shallowRef, watch } from 'vue'
import { useToast } from '@nuxt/ui/composables'
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
}>(), {
  title: 'Markdown editor',
  statusLabel: '',
  metadataLabel: '',
  saving: false,
  readOnly: false,
  unsupportedMessage: null,
  conflictMessage: null,
  autosave: true,
})

const emit = defineEmits<{
  'update:modelValue': [value: string]
  save: [reason: 'manual' | 'autosave']
  saveCopy: []
  reload: []
  dismissConflict: []
  dirtyChange: [value: boolean]
}>()

const toast = useToast()
const editor = shallowRef<Editor | null>(null)
const dirty = ref(false)
let lastCommittedValue = props.modelValue
let syncFromProps = false
let autosaveTimer: ReturnType<typeof setTimeout> | null = null

const footerMessage = computed(() => {
  if (props.unsupportedMessage) return 'Use Download or Open in browser for unsupported file types.'
  if (props.readOnly) return 'This editor stays in review mode until you save a separate copy.'
  return props.autosave ? 'Changes autosave after a short pause, and you can still save explicitly anytime.' : 'Save whenever you are ready.'
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
  toast.add({ title: 'Markdown copied', description: 'The Markdown source is on your clipboard.' })
}

async function copyPlainText() {
  if (!import.meta.client || !editor.value) throw new Error('Clipboard access is unavailable here.')
  await navigator.clipboard.writeText(editor.value.getText({ blockSeparator: '\n\n' }))
  toast.add({ title: 'Text copied', description: 'The plain text version is on your clipboard.' })
}

const commandActions = useEditorCommands(editor, {
  copyMarkdown,
  copyPlainText,
  save: () => emit('save', 'manual'),
  saving: computed(() => props.saving),
})

const primaryActions = computed(() => commandActions.value.filter((action) => ['copy-markdown', 'copy-text', 'save'].includes(action.id)))
const formattingActions = computed(() => commandActions.value.filter((action) => !['copy-markdown', 'copy-text', 'save'].includes(action.id)))

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
  } catch (error: any) {
    toast.add({
      title: 'Action unavailable',
      description: error?.message || 'That editor action could not finish.',
      color: 'error',
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
    editable: !props.readOnly && !props.unsupportedMessage,
    content: markdownToEditorContent(props.modelValue),
    extensions: [
      ...createMarkdownEditorExtensions(),
      Placeholder.configure({ placeholder: 'Start writing…' }),
    ],
    editorProps: {
      attributes: {
        class: 'min-h-80 outline-none',
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

watch(() => [props.readOnly, props.unsupportedMessage] as const, ([readOnly, unsupported]) => {
  editor.value?.setEditable(!readOnly && !unsupported)
})

onBeforeUnmount(() => {
  clearAutosaveTimer()
  editor.value?.destroy()
})
</script>

<style scoped>
:deep(.or3-markdown-editor .ProseMirror) {
  min-height: 20rem;
  outline: none;
  white-space: pre-wrap;
  word-break: break-word;
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
  font-family: var(--font-mono, ui-monospace, monospace);
  font-weight: 700;
  line-height: 1.2;
  margin: 1rem 0 0.5rem;
}

:deep(.or3-markdown-editor .ProseMirror h1) {
  font-size: 1.5rem;
}

:deep(.or3-markdown-editor .ProseMirror h2) {
  font-size: 1.25rem;
}

:deep(.or3-markdown-editor .ProseMirror h3) {
  font-size: 1.1rem;
}

:deep(.or3-markdown-editor .ProseMirror p),
:deep(.or3-markdown-editor .ProseMirror ul),
:deep(.or3-markdown-editor .ProseMirror ol),
:deep(.or3-markdown-editor .ProseMirror pre) {
  margin: 0.75rem 0;
}

:deep(.or3-markdown-editor .ProseMirror ul),
:deep(.or3-markdown-editor .ProseMirror ol) {
  padding-left: 1.4rem;
}

:deep(.or3-markdown-editor .ProseMirror code) {
  border-radius: 0.5rem;
  background: color-mix(in srgb, var(--or3-surface-soft) 88%, white 12%);
  padding: 0.1rem 0.35rem;
  font-size: 0.92em;
}

:deep(.or3-markdown-editor .ProseMirror pre) {
  overflow: auto;
  border-radius: 1rem;
  background: var(--or3-surface-soft);
  padding: 0.9rem 1rem;
}

:deep(.or3-markdown-editor .ProseMirror pre code) {
  background: transparent;
  padding: 0;
}

:deep(.or3-markdown-editor .ProseMirror hr) {
  margin: 1rem 0;
  border: 0;
  border-top: 1px solid var(--or3-border);
}

:deep(.or3-markdown-editor .ProseMirror blockquote) {
  margin: 1rem 0;
  border-left: 3px solid var(--or3-border);
  padding-left: 0.9rem;
  color: var(--or3-text-muted);
}
</style>