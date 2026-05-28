# Mobile Settings Simplification Design

## Overview

The design reframes Settings as three nested levels of intent:

1. **Settings** — mobile-first control room for normal people: Doctor chat, device/pairing, Add-ons, Skills, Passkeys, PIN, and one Advanced Settings escape hatch.
2. **Advanced Settings** — today’s simple settings: friendly grouped controls, connection summary, useful checks, and security/operational pages.
3. **Super Advanced Settings** — today’s advanced raw configure editor: search, field highlights, raw configure sections, and exact backend keys.

This fits the current architecture because `or3-app` already separates page routes, shell layout, settings components, and configure API mapping. The work should primarily reorganize route ownership and mobile landing composition rather than rewrite settings logic.

UX priority: mobile Settings should answer one question instantly: “How do I get OR3 to help me change or fix something?” The answer is Doctor chat. Everything else on the first screen exists only if it supports device trust, app security, or capability extension.

## Affected Areas

- `app/pages/settings/index.vue`
  - Becomes the responsive settings entry point. Mobile renders the new Doctor-first landing without loading the configure field index. Desktop/electron can keep a fuller host/admin landing or link directly into Advanced Settings while preserving all options.
- `app/components/settings/SimpleSettingsHome.vue`
  - Represents today’s broad simple settings experience. It should move behind Advanced Settings instead of being the mobile default.
- `app/pages/settings/advanced.vue`
  - Today this is the raw advanced editor. Its implementation should move into a dedicated raw editor component rendered by `/settings/super-advanced`.
- `app/pages/settings/section/[section].vue` and `app/pages/settings/[section].vue`
  - Both existing section route shapes must be inventoried. The implementation must preserve or intentionally redirect each shape so dynamic section links and bookmarks keep working.
- `app/components/desktop/sidebars/SettingsSidebar.vue`
  - Needs updated labels/grouping so desktop/electron preserves all options while reflecting Advanced and Super Advanced terminology.
- `app/components/settings/SettingsHealthChat.vue`
  - Should be reused for the Doctor destination, but not embedded wholesale into the mobile landing if that would load a 1,900-line chat surface on initial settings load.
- `app/components/settings/PinLockSettings.vue`
  - Reused directly on mobile Settings for PIN setup and toggle.
- `app/pages/settings/passkeys.vue`
  - Stays the full passkey management page. Mobile landing should link to it through a simplified passkey status/action card.
- `app/components/assistant/AssistantComposer.vue`
  - Already contains the composer `+` menu and runner/model picker UI. The plan should refine ownership so chat/agent model choice lives here while non-agent model roles stay in Advanced/Super Advanced.
- `app/pages/settings/heartbeat.vue`
  - Keeps the heartbeat implementation but should be owned/discovered from Computer instead of mobile Settings.
- `app/pages/computer/index.vue`
  - Gains the Automatic check-ins entry point/card only through an extracted component, existing card list, or metadata boundary. Do not add another bespoke markup block directly to this already-large page.
- `app/composables/useViewport.ts` and `useElectronHostSetup.ts`
  - Existing responsive/platform state should drive page composition; do not add a second viewport/platform system.

## Information Architecture

### Mobile `/settings`

Spatial layout:

1. **Header**
   - Small `SETTINGS` eyebrow.
   - Title: “How can OR3 help?” or “Settings.”
   - Optional connection pill only if it clarifies state.

2. **Doctor Hero**
   - Large top card, visually dominant.
   - Doctor avatar/icon on the left/top, one sentence of promise, one primary action.
   - Primary action: “Ask Doctor.”
   - Secondary microcopy: “Tell OR3 what you want changed. It can explain, diagnose, and guide fixes.”
   - If disconnected: primary action becomes “Pair a computer” or “Reconnect,” with Doctor described as available after connection.

3. **Essential Actions**
   - A short list or two-column grid depending on width.
   - Cards:
     - Device management & pairing
     - Add-ons (MCP)
     - Skills
     - Passkeys
     - PIN Lock
   - Use one-line titles and one-line descriptions. Avoid raw config vocabulary.

4. **Advanced Settings Button**
   - Full-width low-emphasis caution/neutral card at the bottom.
   - Copy: “For model roles, memory, workspace, approvals, automation, and other expert controls.”
   - Route: `/settings/advanced` after route migration.

### Advanced Settings

Advanced Settings is the current `/settings` experience after removing the new mobile landing from it:

- Connection summary.
- Desktop mode card where relevant.
- `SimpleSettingsHome` grouped settings.
- PIN settings and useful checks.
- Links to Add-ons, Skills, Passkeys, permissions, observability, approval autopilot, and Super Advanced Settings.

Recommended route: `/settings/advanced`.

Implementation detail:

- Extract the current settings-index behavior into a focused component such as `AdvancedSettingsHome.vue` so the route page stays thin and the mobile landing does not inherit its data loading.
- `AdvancedSettingsHome.vue` may call `useSimpleSettings().ensureLoaded()`; mobile `/settings` should not.

### Super Advanced Settings

Super Advanced Settings is the current raw `/settings/advanced` page:

- Caution/info card.
- Search settings/fields/keys.
- Category chips and highlights.
- Field-level results.
- Raw section editor links.

Recommended route: `/settings/super-advanced`.

Compatibility and extraction requirements:

- Move raw editor markup into `SettingsRawConfigureHome.vue`.
- Render `SettingsRawConfigureHome.vue` from `/settings/super-advanced`.
- Keep `/settings/advanced` for Advanced Settings only.
- Preserve old raw-editor access intentionally with a temporary alias/redirect strategy if current users depend on it; do not leave two pages with the same “Advanced” label.

## Route Map

Final route contract:

- `/settings` = normal Settings, Doctor-first on mobile.
- `/settings/advanced` = Advanced Settings, using today’s broad simple-settings experience.
- `/settings/super-advanced` = Super Advanced Settings, using today’s raw configure editor.

The implementation should not leave this as an open decision. If old raw-editor deep links exist, support them with a temporary alias, query-compatible redirect, or explicit release note, but the user-facing labels above are the source of truth.

| User intent | Mobile primary route | Desktop/electron route | Notes |
| --- | --- | --- | --- |
| Normal settings help | `/settings` | `/settings` or `/settings/advanced` | Doctor-first on mobile; desktop can preserve fuller admin surface. |
| Doctor chat | `/settings/health` | `/settings/health` | Reuse existing `SettingsHealthChat`; rename visible copy toward “Doctor” if desired. |
| Device pairing | `/settings/pair` | `/settings/pair`, `/computer/connect-device`, `/computer/trusted-devices` | Route depends on host mode. |
| Add-ons / MCP | `/settings/addons` | `/settings/addons` | First-class mobile card. |
| Skills | `/settings/skills` | `/settings/skills` | First-class mobile card. |
| Passkeys | `/settings/passkeys` | `/settings/passkeys` | Simple card links to full management. |
| PIN Lock | Inline on `/settings` | Inline or Advanced Settings | Reuse `PinLockSettings`. |
| Automatic check-ins | `/computer` card to heartbeat flow | `/computer` and advanced/sidebar search | Remove from mobile Settings landing. |
| Friendly grouped controls | `/settings/advanced` | `/settings/advanced` | Current simple settings. |
| Raw configure editor | `/settings/super-advanced` | `/settings/super-advanced` | Current advanced settings. |

## Component Design

### Thin Route Pages

Route pages should become composition shells, not long-lived owners of settings logic:

- `/settings` imports and renders `MobileSettingsHome` for mobile layout and a desktop/electron home for wider/host contexts.
- `/settings/advanced` renders `AdvancedSettingsHome`.
- `/settings/super-advanced` renders `SettingsRawConfigureHome`.

This is the main code-judo move: complexity moves down by user intent, not sideways into more `if (mobile)` branches.

### `MobileSettingsHome.vue`

Create a focused component under `app/components/settings/`.

Responsibilities:

- Render the Doctor hero.
- Render essential action cards from typed metadata.
- Render `PinLockSettings` in a compact landing-page section.
- Render the bottom Advanced Settings button.
- Decide copy/state for paired, connected, disconnected, and host-capability states using existing composables.

Non-responsibilities:

- Do not own raw configure loading.
- Do not implement Doctor chat.
- Do not implement passkey ceremonies.
- Do not know every desktop sidebar item.

### `SettingsActionCard.vue`

Create only if repeated card markup becomes meaningful.

Suggested props:

```ts
interface SettingsActionCardProps {
  title: string
  description: string
  icon: string
  to?: string
  disabled?: boolean
  badge?: { label: string; tone?: 'green' | 'amber' | 'neutral' | 'rose' }
}
```

Use a card component instead of repeated ad-hoc NuxtLink markup if it deletes duplication. Do not create it if only two cards use it.

### Typed Route Metadata

Add a small metadata module only if it simplifies both mobile landing and sidebar updates, for example `app/settings/settingsNavigation.ts`.

Keep it boring:

```ts
type SettingsSurface = 'mobile-home' | 'advanced' | 'super-advanced' | 'desktop-sidebar'

interface SettingsDestination {
  key: string
  label: string
  description: string
  icon: string
  to: string
  surfaces: SettingsSurface[]
}
```

Do not overbuild permissions or policy logic into metadata. Runtime decisions such as electron host mode can still be computed near the consumer.

## Doctor Hero UX Detail

Default connected state:

- Title: “Ask Doctor to change settings.”
- Body: “Tell OR3 what you want. Doctor can diagnose problems, explain options, and guide safe changes.”
- Primary action: “Ask Doctor.”
- Secondary status: connected host name or “Ready.”

Unpaired state:

- Title: “Pair a computer first.”
- Body: “Doctor can help after this app is connected to your OR3 computer.”
- Primary action: “Pair computer.”
- Secondary action: none unless a reconnect route exists.

Disconnected paired state:

- Title: “Reconnect to use Doctor.”
- Body: “This app remembers your computer, but cannot reach it right now.”
- Primary action: “Open pairing.” or “Reconnect,” depending on existing capabilities.

Motion:

- Avoid decorative animation.
- If the card changes from disconnected to ready, use existing transition utilities or a subtle opacity/translate transition under 180ms.
- Do not animate layout shifts while the user is trying to tap.

Accessibility:

- The whole card may be a link only if it has one action. If multiple actions exist, make only explicit buttons interactive.
- Primary action minimum height 48px.
- Status text must not rely on color alone.

## Model Picker Design

The composer already has a `+` menu with runner selection and model selection. The plan should clarify rather than duplicate:

- The composer picker owns model choice for the current chat/agent runner experience.
- Advanced Settings owns backend model roles: chat, agents, subagents, summarization, context manager, embeddings, fallbacks, and provider keys.
- Mobile Settings should not show broad model-role cards by default.

Implementation guidance:

- Audit whether the existing composer picker persists runner model choice locally, sends it per-turn, or maps to a backend setting.
- If it is per-run/per-session, keep it there and label it “Agent model” when the selected runner is agent-style.
- If it currently changes global settings, split behavior carefully so the `+` menu does not accidentally alter embeddings/summarization/context roles.
- Reuse existing model metadata utilities and picker UI. Do not add a parallel provider/model browser.
- Because `AssistantComposer.vue` is already very large, prefer a surgical copy/data-path correction. If meaningful new model-picker behavior is needed, extract the composer action menu or model picker into a focused child component before adding it.

## Automatic Check-Ins Design

Move ownership from Settings to Computer:

- Add a Computer page card: “Automatic check-ins.”
- Description: “Let OR3 run a recurring background checklist for this computer.”
- Link to the existing heartbeat flow or a future `/computer/check-ins` route that renders the same implementation.
- Remove the heartbeat card from mobile `SimpleSettingsHome` once that component is behind Advanced Settings.
- Keep `/settings/heartbeat` functional during rollout; redirect later only if route churn is worth it.

Implementation constraint:

- Do not grow `app/pages/computer/index.vue` with more inline card markup. If there is no existing card-list boundary, extract a small `ComputerActionCard` or `ComputerQuickActions` component first and add check-ins there.

## Passkeys and PIN Design

Mobile landing should not expose passkey inventory management complexity directly.

Recommended landing states:

- **Ready:** “Passkey set up” with action “Manage.”
- **Recommended:** “Add a passkey” with action “Set up.”
- **Unavailable:** “Passkeys unavailable on this host” with action “Learn why” or disabled state.
- **Needs connection:** “Pair first” with route to pairing.

Passkey setup improvements:

- Default nickname should be generated where possible: `Brendon’s iPhone`, `This iPad`, `Chrome on Mac`, or `This device`.
- The first action should be “Create passkey,” not a form-first experience.
- Advanced actions such as rename and revoke remain on `/settings/passkeys` with step-up and confirmation.

PIN:

- Reuse `PinLockSettings` exactly for behavior.
- If visual density is too high on the landing page, wrap it in a compact section but do not fork logic.

## Control Flow

```mermaid
flowchart TD
    OpenSettings[Open /settings] --> IsMobile{AppShell mobile layout?}
    IsMobile -->|yes| MobileHome[Doctor-first MobileSettingsHome]
    IsMobile -->|no| DesktopHome[Desktop/electron settings home]
    MobileHome --> Doctor[/settings/health Doctor chat]
    MobileHome --> Pair[/settings/pair or computer device route]
    MobileHome --> Addons[/settings/addons]
    MobileHome --> Skills[/settings/skills]
    MobileHome --> Passkeys[/settings/passkeys]
    MobileHome --> Advanced[/settings/advanced]
    Advanced --> SimpleSettings[Current SimpleSettingsHome]
    Advanced --> SuperAdvanced[/settings/super-advanced]
    SuperAdvanced --> RawEditor[Current raw configure editor]
    DesktopHome --> AllRoutes[Sidebar/search exposes all settings]
```

## Data and Persistence

- No new SQLite tables are required.
- No new `or3-intern` configure fields are required for the settings simplification itself.
- Existing configure APIs remain authoritative for advanced settings.
- Existing passkey and PIN storage/session behavior remains authoritative.
- Optional local persistence may be used only for harmless UI state such as remembered advanced tab/route; do not store security decisions in local UI state.
- Mobile `/settings` should avoid calling `useSimpleSettings().ensureLoaded()` or loading `/internal/v1/configure/fields`; Advanced/Super Advanced own that cost.

## Failure Modes and Safeguards

- **Unpaired:** Doctor, Add-ons, Skills, and passkeys that need host APIs should show pairing guidance rather than empty errors.
- **Disconnected:** Preserve visible active host context and route users to reconnect/pairing.
- **Host lacks capabilities:** Hide or disable host-backed actions with plain copy.
- **Passkey unsupported:** Explain that this device/host cannot create passkeys yet; do not silently downgrade sensitive security.
- **Advanced route confusion:** Use clear page titles and redirect/alias strategy so `/settings/advanced` no longer unexpectedly opens raw editor after the rename.
- **Desktop regression:** Audit every existing fixed sidebar item and dynamic configure section after the move.
- **Large-file growth:** Do not expand `SettingsHealthChat.vue` or `AssistantComposer.vue` with landing-page concerns.

## Testing Strategy

Use focused Vitest coverage where the repo already supports it.

Recommended tests:

- Unit test any `settingsNavigation.ts` metadata/filter helper if added.
- Component test `MobileSettingsHome` for unpaired, paired-connected, paired-disconnected, and passkey-unavailable states if component testing patterns exist.
- Route/smoke test that `/settings`, `/settings/advanced`, `/settings/super-advanced`, `/settings/addons`, `/settings/skills`, `/settings/passkeys`, and `/settings/pair` render expected titles or key actions.
- Regression test that desktop/electron sidebar items still include Add-ons, Skills, Passkeys, Observability, Approval autopilot, Advanced Settings, and Super Advanced Settings.
- Manual mobile QA on a narrow viewport for 48px touch targets, bottom nav spacing, keyboard behavior, and disconnected states.

Validation commands:

- `bunx vitest run <focused tests>` for added unit/component tests.
- `bun run typecheck` only after noting existing unrelated TipTap caveats from `AGENTS.md`.
- Manual smoke with Nuxt dev server on `/settings`, `/settings/advanced`, `/settings/super-advanced`, `/settings/health`, `/computer`.

## Rollout Plan

1. Extract/rename routes without visual redesign first.
2. Add mobile landing behind responsive branching in `/settings`.
3. Update sidebar/navigation labels and links.
4. Move heartbeat entry to Computer while preserving old route.
5. Clarify composer model picker ownership.
6. Polish copy/states and run mobile QA.
7. Remove temporary aliases only after a later release if analytics/manual usage confirms no dependency.

## Thermo-Nuclear Code Quality Constraints

- The code-judo move is route/component ownership: make `/settings` small and intentional, move existing complexity down one level, and do not thread `isMobile` branches through every settings child.
- Do not embed the full Doctor chat component into the landing page just to show a hero. Link to it or extract a tiny status hero.
- Do not grow already-large files (`AssistantComposer.vue`, `SettingsHealthChat.vue`, `app/pages/computer/index.vue`) unless the change is tiny and unavoidable; extract first for meaningful new behavior.
- Do not duplicate settings card markup across mobile landing, sidebar, and advanced pages; use typed metadata or a small reusable card only where it deletes duplication.
- Do not create a generic settings framework. The desired IA is simple and finite.
- Do not add broad “show/hide advanced” booleans scattered through `SimpleSettingsHome`; move the component to the Advanced route instead.
- Keep security behavior in existing auth/passkey/PIN composables and components. The landing page is navigation and explanation, not a security-policy layer.