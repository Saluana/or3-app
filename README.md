# or3-app

Nuxt 4 starter configured for Capacitor with:

- Nuxt UI
- Nuxt Icon
- Nuxt Fonts
- Android Capacitor shell

## Install

```bash
npm install
```

## Development

```bash
npm run dev
```

## Web build

Builds a static bundle into `.output/public`, which is what Capacitor syncs into the native projects.

```bash
npm run build:web
```

## Capacitor

Sync the latest web build into native projects:

```bash
npm run cap:sync
```

Open Android Studio:

```bash
npm run cap:open:android
```

Open Xcode:

```bash
npm run cap:open:ios
```

## iOS prerequisite

The iOS platform was not generated yet because CocoaPods is not installed on this machine. After installing CocoaPods, run:

```bash
npx cap add ios
npm run cap:sync
```
