---
artifact_id: 98a07fe4-8847-4f41-9f42-e0879cf9aa9a
title: tasks.md
feature: or3-app-v1
---

# or3-app v1 Implementation Tasks

## 1. Normalize project tooling and dependencies

- [x] 1.1 Convert scaffold scripts from npm to Bun
  - Replace `npm run` script references with `bun run` equivalents in `package.json`.
  - Ensure `postinstall`, `build:web`, `build:mobile`, and `cap:sync` work with Bun.
  - Remove npm-specific assumptions from README.
  - Requirements: 18.1, 18.2

- [x] 1.2 Install and verify reused runtime packages
  - Add `or3-scroll@0.0.3`.
  - Add `streamdown-vue@1.0.29`.
  - Add only required supporting packages for v1 chat/composer behavior.
  - Avoid pulling all of `or3-chat` dependencies unless directly needed.
  - Requirements: 4.4, 4.5, 15.1, 15.2, 16.5

- [ ] 1.3 Add validation scripts
  - Add Bun-based scripts for type check, build, and tests.
  - Confirm Nuxt 4 static build still outputs `.output/public` for Capacitor.
  - Keep Android sync working and document iOS CocoaPods prerequisite.
  - Requirements: 18.2, 18.4, 18.5

## 2. Establish visual system and app shell

- [x] 2.1 Define theme tokens and base CSS
  - Add warm off-white, cream surface, border, text, muted green, amber, danger, and shadow tokens.
  - Add safe-area helper classes for top and bottom app regions.
  - Set mobile-first body/background/font defaults.
  - Requirements: 1.1, 1.6, 2.1, 2.5

- [ ] 2.2 Create reusable UI primitives
  - Build `SurfaceCard.vue`, `SectionHeader.vue`, `StatusPill.vue`, and `RetroIcon.vue`.
  - Use typed props and simple Tailwind class composition.
  - Ensure icon-only controls have accessible labels.
  - Requirements: 2.2, 2.3, 17.1, 17.2

- [ ] 2.3 Build `AppShell.vue`, `AppHeader.vue`, and `BottomNav.vue`
  - Implement mobile bottom nav with Chat, Agents, Add, Computer, Settings.
  - Add pending approval badge and active host status placement.
  - Add desktop adaptive layout without making desktop the primary design.
  - Requirements: 1.1, 1.2, 1.3, 1.4, 1.5

- [ ] 2.4 Create primary route placeholders
  - Add `/`, `/agents`, `/add`, `/computer`, `/settings`, and `/approvals` pages.
  - Use real layout components, not bare placeholders.
  - Add empty/loading/error states early.
  - Requirements: 1.2, 16.3, 17.4

## 3. Implement local app state and host profiles

- [ ] 3.1 Define app state types
  - Add types for host profiles, chat sessions, messages, jobs, approvals, files, terminal sessions, configure sections, and app errors.
  - Keep API types separate from UI view models.
  - Requirements: 3.6, 14.5, 18.3

- [ ] 3.2 Implement local cache composable
  - Persist host profiles, active host ID, last-known status, chat drafts, selected session, recent jobs, and UI preferences.
  - Scope cached data by host ID/base URL.
  - Add a clear-cache path that forces re-pairing.
  - Requirements: 14.1, 14.2, 14.4, 14.5

- [ ] 3.3 Add token storage abstraction
  - Implement a minimal token store interface with web fallback.
  - Document that native secure storage should replace web fallback before production distribution.
  - Keep tokens isolated per host profile.
  - Requirements: 3.3, 3.4, 14.3

## 4. Build typed `or3-intern` REST client

- [ ] 4.1 Implement `useOr3Api`
  - Normalize base URL.
  - Attach `Authorization: Bearer <token>` for protected calls.
  - Support JSON requests/responses and SSE streams.
  - Support abort signals.
  - Requirements: 3.4, 4.1, 4.2, 16.3

- [ ] 4.2 Add typed error mapping
  - Map `400`, `401`, `403`, `404`, `409`, `429`, `502`, and `503` into app error codes.
  - Preserve retry metadata when available.
  - Provide UI-safe messages.
  - Requirements: 3.5, 4.7, 16.3

- [ ] 4.3 Add SSE parsing utilities
  - Parse lifecycle events from turns and jobs.
  - Tolerate unknown event types.
  - Support stream cancellation and fallback to job polling.
  - Requirements: 4.2, 4.3, 6.4, 16.3

- [ ] 4.4 Add REST client tests
  - Test auth headers, base URLs, JSON body handling, error mapping, and SSE parsing.
  - Requirements: 18.4, 18.5

## 5. Implement pairing and active host onboarding

- [ ] 5.1 Build first-run connection screen
  - Collect host URL, display name, and optional device label.
  - Explain private-network/Tailscale expectation.
  - Validate URL format before requesting pairing.
  - Requirements: 3.1, 3.7, 13.4

- [ ] 5.2 Implement pairing request flow
  - Call `POST /internal/v1/pairing/requests`.
  - Show code, expiry, and waiting state.
  - Poll or manually retry exchange when appropriate.
  - Requirements: 3.2, 3.3

- [ ] 5.3 Implement pairing exchange and host storage
  - Call `POST /internal/v1/pairing/exchange`.
  - Store device ID, role, token, and host metadata.
  - Immediately verify with `GET /internal/v1/health`.
  - Requirements: 3.3, 3.4, 7.1

- [ ] 5.4 Add host switcher and auth failure recovery
  - Support multiple hosts.
  - Show unreachable, unauthorized, and forbidden states.
  - Provide re-pair CTA without destroying other profiles.
  - Requirements: 3.5, 3.6, 3.7

- [ ] 5.5 Add paired device management
  - List paired devices with `GET /internal/v1/devices`.
  - Revoke trusted devices with `POST /internal/v1/devices/{deviceId}/revoke`.
  - Rotate tokens with `POST /internal/v1/devices/{deviceId}/rotate` and store/show the replacement token safely.
  - Require confirmation for revoke and rotate actions.
  - Requirements: 3.8, 11.8

## 6. Build chat foundation

- [ ] 6.1 Create chat session state
  - Generate and persist `session_key` values.
  - Store local messages and drafts by host/session.
  - Expose active session selection.
  - Requirements: 4.8, 14.1

- [ ] 6.2 Port simplified composer action registry
  - Adapt `or3-chat` `useComposerActions` to app-local needs.
  - Remove plugin gate dependencies unless needed.
  - Add tests for register, unregister, ordering, visibility, and disabled state.
  - Requirements: 5.4, 15.3, 15.4

- [ ] 6.3 Port simplified chat input bridge
  - Adapt `or3-chat` `useChatInputBridge` for `AssistantComposer`.
  - Support `setText` and `triggerSend` only for v1.
  - Add cleanup expectations and tests.
  - Requirements: 5.5, 15.3, 15.4

- [ ] 6.4 Build `AssistantComposer.vue`
  - Implement mobile-first multiline input.
  - Add attach button, send/stop button, quick action row, and desktop drop zone.
  - Keep keyboard and safe-area behavior comfortable on iOS.
  - Requirements: 5.1, 5.2, 5.3, 5.6, 17.1, 17.3

- [ ] 6.5 Build message rendering components
  - Create `ChatMessageList.vue`, `ChatMessage.vue`, and `StreamingMarkdown.vue`.
  - Use `or3-scroll` for message list behavior.
  - Use `streamdown-vue` for assistant markdown.
  - Requirements: 4.3, 4.4, 4.5, 16.1

- [ ] 6.6 Implement `useAssistantStream`
  - Send turns through `POST /internal/v1/turns`.
  - Handle SSE streaming, JSON fallback, retry, stop/abort, and error states.
  - Record `job_id` for follow-up job status.
  - Requirements: 4.1, 4.2, 4.3, 4.7, 16.3

- [ ] 6.7 Finish Chat page
  - Add header, host/session status, quick prompts, message list, composer, and empty state.
  - Surface pending approvals relevant to active turn.
  - Requirements: 4.1, 4.6, 10.1

## 7. Build agent controller

- [ ] 7.1 Implement `useJobs`
  - Queue subagent jobs with `POST /internal/v1/subagents`.
  - Fetch snapshots through `GET /internal/v1/jobs/{jobId}`.
  - Stream lifecycle through `GET /internal/v1/jobs/{jobId}/stream`.
  - Abort via `POST /internal/v1/jobs/{jobId}/abort`.
  - Requirements: 6.1, 6.3, 6.4, 6.5

- [ ] 7.2 Build agent task form
  - Collect task, optional context, timeout, and tool policy preset.
  - Use friendly labels and avoid exposing raw internals by default.
  - Requirements: 6.1, 17.3

- [ ] 7.3 Build agent list and detail views
  - Show job cards by status.
  - Show timeline/events, output, error, abort, and retry actions.
  - Handle disabled subagent state using health/capabilities.
  - Requirements: 6.2, 6.3, 6.4, 6.5, 6.6

## 8. Build computer overview

- [ ] 8.1 Implement health/readiness/capabilities composables
  - Call `GET /internal/v1/health`.
  - Call `GET /internal/v1/readiness`.
  - Call `GET /internal/v1/capabilities`.
  - Cache last-known responses per host.
  - Requirements: 7.1, 7.2, 7.3, 7.5

- [ ] 8.2 Build Computer overview page
  - Show host card, online/offline state, runtime posture, approvals mode, exec/sandbox availability, and MCP summary.
  - Show warnings and blockers in plain language.
  - Provide entry cards for Files, Terminal, Approvals, Health, and Settings.
  - Requirements: 7.1, 7.2, 7.3, 7.4

## 9. Add or3-intern file API extension

- [ ] 9.1 Design and document file API contract in `or3-intern`
  - Add endpoint contract for roots, list, stat, download, upload, mkdir, and delete/trash.
  - Define auth, config flags, root scoping, and audit behavior.
  - Requirements: 8.1, 8.6, 13.4

- [ ] 9.2 Implement root-scoped file listing backend
  - Add `GET /internal/v1/files/roots`.
  - Add `GET /internal/v1/files/list`.
  - Resolve paths safely against configured roots.
  - Reject traversal and unavailable roots.
  - Requirements: 8.1, 8.2, 8.5

- [ ] 9.3 Implement file metadata and download backend
  - Add `GET /internal/v1/files/stat`.
  - Add `GET /internal/v1/files/download`.
  - Enforce auth, root scoping, and audit events.
  - Requirements: 8.3, 8.5, 13.4

- [ ] 9.4 Implement upload and directory operations backend
  - Add `POST /internal/v1/files/upload` without overwriting by default.
  - Add `POST /internal/v1/files/mkdir`.
  - Add delete/trash only if safety rules are clear.
  - Requirements: 8.4, 8.5

- [ ] 9.5 Add backend tests for file API
  - Test auth, traversal rejection, root scoping, upload overwrite behavior, and error status codes.
  - Requirements: 8.5, 16.4, 18.4

## 10. Build file explorer UI

- [ ] 10.1 Implement `useComputerFiles`
  - Call roots, list, stat, download, upload, mkdir, and delete/trash endpoints.
  - Convert backend errors into UI-safe states.
  - Cache current directory state per host/root.
  - Requirements: 8.1, 8.2, 8.3, 8.7

- [ ] 10.2 Build file browser components
  - Create `FileBrowser.vue`, `FileBreadcrumbs.vue`, and `FileRow.vue`.
  - Add root selector, breadcrumbs, file/folder rows, and search/filter current directory.
  - Requirements: 8.1, 8.2, 8.3, 17.1

- [ ] 10.3 Add file action sheet
  - Add preview metadata, download/share, ask assistant, copy path, upload, and open terminal here actions.
  - Ensure unsupported previews degrade gracefully.
  - Requirements: 8.3, 8.7, 5.5

- [ ] 10.4 Add upload flow
  - Support Capacitor/browser file picker where available.
  - Show confirmation for conflicts.
  - Show progress and result states.
  - Requirements: 8.4, 16.2

## 11. Add or3-intern terminal API extension

- [ ] 11.1 Design and document terminal API contract in `or3-intern`
  - Add endpoint contract for create, stream, input, resize, close, and reconnect.
  - Define config flags, approval behavior, session TTL, audit events, and capability reporting.
  - Requirements: 9.1, 9.2, 9.3, 9.4, 13.4

- [ ] 11.2 Implement bounded terminal session backend
  - Add `POST /internal/v1/terminal/sessions`.
  - Require auth and capability/config enablement.
  - Route shell/session creation through approval checks when required.
  - Requirements: 9.2, 9.3, 9.6

- [ ] 11.3 Implement terminal stream/input/resize/close backend
  - Add SSE or WebSocket output streaming.
  - Add input and resize endpoints.
  - Add explicit close endpoint.
  - Keep reconnect alive for bounded TTL only.
  - Requirements: 9.4, 9.5

- [ ] 11.4 Add backend tests for terminal API
  - Test auth, disabled state, approval-required state, reconnect TTL, close behavior, and audit events.
  - Requirements: 9.2, 9.4, 9.5, 18.4

## 12. Build terminal UI

- [ ] 12.1 Implement `useTerminalSession`
  - Create terminal sessions.
  - Attach to output stream.
  - Send input and resize events.
  - Close sessions intentionally.
  - Handle reconnect and terminal unavailable states.
  - Requirements: 9.1, 9.3, 9.4, 9.5

- [ ] 12.2 Build `TerminalPanel.vue`
  - Use readable monospace output.
  - Keep command input mobile-friendly.
  - Show host, cwd, approval mode, and session status.
  - Avoid dense desktop-only terminal layout on phone.
  - Requirements: 9.1, 9.7, 17.5

- [ ] 12.3 Build Terminal page
  - Add start session, reconnect, close, clear, and open-at-path flows.
  - Surface approval-required state and link to Approvals.
  - Requirements: 9.2, 9.6

## 13. Build approvals and allowlists

- [ ] 13.1 Implement `useApprovals`
  - List approvals with filters.
  - Fetch approval details.
  - Approve, deny, cancel, expire, list allowlists, create allowlist, and remove allowlist.
  - Requirements: 10.1, 10.2, 10.3, 10.4, 10.5, 10.6

- [ ] 13.2 Build approvals overview
  - Show pending approvals prominently.
  - Provide tabs/filters for pending, resolved, expired, and allowlists.
  - Requirements: 10.1, 10.6

- [ ] 13.3 Build approval detail sheet
  - Show readable subject summary and expandable raw JSON.
  - Add approve once, approve and remember, deny, cancel actions.
  - Do not expose returned tokens unnecessarily.
  - Requirements: 10.2, 10.3, 10.4, 10.5, 10.7

- [ ] 13.4 Add approval notifications/badges
  - Add badge in app shell.
  - Add card on Chat/Computer when pending approvals exist.
  - Use bounded polling that pauses in background.
  - Requirements: 10.1, 16.2

## 14. Build settings and configuration management

- [ ] 14.1 Implement configure composables
  - Call `GET /internal/v1/configure/sections`.
  - Call `GET /internal/v1/configure/fields`.
  - Call `POST /internal/v1/configure/apply`.
  - Requirements: 11.2, 11.3, 11.4

- [ ] 14.2 Build Settings overview
  - Group Account/Device, Host Connection, Provider, Memory, Tools, Approvals, Channels, Automations, Privacy, Appearance, Advanced.
  - Use clean rows, toggles, chevrons, status pills, and plain-language descriptions.
  - Requirements: 11.1, 17.3

- [ ] 14.3 Build generic configure section editor
  - Render text, secret, boolean, choice, and list fields.
  - Preserve unsaved input on backend validation errors.
  - Confirm security-sensitive changes.
  - Requirements: 11.3, 11.4, 11.5, 11.6, 11.7

## 15. Build memory, context, embeddings, scope, and audit surfaces

- [ ] 15.1 Implement embeddings and scope composables
  - Call `GET /internal/v1/embeddings/status`.
  - Call `POST /internal/v1/embeddings/rebuild`.
  - Call scope link, resolve, and sessions endpoints.
  - Requirements: 12.2, 12.3, 12.4, 12.5

- [ ] 15.2 Build Memory surface
  - Show memory/context status, embedding fingerprint, doc index status where available, and rebuild actions.
  - Clearly distinguish status from browsable memory content when full content APIs are unavailable.
  - Requirements: 12.1, 12.6

- [ ] 15.3 Implement audit composable and Trust UI
  - Call `GET /internal/v1/audit`.
  - Call `POST /internal/v1/audit/verify`.
  - Show enabled/available/strict/verify status and event count.
  - Requirements: 13.1, 13.2, 13.3

## 16. Build Add hub and cross-surface actions

- [ ] 16.1 Build Add page/action hub
  - Add large cards for New Memory, Upload File, Take Note, Scan Document later, New Automation, Ask Assistant, New Agent Task.
  - Route actions into existing composer/agent/file flows using the input bridge where appropriate.
  - Requirements: 5.2, 5.5, 8.4, 6.1

- [ ] 16.2 Add file-to-chat and agent-to-chat flows
  - “Ask assistant about this file” should programmatically send a concise prompt with the selected path/context.
  - Agent result actions should allow continuing in chat.
  - Requirements: 5.5, 8.3, 6.3

## 17. Polish mobile, desktop, and Capacitor behavior

- [ ] 17.1 Audit safe-area and keyboard behavior
  - Validate app shell, composer, bottom nav, sheets, and terminal input on iOS-sized viewports.
  - Requirements: 1.1, 1.2, 1.6, 5.1

- [ ] 17.2 Add responsive desktop layout
  - Add wider layout improvements for desktop without changing mobile primary UX.
  - Keep files/terminal/chat usable side-by-side where space allows.
  - Requirements: 1.3, 16.5

- [ ] 17.3 Add native polish plan hooks
  - Prepare StatusBar/SplashScreen/Keyboard/Haptics integration points without adding unnecessary plugins yet.
  - Document what native plugins should be added before App Store/TestFlight builds.
  - Requirements: 18.2, 16.5

## 18. Testing and verification

- [ ] 18.1 Add unit tests
  - Test REST client, SSE parser, pairing state, composer action registry, chat input bridge, approvals payloads, configure payloads, and local cache scoping.
  - Requirements: 18.4, 18.5

- [ ] 18.2 Add component tests
  - Test bottom nav, assistant composer, message rendering, approval detail sheet, settings fields, and file breadcrumbs.
  - Requirements: 17.1, 17.2, 17.3, 17.4

- [ ] 18.3 Add integration tests with mocked `or3-intern`
  - Cover pairing, chat stream, agent queue/abort, approvals, configure apply, file browsing, and terminal session flows.
  - Requirements: 3.2, 4.2, 6.1, 8.1, 9.3, 10.3, 11.4

- [ ] 18.4 Add mobile E2E smoke tests
  - Test first-run pairing, send chat, approve action, browse files, create agent job, and change settings at 390px width.
  - Requirements: 1.1, 3.1, 4.1, 8.1, 10.3, 11.4

- [ ] 18.5 Run final validation
  - Run Bun install, type check, unit tests, production build, and Capacitor sync.
  - Document any platform prerequisites such as CocoaPods.
  - Requirements: 18.1, 18.2, 18.5

## 19. Documentation and handoff

- [ ] 19.1 Update project README
  - Document Bun workflow.
  - Document host pairing and private-network assumptions.
  - Document build and Capacitor commands.
  - Requirements: 3.1, 18.1, 18.2

- [ ] 19.2 Document v1 backend extension contracts
  - Add file API and terminal API docs to `or3-intern` once implemented.
  - Include security model, root scoping, approvals, audit events, and examples.
  - Requirements: 8.6, 9.3, 13.4

- [ ] 19.3 Create v1 release checklist
  - Include mobile viewport checks, host security posture checks, API compatibility checks, and native platform prerequisites.
  - Requirements: 16.2, 16.3, 17.1, 18.5
