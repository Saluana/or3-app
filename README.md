# or3-app

`or3-app` is a mobile-first Nuxt 4 + Capacitor companion for `or3-intern`.

Current v1 surfaces include:

- pairing and trusted host switching
- chat with streaming assistant responses
- agent job queue and status views
- computer overview with health/readiness/capability status
- root-scoped file browser with upload flow
- bounded mobile terminal sessions
- approvals inbox and allowlist management
- remote settings editor backed by `or3-intern` configure APIs

Built with:

- Nuxt UI
- Nuxt Icon
- Nuxt Fonts
- Capacitor
- Bun
- Android Capacitor shell

## Install

```bash
bun install
```

## Development

```bash
bun run dev
```

Pair the app to an `or3-intern` host from the Settings screen. The expected deployment model is a trusted private network such as local LAN, Tailscale, or another authenticated tunnel.

## Web build

Builds a static bundle into `.output/public`, which is what Capacitor syncs into the native projects.

```bash
bun run build:web
```

## Capacitor

Sync the latest web build into native projects:

```bash
bun run cap:sync
```

Open Android Studio:

```bash
bun run cap:open:android
```

Open Xcode:

```bash
bun run cap:open:ios
```

## Validation

Run the current app verification flow:

```bash
bun run test
bun run typecheck
bun run build:web
bun run cap:sync
```

## iOS prerequisite

The iOS platform was not generated yet because CocoaPods is not installed on this machine. After installing CocoaPods, run:

```bash
bunx cap add ios
bun run cap:sync
```
