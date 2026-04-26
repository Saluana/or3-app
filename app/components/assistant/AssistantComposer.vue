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
import type { AssistantSendPayload, ChatAttachment } from '~/types/app-state'

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

const fileInput = ref<HTMLInputElement | null>(null)
const editor = shallowRef<Editor>()
const isDragging = ref(false)
const isFocused = ref(false)
const dragDepth = ref(0)
const attachments = ref<DraftAttachment[]>([])
const formState = reactive({
  text: props.modelValue,
})

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

  const fileAttachments = attachments.value.filter((attachment) => attachment.kind === 'file')
  if (fileAttachments.length) {
    sections.push(`Local files selected in or3-app (names only, contents not uploaded): ${fileAttachments.map((attachment) => attachment.name).join(', ')}`)
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
    })
  }
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
        if ((event.metaKey || event.ctrlKey) && event.key === 'Enter') {
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
    },
  })

  const dom = editor.value?.view.dom
  dom.addEventListener('dragenter', onDragEnter)
  dom.addEventListener('dragover', onDragOver)
  dom.addEventListener('dragleave', onDragLeave)
  dom.addEventListener('drop', onDrop)

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
