# Approval Moderator Settings Design

## Overview

Add a small settings experience for `security.approvals.moderator.*`. The user-facing design is preset-first, with custom rules and model controls available below the main choice. The implementation should fit the existing Simple Settings system instead of creating a separate settings store.

Recommended route:

- `/settings/approval-autopilot`

Recommended Settings entry:

- Label: `Approval autopilot`
- Location: Safety & Privacy section and the Useful checks/settings shortcuts area if moderator fields are exposed.
- Summary copy: `Choose what OR3 can approve by itself and what still needs you.`

## Affected areas

- `app/settings/simpleSettings.ts`
  - Add any missing control kind only if existing kinds cannot express the UX.
- `app/settings/fieldMappings.ts`
  - Add simple setting refs for moderator enabled, preset, model/provider, timeout, failure action, user policy, and per-risk actions.
- `app/composables/settings/useSimpleSettings.ts`
  - Add aliases only if backend configure field names differ from simple field refs.
- `app/pages/settings/approval-autopilot.vue`
  - New focused page for preset, risk summary, policy editor, and advanced controls.
- `app/components/settings/ModeratorPresetPicker.vue`
  - Friendly preset selector with current behavior summary.
- `app/components/settings/ModeratorRiskMatrix.vue`
  - Plain-language low/medium/high/extreme summary.
- `app/components/settings/ModeratorPolicyEditor.vue`
  - Text editor for user policy, visually similar to the heartbeat note editor.
- `app/components/approvals/ApprovalRequestCard.vue`
  - Optional moderator risk/action badge when backend returns metadata.
- `app/utils/or3/approvals.ts` and `app/types/or3-api.ts`
  - Add optional moderator metadata fields.
- `tests/unit`
  - Add focused tests for mappings, summaries, and metadata formatting.

## UX shape

The page should read top to bottom like this:

1. **Status header**
   - Uses `SurfaceCard`, `StatusPill`, and a shield/approval icon.
   - One sentence: `OR3 can handle normal approval requests automatically. You still stay in charge of dangerous actions.`
   - On/off `USwitch` for moderator enabled.

2. **How much should OR3 handle?**
   - Use a Nuxt UI radio group, segmented control, or local `PresetSlider` pattern.
   - Presets:
     - `Ask me every time`: all risk levels ask the user.
     - `Careful helper`: low auto-approved, medium/high ask, extreme blocked.
     - `Balanced`: low/medium auto-approved, high asks, extreme blocked. Recommended.
     - `Hands-off`: low/medium/high auto-approved when policy allows, extreme blocked or asks depending on backend policy.
   - Show one short result sentence under the selected preset.

3. **What each level means**
   - A compact `ModeratorRiskMatrix`.
   - Four rows, not cards inside cards.
   - Columns: Level, examples, what OR3 does.
   - Badges: `Handles`, `Asks`, `Blocks`.

4. **Your extra rules**
   - Similar to heartbeat, but stored as config text.
   - Use `UTextarea` or a small reusable `SettingsTextEditor` rather than the file-backed heartbeat composable.
   - Include buttons:
     - `Insert examples`
     - `Reset to starter`
     - `Clear`
   - Starter policy:

```md
# My approval rules

- Never use grep. Use rg instead.
- Ask me before downloading large uncached content.
- Ask me before installing or upgrading packages.
- Block anything that might expose secrets or credentials.
```

5. **Advanced**
   - Collapsible.
   - Reuse `ModelPickerControl` for model selection.
   - Use `USelectMenu` for provider, failure action, and per-risk actions.
   - Use existing seconds control pattern for timeout.

6. **Save review**
   - Reuse `SettingSaveReview` or the same pending-change bar pattern from `SimpleSettingsSection`.
   - Summaries should say things like:
     - `Balanced: OR3 handles low and medium risk, asks for high risk, blocks extreme risk.`
     - `Custom rule added: "Never use grep..."`

## Data mapping

Expected simple field refs:

```ts
[
  { section: 'security', field: 'approvals.moderator.enabled' },
  { section: 'security', field: 'approvals.moderator.preset' },
  { section: 'security', field: 'approvals.moderator.provider' },
  { section: 'security', field: 'approvals.moderator.model' },
  { section: 'security', field: 'approvals.moderator.timeoutSeconds' },
  { section: 'security', field: 'approvals.moderator.failureAction' },
  { section: 'security', field: 'approvals.moderator.userPolicy' },
  { section: 'security', field: 'approvals.moderator.actions.low' },
  { section: 'security', field: 'approvals.moderator.actions.medium' },
  { section: 'security', field: 'approvals.moderator.actions.high' },
  { section: 'security', field: 'approvals.moderator.actions.extreme' },
]
```

If `or3-intern` exposes flat configure keys instead, add aliases in `useSimpleSettings.ts`, following the existing `FIELD_ALIASES` pattern.

## Reuse guidance

- Use `useConfigure.applyChanges()` and `useSimpleSettings` for reads/writes.
- Reuse `ModelPickerControl` instead of building a separate model browser.
- Reuse `SurfaceCard`, `StatusPill`, `RetroIcon`, `DangerCallout`, and Nuxt UI `UButton`, `USwitch`, `USelectMenu`, `UTextarea`, `UCollapsible`, and `UBadge`.
- Copy the heartbeat page's UX idea, not its file storage. The moderator policy is config text unless the backend intentionally changes to file-backed policy.
- If a generic text editor is useful, extract a small `SettingsPromptEditor.vue` that both heartbeat-style future pages can reuse.

## Failure modes

- **Old host:** hide the entry or show `Update OR3 Intern to use approval autopilot.`
- **Backend rejects policy:** keep draft text and show backend error.
- **Provider/model unavailable:** allow saving only if backend accepts it; otherwise surface validation.
- **Metadata missing on approvals:** render existing approval cards unchanged.
- **Mobile keyboard:** keep editor save controls above bottom navigation and avoid fixed-height layouts that hide text.

## Testing strategy

- Unit test simple setting mappings for all exposed moderator fields.
- Unit test preset summaries and custom action matrix summaries.
- Unit test policy editor draft/save/discard behavior.
- Unit test approval card metadata formatting with and without moderator fields.
- Smoke-check `/settings`, `/settings/section/safety`, `/settings/approval-autopilot`, and `/approvals` on desktop and mobile widths.
