# Electron Host Setup

Electron can run in two desktop roles:

- **Use this computer** starts OR3 on the current computer, monitors the local `or3-intern` service, and shows **Connect device** / **Trusted devices** host tools.
- **Control another computer** keeps the same remote client behavior as web, iOS, and Android. Pairing remains under Settings.

Web, iOS, Android, and Electron remote mode do not show local service install/start controls.

## First-run setup

On first Electron launch, OR3 asks which role to use. The recommended host path is short:

1. Choose **Use this computer**.
2. Pick a machine name and workspace folder with the native folder picker.
3. Keep **Private** security unless you intentionally want LAN access, then start OR3.

Advanced setup exposes the intern binary path, data directory, listen address, port, autostart, and service background behavior.

## Companion service

The desktop app looks for `or3-intern` in this order:

1. Packaged/bundled binary location.
2. A manually selected binary from Advanced setup.
3. `or3-intern` on `PATH` for development.

If automatic installation is unavailable or fails, choose an existing binary manually. The main process validates it with a safe `--version` check before using it.

## Security presets

- **Private**: local-only `127.0.0.1`, secure QR preferred, approvals on, no LAN exposure.
- **Home network**: private-network access for approved devices, secure QR preferred, approvals on.
- **Custom**: power-user control of listen address and compatibility behavior.

Use **Private** unless you understand the tradeoff of exposing the local service beyond this computer.

## Connect device

Host mode uses `/computer/connect-device`:

- Secure QR enrollment is the supported path.

Remote/client mode still uses `/settings/pair` to connect this app to another computer.

## Trusted devices

Host mode uses `/computer/trusted-devices` to list secure enrolled devices. Revocation asks for confirmation and then calls the secure service API.

Power users can still use CLI commands when troubleshooting:

```bash
or3-intern service
```

## Release validation checklist

- Launch a fresh packaged Electron build and confirm setup appears before the app shell.
- Complete **Use this computer** with the default **Private** preset.
- Confirm the local service starts or an already-running service is adopted.
- Open **Connect device** and generate a secure QR invite plus code fallback.
- Connect a phone/browser/remote Electron client, list it under **Trusted devices**, and revoke it.
- Relaunch Electron and confirm mode/setup state persists.
- Launch web, iOS, Android, and Electron remote mode and confirm host-only controls are absent.
