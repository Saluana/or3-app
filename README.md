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

Web, iOS, Android, and Electron remote mode pair the app to an `or3-intern` host from `/settings/pair`. Start the host with:

```bash
or3-intern service
```

The expected deployment model is a trusted private network such as local LAN, Tailscale, or another authenticated tunnel. Use `http://127.0.0.1:9100` only when the app and intern service are on the same computer; phones and other devices need the computer's LAN or Tailscale address.

The full web, Electron, iOS, Android, pairing, disconnect, and troubleshooting guide lives at [../or3-intern/docs/v1/user-guide/app-integration/or3-app-connection-guide.md](../or3-intern/docs/v1/user-guide/app-integration/or3-app-connection-guide.md).

Electron host mode is documented in [docs/electron-host-setup.md](docs/electron-host-setup.md). It covers the first-run **Use this computer** setup, local service management, **Connect device**, trusted devices, and release validation.

## Pairing

Use `/computer/connect-device` on the host computer to create a secure QR invite. Use `/settings/pair` on the remote app to scan or paste that invite.

After pairing, use **Disconnect this app** in Settings to forget the saved local enrollment.

## Electron

On first launch, Electron asks whether to **Use this computer** or **Control another computer**. Host-only service controls are hidden from web, iOS, Android, and Electron remote mode.

During development, run Electron with the Nuxt dev server and Electron-process restart watcher:

```bash
bun run electron:dev
```

Renderer changes use Nuxt hot reload. Changes under `electron/` restart the Electron process. If you already have Nuxt running separately, use `bun run electron:dev:raw`.

Keep only one Nuxt dev server running for phone testing. If port `3060` is busy, stop the old server before starting `bun run electron:dev`; otherwise phones can keep hitting a stale alternate port.

For a static packaged run:

```bash
bun run electron
```

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
