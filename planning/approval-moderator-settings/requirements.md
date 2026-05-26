# Approval Moderator Settings Requirements

## Overview

This plan covers the `or3-app` settings work needed after `or3-intern` implements the approval moderator. The app should make the feature easy to understand, safe to tune, and pleasant to use from desktop or mobile.

The app must not duplicate backend policy logic. It should use the existing configure APIs, Nuxt UI, and current settings components. The UI goal is simple: a non-technical user should understand when OR3 will keep working on its own and when it will stop to ask.

Assumptions:

- `or3-intern` exposes moderator fields through `/internal/v1/configure/sections`, `/internal/v1/configure/fields`, and `/internal/v1/configure/apply`.
- Expected backend fields include `security.approvals.moderator.enabled`, `preset`, `provider`, `model`, `timeoutSeconds`, `failureAction`, `userPolicy`, and per-risk actions for low/medium/high/extreme.
- Moderator decisions and risk metadata may also appear in approval list/show responses.

## Requirements

### 1. Simple User Entry Point

**User story:** As a normal user, I want one obvious place to control automatic approval review, so that I do not need to understand raw approval modes.

Acceptance criteria:

1. WHEN the backend exposes moderator settings THEN Settings SHALL show a friendly entry named `Approval autopilot` or equivalent under Safety & Privacy.
2. WHEN the user opens the entry THEN the first screen SHALL explain the current behavior in one plain sentence, for example: `OR3 can handle normal requests, but will still ask you before dangerous ones.`
3. WHEN the backend does not expose moderator fields THEN the app SHALL hide the entry or show a disabled card explaining that the host needs an update.
4. WHEN the user is not connected to a host THEN the route SHALL use the existing connection-gate/settings empty state patterns.

### 2. Preset-First Control

**User story:** As a user, I want a simple choice of how hands-off OR3 should be, so that I can choose without reading a policy manual.

Acceptance criteria:

1. WHEN the page loads THEN it SHALL show four presets: `Ask me every time`, `Careful helper`, `Balanced`, and `Hands-off`.
2. WHEN the user chooses a preset THEN the UI SHALL show which risk levels are handled automatically and which still ask the user.
3. WHEN no preset matches the current backend values THEN the UI SHALL show `Custom` without breaking editing.
4. WHEN saving a preset THEN the app SHALL use `/internal/v1/configure/apply` through existing settings/composable paths.
5. WHEN a preset is recommended THEN `Balanced` SHALL be visually marked as recommended unless backend defaults say otherwise.

### 3. Plain-Language Risk Summary

**User story:** As a user, I want to see what low, medium, high, and extreme mean in practical terms, so that I trust the setting.

Acceptance criteria:

1. WHEN showing risk levels THEN the UI SHALL use examples such as tests, normal file edits, package installs, network-heavy pulls, secret access, and destructive commands.
2. WHEN a risk level is auto-approved THEN the UI SHALL use calm language like `OR3 handles this`.
3. WHEN a risk level escalates THEN the UI SHALL say `OR3 asks you first`.
4. WHEN a risk level is denied THEN the UI SHALL say `OR3 blocks this`.
5. WHEN displaying risk examples THEN the UI SHALL avoid scary walls of text and keep examples short.

### 4. Policy Prompt Editor

**User story:** As a user, I want to add my own rules in plain language, so that OR3 learns my approval preferences.

Acceptance criteria:

1. WHEN the user opens the custom rules area THEN it SHALL provide a prompt editor similar in feel to the heartbeat page.
2. WHEN the editor is empty THEN it SHALL offer starter examples such as `Never use grep. Use rg instead.` and `Ask me before downloading large uncached content.`
3. WHEN the user edits policy text THEN the app SHALL save it to the backend moderator user-policy config field, not local app storage.
4. WHEN the user asks for examples THEN the editor SHALL insert safe, concrete examples instead of abstract security terms.
5. WHEN the policy is long THEN the editor SHALL remain usable on mobile with stable height, autosave status, and explicit Save.

### 5. Model and Advanced Controls

**User story:** As an advanced user, I want to choose the moderator model and fallback behavior without cluttering the beginner path.

Acceptance criteria:

1. WHEN provider/model fields exist THEN advanced controls SHALL reuse `ModelPickerControl` and provider settings patterns.
2. WHEN timeout and failure behavior fields exist THEN they SHALL be available behind an `Advanced` disclosure.
3. WHEN per-risk actions are editable THEN they SHALL be shown as a compact table or segmented controls only after the preset section.
4. WHEN the user changes advanced controls THEN the save review SHALL summarize the effect in plain language.

### 6. Approval Metadata Display

**User story:** As a user, I want to know when OR3 approved or blocked something automatically, so that the feature feels transparent.

Acceptance criteria:

1. WHEN approval requests include moderator metadata THEN approval cards SHALL show risk/action/status with a small badge.
2. WHEN an item was auto-approved THEN the app SHALL show it as a history/status detail, not as a pending action.
3. WHEN an item was auto-denied THEN the app SHALL show the short reason and safe alternative when provided.
4. WHEN metadata is absent THEN existing approval UI SHALL remain unchanged.

### 7. Usability and Safety

**User story:** As a less technical user, I want settings that are hard to misunderstand, so that I do not accidentally weaken safety.

Acceptance criteria:

1. WHEN a choice could increase autonomy THEN the UI SHALL show a clear but non-alarmist warning.
2. WHEN the user selects `Hands-off` THEN the app SHALL confirm that extreme actions still do not run automatically.
3. WHEN backend validation rejects a setting THEN the app SHALL surface the backend message and keep the unsaved draft intact.
4. WHEN the user discards changes THEN the UI SHALL restore the backend values.

## Non-functional constraints

- Reuse existing settings infrastructure: `useSimpleSettings`, `useConfigure`, `SettingSaveReview`, `SurfaceCard`, `StatusPill`, `ModelPickerControl`, and Nuxt UI form components.
- Do not create separate app-side moderator state.
- Keep the first screen small and obvious. Advanced policy should be reachable, not dominant.
- Work on desktop, mobile web, Capacitor, and Electron layouts.
- Avoid nested cards and dense security jargon.
