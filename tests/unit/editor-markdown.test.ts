import { describe, expect, it } from 'vitest'
import { Editor } from '@tiptap/core'
import { createMarkdownEditorExtensions, editorToMarkdown, markdownToEditorContent } from '../../app/utils/editor/markdown'

describe('markdown editor helpers', () => {
  it('passes markdown strings to tiptap-markdown so non-empty files open', () => {
    const source = '# Review\n\n- Open the editor\n- Keep Markdown intact'
    const content = markdownToEditorContent(source)
    let editor: Editor | null = null

    try {
      expect(content).toBe(source)
      expect(() => {
        editor = new Editor({
          extensions: createMarkdownEditorExtensions(),
          content,
        } as any)
      }).not.toThrow()
      expect(editorToMarkdown(editor!)).toContain('Open the editor')
    } finally {
      editor?.destroy()
    }
  })
})
