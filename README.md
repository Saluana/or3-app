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

Pair the app to an `or3-intern` host from `/settings/pair`. Start the host with:

```bash
or3-intern service
```

The expected deployment model is a trusted private network such as local LAN, Tailscale, or another authenticated tunnel. Use `http://127.0.0.1:9100` only when the app and intern service are on the same computer; phones and other devices need the computer's LAN or Tailscale address.

The full web, Electron, iOS, Android, pairing, disconnect, and troubleshooting guide lives at [../or3-intern/docs/v1/user-guide/app-integration/or3-app-connection-guide.md](../or3-intern/docs/v1/user-guide/app-integration/or3-app-connection-guide.md).

## Pairing

App-created flow:

```bash
or3-intern pairing approve-code 123456
```

Use this when `/settings/pair` shows a 6-digit code.

CLI-created flow:

```bash
or3-intern connect-device
```

Use this when you want the computer to print the request ID and code first, then enter both values in the app's **Connect with a CLI code** section.

After pairing, use **Disconnect this app** in Settings to forget the saved local token. Revoke host trust from the computer with `or3-intern connect-device disconnect <device-id>`.

## Electron

During development, start Nuxt first, then run Electron in another terminal:

```bash
bun run electron:dev
```

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
