import { computed, type ComputedRef, type Ref } from 'vue'
import type { Editor } from '@tiptap/vue-3'

export interface EditorCommandAction {
  id: string
  label: string
  icon: string
  run: () => void | Promise<void>
  isActive?: boolean
  disabled?: boolean
}

export interface EditorCommandOptions {
  copyMarkdown?: () => void | Promise<void>
  copyPlainText?: () => void | Promise<void>
  save?: () => void | Promise<void>
  saving?: Ref<boolean> | ComputedRef<boolean>
}

export function useEditorCommands(editorRef: Ref<Editor | null | undefined>, options: EditorCommandOptions = {}) {
  return computed<EditorCommandAction[]>(() => {
    const editor = (editorRef.value as any) ?? null
    const saving = Boolean(options.saving?.value)
    const canRun = (callback: () => boolean, fallback = false) => {
      try {
        return editor ? callback() : fallback
      } catch {
        return fallback
      }
    }

    const actions: EditorCommandAction[] = [
      {
        id: 'bold',
        label: 'Bold',
        icon: 'i-pixelarticons-edit',
        run: () => { editor?.chain().focus().toggleBold().run() },
        isActive: canRun(() => editor?.isActive('bold') === true),
        disabled: !canRun(() => editor?.can().chain().focus().toggleBold().run() === true),
      },
      {
        id: 'italic',
        label: 'Italic',
        icon: 'i-pixelarticons-edit-box',
        run: () => { editor?.chain().focus().toggleItalic().run() },
        isActive: canRun(() => editor?.isActive('italic') === true),
        disabled: !canRun(() => editor?.can().chain().focus().toggleItalic().run() === true),
      },
      {
        id: 'heading',
        label: 'Heading',
        icon: 'i-pixelarticons-book-open',
        run: () => { editor?.chain().focus().toggleHeading({ level: 2 }).run() },
        isActive: canRun(() => editor?.isActive('heading', { level: 2 }) === true),
        disabled: !canRun(() => editor?.can().chain().focus().toggleHeading({ level: 2 }).run() === true),
      },
      {
        id: 'bullet-list',
        label: 'Bullet list',
        icon: 'i-pixelarticons-list',
        run: () => { editor?.chain().focus().toggleBulletList().run() },
        isActive: canRun(() => editor?.isActive('bulletList') === true),
        disabled: !canRun(() => editor?.can().chain().focus().toggleBulletList().run() === true),
      },
      {
        id: 'ordered-list',
        label: 'Numbered list',
        icon: 'i-pixelarticons-list',
        run: () => { editor?.chain().focus().toggleOrderedList().run() },
        isActive: canRun(() => editor?.isActive('orderedList') === true),
        disabled: !canRun(() => editor?.can().chain().focus().toggleOrderedList().run() === true),
      },
      {
        id: 'inline-code',
        label: 'Inline code',
        icon: 'i-pixelarticons-code',
        run: () => { editor?.chain().focus().toggleCode().run() },
        isActive: canRun(() => editor?.isActive('code') === true),
        disabled: !canRun(() => editor?.can().chain().focus().toggleCode().run() === true),
      },
      {
        id: 'code-block',
        label: 'Code block',
        icon: 'i-pixelarticons-terminal',
        run: () => { editor?.chain().focus().toggleCodeBlock().run() },
        isActive: canRun(() => editor?.isActive('codeBlock') === true),
        disabled: !canRun(() => editor?.can().chain().focus().toggleCodeBlock().run() === true),
      },
      {
        id: 'horizontal-rule',
        label: 'Divider',
        icon: 'i-pixelarticons-minus',
        run: () => { editor?.chain().focus().setHorizontalRule().run() },
        disabled: !canRun(() => editor?.can().chain().focus().setHorizontalRule().run() === true),
      },
      {
        id: 'undo',
        label: 'Undo',
        icon: 'i-pixelarticons-undo',
        run: () => { editor?.chain().focus().undo().run() },
        disabled: !canRun(() => editor?.can().chain().focus().undo().run() === true),
      },
      {
        id: 'redo',
        label: 'Redo',
        icon: 'i-pixelarticons-redo',
        run: () => { editor?.chain().focus().redo().run() },
        disabled: !canRun(() => editor?.can().chain().focus().redo().run() === true),
      },
    ]

    if (options.copyMarkdown) {
      actions.push({
        id: 'copy-markdown',
        label: 'Copy Markdown',
        icon: 'i-pixelarticons-copy',
        run: options.copyMarkdown,
      })
    }

    if (options.copyPlainText) {
      actions.push({
        id: 'copy-text',
        label: 'Copy Text',
        icon: 'i-pixelarticons-article',
        run: options.copyPlainText,
      })
    }

    if (options.save) {
      actions.push({
        id: 'save',
        label: saving ? 'Saving…' : 'Save',
        icon: saving ? 'i-pixelarticons-loader' : 'i-pixelarticons-save',
        run: options.save,
        disabled: saving,
      })
    }

    return actions
  })
}