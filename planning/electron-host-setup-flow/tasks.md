<!-- artifact_id: 1cfa8984-4c6f-4fb9-8d92-f426524f6024 -->
<!-- content_type: text/markdown -->

# Electron Host Setup Flow Tasks

## 1. Define Mode and Setup Foundations

- [ ] 1.1 Add runtime platform and mode types
    - Define `Or3RuntimePlatform`, `PlatformCapabilities`, `AppUseMode`, and setup-state interfaces.
    - Keep the language split between internal `host/remote` and user-facing **Use this computer / Control another computer**.
    - Requirements: 1.1, 1.2, 9.1, 10.1

- [ ] 1.2 Add setup state store/composable
    - Create a setup composable for first-run state, current step, selected mode, and completion.
    - Persist non-secret renderer setup state.
    - Requirements: 1.5, 10.1, 10.2

- [ ] 1.3 Add Electron capability detection
    - Detect Electron through the preload bridge rather than user-agent heuristics.
    - Return safe browser/mobile defaults when the bridge is absent.
    - Requirements: 6.4, 9.2, 10.4

- [ ] 1.4 Gate host-mode UI by platform and mode
    - Ensure host setup and local service controls appear only in Electron host mode.
    - Ensure web, iOS, Android, and Electron remote mode continue using client flows.
    - Requirements: 6.4, 9.1, 9.2, 12.4

## 2. Build First-Run Setup UX

- [ ] 2.1 Create setup shell route/component
    - Add a first-run screen that appears before normal navigation when setup is incomplete.
    - Keep the visual language consistent with the current desktop app.
    - Requirements: 1.1, 2.1, 2.2

- [ ] 2.2 Implement role selection step
    - Add two clear choices: **Use this computer** and **Control another computer**.
    - Include one short benefit sentence per choice.
    - Requirements: 1.2, 1.3, 1.4

- [ ] 2.3 Implement host essentials step
    - Ask for machine name and workspace folder.
    - Use Electron folder picker for workspace selection.
    - Requirements: 2.3, 2.4, 4.1

- [ ] 2.4 Implement security preset step
    - Add three choices: **Private**, **Home network**, and **Custom**.
    - Keep **Private** selected by default.
    - Requirements: 3.1, 3.2, 3.3, 7.2

- [ ] 2.5 Implement advanced setup disclosure
    - Add advanced fields for intern binary path, data directory, listen address, port, autostart, and service behavior.
    - Keep it collapsed by default.
    - Requirements: 2.2, 2.5, 3.4

- [ ] 2.6 Implement setup progress/final step
    - Show intern detection/install, config apply, service start, and finish states.
    - End with **Connect a device** and **Go to dashboard** actions.
    - Requirements: 4.4, 5.1, 7.1

## 3. Expand Electron Preload and Main Process APIs

- [ ] 3.1 Define narrow preload API shape
    - Expose `window.or3Desktop.platform`, `filesystem`, and `intern` namespaces.
    - Do not expose generic shell, fs, or process APIs.
    - Requirements: 4.1, 5.1, 12.2

- [ ] 3.2 Add IPC channel allowlist and validation
    - Extend Electron security tests for every new IPC channel.
    - Validate arguments in main before using them.
    - Requirements: 12.2

- [ ] 3.3 Add native folder picker IPC
    - Implement workspace and data-directory folder selection using Electron dialog APIs.
    - Return structured cancel/success results.
    - Requirements: 2.3, 2.5

- [ ] 3.4 Add manual binary picker IPC
    - Let advanced users choose an existing `or3-intern` binary when install/detection fails.
    - Validate the selected binary by running a safe version check.
    - Requirements: 4.1, 4.5

- [ ] 3.5 Add Electron host config persistence
    - Store privileged Electron host config under `app.getPath('userData')`.
    - Keep secrets out of renderer localStorage.
    - Requirements: 10.1, 10.5

## 4. Implement Intern Detection and Installation

- [ ] 4.1 Detect bundled intern binary
    - Define expected packaged binary location and version check.
    - Prefer bundled binary in packaged host mode.
    - Requirements: 4.1, 4.2

- [ ] 4.2 Detect PATH intern binary for development
    - Check PATH for `or3-intern` and validate compatibility.
    - Use this as the primary development fallback.
    - Requirements: 4.1, 4.2

- [ ] 4.3 Add install flow placeholder or installer integration
    - If no binary exists, offer install/download UI.
    - Capture progress and failures as structured results.
    - Requirements: 4.3, 4.4, 4.5

- [ ] 4.4 Add install failure recovery
    - Provide retry, choose binary, and open diagnostics actions.
    - Requirements: 4.4, 4.5

## 5. Implement Local Service Lifecycle

- [ ] 5.1 Add service config mapping
    - Map machine name, workspace, preset, listen address, port, and autostart to `or3-intern` config commands/files.
    - Requirements: 3.2, 5.1

- [ ] 5.2 Start local service safely
    - Spawn `or3-intern service` without shell command strings.
    - Track process ID, start time, base URL, and logs.
    - Requirements: 5.1, 5.2

- [ ] 5.3 Connect to already-running service
    - If the service is already reachable and compatible, adopt it instead of starting a duplicate.
    - Requirements: 5.1, 5.2

- [ ] 5.4 Add health polling
    - Poll health/bootstrap endpoints and expose `ServiceStatus` to renderer.
    - Requirements: 5.2, 5.3, 6.2

- [ ] 5.5 Add restart and stop controls
    - Implement restart/stop actions with clear loading and error states.
    - Requirements: 5.3, 5.5

- [ ] 5.6 Add autostart support
    - Use Electron app login item APIs where appropriate.
    - Explain behavior when the window closes.
    - Requirements: 5.4, 5.5

## 6. Update Electron Host Navigation and Sidebar UX

- [ ] 6.1 Add host-mode sidebar status card
    - Replace paired-remote status with local service status only in Electron host mode.
    - Include **Connect device**, **Start**, **Restart**, or **Fix setup** actions depending on state.
    - Requirements: 6.1, 6.2, 6.3, 6.4

- [ ] 6.2 Add host dashboard copy
    - Update Computer/Settings copy in host mode so it describes this computer, not a paired remote computer.
    - Requirements: 6.1, 10.3

- [ ] 6.3 Rename client-only pairing entry points in host mode
    - Replace **Pair computer** with **Connect devices** or **Trusted devices** in Electron host settings.
    - Preserve **Pair computer** or **Connect to computer** in remote/client mode.
    - Requirements: 7.1, 8.1, 9.1

- [ ] 6.4 Add mode switching settings
    - Provide a clear path to switch between **Use this computer** and **Control another computer**.
    - Explain service/autostart consequences before switching away from host mode.
    - Requirements: 9.3, 9.4

## 7. Build Host Connect Device Page

- [ ] 7.1 Add host-only route
    - Create `/computer/connect-device` or `/devices/connect` and gate it to Electron host mode.
    - Requirements: 7.1, 7.2, 9.2

- [ ] 7.2 Implement secure QR primary section
    - Create QR invite through secure-connections intent endpoint.
    - Show QR, text fallback, expiry, and refresh action.
    - Requirements: 7.2, 7.5

- [ ] 7.3 Add remote-device instructions
    - Use short copy for phone/browser users: open OR3 App, choose scan/use text, confirm.
    - Requirements: 7.1, 11.1

- [ ] 7.4 Add CLI code fallback generation
    - Let host users generate request ID/code from the app.
    - Make it visually secondary to QR.
    - Requirements: 7.3, 11.4

- [ ] 7.5 Add hidden legacy compatibility section
    - Keep old short-code flow available under a collapsed **Compatibility** disclosure.
    - Requirements: 7.4, 11.2

- [ ] 7.6 Add invite status watching
    - Show when a device joins, completes enrollment, expires, or fails.
    - Requirements: 7.5, 8.1

## 8. Build Trusted Device Management

- [ ] 8.1 Add host Trusted Devices page/section
    - List secure enrolled devices first.
    - Requirements: 8.1, 8.2

- [ ] 8.2 Add compatibility device section
    - Show legacy pairings separately and label them as compatibility devices.
    - Requirements: 8.2, 7.4

- [ ] 8.3 Add secure device revocation
    - Confirm revocation, call secure device revoke API, and refresh list.
    - Requirements: 8.3, 8.4

- [ ] 8.4 Add legacy device revocation
    - Keep existing legacy revoke behavior but frame it as compatibility cleanup.
    - Requirements: 8.2, 8.3

- [ ] 8.5 Add device-list error states
    - Show recoverable errors without hiding local service status.
    - Requirements: 8.5

## 9. Preserve Remote and Non-Electron Client Flows

- [ ] 9.1 Keep current web/iOS/Android pairing behavior
    - Confirm no host setup UI appears on non-Electron platforms.
    - Requirements: 6.4, 9.1, 12.4

- [ ] 9.2 Keep Electron remote mode pairing behavior
    - Confirm Electron remote mode can use existing QR/text/CLI/legacy client pairing as needed.
    - Requirements: 9.1, 9.2

- [ ] 9.3 Add dev flag for forced client mode
    - Support a development-only override for testing Electron as a remote client.
    - Requirements: 9.5

- [ ] 9.4 Update Settings labels by mode
    - Host mode: **Connect devices** / **Trusted devices**.
    - Remote mode: **Connect to computer**.
    - Requirements: 10.3, 11.5

## 10. Update Documentation

- [ ] 10.1 Add Electron host setup guide
    - Document installer/setup wizard first, not CLI-first startup.
    - Requirements: 11.1, 11.3

- [ ] 10.2 Update current connection guide
    - Split Electron host mode from web/mobile/remote client mode.
    - Requirements: 11.1, 11.5

- [ ] 10.3 Document power-user CLI paths
    - Keep `or3-intern service`, `connect-device`, `devices list`, and revoke commands under troubleshooting/power-user sections.
    - Requirements: 11.2, 11.4

- [ ] 10.4 Add release validation checklist
    - Include packaged Electron launch, setup, local service start, QR connect, and revoke.
    - Requirements: 12.5

## 11. Add Tests

- [ ] 11.1 Add setup state unit tests
    - Cover first run, resume, completed setup, invalid state, and mode switching.
    - Requirements: 10.1, 10.2, 12.1

- [ ] 11.2 Add preset mapping tests
    - Cover Private, Home network, and Custom config mapping.
    - Requirements: 3.1, 3.2, 12.1

- [ ] 11.3 Add platform gating tests
    - Confirm host UI only appears for Electron host mode.
    - Requirements: 6.4, 9.2, 12.4

- [ ] 11.4 Add sidebar host card tests
    - Cover not installed, stopped, starting, online, unhealthy, and error states.
    - Requirements: 6.1, 6.2, 6.3

- [ ] 11.5 Add connect-device page tests
    - Cover QR primary flow, CLI fallback, hidden legacy compatibility, and invite errors.
    - Requirements: 7.1, 7.2, 7.3, 7.4, 7.5

- [ ] 11.6 Add Electron IPC security tests
    - Cover channel allowlists, argument validation, folder picker, service lifecycle IPC, and no raw shell exposure.
    - Requirements: 12.2

- [ ] 11.7 Add integration tests for service lifecycle
    - Cover detected binary, missing binary, install failure, start, health polling, restart, and adopt-running-service behavior.
    - Requirements: 4.1, 4.3, 5.1, 5.3, 5.4

## 12. Validate and Release

- [ ] 12.1 Run focused frontend tests
    - Run setup, sidebar, connect-device, pairing, and Electron security test files.
    - Requirements: 12.1, 12.2, 12.4

- [ ] 12.2 Run typecheck and web build
    - Ensure shared code still builds for web/mobile.
    - Requirements: 9.1, 12.4

- [ ] 12.3 Run packaged Electron smoke test
    - Launch packaged/static Electron, complete setup, and confirm no blank screen/CSP regression.
    - Requirements: 12.5

- [ ] 12.4 Run host-mode end-to-end smoke test
    - Complete first-run host setup, start service, open connect-device page, connect a remote device, list devices, revoke device.
    - Requirements: 12.3, 12.5

- [ ] 12.5 Run remote-mode smoke test
    - Select **Control another computer** and confirm existing client pairing works.
    - Requirements: 9.1, 9.2, 12.4
