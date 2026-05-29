# Mobile Settings Simplification Tasks

## 1. Route and IA Preparation

- [x] 1.1 Inventory current settings routes and links
  - Check `/settings`, `/settings/advanced`, `/settings/section/*`, `/settings/addons`, `/settings/skills`, `/settings/passkeys`, `/settings/pair`, `/settings/heartbeat`, and desktop sidebar links.
  - Confirm which links are mobile-first versus desktop/electron-only.
  - Requirements: 3.4, 4.1, 6.2

- [x] 1.2 Implement the final route contract
  - `/settings` = normal Settings with Doctor-first mobile landing.
  - `/settings/advanced` = current broad simple-settings experience.
  - `/settings/super-advanced` = current raw configure editor.
  - Ensure old raw-editor links either intentionally redirect, alias, or remain discoverable during rollout.
  - Requirements: 3.2, 3.4

- [x] 1.3 Define settings destination metadata if it reduces duplication
  - Add a small typed module only if it can serve both mobile landing cards and sidebar labels cleanly.
  - Avoid a generic settings framework or permission engine.
  - Requirements: 8.6, 9.1, 9.2

- [x] 1.4 Inventory both dynamic section route shapes
  - Check `app/pages/settings/[section].vue` and `app/pages/settings/section/[section].vue`.
  - Preserve both intentionally or redirect one clearly after verifying callers.
  - Requirements: 3.5, 3.4

## 2. Create the Mobile Settings Landing

- [x] 2.1 Add `MobileSettingsHome.vue`
  - Create a focused component under `app/components/settings/`.
  - Render Doctor hero, essential actions, compact passkey/PIN sections, and bottom Advanced Settings button.
  - Do not call `useSimpleSettings().ensureLoaded()` or load raw configure fields from mobile `/settings`.
  - Requirements: 1.1, 1.2, 2.1, 8.1

- [x] 2.2 Build Doctor hero states
  - Connected: “Ask Doctor to change settings.”
  - Unpaired: “Pair a computer first.”
  - Disconnected: “Reconnect to use Doctor.”
  - Use existing `useActiveHost`, `useComputerStatus`, and route patterns where possible.
  - Requirements: 1.1, 1.2, 1.3, 1.4

- [x] 2.3 Add essential action cards
  - Device management and pairing.
  - Add-ons (MCP) linking to `/settings/addons`.
  - Skills linking to `/settings/skills`.
  - Passkeys linking to `/settings/passkeys` with state-aware copy.
  - Requirements: 2.1, 2.2, 2.3, 2.4, 2.6

- [x] 2.4 Reuse PIN setup behavior
  - Render `PinLockSettings` or a compact wrapper around it without forking PIN logic.
  - Confirm toggle/setup/change/disable flows still work on narrow mobile screens.
  - Requirements: 2.5, 7.5

- [x] 2.5 Add the Advanced Settings escape hatch
  - Full-width bottom button/card to `/settings/advanced`.
  - Explain that models, memory, workspace, approvals, automation, and expert controls live there.
  - Requirements: 3.1, 8.1, 8.5

## 3. Rehome Current Settings Levels

- [x] 3.1 Convert current `/settings` content into Advanced Settings
  - Extract connection summary, desktop mode card, `SimpleSettingsHome`, last-change undo, and related behavior into `AdvancedSettingsHome.vue` or an equivalent focused component.
  - Render that component from `/settings/advanced`.
  - Keep desktop/electron access intact.
  - Requirements: 3.1, 4.1, 4.2

- [x] 3.2 Convert current raw advanced editor into Super Advanced Settings
  - Extract current `app/pages/settings/advanced.vue` raw editor into `SettingsRawConfigureHome.vue` or an equivalent focused component.
  - Add `/settings/super-advanced` page with title/copy “Super Advanced Settings.”
  - Requirements: 3.2, 3.3, 9.3, 9.5

- [x] 3.3 Update labels and caution copy
  - Rename visible “Simple Settings” references to “Settings” or “Advanced Settings” depending on destination.
  - Rename raw editor references to “Super Advanced Settings.”
  - Keep copy direct, respectful, and non-alarmist.
  - Requirements: 3.3, 3.5, 8.3

- [x] 3.4 Preserve section editor access
  - Ensure `/settings/section/[section]` remains reachable from Advanced or Super Advanced flows.
  - Verify dynamic simple setting sections still load only when host API is ready.
  - Requirements: 3.4, 4.1

## 4. Preserve Desktop and Electron Host Functionality

- [x] 4.1 Update `SettingsSidebar.vue`
  - Add/rename entries for Settings, Advanced Settings, and Super Advanced Settings.
  - Keep all fixed entries available: pair/connect devices, trusted devices, health/Doctor, permissions, skills, add-ons, approval autopilot, passkeys, observability.
  - Keep dynamic configure sections reachable through Advanced/Super Advanced search or section links.
  - Requirements: 4.1, 4.2, 4.3

- [x] 4.2 Verify host-mode routing
  - Confirm electron host mode still routes device actions to `/computer/connect-device` and `/computer/trusted-devices` where appropriate.
  - Confirm remote mode still routes pairing to `/settings/pair`.
  - Requirements: 2.4, 4.2

- [x] 4.3 Avoid desktop capability loss
  - Create a concrete destination inventory or typed manifest covering current fixed sidebar items and dynamic section destinations.
  - Add a regression test for destination generation if metadata/helper extraction makes this practical.
  - Requirements: 4.1, 4.3, 9.6

## 5. Move Automatic Check-Ins to Computer

- [x] 5.1 Add a Computer page entry point
  - Add an “Automatic check-ins” card/action to the Computer page through an extracted action-card/list component or existing metadata boundary.
  - Do not add another bespoke inline block directly to the already-large `app/pages/computer/index.vue`.
  - Use copy that frames heartbeat as background review for this computer.
  - Requirements: 6.1, 8.3

- [x] 5.2 Remove heartbeat from mobile Settings landing
  - Do not show heartbeat as a first-class card on mobile `/settings`.
  - Keep it available from Advanced Settings or desktop search/sidebar if useful.
  - Requirements: 2.7, 6.1, 6.3

- [x] 5.3 Preserve `/settings/heartbeat`
  - Keep the current route functional during rollout or add an intentional redirect only after verifying no behavior loss.
  - Requirements: 6.2, 6.4

## 6. Clarify Model Picker Ownership

- [x] 6.1 Audit current composer model behavior
  - Determine whether `AssistantComposer.vue` model selection is per-run, per-runner, session-local, or global configuration.
  - Document the current data path before changing behavior.
  - Requirements: 5.1, 5.5

- [x] 6.2 Label composer model choice as agent/run model where appropriate
  - In the `+` menu, make it clear this controls the current agent/run model, not embeddings or maintenance roles.
  - Preserve fallback/custom model entry behavior.
  - Keep changes to `AssistantComposer.vue` surgical unless the action menu/model picker is first extracted into a focused child component.
  - Requirements: 5.1, 5.2, 5.4

- [x] 6.3 Keep backend model roles in Advanced/Super Advanced
  - Ensure summarization, context manager, embeddings, fallbacks, providers, and API-key setup are not exposed as mobile landing cards.
  - Requirements: 5.2, 5.3

- [x] 6.4 Avoid a second model picker system
  - Reuse existing model metadata and picker components/patterns.
  - Do not introduce a parallel provider browser for the mobile landing.
  - Requirements: 5.5, 9.4

## 7. Simplify Passkey Presentation

- [x] 7.1 Add a passkey status/action card to mobile settings
  - Use current `useAuthSession`/`usePasskeys` capability state if available.
  - Show Ready, Recommended, Unavailable, or Pair first states.
  - Requirements: 7.1, 7.4

- [x] 7.2 Reduce passkey setup friction
  - On `/settings/passkeys`, consider making “Create passkey” the primary first action and generating a default label when nickname is empty.
  - Keep full management available after setup.
  - Requirements: 7.2, 7.3

- [x] 7.3 Preserve sensitive passkey safeguards
  - Confirm rename/revoke still require confirmation and step-up.
  - Do not move destructive actions onto the mobile landing page.
  - Requirements: 7.5, 10.1

## 8. Polish Mobile UX and Accessibility

- [x] 8.1 Apply Material-style hierarchy
  - Doctor hero should be visually dominant; action cards should be secondary; Advanced should sit last.
  - Use existing `SurfaceCard`, `RetroIcon`, `StatusPill`, and focus-ring patterns.
  - Requirements: 8.1, 8.5

- [ ] 8.2 Verify touch and spacing
  - Ensure every primary interactive target is at least 48px.
  - Check bottom nav safe-area spacing and keyboard behavior.
  - Requirements: 8.2

- [x] 8.3 Write final copy with real states
  - Avoid jargon on the mobile landing page.
  - Pair “MCP” with “Add-ons” so power users recognize it without confusing normal users.
  - Requirements: 8.3, 8.4

- [ ] 8.4 Design empty/error/loading states
  - Cover unpaired, disconnected, host loading, host unsupported, passkeys unavailable, and Doctor unavailable states.
  - Requirements: 1.3, 7.4, 8.4

## 9. Tests and Validation

- [ ] 9.1 Add focused tests for navigation metadata/helpers
  - If a settings metadata helper is added, test mobile/desktop destination filtering, host-mode destination choices, and the full desktop/electron destination inventory.
  - Requirements: 4.1, 9.2, 9.6

- [ ] 9.2 Add component tests where patterns exist
  - Test `MobileSettingsHome` renders the Doctor hero and essential actions for connected/unpaired/disconnected states.
  - Requirements: 1.1, 1.3, 2.1, 8.4

- [ ] 9.3 Run focused Vitest tests
  - Use `bunx vitest run <focused tests>` for new or changed tests.
  - Requirements: 9.6

- [ ] 9.4 Run typecheck with known caveat awareness
  - Run `bun run typecheck` if practical.
  - If it fails on known unrelated TipTap issues from `AGENTS.md`, report that separately and verify no new settings errors were introduced.
  - Requirements: 9.6

- [ ] 9.5 Manual smoke QA
  - Check `/settings`, `/settings/advanced`, `/settings/super-advanced`, `/settings/health`, `/settings/addons`, `/settings/skills`, `/settings/passkeys`, `/settings/pair`, and `/computer` on mobile width and desktop/electron width.
  - Requirements: 1.1, 2.1, 3.1, 3.2, 4.1, 6.1

## Out of Scope

- Backend passkey/WebAuthn protocol changes beyond consuming existing capabilities.
- Rewriting the Doctor chat implementation.
- Replacing the existing configure API or duplicating settings persistence in the app.
- Removing existing desktop/electron settings capabilities.
- Building a generic settings framework or theme redesign.