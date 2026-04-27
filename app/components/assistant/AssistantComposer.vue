<template>
  <UForm :state="formState" class="sticky bottom-22 z-20 mt-4 rounded-[26px] border border-(--or3-border) bg-(--or3-surface) p-3 shadow-(--or3-shadow)" @submit.prevent="submit">
    <div v-if="isDragging" class="mb-3 rounded-2xl border border-dashed border-(--or3-green) bg-(--or3-green-soft) p-3 text-center text-sm text-(--or3-green-dark)">
      Drop files to attach them
    </div>

    <div class="rounded-[22px] border border-(--or3-border) bg-white/60 px-3 py-3 transition-colors" :class="isFocused ? 'border-(--or3-green)' : ''" @click="focusEditor">
      <EditorContent
        v-if="editor"
        :editor="editor"
        class="assistant-composer-editor min-h-14 max-h-44 overflow-y-auto text-base leading-6 text-(--or3-text)"
        aria-label="Message or3-intern"
      />
    </div>

    <div
      v-if="mentionState.open"
      class="mt-2 overflow-hidden rounded-2xl border border-(--or3-border) bg-(--or3-surface) shadow-(--or3-shadow-soft)"
    >
      <div class="flex items-center gap-2 border-b border-(--or3-border) px-3 py-2 text-xs text-(--or3-text-muted)">
        <Icon name="i-lucide-file-search" class="size-3.5 text-(--or3-green-dark)" />
        <span class="font-mono uppercase tracking-[0.16em]">Mention file</span>
        <span v-if="mentionState.loading" class="ml-auto">Searching…</span>
      </div>
      <div v-if="mentionState.items.length" class="max-h-56 overflow-y-auto p-1">
        <button
          v-for="(item, index) in mentionState.items"
          :key="`${item.root_id}:${item.path}`"
          type="button"
          class="flex w-full items-start gap-2 rounded-xl px-3 py-2 text-left text-sm"
          :class="index === mentionState.selectedIndex ? 'bg-(--or3-green-soft) text-(--or3-green-dark)' : 'text-(--or3-text) hover:bg-(--or3-surface-soft)'"
          @mousedown.prevent="selectMention(item)"
        >
          <Icon name="i-lucide-file" class="mt-0.5 size-4 shrink-0" />
          <span class="min-w-0 flex-1">
            <span class="block truncate font-medium">{{ item.name }}</span>
            <span class="block truncate text-xs text-(--or3-text-muted)">{{ item.root_label }} / {{ item.path }}</span>
          </span>
        </button>
      </div>
      <p v-else class="px-3 py-3 text-sm text-(--or3-text-muted)">
        {{ mentionState.loading ? 'Searching workspace files…' : 'No files found. Keep typing after @ to search.' }}
      </p>
    </div>

    <div v-if="attachments.length" class="mt-3 flex flex-wrap gap-2">
      <button
        v-for="attachment in attachments"
        :key="attachment.id"
        type="button"
        class="inline-flex max-w-full items-center gap-2 rounded-2xl border border-(--or3-border) bg-(--or3-surface-soft) px-3 py-2 text-left text-xs text-(--or3-text)"
        @click="removeAttachment(attachment.id)"
      >
        <Icon :name="attachment.kind === 'text' ? 'i-lucide-notebook-text' : 'i-lucide-paperclip'" class="size-3.5 shrink-0 text-(--or3-green-dark)" />
        <span class="min-w-0 flex-1 truncate">
          <span class="block font-medium text-(--or3-text)">{{ attachment.name }}</span>
          <span v-if="attachment.preview" class="block truncate text-(--or3-text-muted)">{{ attachment.preview }}</span>
        </span>
        <Icon name="i-lucide-x" class="size-3.5 shrink-0 text-(--or3-text-muted)" />
      </button>
    </div>

    <div class="mt-2 flex items-center gap-2">
      <UButton icon="i-lucide-paperclip" color="neutral" variant="ghost" class="or3-touch-target" aria-label="Attach file" type="button" @click="fileInput?.click()" />
      <input ref="fileInput" type="file" multiple class="hidden" accept="image/*,application/pdf,text/plain,.md,.txt,.json" aria-hidden="true" tabindex="-1" @change="handleFiles" />

      <div class="flex flex-1 gap-1 overflow-x-auto pb-1">
        <UButton v-for="entry in actions" :key="entry.action.id" size="xs" color="neutral" variant="soft" :icon="entry.action.icon" :label="entry.action.label" :disabled="entry.disabled" type="button" @click="entry.action.handler(actionContext)" />
      </div>

      <UButton v-if="!streaming" icon="i-lucide-send" class="or3-touch-target bg-(--or3-green) text-white hover:bg-(--or3-green-dark)" aria-label="Send message" type="submit" :disabled="!canSend" />
      <UButton v-else icon="i-lucide-square" color="error" variant="soft" class="or3-touch-target" aria-label="Stop generation" type="button" @click="emit('stop')" />
    </div>
  </UForm>
</template>

<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, reactive, ref, shallowRef, watch } from 'vue'
import { Editor, EditorContent } from '@tiptap/vue-3'
import StarterKit from '@tiptap/starter-kit'
import Placeholder from '@tiptap/extension-placeholder'
import { registerPaneInput, unregisterPaneInput } from '~/composables/useChatInputBridge'
import { useComposerActions } from '~/composables/useComposerActions'
import { useComputerFiles } from '~/composables/useComputerFiles'
import type { AssistantSendPayload, ChatAttachment } from '~/types/app-state'
import type { FileSearchItem } from '~/types/or3-api'

const props = withDefaults(defineProps<{ modelValue?: string; streaming?: boolean; paneId?: string }>(), {
  modelValue: '',
  streaming: false,
  paneId: 'main',
})

const emit = defineEmits<{
  'update:modelValue': [value: string]
  send: [value: AssistantSendPayload]
  stop: []
}>()

interface DraftAttachment extends ChatAttachment {
  content?: string
}

interface MentionEditorState {
  state: {
    selection: {
      empty: boolean
      from: number
    }
    doc: {
      textBetween: (from: number, to: number, blockSeparator?: string, leafText?: string) => string
    }
  }
}

const fileInput = ref<HTMLInputElement | null>(null)
const editor = shallowRef<Editor>()
const isDragging = ref(false)
const isFocused = ref(false)
const dragDepth = ref(0)
const attachments = ref<DraftAttachment[]>([])
const { searchWorkspaceFiles } = useComputerFiles()
const formState = reactive({
  text: props.modelValue,
})
const mentionState = reactive<{
  open: boolean
  query: string
  from: number
  to: number
  selectedIndex: number
  loading: boolean
  items: FileSearchItem[]
}>({
  open: false,
  query: '',
  from: 0,
  to: 0,
  selectedIndex: 0,
  loading: false,
  items: [],
})
let mentionSearchTimer: ReturnType<typeof setTimeout> | null = null

watch(() => props.modelValue, (value) => {
  if (formState.text === value) return
  formState.text = value
  if (editor.value && editor.value.getText({ blockSeparator: '\n\n' }) !== value) {
    editor.value.commands.setContent(value || '', false)
  }
})

watch(() => formState.text, (value) => {
  if (props.modelValue !== value) emit('update:modelValue', value)
})

const actionContext = computed(() => ({
  text: formState.text,
  isStreaming: props.streaming,
  setText: (value: string) => {
    updateEditorText(value)
    nextTick(() => focusEditor())
  },
  send: submit,
}))

const actions = useComposerActions(() => actionContext.value)
const canSend = computed(() => !!formState.text.trim() || attachments.value.length > 0)

function attachmentId() {
  return `attachment_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`
}

function summarizeText(text: string, maxWords = 12) {
  const words = text.trim().split(/\s+/).filter(Boolean)
  return words.slice(0, maxWords).join(' ') + (words.length > maxWords ? '…' : '')
}

function updateEditorText(value: string) {
  formState.text = value
  editor.value?.commands.setContent(value || '', false)
}

function focusEditor() {
  editor.value?.commands.focus('end')
}

function removeAttachment(id: string) {
  attachments.value = attachments.value.filter((attachment) => attachment.id !== id)
}

function closeMention() {
  mentionState.open = false
  mentionState.query = ''
  mentionState.items = []
  mentionState.selectedIndex = 0
  mentionState.loading = false
}

function buildTransportText() {
  const sections: string[] = []
  const promptText = formState.text.trim()
  if (promptText) sections.push(promptText)

  const textAttachments = attachments.value.filter((attachment) => attachment.kind === 'text' && attachment.content)
  if (textAttachments.length) {
    sections.push([
      'Additional pasted context:',
      ...textAttachments.map((attachment, index) => `Context block ${index + 1} (${attachment.name}):\n${attachment.content}`),
    ].join('\n\n'))
  }

  const workspaceFiles = attachments.value.filter((attachment) => attachment.kind === 'file' && attachment.source === 'workspace')
  if (workspaceFiles.length) {
    sections.push([
      'Workspace files mentioned by the user:',
      ...workspaceFiles.map((attachment) => `- ${attachment.rootId || 'workspace'}:${attachment.path || attachment.name}`),
    ].join('\n'))
  }

  const localFiles = attachments.value.filter((attachment) => attachment.kind === 'file' && attachment.source !== 'workspace')
  if (localFiles.length) {
    sections.push(`Local files selected in or3-app (names only, contents not uploaded): ${localFiles.map((attachment) => attachment.name).join(', ')}`)
  }

  return sections.join('\n\n').trim()
}

function visiblePayloadText() {
  const promptText = formState.text.trim()
  if (promptText) return promptText
  if (attachments.value.length === 1) return `Shared ${attachments.value[0]?.name || 'an attachment'} for context.`
  return `Shared ${attachments.value.length} attachments for context.`
}

function submit() {
  if (!canSend.value || props.streaming) return
  const payload: AssistantSendPayload = {
    text: visiblePayloadText(),
    transportText: buildTransportText(),
    attachments: attachments.value.map(({ content: _content, ...attachment }) => attachment),
  }
  emit('send', payload)
  attachments.value = []
  updateEditorText('')
}

function addFiles(files: File[]) {
  for (const file of files) {
    attachments.value.push({
      id: attachmentId(),
      kind: 'file',
      name: file.name,
      preview: file.type ? file.type.replace(/\/.+$/, '').toUpperCase() : 'FILE',
      mimeType: file.type || undefined,
      size: file.size || undefined,
      source: 'local',
    })
  }
}

function addWorkspaceFileMention(item: FileSearchItem) {
  const id = `${item.root_id}:${item.path}`
  if (attachments.value.some((attachment) => attachment.id === id)) return
  attachments.value.push({
    id,
    kind: 'file',
    source: 'workspace',
    name: item.name,
    preview: item.path,
    mimeType: item.mime_type || undefined,
    size: item.size || undefined,
    path: item.path,
    rootId: item.root_id,
  })
}

function scheduleMentionSearch(query: string) {
  if (mentionSearchTimer) clearTimeout(mentionSearchTimer)
  mentionState.loading = true
  mentionSearchTimer = setTimeout(async () => {
    const activeQuery = query.trim()
    try {
      const items = await searchWorkspaceFiles(activeQuery, 12)
      if (!mentionState.open || mentionState.query !== query) return
      mentionState.items = items
      mentionState.selectedIndex = 0
    } finally {
      if (mentionState.query === query) mentionState.loading = false
    }
  }, 120)
}

function updateMentionState(instance: MentionEditorState) {
  const { selection, doc } = instance.state
  if (!selection.empty) {
    closeMention()
    return
  }
  const to = selection.from
  const from = Math.max(0, to - 96)
  const textBefore = doc.textBetween(from, to, '\n', '\n')
  const atIndex = textBefore.lastIndexOf('@')
  if (atIndex < 0) {
    closeMention()
    return
  }
  const previous = atIndex > 0 ? textBefore.at(atIndex - 1) : ' '
  const query = textBefore.slice(atIndex + 1)
  if ((previous && !/\s|[(\[{]/.test(previous)) || /\s/.test(query) || query.length > 80) {
    closeMention()
    return
  }
  mentionState.open = true
  mentionState.query = query
  mentionState.from = from + atIndex
  mentionState.to = to
  scheduleMentionSearch(query)
}

function selectMention(item = mentionState.items[mentionState.selectedIndex]) {
  if (!item || !editor.value) return
  addWorkspaceFileMention(item)
  editor.value
    .chain()
    .focus()
    .insertContentAt({ from: mentionState.from, to: mentionState.to }, `@${item.path} `)
    .run()
  closeMention()
}

function addPastedText(text: string) {
  const wordCount = text.trim().split(/\s+/).filter(Boolean).length
  if (wordCount < 120) return false
  attachments.value.push({
    id: attachmentId(),
    kind: 'text',
    name: 'Pasted text',
    preview: summarizeText(text),
    content: text.trim(),
  })
  return true
}

function handleFiles(event: Event) {
  const input = event.target as HTMLInputElement
  addFiles(Array.from(input.files ?? []))
  input.value = ''
}

async function handlePaste(event: ClipboardEvent) {
  const items = Array.from(event.clipboardData?.items ?? [])
  const files = items
    .map((item) => item.kind === 'file' ? item.getAsFile() : null)
    .filter((file): file is File => !!file)

  if (files.length) {
    event.preventDefault()
    addFiles(files)
    return
  }

  const text = event.clipboardData?.getData('text/plain')?.trim() || ''
  if (text && addPastedText(text)) {
    event.preventDefault()
  }
}

function hasFilePayload(event: DragEvent) {
  return Array.from(event.dataTransfer?.types ?? []).includes('Files')
}

function onDragEnter(event: DragEvent) {
  if (!hasFilePayload(event)) return
  event.preventDefault()
  dragDepth.value += 1
  isDragging.value = true
}

function onDragOver(event: DragEvent) {
  if (!hasFilePayload(event)) return
  event.preventDefault()
  isDragging.value = true
}

function onDragLeave(event: DragEvent) {
  if (!hasFilePayload(event)) return
  event.preventDefault()
  dragDepth.value = Math.max(0, dragDepth.value - 1)
  if (!dragDepth.value) isDragging.value = false
}

function onDrop(event: DragEvent) {
  if (!hasFilePayload(event)) return
  event.preventDefault()
  dragDepth.value = 0
  isDragging.value = false
  addFiles(Array.from(event.dataTransfer?.files ?? []))
}

onMounted(() => {
  editor.value = new Editor({
    content: props.modelValue || '',
    extensions: [
      StarterKit.configure({
        heading: false,
        blockquote: false,
        bulletList: false,
        orderedList: false,
        codeBlock: false,
        horizontalRule: false,
      }),
      Placeholder.configure({ placeholder: 'Ask or3-intern to help with your computer…' }),
    ],
    autofocus: false,
    editorProps: {
      attributes: {
        class: 'min-h-14 outline-none',
      },
      handleKeyDown(_view, event) {
        if (mentionState.open) {
          if (event.key === 'ArrowDown') {
            event.preventDefault()
            mentionState.selectedIndex = Math.min(mentionState.items.length - 1, mentionState.selectedIndex + 1)
            return true
          }
          if (event.key === 'ArrowUp') {
            event.preventDefault()
            mentionState.selectedIndex = Math.max(0, mentionState.selectedIndex - 1)
            return true
          }
          if ((event.key === 'Enter' || event.key === 'Tab') && mentionState.items.length) {
            event.preventDefault()
            selectMention()
            return true
          }
          if (event.key === 'Escape') {
            event.preventDefault()
            closeMention()
            return true
          }
        }

        if (event.key === 'Enter' && !event.shiftKey && !event.isComposing) {
          event.preventDefault()
          submit()
          return true
        }
        return false
      },
      handlePaste(_view, event) {
        void handlePaste(event)
        return false
      },
    },
    onFocus() {
      isFocused.value = true
    },
    onBlur() {
      isFocused.value = false
    },
    onUpdate({ editor: instance }) {
      formState.text = instance.getText({ blockSeparator: '\n\n' })
      updateMentionState(instance)
    },
    onSelectionUpdate({ editor: instance }) {
      updateMentionState(instance)
    },
  })

  const dom = editor.value?.view.dom
  dom?.addEventListener('dragenter', onDragEnter)
  dom?.addEventListener('dragover', onDragOver)
  dom?.addEventListener('dragleave', onDragLeave)
  dom?.addEventListener('drop', onDrop)

  registerPaneInput(props.paneId, {
    setText: (value) => {
      updateEditorText(value)
      nextTick(() => focusEditor())
    },
    triggerSend: submit,
  })
})

onBeforeUnmount(() => {
  unregisterPaneInput(props.paneId)
  if (mentionSearchTimer) clearTimeout(mentionSearchTimer)
  const dom = editor.value?.view.dom
  dom?.removeEventListener('dragenter', onDragEnter)
  dom?.removeEventListener('dragover', onDragOver)
  dom?.removeEventListener('dragleave', onDragLeave)
  dom?.removeEventListener('drop', onDrop)
  editor.value?.destroy()
})
</script>

<style scoped>
:deep(.assistant-composer-editor .ProseMirror) {
  min-height: 3.5rem;
  outline: none;
  white-space: pre-wrap;
  word-break: break-word;
}

:deep(.assistant-composer-editor .ProseMirror p.is-editor-empty:first-child::before) {
  content: attr(data-placeholder);
  float: left;
  color: var(--or3-text-muted);
  pointer-events: none;
  height: 0;
}

:deep(.assistant-composer-editor .ProseMirror p) {
  margin: 0;
}
</style>
