# Approval Moderator Settings Tasks

## 1. Backend Contract Alignment

- [ ] 1.1 Confirm final `or3-intern` configure field names for `security.approvals.moderator.*`.
- [ ] 1.2 Add TypeScript API types for optional moderator metadata on approval requests.
- [ ] 1.3 Add simple settings aliases if backend fields are flat instead of nested.

## 2. Simple Settings Entry

- [ ] 2.1 Add moderator controls to `app/settings/fieldMappings.ts` under Safety & Privacy.
- [ ] 2.2 Add an `Approval autopilot` shortcut from `SimpleSettingsHome.vue` when fields are available.
- [ ] 2.3 Add a contextual CTA from `SimpleSettingsSection.vue` for the Safety section, similar to the heartbeat CTA in Automation.

## 3. Focused Settings Page

- [ ] 3.1 Create `app/pages/settings/approval-autopilot.vue`.
- [ ] 3.2 Add `ModeratorPresetPicker.vue` using Nuxt UI controls and plain-language preset summaries.
- [ ] 3.3 Add `ModeratorRiskMatrix.vue` showing low/medium/high/extreme examples and action badges.
- [ ] 3.4 Add `ModeratorPolicyEditor.vue` with starter examples, insert examples, reset, clear, dirty state, and save/discard.
- [ ] 3.5 Add an Advanced disclosure for provider/model, timeout, failure action, and per-risk actions.

## 4. Save Flow

- [ ] 4.1 Reuse `useSimpleSettings` and `useConfigure.applyChanges()` for all saves.
- [ ] 4.2 Reuse `SettingSaveReview` or the existing pending-change bar pattern.
- [ ] 4.3 Keep unsaved drafts intact when backend validation fails.
- [ ] 4.4 Add a confirmation when selecting `Hands-off`, making clear that extreme actions still do not run automatically.

## 5. Approval UI Metadata

- [ ] 5.1 Update approval normalization to retain moderator status, risk, action, reason, and alternative.
- [ ] 5.2 Add compact moderator badges to `ApprovalRequestCard.vue`.
- [ ] 5.3 Show auto-denial reason and safe alternative when present.
- [ ] 5.4 Keep existing approval cards unchanged when metadata is missing.

## 6. Tests and Verification

- [ ] 6.1 Add unit tests for field mappings and field availability filtering.
- [ ] 6.2 Add unit tests for preset and risk matrix summary text.
- [ ] 6.3 Add unit tests for approval metadata formatting.
- [ ] 6.4 Run focused Vitest tests for settings and approvals.
- [ ] 6.5 Manually smoke-check `/settings`, `/settings/section/safety`, `/settings/approval-autopilot`, and `/approvals` at desktop and mobile widths.

## Out of Scope

- [ ] Reimplementing moderator risk decisions in the app.
- [ ] Storing moderator policy in local app state.
- [ ] Replacing the existing advanced settings editor.
- [ ] Building a new design system instead of Nuxt UI and existing OR3 settings components.
