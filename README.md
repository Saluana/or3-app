# or3-app

Nuxt 4 starter configured for Capacitor with:

- Nuxt UI
- Nuxt Icon
- Nuxt Fonts
- Android Capacitor shell

## Install

```bash
bun install
```

## Development

```bash
bun run dev
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

## iOS prerequisite

The iOS platform was not generated yet because CocoaPods is not installed on this machine. After installing CocoaPods, run:

```bash
bunx cap add ios
bun run cap:sync
```
