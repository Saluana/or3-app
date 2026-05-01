---
artifact_id: f6af33ef-3eb0-41f8-b5cb-5bec9c724f2e
title: tasks.md
feature: tiptap-commands-markdown-prompts
---

# Tiptap Commands, Markdown Editor, and Prompt Gallery Tasks

## 1. Prepare dependencies and shared editor utilities

- [ ] 1.1 Add version-compatible Tiptap dependencies
  - Install `@tiptap/extension-mention`, `@tiptap/suggestion`, and `tiptap-markdown` with Bun.
  - Keep versions aligned with current `@tiptap/*` v2 packages unless a dedicated upgrade task is created.
  - Run `bun install` and `bun run typecheck`.
  - Requirements: 6.6, 6.7

- [ ] 1.2 Create shared editor command helpers
  - Add reusable toolbar command definitions for bold, italic, headings, lists, inline code, code block, horizontal rule, undo, redo, copy, and save.
  - Base behavior on `or3-chat` document editor patterns, but keep app-specific code small.
  - Requirements: 3.5, 3.11, 3.12

- [ ] 1.3 Add Markdown conversion adapter
  - Wrap Markdown extension usage behind `markdownToEditorContent` and `editorToMarkdown` helpers.
  - Add fallback behavior if Markdown parsing fails.
  - Requirements: 3.3, 3.4, 7.3

## 2. Upgrade chat `@file` mentions

- [ ] 2.1 Add file mention item types and search composable
  - Create `useFileMentionSuggestions.ts` using `useComputerFiles().searchWorkspaceFiles`.
  - Add debounce, stale-response protection, loading, and error state.
  - Requirements: 1.2, 1.7, 6.1, 6.2, 7.2

- [ ] 2.2 Build `FileMentionMenu.vue`
  - Render file name, root label, path, type icon, loading, empty, and error states.
  - Support keyboard-highlighted row and pointer selection.
  - Make rows mobile-friendly with large tap targets.
  - Requirements: 1.3, 1.5, 1.6, 6.3, 6.4

- [ ] 2.3 Replace handcrafted mention parsing with Tiptap Mention/Suggestion
  - Configure `@` trigger with custom render text/HTML.
  - Insert readable mention tokens and add workspace file attachments.
  - Preserve current outgoing `buildTransportText()` behavior.
  - Requirements: 1.1, 1.4, 1.8

- [ ] 2.4 Add mention tests
  - Test search filtering, keyboard selection, mouse selection, duplicate prevention, and stale response handling.
  - Requirements: 7.2

## 3. Add `/` chat commands

- [ ] 3.1 Create `useChatCommands.ts`
  - Define a local command registry and filtering helper.
  - Add initial commands: `/help`, `/commands`, `/clear`, `/new`, `/session`, `/status`, `/compact`, `/prune`.
  - Requirements: 2.1, 2.2, 2.9

- [ ] 3.2 Build `SlashCommandMenu.vue`
  - Render command title, description, alias hint, icon, and destructive marker where relevant.
  - Support keyboard navigation and mobile tap targets.
  - Requirements: 2.1, 2.2, 6.3, 6.4

- [ ] 3.3 Wire slash suggestions into `AssistantComposer.vue`
  - Trigger only at the start of a line or after an empty paragraph.
  - On selection, remove the slash query and run the command locally.
  - Let unknown slash text send as normal chat text.
  - Requirements: 2.1, 2.9

- [ ] 3.4 Implement safe command behaviors
  - `/help` and `/commands`: append local system help message.
  - `/clear`: confirm, then clear visible messages for the active session.
  - `/new`: create and switch to a new local chat session.
  - `/session`: append session/host/message count summary.
  - `/status`: append concise health/readiness/capabilities summary.
  - `/compact` and `/prune`: create a compact summary without deleting backend history in the first pass.
  - Requirements: 2.3, 2.4, 2.5, 2.6, 2.7, 2.8, 2.10

- [ ] 3.5 Add command tests
  - Test filtering, aliases, unknown command fallback, command side effects, and destructive confirmations.
  - Requirements: 7.1

## 4. Add backend text file read/write support in `or3-intern`

- [ ] 4.1 Add `GET /internal/v1/files/read`
  - Return root-scoped text content and metadata.
  - Reject directories, binary/unsupported files, large files, unknown roots, and path escapes.
  - Requirements: 3.1, 3.10, 5.1, 5.3

- [ ] 4.2 Add `PUT /internal/v1/files/write`
  - Require writable roots.
  - Write atomically.
  - Support create vs overwrite.
  - Support lightweight conflict detection with revision/modified metadata.
  - Requirements: 3.7, 3.8, 3.9, 5.2, 5.4, 5.6

- [ ] 4.3 Add prompt folder ensure support
  - Either use existing `mkdir` from the app or add a small `files/prompts/ensure` endpoint.
  - Ensure `.prompts` is created only under the workspace root.
  - Requirements: 4.1, 4.2, 5.5

- [ ] 4.4 Add backend file API tests
  - Cover read, write, conflict, read-only roots, path traversal, large/binary rejection, and prompt folder creation.
  - Requirements: 7.4

## 5. Build text file composables in `or3-app`

- [ ] 5.1 Add `useComputerTextFiles.ts`
  - Implement `readTextFile`, `writeTextFile`, and `canEditFile` helpers.
  - Use `downloadFile()` fallback for reads until the read endpoint exists.
  - Surface friendly app errors for read-only, conflict, too-large, and unsupported file states.
  - Requirements: 3.1, 3.2, 3.8, 3.10, 5.1, 5.2

- [ ] 5.2 Add editor route state helpers
  - Encode/decode `root_id` and `path` query params.
  - Preserve return path to the file browser.
  - Requirements: 3.1, 3.2

- [ ] 5.3 Add text file tests
  - Test read fallback, write payload, conflict mapping, and editable extension detection.
  - Requirements: 7.3

## 6. Build the Markdown/text editor UI

- [ ] 6.1 Create `MarkdownEditor.vue`
  - Add mobile-first shell with header, path/status metadata, Tiptap content area, and toolbar.
  - Include autosave debounce and explicit Save.
  - Requirements: 3.2, 3.5, 3.7, 3.8, 3.11, 3.12

- [ ] 6.2 Add toolbar and copy actions
  - Implement formatting buttons, active states, accessible labels, Copy Markdown, Copy Content, Save, Undo, and Redo.
  - Requirements: 3.5, 3.6, 6.4

- [ ] 6.3 Add conflict and error UI
  - Show conflict banner with Reload, Save Copy, and Cancel options.
  - Show read-only and unsupported-file banners.
  - Requirements: 3.9, 3.10, 6.5

- [ ] 6.4 Add `/computer/edit` page
  - Load file by query params.
  - Render `MarkdownEditor`.
  - Save through `useComputerTextFiles`.
  - Return to file browser with preserved root/path.
  - Requirements: 3.1, 3.2, 3.7

- [ ] 6.5 Integrate editor with file browser
  - Show `Edit` for supported Markdown/text files.
  - Keep Download/Open/Ask Assistant actions unchanged.
  - Requirements: 3.1, 3.10

- [ ] 6.6 Add editor component tests
  - Test loading, formatting, copy actions, autosave, explicit save, conflict state, and read-only state.
  - Requirements: 7.3

## 7. Build prompt gallery and file-backed prompt editor

- [ ] 7.1 Add `usePromptFiles.ts`
  - Locate workspace root.
  - Ensure/list `.prompts`.
  - Read prompt title/preview from Markdown.
  - Create safe slug filenames.
  - Store favorite/default prompt preference locally per host.
  - Requirements: 4.1, 4.2, 4.3, 4.5, 4.7, 4.9

- [ ] 7.2 Create `/prompts` gallery page
  - Add mobile-first prompt cards with title, filename, preview, updated date, and actions.
  - Add search and empty state.
  - Add New Prompt action.
  - Requirements: 4.1, 4.2, 4.3, 4.5, 4.8, 6.5

- [ ] 7.3 Reuse `MarkdownEditor` for prompt files
  - Open prompt files from the gallery.
  - Save changes as Markdown files.
  - Keep prompt editing visually similar to document editing but simpler.
  - Requirements: 4.4

- [ ] 7.4 Add chat integration for prompts
  - Add `Use in Chat` action that either fills the chat draft or sends with explicit confirmation.
  - Prefer filling the draft first so users can edit before sending.
  - Requirements: 4.6

- [ ] 7.5 Add prompt tests
  - Test `.prompts` creation, file listing, title extraction, search, safe filename creation, and draft insertion.
  - Requirements: 7.3

## 8. Polish UX and accessibility

- [ ] 8.1 Tune mobile keyboard and safe-area behavior
  - Verify composer menus and editor toolbar remain reachable on iPhone-sized viewports.
  - Add safe bottom padding where needed.
  - Requirements: 1.6, 3.11, 6.3

- [ ] 8.2 Add consistent toasts and empty states
  - Use friendly messages for offline, unpaired, read-only, unsupported, and conflict states.
  - Requirements: 1.7, 4.8, 6.5

- [ ] 8.3 Add route/navigation entry points
  - Add prompt gallery access from Chat/Add/Settings or Computer without crowding bottom nav.
  - Add file editor access from file details.
  - Requirements: 3.1, 4.1

- [ ] 8.4 Run final validation
  - Run `bun run typecheck`.
  - Run focused unit/component tests.
  - Manually test mobile and desktop layouts.
  - Requirements: 7.5
