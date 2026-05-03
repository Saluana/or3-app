---
artifact_id: 87e7e38b-bb96-41fc-8da0-439f17157f00
title: design.md
feature: tiptap-commands-markdown-prompts
---

# Tiptap Commands, Markdown Editor, and Prompt Gallery Design

## Overview

This design adds a small Tiptap-centered editing layer to `or3-app` without turning the app into a complex desktop IDE. The goal is to make common work feel natural from a phone:

- Mention a file in chat with `@`.
- Run local chat actions with `/`.
- Edit Markdown/text files from approved file roots.
- Manage reusable prompt files stored in workspace `.prompts`.

The current app already has most of the foundation:

- `AssistantComposer.vue` uses Tiptap and already implements a custom `@` file popup.
- `useComputerFiles.ts` exposes roots, list, search, stat, download, upload, mkdir, and copy path.
- `FileBrowser.vue` already previews text/image files and offers file actions.
- `useChatSessions.ts` and `useAssistantStream.ts` own local chat state and turn sending.
- `or3-intern` file routes are root-scoped and protect against path escapes, but do not yet provide a clean text write/overwrite endpoint.
- `or3-chat` has useful references for a Tiptap document editor and prompt editor, but `or3-app` should keep a smaller mobile-first implementation.

## Research Notes

Context7/Tiptap findings:

- Tiptap Mention supports custom `renderText`, `renderHTML`, and `suggestion` options. This fits `@file` chips well.
- Tiptap Suggestion-style menus can also power `/` commands with a different trigger character.
- Tiptap Markdown APIs in current docs support `editor.commands.setContent(markdown, { contentType: 'markdown' })` and `editor.getMarkdown()`; because `or3-app` currently uses Tiptap v2, use a v2-compatible Markdown extension such as `tiptap-markdown` unless a deliberate Tiptap v3 upgrade is planned.
- `or3-chat` currently depends on `@tiptap/extension-mention`, `@tiptap/suggestion`, and `tiptap-markdown`; `or3-app` does not yet include those packages.

## High-Level Architecture

```mermaid
flowchart TD
    Chat[Chat Page] --> Composer[AssistantComposer]
    Composer --> MentionExt[@file Mention Extension]
    Composer --> SlashExt[/ Command Suggestion Extension]
    MentionExt --> FileSearch[useComputerFiles.searchWorkspaceFiles]
    SlashExt --> CommandRegistry[useChatCommands]
    CommandRegistry --> ChatSessions[useChatSessions]
    CommandRegistry --> ComputerStatus[useComputerStatus / useJobs]
    CommandRegistry --> AssistantStream[useAssistantStream]

    FileBrowser[FileBrowser] --> EditorRoute[Markdown File Editor Route]
    PromptGallery[Prompt Gallery] --> EditorRoute
    EditorRoute --> MarkdownEditor[MarkdownEditor.vue]
    MarkdownEditor --> FileTextApi[useComputerTextFiles]
    FileTextApi --> InternFiles[or3-intern root-scoped file API]

    PromptGallery --> PromptFiles[usePromptFiles]
    PromptFiles --> PromptsFolder[workspace/.prompts]
```

## Dependencies

Add only what is needed and keep versions aligned with current Tiptap v2 dependencies:

```txt
@tiptap/extension-mention@^2.26.1
@tiptap/suggestion@^2.26.1
tiptap-markdown
```

If `tiptap-markdown` compatibility is poor, fallback options are:

1. Use Markdown extension only in the new editor and keep chat composer plain text.
2. Add small Markdown serialize/parse helpers for the limited toolbar set.
3. Upgrade all Tiptap packages together in a separate dependency task, not mixed into the UX work.

## Components

### `AssistantComposer.vue` Evolution

Keep the current UI, send/stop behavior, attachments, paste handling, drag/drop, and mobile Enter behavior. Replace the handcrafted `updateMentionState` popup over time with extension-backed menus.

Key changes:

- Add `FileMention` Tiptap extension configured with `char: '@'`.
- Add `SlashCommand` suggestion extension configured with `char: '/'` and `startOfLine: true` behavior.
- Keep the outgoing attachment list as the source of truth for file context.
- Keep visible editor text readable: `@filename` or `@path`, not opaque IDs.
- On send, continue using `buildTransportText()` to include mentioned workspace files.

### `FileMentionMenu.vue`

Mobile-first floating suggestion panel.

Responsibilities:

- Render file search results.
- Show loading/empty/error states.
- Support keyboard and pointer selection.
- Call a provided `onSelect(item)` callback.

Suggested item shape:

```ts
export interface FileMentionItem {
    id: string;
    rootId: string;
    rootLabel: string;
    name: string;
    path: string;
    mimeType?: string;
    size?: number;
}
```

### `useFileMentionSuggestions.ts`

Small composable that wraps file search with debounce and stale-response protection.

```ts
export interface FileMentionSearchState {
    items: FileMentionItem[];
    loading: boolean;
    error: string | null;
}

export function useFileMentionSuggestions(options?: {
    debounceMs?: number;
    limit?: number;
}) {
    async function search(query: string): Promise<FileMentionItem[]>;
    return { search };
}
```

### `useChatCommands.ts`

Local registry for slash commands. Keep commands explicit and understandable.

```ts
export interface ChatCommandContext {
    sessionId: string | null;
    sessionKey: string | null;
    messageCount: number;
    runSend: (text: string) => Promise<void> | void;
    addSystemMessage: (content: string) => void;
    confirm: (options: { title: string; description: string }) => Promise<boolean>;
}

export interface ChatCommandItem {
    id: string;
    title: string;
    description: string;
    aliases?: string[];
    icon: string;
    destructive?: boolean;
    run: (ctx: ChatCommandContext) => Promise<void> | void;
}
```

Initial commands:

| Command | Behavior |
| --- | --- |
| `/help`, `/commands` | Add a local system message with command list. |
| `/clear` | Clear visible messages for the active session after confirmation. |
| `/new` | Create and switch to a new local session. |
| `/session` | Add session summary: host, session key, messages, active job. |
| `/status` | Add concise health/readiness/capabilities summary. |
| `/compact`, `/prune` | Compact current chat context into a summary before clearing/reducing visible context. |

For `/compact`, prefer an app-local first version:

1. Confirm with the user.
2. Build a concise summary from recent messages locally where possible.
3. Add a system message labeled `Compacted context`.
4. Keep the original messages until the user confirms clearing, or mark them hidden if hidden-message state is added.

Avoid destructive backend history deletion until a dedicated API contract exists.

### `MarkdownEditor.vue`

Reusable editor component used by file editor and prompt editor.

Responsibilities:

- Load Markdown/text into Tiptap.
- Render a polished toolbar.
- Provide Copy Markdown, Copy Content, Save, and close/back actions.
- Debounced autosave plus explicit Save.
- Mobile-first layout: sticky top bar, horizontal toolbar, safe-area bottom padding.

Toolbar buttons:

- Bold
- Italic
- Heading 1/2/3
- Bullet list
- Ordered list
- Inline code
- Code block
- Horizontal rule
- Undo
- Redo
- Copy Markdown
- Copy Content
- Save

Use `or3-chat` `DocumentEditorRoot.vue` and `useDocumentEditorToolbar.ts` as references, but keep the `or3-app` version smaller and file-focused.

### `MarkdownFileEditorPage`

Route recommendation:

```txt
/computer/edit?root_id=workspace&path=README.md
```

This keeps file editor links simple and avoids path params with slash escaping.

Behavior:

- Resolve `root_id` and `path` from query.
- Read text content through `useComputerTextFiles`.
- Pass content and metadata to `MarkdownEditor`.
- Save through `useComputerTextFiles.writeTextFile()`.
- Return to file browser preserving root/path query where possible.

### `PromptGallery.vue`

Route recommendation:

```txt
/prompts
```

Navigation placement:

- Add an entry card from Chat empty state or Add page.
- Add a small prompt button near composer later if it does not crowd the UI.

Responsibilities:

- List `.md` files under `workspace/.prompts`.
- Search by title/filename/content preview.
- Create `.prompts` folder if missing.
- Create new prompt files.
- Open prompt files in `MarkdownEditor`.
- Insert selected prompt into chat via `programmaticSend` or set the draft text, depending on the action label.

Prompt file format should stay Markdown-first:

```markdown
# Prompt title

Prompt body goes here.
```

Optional YAML frontmatter can be deferred. Store default/favorite prompt IDs in local app preferences keyed by host instead of modifying files.

## Composables and Data Flow

### `useComputerTextFiles.ts`

Wrapper around root-scoped file APIs for text editing.

```ts
export interface TextFileSnapshot {
    rootId: string;
    path: string;
    name: string;
    mimeType?: string;
    modifiedAt?: string;
    size?: number;
    content: string;
    writable: boolean;
    revision?: string;
}

export interface WriteTextFileInput {
    rootId: string;
    path: string;
    content: string;
    expectedRevision?: string;
    create?: boolean;
}
```

Read strategy:

- Short term: use existing `downloadFile()` and decode Blob as UTF-8 for `.md`, `.markdown`, `.txt`, `.json`, and other safe text types.
- Cleaner backend path: add `GET /internal/v1/files/read?root_id=&path=` returning content + metadata.

Write strategy:

- Add `PUT /internal/v1/files/write` to `or3-intern`.
- Require writable root.
- Use root-scoped path resolution.
- Reject files above a conservative text editing size limit.
- Support `expected_modified_at` or `expected_revision` to avoid silent overwrite.

### `usePromptFiles.ts`

Uses `useComputerTextFiles` and `useComputerFiles`.

```ts
export interface PromptFileSummary {
    rootId: string;
    path: string;
    title: string;
    filename: string;
    preview: string;
    modifiedAt?: string;
    favorite?: boolean;
}
```

Behavior:

- Ensure `.prompts` exists under workspace root.
- List prompt files.
- Read prompt text lazily for preview/search.
- Create prompt with safe slug filename.
- Save prompt via text write endpoint.
- Store favorite/default prompt path in `useLocalCache().state.preferences`.

### `useMarkdownEditorState.ts`

Shared editor state for file and prompt editor.

Tracks:

- `contentMarkdown`
- `originalMarkdown`
- `dirty`
- `status: 'loading' | 'ready' | 'saving' | 'saved' | 'error' | 'conflict'`
- `error`
- `lastSavedAt`

## Backend API Additions in `or3-intern`

Existing routes cover browse/search/download/upload/mkdir. Add the minimum needed for safe editing:

### `GET /internal/v1/files/read`

Query:

```txt
root_id=workspace&path=docs/note.md
```

Response:

```ts
interface FileReadResponse {
    root_id: string;
    path: string;
    name: string;
    mime_type?: string;
    size: number;
    modified_at: string;
    revision: string;
    writable: boolean;
    content: string;
}
```

Rules:

- Operator role required.
- Path must resolve under approved root.
- Target must be a file.
- Limit to text-safe extensions/MIME types and a max size such as 1 MB for first pass.

### `PUT /internal/v1/files/write`

Body:

```ts
interface FileWriteRequest {
    root_id: string;
    path: string;
    content: string;
    expected_revision?: string;
    create?: boolean;
}
```

Response:

```ts
interface FileWriteResponse {
    root_id: string;
    path: string;
    status: 'written' | 'created';
    modified_at: string;
    revision: string;
}
```

Rules:

- Operator role required; consider session/step-up if matching upload sensitivity is required.
- Root must be writable.
- Path must remain under root.
- Parent directory must exist unless prompt folder creation is explicit.
- If `expected_revision` does not match, return `409` with current metadata.
- Write atomically through temp file + rename.

### `POST /internal/v1/files/prompts/ensure`

Optional convenience route. It can be skipped if `mkdir` is enough.

Behavior:

- Ensure `workspace/.prompts` exists.
- Return root/path metadata.
- Reject if workspace root is unavailable or read-only.

## UI/UX Details

### Composer Menus

- Position menus above the composer when near the bottom of the screen.
- Keep max height around `14rem` on mobile.
- Use large row targets and visible selected state.
- Use `Searching…` and `No files found` states.
- Keep regular typing smooth: debounce network search by ~120ms.

### Editor Layout

Mobile:

- Full-screen page.
- Header: back, filename/title, save status.
- Toolbar: horizontal scroll with grouped buttons.
- Content: comfortable padding, large text, safe bottom padding.
- Bottom mini bar only if needed for Save/Copy actions.

Desktop:

- Centered editor max width around `820px`.
- Sticky toolbar.
- Optional side metadata card only if it does not clutter the first pass.

### Prompt Gallery

- Card list with title, filename, preview, modified date.
- Primary actions: New Prompt, Search, Open.
- Secondary actions: Use in Chat, Copy, Favorite, Rename, Delete only if backend delete/trash support is added later.
- Avoid destructive delete in first pass unless file deletion API is intentionally implemented.

## Error Handling

| Scenario | Handling |
| --- | --- |
| Host unavailable | Disable search/editor saves, show reconnect prompt. |
| Search fails | Keep composer usable; show small menu error. |
| Read-only root | Allow read/copy; disable save with explanation. |
| Path traversal rejected | Show safe generic error and log details in dev only. |
| File too large | Offer download/copy path instead of editor. |
| Save conflict | Show conflict banner with Reload, Save Copy, and Cancel. |
| Clipboard unavailable | Show toast explaining copy failed. |
| Markdown conversion issue | Preserve raw Markdown in source mode fallback. |

## Testing Strategy

### Unit Tests

- Command filtering and aliases.
- Command side effects for `/help`, `/clear`, `/new`, `/session`, `/status`.
- File mention search debounce and stale-response handling.
- Duplicate attachment prevention.
- Markdown editor state transitions.
- Prompt filename slug generation and title extraction.

### Component Tests

- Composer opens `@` and `/` menus.
- Keyboard navigation selects menu items.
- Markdown toolbar buttons call expected editor commands.
- Editor save/copy buttons reflect status.
- Prompt gallery empty, loading, search, and list states.

### Backend Tests

- `GET /internal/v1/files/read` rejects directories, missing files, path escape, and large/binary files.
- `PUT /internal/v1/files/write` rejects read-only roots and path escapes.
- Write endpoint returns `409` on stale revision.
- Prompt folder creation stays under workspace root.

### Manual QA

- iPhone-sized viewport with keyboard open.
- Desktop browser with drag/drop and keyboard shortcuts.
- Offline/unpaired state.
- Workspace root with `.prompts` missing.
- File changed externally before save.

## Implementation Notes

- Keep `AssistantComposer` plain-text transport behavior; mentions should enrich attachments, not turn chat into rich document storage.
- Do not store prompt bodies in local storage; files are the source of truth.
- Do not expose absolute paths in app state when root-scoped `rootId:path` is enough.
- Do not implement collaboration or live multi-user editing in this pass.
- Do not add delete for prompt files unless the backend file delete/trash story is explicitly approved.
