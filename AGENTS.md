# AGENTS.md

This file orients AI coding agents working in `or3-app`. Prefer the README for user-facing setup details; use this file for repo conventions, likely touch points, and verification.

## Project Shape

`or3-app` is a Nuxt 4 companion app for `or3-intern`. It targets web, Capacitor mobile, and Electron. The app pairs with an `or3-intern service` host, then exposes chat, jobs, approvals, files, terminal, settings, secure device enrollment, and Electron host-mode controls.

Important directories:

- `app/pages`: route pages. Nuxt file routing is in use.
- `app/components`: shared UI. Auto-imports are enabled with `pathPrefix: false`, so `app/components/settings/ConnectionSummaryCard.vue` is `<ConnectionSummaryCard />`, not `<SettingsConnectionSummaryCard />`.
- `app/composables`: app state and API clients. Pairing/auth lives mostly in `usePairing.ts`, `useActiveHost.ts`, `useOr3Api.ts`, `useSecureHostTokens.ts`, and secure-connection composables.
- `app/utils/or3`: protocol and service helpers, including secure connections, SSE, readiness, jobs, and approvals.
- `server/api/or3/[...path].ts`: local Nuxt proxy to the `or3-intern` service at `127.0.0.1:9100`.
- `electron`: Electron shell, host-service bridge, preload, and security policy.
- `tests/unit`: Vitest unit tests.
- `planning`: product/design notes. Useful context, not necessarily current source of truth.

## Common Commands

Use Bun.

```bash
bun install
bun run dev
bun run test
bunx vitest run tests/unit/or3-api.test.ts
bun run typecheck
bun run build:web
bun run electron:dev
```

The dev server is configured for port `3060`, but Nuxt may choose another port if `3060` is busy. For phone/device testing, keep only one Nuxt dev server running so clients do not hit a stale alternate port.

## Pairing And Auth Model

The app talks to `or3-intern service`.

- Legacy/compatibility pairing stores a paired-device token and creates an active host profile.
- Secure pairing stores device identity/enrollment state under the secure-connections state and uses secure sessions for service calls.
- `useActiveHost()` is the app-level source for current host selection and paired/connected status.
- `useOr3Api()` is the normal service request path. Keep auth behavior centralized there.
- `useLocalCache()` persists host metadata but intentionally strips raw tokens before writing `or3-app:v1:state`.
- `useSecureHostTokens()` stores legacy/session tokens. Be careful about origin matching when changing base URLs.

When changing pairing or connection state, check all of these surfaces:

- `/settings/pair`
- `/settings`
- `/settings/advanced`
- `/computer`
- `DeviceManagementCard.vue`
- `SecurePairingCard.vue`
- `HostConnectionCard.vue`
- `server/api/or3/[...path].ts`

## UI Conventions

- Use existing Nuxt UI, Tailwind utility, and local component patterns.
- Icons generally use `pixelarticons`; use existing icon names where possible.
- Shared settings card styling usually goes through `SurfaceCard`, `StatusPill`, `RetroIcon`, and `ConnectionSummaryCard`.
- Do not duplicate page card markup when behavior is shared. Extract small components under `app/components`.
- For local frontend changes, start the dev server and smoke-check the relevant route when feasible.

## Testing Notes

Use `bunx vitest run ...` for focused unit tests. Direct `bun test` does not reliably understand the Nuxt `~` aliases used by these tests.

Known current caveat: `bun run typecheck` may fail on unrelated TipTap `setContent(..., false)` type errors in:

- `app/components/agents/AgentCommandCenter.vue`
- `app/components/assistant/AssistantComposer.vue`
- `app/components/computer/MarkdownEditor.vue`

If typecheck fails, verify whether new errors are from your changes before reporting.

## Cross-Repo Context

`or3-app` is normally developed beside `or3-intern`:

```text
/Users/brendon/Documents/or3-app
/Users/brendon/Documents/or3-intern
```

Backend service contracts, pairing endpoints, secure sessions, and auth policy are implemented in `or3-intern`. When changing service API behavior, update and test both repos.

Useful `or3-intern` areas:

- `cmd/or3-intern/service_auth.go`
- `cmd/or3-intern/service_secure_connections.go`
- `cmd/or3-intern/service_routes.go`
- `internal/secureconn`
- `docs/v1/user-guide/app-integration/or3-app-connection-guide.md`
- `docs/v1/architecture/security/secure-connections/secure-connections-api.md`

## Working Rules

- Do not revert unrelated dirty files. This repo is often worked on alongside `or3-intern`.
- Keep changes scoped to the route/component/composable involved.
- Prefer structured protocol helpers over ad hoc parsing.
- Do not store bearer tokens in plain app state.
- Avoid changing `bun.lock` unless dependency resolution actually requires it.
