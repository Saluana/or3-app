# or3-app v1 Release Checklist

## Host + API

- Confirm `or3-intern` host is reachable from the mobile device over a trusted network.
- Verify pairing succeeds with a fresh device label and token exchange.
- Verify the host exposes file, terminal, approvals, configure, jobs, and turns endpoints.
- Confirm operator permissions are used for mobile control flows.

## Mobile UX

- Review all primary screens at roughly 390px width.
- Verify safe-area spacing on header, bottom nav, composer, and terminal input.
- Confirm keyboard behavior on chat composer and terminal command entry.
- Verify touch targets remain comfortable in Settings, Files, and Approvals.

## Core flows

- Pair a new host from Settings.
- Send a chat prompt and confirm streaming assistant output.
- Queue an agent task and confirm lifecycle updates.
- Browse files, upload a file, and send a file context prompt into chat.
- Start a terminal session, run a command, and close the session.
- Approve and deny a pending approval from mobile.
- Edit one configure section and confirm the host saves changes.

## Native prerequisites

- Install CocoaPods before generating/syncing iOS.
- Re-run `bun run cap:sync` before opening Android Studio or Xcode.
- Review status bar, splash, keyboard, and haptics integration before TestFlight/App Store packaging.

## Validation commands

```bash
bun run test
bun run typecheck
bun run build:web
bun run cap:sync
```

For backend validation in `or3-intern`:

```bash
go test ./cmd/or3-intern -run 'TestServiceTerminal|TestServiceFile'
go build ./...
```
