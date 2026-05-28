import StarterKit from '@tiptap/starter-kit'
import { Markdown } from 'tiptap-markdown'

const markdownExtensions = [
  StarterKit.configure({
    heading: { levels: [1, 2, 3] },
  }),
  Markdown.configure({
    html: false,
    tightLists: true,
    tightListClass: 'tight',
  }),
]

function hasMarkdownStorage(value: unknown): value is { getMarkdown: () => string } {
  if (!value || typeof value !== 'object') return false
  if (!('getMarkdown' in value)) return false
  return typeof (value as { getMarkdown?: unknown }).getMarkdown === 'function'
}

export function createMarkdownEditorExtensions(): any[] {
  return markdownExtensions
}

export function markdownToEditorContent(markdown: string): string {
  return typeof markdown === 'string' ? markdown : ''
}

export function editorToMarkdown(editor: { storage?: unknown; getText: (options?: { blockSeparator?: string }) => string }): string {
  const storage = editor.storage as unknown as Record<string, unknown> | undefined
  const markdownStorage = storage?.markdown
  if (hasMarkdownStorage(markdownStorage)) {
    return markdownStorage.getMarkdown()
  }
  return editor.getText({ blockSeparator: '\n\n' }).trim()
}
