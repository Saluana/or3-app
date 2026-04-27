# Settings, Safety, Passkeys, Pairing, and Mobile Authentication Requirements

## Introduction

This plan defines the requirements for making OR3 App safer and easier to use on mobile while preserving the existing OR3 Intern pairing model. The goal is to separate device enrollment from user-presence authentication: pairing decides whether a device may connect to an OR3 Intern instance, passkeys prove the owner is present, and short-lived sessions carry temporary API access.

The scope covers `or3-app` and `or3-intern` integration points discovered during the audit:

- `or3-app` currently stores paired-device bearer tokens in `sessionStorage` through `app/composables/useLocalCache.ts` and sends them through `app/composables/useOr3Api.ts`.
- `or3-app` pairs devices through `app/composables/usePairing.ts` and presents pairing/device UI in `app/pages/settings/pair.vue`, `app/components/app/HostConnectionCard.vue`, and `app/components/app/DeviceManagementCard.vue`.
- `or3-intern` exposes internal routes from `cmd/or3-intern/service.go`, authenticates shared-secret or paired-device bearer tokens in `cmd/or3-intern/service_auth.go`, and stores paired devices/pairing requests in `internal/db/db.go` and `internal/db/approval_store.go`.
- `or3-intern` currently has no WebAuthn/passkey credential, ceremony, auth-session, or step-up persistence tables.

## Requirements

### 1. Simple Settings Information Architecture

**User Story:** As a mobile user, I want settings grouped by everyday outcomes, so that I can configure OR3 without understanding low-level backend flags.

#### Acceptance Criteria

1. WHEN the user opens Settings THEN the app SHALL show simple categories before advanced configuration sections.
2. WHEN a setting maps to existing `configure` fields THEN the app SHALL use the existing `/internal/v1/configure/*` API rather than introducing duplicate config storage.
3. WHEN a setting is security-sensitive THEN the app SHALL identify whether it requires pairing only, passkey session auth, or recent passkey step-up.
4. WHEN advanced users need raw controls THEN the app SHALL preserve access to the current advanced section editor.
5. IF a backend does not expose a simple setting capability THEN the app SHALL hide or disable the simple control with clear explanatory copy.

### 2. Device Pairing as Enrollment

**User Story:** As an OR3 owner, I want pairing to enroll trusted devices, so that only approved phones or browsers can reach my OR3 Intern instance.

#### Acceptance Criteria

1. WHEN a new device pairs THEN OR3 Intern SHALL continue creating a paired-device record and token hash compatible with existing clients.
2. WHEN a device is paired THEN the system SHALL treat pairing as device enrollment, not proof of the current human user.
3. WHEN a user revokes a paired device THEN all sessions and step-up grants associated with that paired device SHALL be invalidated.
4. WHEN an old app version uses only paired-device bearer tokens THEN OR3 Intern SHALL remain compatible unless passkey enforcement is explicitly enabled.
5. IF unauthenticated pairing is disabled or not allowed by loopback/flag rules THEN the app SHALL show instructions for manual pairing instead of retrying indefinitely.

### 3. Passkey-Based Owner Presence

**User Story:** As an OR3 owner, I want to unlock sensitive access with a passkey, so that local device possession alone is not enough for high-risk actions.

#### Acceptance Criteria

1. WHEN a user registers a passkey THEN OR3 Intern SHALL generate the WebAuthn challenge server-side and validate the registration response server-side.
2. WHEN a user authenticates with a passkey THEN OR3 Intern SHALL verify challenge, origin, RP ID hash, signature, user presence, and user verification according to WebAuthn requirements.
3. WHEN passkeys are used for step-up THEN WebAuthn `userVerification` SHALL be required and the verified UV flag SHALL be checked.
4. WHEN a credential is stored THEN OR3 Intern SHALL persist credential ID, public key, sign count, transports, backup eligibility/state, AAGUID/attestation metadata where available, owner/device linkage, and timestamps.
5. IF WebAuthn is unavailable on the client THEN the app SHALL provide an explicit fallback path based on pairing plus a configured recovery/admin policy, not silently downgrade sensitive actions.

### 4. Short-Lived Auth Sessions

**User Story:** As a mobile user, I want passkey unlocks to create temporary sessions, so that I do not have to approve every safe action while high-risk actions remain protected.

#### Acceptance Criteria

1. WHEN passkey authentication succeeds THEN OR3 Intern SHALL issue an opaque, high-entropy session token bound to the paired device and user/security context.
2. WHEN the app calls internal APIs THEN it SHALL prefer the short-lived session token and retain the paired-device token only as enrollment/bootstrap proof.
3. WHEN the session is idle beyond policy THEN OR3 Intern SHALL reject it and require reauthentication.
4. WHEN the session exceeds absolute lifetime THEN OR3 Intern SHALL reject it even if recently active.
5. WHEN the user logs out, revokes a device, rotates a device token, or removes a passkey THEN related sessions SHALL be invalidated server-side.

### 5. Step-Up Authorization for Sensitive Actions

**User Story:** As an OR3 owner, I want destructive or powerful actions to require recent owner verification, so that compromised tokens cannot perform high-risk operations unattended.

#### Acceptance Criteria

1. WHEN a route performs high-risk operations THEN OR3 Intern SHALL require a recent passkey step-up timestamp in addition to role checks.
2. WHEN a step-up is successful THEN OR3 Intern SHALL record the timestamp, method, credential ID, device ID, and audit event without logging raw tokens.
3. WHEN a step-up window expires THEN sensitive routes SHALL return a structured challenge-required response.
4. IF a request lacks required step-up THEN OR3 App SHALL open an inline passkey prompt and retry only the original user-initiated action after success.
5. WHEN safety approvals and step-up both apply THEN both policies SHALL be enforced without bypassing the existing approval broker.

### 6. Mobile Passkey and Secure Storage Support

**User Story:** As a mobile user, I want passkeys and session storage to work reliably in Capacitor, so that authentication feels native on iOS and Android.

#### Acceptance Criteria

1. WHEN OR3 App runs on iOS THEN passkey support SHALL account for Apple Associated Domains and the `webcredentials` service for the selected RP ID.
2. WHEN OR3 App runs on Android THEN passkey support SHALL account for Digital Asset Links with `delegate_permission/common.get_login_creds` and Android Credential Manager/WebView requirements.
3. WHEN OR3 App stores long-lived enrollment material THEN native builds SHALL use platform secure storage when available instead of browser `sessionStorage`/`localStorage`.
4. WHEN secure storage is unavailable THEN the app SHALL degrade to browser storage only with a clear lower-security state and shorter session durations.
5. IF only local biometric verification is available THEN it SHALL be treated as convenience gating only, never as the server-side passkey proof for sensitive authorization.

### 7. RP ID, Origin, and Deployment Modes

**User Story:** As an operator, I want passkey domains configured explicitly, so that passkeys work without weakening phishing protections.

#### Acceptance Criteria

1. WHEN WebAuthn is enabled THEN OR3 Intern SHALL require explicit RP ID and allowed origin configuration.
2. WHEN OR3 App is served from production domains THEN the RP ID SHALL be a registrable domain or valid subdomain controlled by OR3.
3. WHEN development uses localhost THEN the system SHALL support `http://localhost` WebAuthn development mode with separate credentials from production.
4. WHEN tunnel or LAN access is used THEN the plan SHALL require HTTPS origins and explicit configuration instead of trying to use raw IP addresses as RP IDs.
5. IF related origins are needed THEN OR3 SHALL serve `/.well-known/webauthn` and keep the allowlist narrow.

### 8. Recovery, Revocation, and Account Safety

**User Story:** As an OR3 owner, I want a safe recovery path if I lose a passkey or phone, so that I do not permanently lose access to my local agent.

#### Acceptance Criteria

1. WHEN the first passkey is created THEN OR3 Intern SHALL require or strongly prompt creation of a recovery path.
2. WHEN a passkey is revoked THEN OR3 Intern SHALL invalidate sessions authenticated by that credential and log the event.
3. WHEN all passkeys are lost THEN recovery SHALL require local administrative control, existing paired admin device policy, or explicit bootstrap recovery configuration.
4. WHEN a recovery action succeeds THEN the system SHALL rotate affected sessions/tokens and audit the event.
5. IF a passkey mismatch occurs because the provider has a credential missing on the server THEN the app SHOULD signal unknown credential where supported.

### 9. Backward Compatibility and Rollout

**User Story:** As an existing OR3 user, I want upgrades to be safe and reversible, so that I can adopt passkeys without breaking current paired devices.

#### Acceptance Criteria

1. WHEN the new backend ships THEN existing pairing and device APIs SHALL continue working.
2. WHEN passkeys are disabled THEN the app SHALL behave like the current paired-device model.
3. WHEN passkeys are enabled in warn mode THEN OR3 Intern SHALL report missing step-up requirements without blocking existing workflows.
4. WHEN passkeys are enabled in enforce mode THEN sensitive routes SHALL require sessions/step-up according to policy.
5. IF an old app cannot satisfy session or step-up requirements THEN OR3 Intern SHALL return machine-readable errors with upgrade instructions.

### 10. Observability, Audit, and Testing

**User Story:** As a developer/operator, I want authentication events to be testable and auditable, so that security regressions are caught before release.

#### Acceptance Criteria

1. WHEN registration, login, step-up, revocation, logout, or recovery occurs THEN OR3 Intern SHALL write audit events without raw tokens or private credential material.
2. WHEN passkey verification fails THEN logs SHALL include safe reason codes and request correlation, not credential payloads.
3. WHEN tests run THEN they SHALL cover WebAuthn ceremony state, replay prevention, session expiry, device revocation, step-up enforcement, and compatibility modes.
4. WHEN mobile builds are validated THEN iOS and Android association files, entitlements/manifests, and WebView/native passkey behavior SHALL be tested.
5. WHEN settings mappings change THEN tests SHALL confirm simple settings apply the intended existing `configure` fields.
