# Mobile Settings Simplification Requirements

## Overview

The mobile Settings experience should stop behaving like a configuration console. Mobile users should see one calm, obvious control room: Doctor chat as the hero, followed by the few actions they actually need on a phone, with everything else available through a clearly labeled Advanced Settings escape hatch.

Scope is limited to `or3-app` UX and client-side routing/component organization. The existing `or3-intern` configure APIs remain the source of truth. Electron host users must retain access to every current option, even if the information architecture is renamed or simplified.

Assumptions:

- “Mobile” means the AppShell mobile layout, not only Capacitor native builds. Small web viewports and iOS/Android should receive the simplified surface.
- “Electron host app” means desktop/electron host-mode should preserve the current breadth of settings and operational controls.
- Current `/settings` simple settings become **Advanced Settings**.
- Current `/settings/advanced` raw configure editor becomes **Super Advanced Settings**.
- Doctor chat means the existing health/admin assistant experience powered by `SettingsHealthChat`.

## Requirements

### 1. Mobile Settings Must Be Doctor-First

**User Story:** As a mobile user, I want Settings to start with Doctor chat, so that I can ask for changes or help without learning configuration categories.

#### Acceptance Criteria

1. WHEN a mobile user opens `/settings` THEN the first primary surface SHALL be a Doctor chat hero, not a list of raw setting categories.
2. WHEN Doctor chat is available THEN the hero SHALL provide a direct “Ask Doctor” action and a short explanation that Doctor can diagnose, explain, and help change settings.
3. WHEN Doctor chat or the host is unavailable THEN the hero SHALL show a calm fallback state with pairing/reconnect guidance instead of a broken chat entry point.
4. WHEN there are health findings THEN the hero MAY summarize the most important status, but it SHALL NOT expand into a dense diagnostic dashboard by default.
5. WHEN the user taps the Doctor hero THEN the app SHALL navigate to the existing Doctor chat route or open the existing chat component without duplicating Doctor logic.

### 2. Mobile Settings Must Keep Only Essential First-Class Actions

**User Story:** As a mobile user, I want only the settings I can reasonably manage on my phone, so that the page feels direct and not like an admin console.

#### Acceptance Criteria

1. WHEN a mobile user opens `/settings` THEN the default page SHALL show first-class actions for Device management and pairing, Add-ons (MCP), Skills, Passkeys, and PIN setup.
2. WHEN a user needs Add-ons THEN the card SHALL link to `/settings/addons` and describe MCP/external tools in plain language.
3. WHEN a user needs Skills THEN the card SHALL link to `/settings/skills` and describe skill toggles/configuration in plain language.
4. WHEN a user needs Device management or pairing THEN the card SHALL route to the current best page for that mode: pairing for remote clients, trusted/connect-device pages for host mode where appropriate.
5. WHEN a user needs PIN setup THEN the page SHALL reuse `PinLockSettings` and preserve the current PIN behavior.
6. WHEN a user needs passkeys THEN the page SHALL expose a simple passkey entry point and avoid showing rename/revoke complexity on the landing page.
7. The mobile default page SHALL NOT show provider, model-role, workspace, memory, safety, approvals, observability, scheduled tasks, permissions, raw config sections, or heartbeat as top-level cards unless they are inside Advanced Settings.

### 3. Advanced and Super Advanced Naming Must Match the New Three-Level Model

**User Story:** As a confident user, I want a clear path to more powerful settings, so that I can still make detailed changes when I know what I am doing.

#### Acceptance Criteria

1. WHEN users open Advanced Settings THEN they SHALL see today’s broad simple-settings experience: connection summary, grouped friendly controls, useful checks, PIN security, and links to deeper pages.
2. WHEN users open Super Advanced Settings THEN they SHALL see today’s raw advanced configure editor with search, highlights, raw sections, and field-level controls.
3. Labels and copy SHALL consistently use **Settings**, **Advanced Settings**, and **Super Advanced Settings**.
4. The final route contract SHALL be explicit: `/settings` is the normal mobile landing, `/settings/advanced` is today’s broad simple-settings experience, and `/settings/super-advanced` is today’s raw configure editor.
5. Existing deep links SHALL be preserved or redirected so bookmarked `/settings/advanced`, `/settings/[section]`, and `/settings/section/[section]` routes do not strand users.
6. Copy SHALL make risk clear without shaming users: “for people who know what they are changing” rather than alarmist warnings.

### 4. Electron/Desktop Must Preserve Full Access

**User Story:** As an electron host user, I want all current settings to remain available, so that the desktop app stays useful for setup, hosting, and administration.

#### Acceptance Criteria

1. WHEN the app is in desktop/electron layout THEN every current settings destination SHALL remain reachable from navigation, sidebar, search, or an advanced page.
2. WHEN the app is in electron host mode THEN host-specific controls such as “Use this computer,” “Control another computer,” connect devices, trusted devices, service status, and diagnostics SHALL remain available.
3. Desktop/electron MAY adopt clearer naming and grouping, but it SHALL NOT remove or hide capabilities that exist today.
4. Mobile simplification SHALL be implemented through page composition and responsive/platform-aware information architecture, not by deleting underlying settings components needed by desktop.
5. The implementation SHALL include a concrete desktop/electron destination inventory or typed destination manifest that can be checked in review and tested where practical.

### 5. Model Picker Must Move Out of Mobile Settings Noise

**User Story:** As a chat user, I want to change the agent model where I start agent work, so that model choice feels contextual instead of buried in settings.

#### Acceptance Criteria

1. WHEN a user opens the chat composer `+` menu THEN the agent model selection SHALL be available there for agent-style runs.
2. The composer model picker SHALL only control the relevant agent/run model selection, not embeddings, summarization, context manager, or other backend model roles.
3. WHEN users need embeddings, summarization, context-pruning, fallback, or provider-level model configuration THEN those controls SHALL remain in Advanced Settings or Super Advanced Settings.
4. WHEN a selected model is unavailable or the host cannot provide model metadata THEN the composer SHALL provide a clear fallback/custom model entry path consistent with the existing composer patterns.
5. The implementation SHALL reuse existing model picker/composer patterns where possible and avoid introducing a second unrelated model-selection system.

### 6. Automatic Check-Ins Must Move to Computer

**User Story:** As a user, I want automatic check-ins to live with computer operations, so that Settings stays focused on setup and control instead of background activity management.

#### Acceptance Criteria

1. WHEN a user looks for automatic check-ins on mobile THEN the primary entry point SHALL be on the Computer page/tab, not mobile Settings.
2. WHEN existing `/settings/heartbeat` links are visited THEN they SHALL still work or redirect to the new Computer-owned entry without data loss.
3. WHEN desktop/electron users search settings THEN automatic check-ins MAY remain discoverable as an advanced or computer-related destination.
4. The heartbeat implementation SHALL NOT be duplicated; only its entry point and ownership in navigation should change.
5. Because `app/pages/computer/index.vue` is already large, this work SHALL add the Computer entry through extraction or existing metadata/card boundaries rather than growing that page with another block of bespoke markup.

### 7. Passkeys Must Be Simple and Secure on Mobile

**User Story:** As a mobile user, I want passkey setup to be obvious and lightweight, so that security does not feel like a punishment.

#### Acceptance Criteria

1. WHEN passkey setup is required or recommended THEN mobile Settings SHALL show a single plain-language passkey card with state, action, and why it matters.
2. WHEN a user creates a passkey THEN the flow SHALL minimize fields; default labels should be generated from device/app context when possible, with edit available later.
3. WHEN the host can bootstrap or guide passkey setup automatically THEN the app SHALL prefer that path over making users understand WebAuthn details.
4. WHEN passkey APIs/capabilities are unavailable THEN the app SHALL show an understandable fallback state and avoid promising unavailable security.
5. Sensitive passkey actions such as revoke/rename SHALL remain behind clear confirmation and step-up behavior; simplification SHALL NOT remove owner verification.

### 8. UX Quality Must Follow Fierce Reduction and Accessibility Rules

**User Story:** As any user, I want settings to feel inevitable, readable, and safe, so that I do not have to think about the interface.

#### Acceptance Criteria

1. Mobile Settings SHALL have one main visual hierarchy: Doctor hero first, essential action grid/list second, Advanced Settings button last.
2. Touch targets SHALL be at least 48px tall/wide for primary mobile actions.
3. Copy SHALL be plain language and action-oriented; no unexplained implementation terms on the mobile landing page except “MCP” paired with “Add-ons.”
4. Empty, disconnected, loading, and unsupported states SHALL be designed explicitly.
5. Advanced/Super Advanced transitions SHALL feel intentional: the user should understand that they are entering deeper, riskier controls.
6. The plan SHALL prefer deleting visible complexity over moving the same clutter into another top-level mobile card.

### 9. Code Must Stay Clean and Bounded

**Engineering Objective:** Keep the implementation direct, reusable, and maintainable while changing the information architecture.

#### Acceptance Criteria

1. The implementation SHALL avoid adding ad-hoc conditionals scattered across settings pages.
2. Shared route/card metadata SHALL live in a small typed module or focused component boundary instead of duplicated card markup.
3. Existing large components such as `SettingsHealthChat.vue` and `AssistantComposer.vue` SHALL NOT receive unrelated settings-landing complexity.
4. `AssistantComposer.vue` changes SHALL be surgical for labeling/data-path correctness or extracted into a focused menu/model component before adding meaningful new behavior.
5. New components SHALL be focused and named by responsibility, for example a mobile settings landing component and reusable settings action cards.
6. No file SHOULD be pushed past 1,000 lines by this work; if a touched file is already large, changes should be minimal or extracted.
7. Tests SHALL cover routing/visibility policy where practical, especially mobile vs desktop route ownership.
8. Mobile `/settings` SHALL NOT eagerly load the full simple-settings/raw configure index; host-backed setting data should load only after entering Advanced or Super Advanced.

## Non-Functional Constraints

- **Security:** Passkey and PIN simplification must not bypass step-up, confirmation, secure token storage, or paired-device safeguards.
- **Compatibility:** Existing settings routes and host-mode flows must remain available through redirects, aliases, or updated links.
- **Performance:** The mobile Settings landing should avoid eagerly loading the full raw configure field index unless the user enters Advanced/Super Advanced.
- **Accessibility:** Cards and buttons must use semantic links/buttons, visible focus rings, screen-reader labels, and 48px touch targets.
- **Maintainability:** Prefer small route/page composition changes and typed navigation metadata over branching inside unrelated components.
- **Offline/disconnected behavior:** The page must be useful when unpaired or disconnected, primarily by guiding pairing/reconnect and explaining unavailable host-backed actions.