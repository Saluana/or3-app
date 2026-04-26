---
artifact_id: 77f0a865-7fb9-4eb4-b646-5cd61f87a501
title: requirements.md
feature: or3-app-v1
---

# or3-app v1 Requirements

## Introduction

or3-app v1 is a mobile-first, desktop-capable companion app for `or3-intern`. It should feel like a polished iOS product that gives the user chat, AI agent control, approvals, settings, and safe access to their computer from a phone. The app should reuse proven `or3-chat` work wherever practical, especially `or3-scroll`, `streamdown-vue`, the chat composer/dropper concepts, message rendering patterns, and plugin-style composer actions, while simplifying and polishing the UX for mobile.

The v1 product goal is: **ChatGPT-like conversation + AI agent controller + personal computer controller**, centered around the `or3-intern` REST API and designed to feel like a personal Google Drive/control surface for a trusted computer.

## Requirements

### 1. Mobile-First App Shell and Navigation

**User Story:** As a mobile user, I want a clear app shell with simple tabs, so that I can quickly switch between chat, agents, files, computer control, approvals, and settings from my phone.

#### Acceptance Criteria

1. WHEN the app launches on a 390px-wide iPhone viewport THEN it SHALL render without horizontal scrolling or clipped primary controls.
2. WHEN the user is on any primary screen THEN the app SHALL provide thumb-friendly bottom navigation with safe-area padding.
3. WHEN the user opens the app on desktop THEN the app SHALL adapt to a wider layout without losing mobile-first behavior.
4. WHEN a route is active THEN the nav item SHALL clearly indicate the active section using text and non-color-only affordances.
5. WHEN the user taps a primary tab THEN the touch target SHALL be at least 44px high/wide.
6. WHEN the app runs in Capacitor THEN top and bottom safe areas SHALL be respected.

### 2. Warm Retro-Professional Visual System

**User Story:** As a user, I want the app to look calm, polished, and distinctive, so that it feels like a trustworthy personal AI control app rather than a generic dashboard.

#### Acceptance Criteria

1. WHEN any screen renders THEN it SHALL use the warm off-white, cream surface, muted green, subtle border, and soft shadow visual language defined for or3-app.
2. WHEN section labels or technical status labels appear THEN they SHALL use monospace styling sparingly.
3. WHEN icons appear THEN they SHALL use Nuxt Icon with simple line or pixel-inspired icon names where possible.
4. WHEN the app needs decoration THEN it SHALL avoid cyberpunk, heavy texture, skeuomorphic metal, and cluttered dashboard visuals.
5. WHEN a card or grouped list is rendered THEN it SHALL use rounded mobile-friendly surfaces with readable text contrast.

### 3. Connection and Pairing to or3-intern

**User Story:** As a user, I want to pair my phone or browser with my trusted `or3-intern` computer, so that I can control it securely without exposing it publicly.

#### Acceptance Criteria

1. WHEN no host is configured THEN the app SHALL show an onboarding flow for entering a service URL and starting pairing.
2. WHEN the user starts pairing THEN the app SHALL call `POST /internal/v1/pairing/requests` with display name, role, origin, and device metadata.
3. WHEN the host operator approves pairing THEN the app SHALL exchange the approved code via `POST /internal/v1/pairing/exchange` and store the returned device token securely.
4. WHEN the device token is present THEN all protected API requests SHALL include `Authorization: Bearer <token>`.
5. WHEN the token is rejected with `401` or `403` THEN the app SHALL show a clear reconnect or re-pair prompt.
6. WHEN multiple computers are configured THEN the app SHALL let the user switch active host without deleting existing host profiles.
7. IF a host is not reachable THEN the app SHALL preserve local UI state and show offline/unreachable status without clearing credentials.
8. WHEN the user manages trusted devices THEN the app SHALL list, revoke, and rotate paired devices through the `or3-intern` devices API.

### 4. ChatGPT-Like Chat Experience

**User Story:** As a user, I want a polished chat interface for talking to `or3-intern`, so that I can ask questions, run tasks, and see streamed responses from my computer.

#### Acceptance Criteria

1. WHEN the user sends a message THEN the app SHALL call `POST /internal/v1/turns` using the active `session_key`.
2. WHEN the user sends a message from a connected host THEN the app SHOULD request SSE by sending `Accept: text/event-stream` where supported.
3. WHEN a response streams THEN the app SHALL render incremental assistant output without jank on mobile.
4. WHEN assistant markdown is displayed THEN the app SHALL use `streamdown-vue` for streaming markdown rendering.
5. WHEN the message list grows THEN the app SHALL use `or3-scroll` or an equivalent reused scroll strategy from `or3-chat` to keep bottom anchoring and scrollback reliable.
6. WHEN the user adds attachments or quick actions THEN the app SHALL adapt the `or3-chat` ChatInputDropper concepts into a mobile-first `AssistantComposer`.
7. WHEN a turn fails THEN the app SHALL show retry and error details appropriate to the failure type.
8. WHEN a user starts a new thread/session THEN the app SHALL create or select a distinct `session_key` and keep it visible in a friendly label.

### 5. Mobile-Polished Composer and Input Dropper

**User Story:** As a chat user, I want a comfortable mobile composer with quick actions and file dropping/attachment support, so that I can work from my phone without fighting desktop UI patterns.

#### Acceptance Criteria

1. WHEN the composer is focused on mobile THEN it SHALL remain reachable above the keyboard and bottom safe area.
2. WHEN the user taps attach THEN the app SHALL present mobile-friendly actions such as upload file, take note, scan document later, and paste text.
3. WHEN the user uses desktop drag-and-drop THEN the composer SHALL accept files in a desktop-friendly drop zone.
4. WHEN composer actions are registered THEN the app SHALL use a simple action registry adapted from `or3-chat` `useComposerActions`.
5. WHEN programmatic sends are needed from quick actions or agent screens THEN the app SHALL use a bridge pattern based on `useChatInputBridge` instead of duplicating send logic.
6. WHEN the composer is streaming THEN send and stop states SHALL be visually and semantically distinct.

### 6. Agent Controller

**User Story:** As a user, I want to launch and monitor background agents, so that I can delegate work to `or3-intern` and return later from my phone.

#### Acceptance Criteria

1. WHEN the user creates an agent task THEN the app SHALL call `POST /internal/v1/subagents` with `parent_session_key`, `task`, optional prompt snapshot, timeout, and tool policy.
2. WHEN an agent job is queued THEN the app SHALL show queued, running, completed, failed, or aborted status.
3. WHEN the user opens an agent job THEN the app SHALL fetch `GET /internal/v1/jobs/{jobId}`.
4. WHEN a job supports live updates THEN the app SHALL attach to `GET /internal/v1/jobs/{jobId}/stream`.
5. WHEN the user aborts a running job THEN the app SHALL call `POST /internal/v1/jobs/{jobId}/abort` and show the resulting state.
6. WHEN subagents are disabled or unavailable THEN the app SHALL show a capability-aware disabled state based on `GET /internal/v1/health` and `GET /internal/v1/capabilities`.

### 7. Computer Overview and Health

**User Story:** As a user, I want to see the status and capabilities of my connected computer, so that I know what the app can safely do.

#### Acceptance Criteria

1. WHEN the app connects to a host THEN it SHALL call `GET /internal/v1/health` and show service/runtime/job/approval availability.
2. WHEN the user opens computer status THEN the app SHALL call `GET /internal/v1/readiness` and show blockers, warnings, and ready state.
3. WHEN the user opens capabilities THEN the app SHALL call `GET /internal/v1/capabilities` and summarize runtime profile, approvals, exec/sandbox availability, MCP servers, and network policy.
4. WHEN a host is in a risky posture THEN the app SHALL surface that clearly without preventing read-only use.
5. WHEN the host is unreachable THEN the app SHALL show last-known status and the time it was last checked.

### 8. Files and Folder Explorer

**User Story:** As a user, I want to browse files and folders on my trusted computer from my phone, so that the app feels like a personal Google Drive for my desktop.

#### Acceptance Criteria

1. WHEN the user opens Files THEN the app SHALL show configured roots or the current root-scoped directory.
2. WHEN the user taps a folder THEN the app SHALL navigate into that folder and show breadcrumbs.
3. WHEN the user taps a file THEN the app SHALL show details and available actions such as preview, download, share, ask assistant, and copy path.
4. WHEN the user uploads a file THEN the app SHALL write only under the selected allowed root and SHALL not overwrite existing files without confirmation.
5. WHEN a path traversal attempt occurs THEN the backend SHALL reject it and the app SHALL show a safe error.
6. WHEN direct file REST endpoints are unavailable in current `or3-intern` THEN v1 SHALL include a small root-scoped file API extension modeled after file-portal security constraints.
7. IF files are large or unsupported for preview THEN the app SHALL show metadata and offer download/share instead of trying to render the full file.

### 9. Terminal and Command Control

**User Story:** As a user, I want controlled terminal access to my trusted computer, so that I can operate my machine from my phone when needed.

#### Acceptance Criteria

1. WHEN the user opens Terminal THEN the app SHALL show a clear safety boundary, current host, working directory, and approval mode.
2. WHEN terminal access is disabled by capabilities or config THEN the app SHALL show why and provide a settings path where possible.
3. WHEN the user starts a shell session THEN v1 SHALL use a dedicated terminal REST/SSE/WebSocket endpoint or a constrained `or3-intern` service extension; it SHALL NOT emulate an interactive shell by blindly sending chat messages.
4. WHEN the terminal disconnects briefly THEN the backend SHOULD keep the session alive for a bounded reconnect window.
5. WHEN the user intentionally closes a terminal session THEN the backend SHALL terminate that shell session.
6. WHEN a command requires approval THEN the app SHALL route the pending request through the approvals UI.
7. WHEN terminal output is shown on mobile THEN it SHALL use readable monospace text, horizontal scroll where needed, and avoid tiny dense layouts.

### 10. Approvals and Allowlists

**User Story:** As an operator, I want to approve, deny, cancel, and allowlist sensitive actions from my phone, so that I can safely control powerful computer operations.

#### Acceptance Criteria

1. WHEN the app opens Approvals THEN it SHALL call `GET /internal/v1/approvals` with useful status filters.
2. WHEN the user opens an approval THEN it SHALL call `GET /internal/v1/approvals/{id}` and show the subject in readable form.
3. WHEN the user approves a request THEN it SHALL call `POST /internal/v1/approvals/{id}/approve` with optional note and allowlist setting.
4. WHEN the user denies a request THEN it SHALL call `POST /internal/v1/approvals/{id}/deny` with optional note if supported.
5. WHEN the user cancels a request THEN it SHALL call `POST /internal/v1/approvals/{id}/cancel`.
6. WHEN allowlists are shown THEN the app SHALL call `GET /internal/v1/approvals/allowlists` and allow removal through `POST /internal/v1/approvals/allowlists/{id}/remove`.
7. WHEN an approval token is returned THEN the app SHALL treat it as one-time sensitive material and SHALL NOT display or persist it unnecessarily.

### 11. Settings and Configuration Management

**User Story:** As a user, I want to inspect and change `or3-intern` settings from the app, so that I can manage my agent without editing config files manually.

#### Acceptance Criteria

1. WHEN the user opens Settings THEN the app SHALL show grouped sections for account/device, host connection, provider, memory, tools, approvals, channels, automations, privacy, appearance, and advanced.
2. WHEN settings sections load THEN the app SHALL call `GET /internal/v1/configure/sections`.
3. WHEN the user opens an editable section THEN the app SHALL call `GET /internal/v1/configure/fields` with section/channel parameters.
4. WHEN the user changes settings THEN the app SHALL call `POST /internal/v1/configure/apply` with validated field mutations.
5. WHEN a setting is secret-like THEN the app SHALL avoid showing stored secret values in plaintext.
6. WHEN a setting change may reduce security THEN the app SHALL require explicit confirmation.
7. WHEN the backend rejects a setting change THEN the app SHALL preserve user input and show actionable error feedback.
8. WHEN the user opens device settings THEN the app SHALL show paired devices and provide revoke/rotate actions with confirmation.

### 12. Memory and Context Management

**User Story:** As a user, I want to inspect memory, context, embeddings, and scopes, so that I understand what `or3-intern` remembers and can keep it useful.

#### Acceptance Criteria

1. WHEN the user opens Memory THEN the app SHALL summarize memory/context status using available health, capabilities, embeddings, and config data.
2. WHEN embeddings status is requested THEN the app SHALL call `GET /internal/v1/embeddings/status`.
3. WHEN the user rebuilds embeddings THEN the app SHALL call `POST /internal/v1/embeddings/rebuild` with `memory`, `docs`, or `all`.
4. WHEN the user links sessions into a shared scope THEN the app SHALL call `POST /internal/v1/scope/links`.
5. WHEN the user views scope sessions THEN the app SHALL call `GET /internal/v1/scope/sessions?scope_key=...`.
6. WHEN full memory/file APIs are not available THEN the app SHALL clearly distinguish between runtime status and browsable memory content.

### 13. Audit and Trust Visibility

**User Story:** As an operator, I want to verify audit status and see important trust events, so that I can trust remote control actions from my phone.

#### Acceptance Criteria

1. WHEN the user opens Trust or Security details THEN the app SHALL call `GET /internal/v1/audit`.
2. WHEN the user verifies audit integrity THEN the app SHALL call `POST /internal/v1/audit/verify`.
3. WHEN audit is disabled or unavailable THEN the app SHALL show the impact in plain language.
4. WHEN sensitive actions occur from the app THEN the UI SHALL show enough context to understand what host, device, and session initiated them.

### 14. Local-First Mobile State

**User Story:** As a mobile user, I want the app to remember my hosts, sessions, drafts, and recent views, so that it remains useful when my computer is offline.

#### Acceptance Criteria

1. WHEN the app is offline THEN it SHALL preserve host profiles, last-known status, chat drafts, selected session, and recent job summaries locally.
2. WHEN the app reconnects THEN it SHALL refresh health, jobs, approvals, and settings without duplicate user actions.
3. WHEN sensitive tokens are stored on native platforms THEN the app SHOULD use Capacitor-native secure storage when introduced; v1 web fallback SHALL minimize exposure and document limitations.
4. WHEN local cache is cleared THEN the app SHALL require re-pairing before protected API access.
5. WHEN data is cached locally THEN it SHALL be scoped by host ID/base URL and active user/device profile.

### 15. Reuse from or3-chat Without Rebuilding From Scratch

**User Story:** As a developer, I want or3-app to reuse working `or3-chat` code, so that v1 ships faster and improves proven patterns instead of rebuilding everything.

#### Acceptance Criteria

1. WHEN markdown streaming is implemented THEN `streamdown-vue@1.0.29` SHALL be used unless a documented blocker is found.
2. WHEN chat scrolling is implemented THEN `or3-scroll@0.0.3` SHALL be used unless a documented blocker is found.
3. WHEN the composer is implemented THEN the plan SHALL adapt `ChatInputDropper.vue`, `useComposerActions`, and `useChatInputBridge` concepts into mobile-first components/composables.
4. WHEN code is copied from `or3-chat` THEN it SHALL be simplified, typed, and restyled for or3-app instead of bringing over desktop/plugin complexity wholesale.
5. WHEN a reusable module can be extracted later THEN v1 SHALL keep boundaries clean enough to move shared code into a package.

### 16. Performance and Reliability

**User Story:** As a user, I want the app to feel fast and reliable on mobile, so that remote computer control does not feel fragile.

#### Acceptance Criteria

1. WHEN rendering chat messages THEN the app SHALL avoid full-list re-render storms during streaming.
2. WHEN polling health/approvals/jobs THEN the app SHALL use bounded intervals and pause noncritical polling in the background where possible.
3. WHEN SSE fails THEN the app SHALL fall back to job status refresh where practical.
4. WHEN lists grow large THEN v1 SHALL cap initial render counts and prepare for virtualization without adding unnecessary complexity.
5. WHEN the app runs on desktop THEN it SHALL not require Capacitor-specific APIs for core web use.

### 17. Accessibility

**User Story:** As a user with accessibility needs, I want controls and statuses to be clear and operable, so that I can safely use the app from mobile and desktop.

#### Acceptance Criteria

1. WHEN an icon-only button is used THEN it SHALL include an accessible label.
2. WHEN status is represented by color THEN it SHALL also include text or an icon/label.
3. WHEN forms are rendered THEN inputs SHALL have visible labels or accessible labels.
4. WHEN modals, sheets, drawers, and menus open THEN focus and screen reader semantics SHALL be handled by Nuxt UI or explicit ARIA.
5. WHEN terminal output updates THEN it SHALL not trap screen reader focus or make the rest of the app unusable.

### 18. Tooling and Build Standards

**User Story:** As a developer, I want a consistent Nuxt 4, Bun, TypeScript, and Capacitor workflow, so that v1 is easy to build and test.

#### Acceptance Criteria

1. WHEN dependencies are installed or scripts run THEN the project SHALL use Bun commands, not npm or yarn.
2. WHEN the app builds for mobile THEN it SHALL generate static assets suitable for Capacitor sync.
3. WHEN code is added THEN it SHALL use Vue 3 Composition API and `<script setup lang="ts">`.
4. WHEN tests are added THEN they SHALL cover the REST client, streaming parser behavior, pairing state, approvals actions, and critical UI states.
5. WHEN CI or local validation runs THEN it SHALL include type checking and a production build.
