<!-- artifact_id: 9f1b0b49-8aa8-48c8-a201-1a4f1cf9d0f1 -->
<!-- content_type: text/markdown -->

# Electron Host Setup Flow Requirements

## Introduction

This plan defines the requirements for making OR3 App Electron feel like a consumer desktop host app while keeping web, iOS, Android, and optional Electron remote mode as client experiences. The Electron app should guide a new user through a short first-run setup, install or detect `or3-intern` when this computer will be the host, start and monitor the local service, and provide a clear **Connect device** experience for phones, browsers, and remote Electron clients.

The product language should avoid technical terms where possible:

- User-facing **This computer** means internal host mode.
- User-facing **Control another computer** means internal remote/client mode.
- User-facing **Connect device** means host-generated QR enrollment plus secondary CLI code and hidden legacy fallback.
- User-facing **Trusted devices** means enrolled secure devices and compatibility pairings.

The most important UX constraint is that setup must be short enough for non-technical users, with advanced details available but not in the main path.

## Requirements

### 1. First-Run Role Selection

**User Story:** As a new Electron user, I want to choose whether this app controls this computer or another computer, so that the setup matches how I actually intend to use OR3.

#### Acceptance Criteria

1. WHEN the Electron app launches for the first time THEN it SHALL show a setup flow before the normal app shell.
2. WHEN the setup asks for the app's role THEN it SHALL use consumer wording such as **Use this computer** and **Control another computer** rather than requiring the user to understand host/client terminology.
3. WHEN the user chooses **Use this computer** THEN the app SHALL enter Electron host mode and set up local `or3-intern` service management.
4. WHEN the user chooses **Control another computer** THEN the app SHALL enter remote mode and show the existing client pairing/connect flow.
5. IF the user skips or exits setup THEN the app SHALL preserve progress and return to the same setup step on next launch.

### 2. Short Consumer Setup Wizard

**User Story:** As a non-technical desktop user, I want setup to ask only for the essential choices, so that I can get OR3 running without feeling overwhelmed.

#### Acceptance Criteria

1. WHEN the user chooses **Use this computer** THEN setup SHALL be no more than three main steps before the local service can start.
2. WHEN advanced settings are available THEN they SHALL be hidden behind an **Advanced** disclosure or secondary page.
3. WHEN setup needs a folder path THEN Electron SHALL use a native folder picker instead of asking the user to type a path string.
4. WHEN the user accepts recommended defaults THEN the app SHALL configure workspace directory, service access, local security, and autostart with safe defaults.
5. IF the user wants expert control THEN advanced fields SHALL expose listen address, port, data directory, autostart, service binary path, and security mode without blocking the simple path.

### 3. Security Presets Without Overload

**User Story:** As a desktop user, I want simple security choices, so that I can choose a safe setup without reading a security manual.

#### Acceptance Criteria

1. WHEN host setup reaches security choices THEN it SHALL offer three clear presets with plain-language descriptions.
2. WHEN a preset is chosen THEN it SHALL apply the corresponding `or3-intern` config values automatically.
3. WHEN the user chooses the recommended preset THEN the service SHALL be local-only by default and require explicit user action before LAN or Tailscale exposure.
4. WHEN a less restrictive preset is chosen THEN the app SHALL explain the tradeoff in one short sentence and provide a way to change it later.
5. IF the selected preset requires a restart or service reconfiguration THEN the app SHALL apply it and show progress without requiring terminal commands.

### 4. Local Intern Detection and Installation

**User Story:** As a desktop user, I want OR3 App to find or install the local intern service, so that I do not have to manage command-line tools before using the app.

#### Acceptance Criteria

1. WHEN host mode setup starts THEN the app SHALL check whether a compatible `or3-intern` binary is bundled, installed on PATH, or available in a configured location.
2. WHEN a compatible binary is found THEN the app SHALL show a simple success state and continue setup.
3. WHEN no compatible binary is found THEN the app SHALL offer to install or download the companion service.
4. WHEN installation runs THEN the app SHALL show progress, errors, and retry actions in the setup UI.
5. IF installation fails THEN the app SHALL provide a manual path selection fallback for advanced users.

### 5. Local Service Lifecycle Management

**User Story:** As a desktop host user, I want the Electron app to start and watch OR3 Intern for me, so that I do not need a terminal window to keep OR3 running.

#### Acceptance Criteria

1. WHEN host setup completes THEN the app SHALL start `or3-intern service` or connect to an already-running compatible service.
2. WHEN the service is running THEN the app SHALL show local runtime status, service address, and health in Electron-only host UI.
3. WHEN the service stops or becomes unhealthy THEN the app SHALL show a recoverable status and offer restart.
4. WHEN autostart is enabled THEN the app SHALL register startup behavior appropriate for the OS.
5. IF the app window closes while autostart/background service is enabled THEN the service SHALL continue or stop according to the user's selected behavior.

### 6. Electron-Only Host Sidebar Status

**User Story:** As a desktop host user, I want the sidebar to show this computer's service status and quick actions, so that I can tell whether OR3 is ready at a glance.

#### Acceptance Criteria

1. WHEN Electron is in host mode THEN the bottom sidebar card SHALL show local `or3-intern` status rather than paired-remote status.
2. WHEN the service is online THEN the card SHALL show **Online**, the local service address, and a quick **Connect device** action.
3. WHEN the service is offline THEN the card SHALL show **Offline** and a quick **Start** or **Fix setup** action.
4. WHEN the app runs on web, iOS, Android, or Electron remote mode THEN this Electron-only host card SHALL NOT replace the existing client status model.
5. IF the service has connected devices THEN the card or associated page SHOULD show a concise device count.

### 7. Host-Side Connect Device Experience

**User Story:** As a desktop host user, I want to connect my phone or browser from the host app, so that the computer shows the QR code and instructions instead of asking itself to pair.

#### Acceptance Criteria

1. WHEN the host user clicks **Connect device** THEN the app SHALL open a full page or focused modal designed for adding a remote device.
2. WHEN the connect-device page opens THEN secure QR enrollment SHALL be the primary visible path.
3. WHEN the user needs a fallback THEN the page SHALL offer a secondary CLI/manual code path that can be generated from the app.
4. WHEN legacy short-code compatibility is available THEN it SHALL be hidden behind a **Compatibility** disclosure or advanced section.
5. IF the service cannot create a QR intent or code THEN the page SHALL show the cause and a retry action without dumping raw technical output.

### 8. Trusted Device Management

**User Story:** As a host owner, I want to review and remove trusted devices, so that I can keep control over who can access this computer.

#### Acceptance Criteria

1. WHEN the user opens trusted-device management in Electron host mode THEN the app SHALL list secure enrolled devices first.
2. WHEN legacy pairings exist THEN the app SHALL list them separately as compatibility devices.
3. WHEN the user revokes a device THEN the app SHALL require a confirmation and then call the appropriate secure or legacy revocation API.
4. WHEN a device is revoked THEN active sessions for that device SHALL no longer be accepted by the service.
5. IF device listing fails THEN the app SHALL show a recoverable error and keep the last known local service status visible.

### 9. Remote Mode Compatibility

**User Story:** As a user who installs Electron on a second computer, I want to use it like a remote client if I choose that mode, so that Electron is not locked to host-only behavior.

#### Acceptance Criteria

1. WHEN the user chooses **Control another computer** THEN Electron SHALL use the existing pairing/client connection screens.
2. WHEN Electron is in remote mode THEN it SHALL not expose local service install/start controls in the normal UI.
3. WHEN the user changes their mind THEN Settings SHALL provide a clear way to switch modes with appropriate warnings.
4. WHEN switching from host to remote mode THEN the app SHALL explain what happens to the local service and autostart.
5. IF a dev flag forces client mode THEN it SHALL be treated as development-only and not as the packaged default.

### 10. Setup Persistence and Mode Awareness

**User Story:** As a returning user, I want OR3 App to remember my setup mode and choices, so that I do not repeat setup every time.

#### Acceptance Criteria

1. WHEN setup completes THEN the app SHALL persist setup mode, completed steps, selected preset, workspace directory, and service preferences.
2. WHEN setup data is missing or invalid THEN the app SHALL restart setup gracefully.
3. WHEN Electron host mode is active THEN app navigation, Settings labels, and connection copy SHALL reflect host behavior.
4. WHEN non-Electron platforms run THEN they SHALL ignore Electron-only host setup state.
5. IF setup state migration is needed in future versions THEN the app SHALL preserve safe defaults and avoid destructive resets.

### 11. Documentation and Power-User Escape Hatches

**User Story:** As a power user, I want CLI paths documented but not required, so that I can troubleshoot without making the main UX harder for everyone else.

#### Acceptance Criteria

1. WHEN Electron host mode ships THEN documentation SHALL describe the normal installer/setup flow first.
2. WHEN CLI commands remain useful THEN documentation SHALL list them under power-user or troubleshooting sections.
3. WHEN users need to install or locate `or3-intern` manually THEN docs SHALL explain the manual path without making it the default path.
4. WHEN the host app can generate CLI codes THEN docs SHALL clarify how they differ from secure QR enrollment and legacy pairing.
5. IF a feature is Electron-only THEN docs SHALL clearly say that web/iOS/Android users will not see it.

### 12. Testing and Release Confidence

**User Story:** As a maintainer, I want host-mode setup tested end to end, so that Electron releases do not regress startup, setup, service management, or pairing.

#### Acceptance Criteria

1. WHEN unit tests run THEN they SHALL cover setup state, platform detection, security preset mapping, sidebar mode behavior, and connect-device UI gating.
2. WHEN Electron tests run THEN they SHALL cover preload IPC allowlists, folder picker IPC, service lifecycle IPC, and packaged CSP behavior.
3. WHEN integration tests run THEN they SHALL cover host setup with detected binary, missing binary, failed install, service start, service restart, QR creation, and device revocation.
4. WHEN remote platforms are tested THEN they SHALL confirm Electron host-only UI is absent from web, iOS, Android, and Electron remote mode.
5. IF a packaged installer is produced THEN release validation SHALL launch the app, complete setup, start the service, connect a device, and revoke it.
