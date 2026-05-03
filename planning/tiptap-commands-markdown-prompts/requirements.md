---
artifact_id: 77bbf1d4-4b57-4f8b-94d0-39f44bf64b7d
title: requirements.md
feature: tiptap-commands-markdown-prompts
---

# Tiptap Commands, Markdown Editor, and Prompt Gallery Requirements

## Introduction

This feature set improves `or3-app` as a mobile-first companion for `or3-intern` by adding three related workflows:

- `@` file mentions in chat for quickly attaching workspace/computer files as context.
- `/` chat commands for fast local actions such as help, clear chat, new chat, compact/prune context, session info, and status.
- A polished Tiptap-based Markdown/text editor for workspace/computer files, plus a prompt gallery/editor that stores prompts as Markdown files in `.prompts`.

The implementation should stay simple and functional. It should reuse the current `AssistantComposer`, `useComputerFiles`, file browser, chat session state, and `or3-chat` editor/prompt patterns without importing unnecessary architecture.

## Requirements

### 1. Chat `@file` Mentions

**User Story:** As a chat user, I want to type `@` and pick files from my workspace or computer, so that I can add file context without copying paths manually.

#### Acceptance Criteria

1. WHEN the user types `@` in the chat composer THEN the app SHALL show a searchable file suggestion menu.
2. WHEN the user types after `@` THEN the app SHALL search approved file roots using the existing file search API.
3. WHEN search results load THEN the app SHALL show file name, root label, path, and a readable file icon.
4. WHEN the user selects a file THEN the app SHALL insert a visible mention token and add the file to the outgoing attachments/context list.
5. WHEN the user navigates the mention menu with keyboard THEN Arrow Up, Arrow Down, Enter, Tab, and Escape SHALL work.
6. WHEN the user is on mobile THEN the menu SHALL remain thumb-friendly and not cover the send button unnecessarily.
7. IF the connected computer is unavailable or file search fails THEN the app SHALL show a small non-blocking empty/error state and keep normal chat usable.
8. IF the same file is mentioned more than once THEN the app SHALL avoid duplicate outgoing attachments.

### 2. Chat `/` Commands

**User Story:** As a chat user, I want to type `/` and choose common chat actions, so that I can manage the conversation quickly from the composer.

#### Acceptance Criteria

1. WHEN the user types `/` at the start of a composer line THEN the app SHALL show a slash command menu.
2. WHEN the user filters slash commands THEN the menu SHALL match command names, aliases, and descriptions.
3. WHEN the user chooses `/help` or `/commands` THEN the app SHALL add a friendly system message listing available commands.
4. WHEN the user chooses `/clear` THEN the app SHALL clear the current on-screen chat transcript after confirmation on non-empty chats.
5. WHEN the user chooses `/new` THEN the app SHALL start a new local chat session.
6. WHEN the user chooses `/session` THEN the app SHALL show current session key, host, message count, and active job state.
7. WHEN the user chooses `/status` THEN the app SHALL show host health/readiness/capabilities in a concise chat-friendly card/message.
8. WHEN the user chooses `/compact` or `/prune` THEN the app SHALL provide a clear compact-context action that preserves useful summary context and avoids accidental data loss.
9. IF a slash command is unknown THEN the app SHALL treat it as normal chat text unless it is explicitly registered as a local command.
10. WHEN a command is destructive or context-changing THEN the app SHALL explain what will happen before running it.

### 3. Markdown/Text File Editor

**User Story:** As a user, I want to open and edit Markdown or text files from my workspace/computer, so that I can work on notes, docs, and prompts directly from `or3-app`.

#### Acceptance Criteria

1. WHEN the user opens a `.md`, `.markdown`, or `.txt` file from the file browser THEN the app SHALL open a dedicated editor route or full-screen sheet.
2. WHEN the editor loads a file THEN it SHALL show title/path, save status, root label, and a readable editing surface.
3. WHEN the file is Markdown THEN the editor SHALL preserve Markdown round-tripping as much as practical.
4. WHEN the file is plain text THEN the editor SHALL still allow editing and saving without forcing rich formatting.
5. WHEN the user formats content THEN the toolbar SHALL include bold, italic, headings, bullet list, ordered list, inline code, code block, horizontal rule, undo, and redo.
6. WHEN the user taps copy actions THEN the editor SHALL support Copy Markdown and Copy Content.
7. WHEN the user edits content THEN the app SHALL autosave with debounce and also provide an explicit Save button.
8. WHEN a save is in progress or complete THEN the editor SHALL show clear `Saving…`, `Saved`, and `Error` states.
9. IF the file changes on disk or a write conflict is detected THEN the app SHALL avoid silent overwrite and ask the user how to proceed.
10. IF the file is too large or unsupported THEN the app SHALL show a safe fallback preview/download path rather than trying to load it into Tiptap.
11. WHEN used on mobile THEN the toolbar SHALL be horizontally scrollable, large enough to tap, and remain accessible above the keyboard.
12. WHEN used on desktop THEN the editor SHALL use a centered readable document width and keyboard shortcuts.

### 4. Prompt Gallery and Markdown Prompt Editor

**User Story:** As a user, I want a prompt gallery backed by Markdown files in `.prompts`, so that my reusable prompts are portable and easy to edit outside the app.

#### Acceptance Criteria

1. WHEN the user opens the prompt gallery THEN the app SHALL list prompt files from `.prompts` under the workspace root.
2. WHEN `.prompts` does not exist THEN the app SHALL offer to create it in the writable workspace root.
3. WHEN the user creates a prompt THEN the app SHALL create a Markdown file with a safe filename and starter content.
4. WHEN the user edits a prompt THEN the app SHALL use the same polished Markdown editor surface.
5. WHEN the user searches prompts THEN the gallery SHALL match title, filename, and Markdown body text when available.
6. WHEN the user selects a prompt for chat THEN the app SHALL insert or attach the prompt content in a clear way without surprising the user.
7. WHEN the user marks a prompt as favorite/default THEN the app SHALL store that preference locally per host, not inside the Markdown file unless explicitly designed later.
8. IF prompt file read/write fails THEN the app SHALL show a friendly error and keep the gallery usable.
9. WHEN prompt files are edited outside the app THEN refreshing the gallery SHALL pick up new/changed files.

### 5. Service File API Support

**User Story:** As an app user, I want file editing and prompt saving to use the same approved roots as browsing, so that the app stays secure and predictable.

#### Acceptance Criteria

1. WHEN the app reads editor content THEN it SHALL use root-scoped file APIs and never send raw absolute paths from the client.
2. WHEN the app writes a file THEN the backend SHALL verify that the selected root is writable.
3. WHEN a path escapes an approved root THEN the backend SHALL reject the request.
4. WHEN writing existing files THEN the backend SHALL support conflict detection using modified time, revision token, or equivalent lightweight precondition.
5. WHEN writing prompt files THEN the backend SHALL only create/write under the workspace `.prompts` folder unless the user intentionally uses the general editor.
6. WHEN a write completes THEN file browser state SHALL be refreshable without stale metadata.

### 6. UX, Performance, and Accessibility

**User Story:** As a mobile user, I want these features to feel fast, calm, and obvious, so that editing and command selection do not feel like desktop tools crammed onto a phone.

#### Acceptance Criteria

1. WHEN suggestion menus open THEN they SHALL appear within 150ms after local debounce for common searches.
2. WHEN suggestion or search requests are in flight THEN stale responses SHALL be ignored.
3. WHEN the user tabs or swipes through controls THEN focus order SHALL match the visual order.
4. WHEN icon-only buttons are present THEN each SHALL have an accessible label.
5. WHEN the user is offline or unpaired THEN editor, prompt, and command surfaces SHALL show clear disabled states instead of broken controls.
6. WHEN the app builds for Capacitor/static web THEN no server-only code SHALL be imported into the client bundle.
7. WHEN dependencies are added THEN they SHALL be minimal, Tiptap-version-compatible, and installed with Bun.

### 7. Testing and Safety

**User Story:** As a developer, I want reliable tests around command parsing, mentions, Markdown conversion, and file writes, so that these workflows do not lose user data.

#### Acceptance Criteria

1. WHEN command parsing is tested THEN aliases, filtering, unknown commands, and destructive confirmations SHALL be covered.
2. WHEN mention search is tested THEN duplicate file attachment prevention and stale search handling SHALL be covered.
3. WHEN Markdown editing is tested THEN load, format, copy, autosave, explicit save, and conflict states SHALL be covered.
4. WHEN backend write endpoints are tested THEN root scoping, read-only roots, path traversal, overwrite conflicts, and prompt folder creation SHALL be covered.
5. WHEN the feature is complete THEN `bun run typecheck` and focused unit tests SHALL pass.
