# Settings, Safety, Passkeys, Pairing, and Mobile Authentication Tasks

## 1. Finalize Product and Security Decisions

- [x] 1.1 Choose the production RP ID and domain strategy
  - Decide between `or3.chat`, `auth.or3.chat`, or a different controlled domain.
  - Document how production, localhost, tunnel, LAN, and self-hosted modes behave.
  - Requirements: 3.1, 3.2, 7.1, 7.2, 7.3, 7.4

- [x] 1.2 Choose the recovery model
  - Decide whether recovery uses local CLI/admin bootstrap, recovery codes, paired admin devices, or a combination.
  - Define what happens when the last passkey is removed.
  - Requirements: 8.1, 8.3, 8.4

- [x] 1.3 Choose native mobile passkey implementation path
  - Spike WebView WebAuthn support versus native bridge support for iOS/Android.
  - Verify whether a maintained Capacitor passkey plugin exists or whether a small first-party plugin is required.
  - Requirements: 6.1, 6.2, 6.5

- [x] 1.4 Define route sensitivity matrix
  - Classify every `/internal/v1/*` route as public pairing, low-risk session, sensitive step-up, or admin/recovery.
  - Include configure, devices, approvals, files, terminal, secrets, and capability changes.
  - Requirements: 5.1, 5.5, 10.3

## 2. Add Backend Auth Configuration

- [x] 2.1 Extend OR3 Intern config types
  - Add passkey/session/step-up settings to `internal/config/config.go`.
  - Include enabled mode, RP ID, allowed origins, session TTLs, step-up TTL, fallback policy, and enforcement mode.
  - Requirements: 4.3, 4.4, 7.1, 9.2

- [x] 2.2 Add configure fields for auth settings
  - Extend `cmd/or3-intern/configure.go` and `cmd/or3-intern/configure_tui.go` with an `auth` or expanded `security` section.
  - Keep existing advanced configure behavior intact.
  - Requirements: 1.2, 1.4, 7.1

- [x] 2.3 Validate RP ID and origins
  - Reject insecure production origins, broad wildcards, mismatched RP ID/origin combinations, and raw IP passkey configs.
  - Allow explicit `localhost` development mode.
  - Requirements: 7.1, 7.3, 7.4

## 3. Add SQLite Auth Schema and Store Methods

- [x] 3.1 Add auth migration tables
  - Add `auth_users`, `passkey_credentials`, `webauthn_ceremonies`, `auth_sessions`, and selected recovery tables in `internal/db/db.go` or a called migration module.
  - Requirements: 3.4, 4.1, 8.1, 10.1

- [x] 3.2 Implement passkey credential store
  - Add create/list/update/revoke credential methods.
  - Store credential ID, public key, sign count, transports, backup flags, AAGUID/attestation metadata, timestamps, and owner/device linkage.
  - Requirements: 3.4, 8.2

- [x] 3.3 Implement ceremony store
  - Store WebAuthn library session data server-side.
  - Enforce short expiry, consume-once semantics, failure tracking, and cleanup.
  - Requirements: 3.1, 3.2, 10.3

- [x] 3.4 Implement auth session store
  - Store only token hashes, idle/absolute expiry, role, user ID, device ID, step-up metadata, and revocation fields.
  - Requirements: 4.1, 4.3, 4.4, 10.1

- [x] 3.5 Link revocation cascades
  - Invalidate sessions when paired devices, passkeys, or recovery state are revoked.
  - Requirements: 2.3, 4.5, 8.2

## 4. Implement Backend WebAuthn Service

- [x] 4.1 Add WebAuthn backend dependency
  - Evaluate and add `github.com/go-webauthn/webauthn` or another maintained Go WebAuthn library.
  - Configure RP ID and origins from OR3 config.
  - Requirements: 3.1, 3.2, 7.1

- [x] 4.2 Implement registration begin/finish
  - Generate server-side challenges, exclude existing credentials, require user verification according to policy, and store verified credentials.
  - Requirements: 3.1, 3.3, 3.4

- [x] 4.3 Implement login begin/finish
  - Support discoverable credential/passkey login if chosen.
  - Verify assertions and issue short-lived opaque sessions.
  - Requirements: 3.2, 4.1, 4.2

- [x] 4.4 Implement step-up begin/finish
  - Require UV and update server-side session step-up metadata.
  - Audit credential ID, method, reason, and expiry without logging raw tokens.
  - Requirements: 3.3, 5.2, 5.3

- [x] 4.5 Implement passkey management APIs
  - List, rename, revoke, and inspect passkey metadata.
  - Require recent step-up for destructive passkey changes.
  - Requirements: 8.2, 8.4

## 5. Integrate Backend Auth Middleware and Route Policy

- [x] 5.1 Extend service auth middleware
  - Update `cmd/or3-intern/service_auth.go` to validate auth sessions in addition to existing shared-secret and paired-device tokens.
  - Preserve pairing and legacy compatibility paths.
  - Requirements: 2.4, 4.2, 9.1, 9.2

- [x] 5.2 Add structured auth challenge errors
  - Return `SESSION_REQUIRED`, `PASSKEY_REQUIRED`, `STEP_UP_REQUIRED`, `SESSION_EXPIRED`, and `AUTH_UNSUPPORTED` with retry metadata.
  - Requirements: 5.3, 5.4, 9.5

- [x] 5.3 Add step-up enforcement hook
  - Apply sensitivity matrix before route handlers execute.
  - Start in warn mode before blocking.
  - Requirements: 5.1, 9.3, 9.4

- [x] 5.4 Preserve approval broker behavior
  - Ensure existing approval broker checks still run after successful auth/step-up.
  - Requirements: 5.5

- [x] 5.5 Add audit events
  - Log registration, login, logout, session expiry, revocation, recovery, step-up success/failure, and policy denials safely.
  - Requirements: 10.1, 10.2

## 6. Add OR3 App Auth and Storage Abstractions

- [x] 6.1 Add auth types
  - Create `app/types/auth.ts` with capabilities, session, passkey, step-up, and challenge-error types.
  - Requirements: 4.1, 5.3, 9.5

- [x] 6.2 Add WebAuthn utility module
  - Create `app/utils/auth/webauthn.ts` for JSON option parsing, `navigator.credentials.create/get`, capability detection, abort handling, and error normalization.
  - Requirements: 3.1, 3.2, 6.4

- [x] 6.3 Add session composable
  - Create `app/composables/useAuthSession.ts` for capabilities, login, logout, session refresh, and step-up retry orchestration.
  - Requirements: 4.2, 4.5, 5.4

- [x] 6.4 Add passkey composable
  - Create `app/composables/usePasskeys.ts` for registration, listing, renaming, revocation, and recovery guidance.
  - Requirements: 3.4, 8.2, 8.5

- [x] 6.5 Add secure token storage wrapper
  - Create `app/composables/useSecureHostTokens.ts` and migrate token access behind it.
  - Keep browser fallback but prepare native secure storage integration.
  - Requirements: 6.3, 6.4

- [x] 6.6 Update API wrapper credential selection
  - Update `app/composables/useOr3Api.ts` to prefer session tokens, handle challenge errors, and keep pairing token bootstrap compatibility.
  - Requirements: 4.2, 5.4, 9.5

## 7. Build Settings and Security UX

- [x] 7.1 Redesign Settings landing page information architecture
  - Update `app/pages/settings.vue` to show Connection, Security, Safety, Agent Behavior, Knowledge, and Advanced groups.
  - Requirements: 1.1, 1.4

- [x] 7.2 Add Security dashboard
  - Add `app/pages/settings/security.vue` and overview cards for passkey status, session policy, device trust, and recovery readiness.
  - Requirements: 1.3, 6.4, 8.1

- [x] 7.3 Add Passkeys page
  - Add `app/pages/settings/passkeys.vue` and components for registration, passkey list, rename, revoke, and unknown-credential guidance.
  - Requirements: 3.4, 8.2, 8.5

- [x] 7.4 Improve pairing/device copy
  - Clarify in `app/pages/settings/pair.vue`, `HostConnectionCard`, and `DeviceManagementCard` that pairing enrolls a device, while passkeys verify the owner.
  - Requirements: 2.1, 2.2

- [x] 7.5 Add step-up modal/sheet
  - Add a reusable mobile-first component that explains why verification is needed, runs passkey step-up, and retries the original action.
  - Requirements: 5.3, 5.4

- [x] 7.6 Add advanced settings escape hatch
  - Keep current section editor available from Advanced.
  - Requirements: 1.4

## 8. Add Mobile Platform Support

- [x] 8.1 Add iOS Associated Domains assets/config
  - Add `webcredentials:<rp-domain>` entitlement guidance/config and host `apple-app-site-association` for the chosen domain.
  - Requirements: 6.1, 7.2

- [x] 8.2 Add Android Digital Asset Links assets/config
  - Add `assetlinks.json` with package `com.or3.app`, release/debug fingerprints, and `delegate_permission/common.get_login_creds`.
  - Requirements: 6.2, 7.2

- [ ] 8.3 Validate WebView/native passkey behavior
  - Confirm passkey registration/login works in Capacitor on iOS and Android for the chosen implementation path.
  - Requirements: 6.1, 6.2

- [x] 8.4 Integrate secure storage
  - Select a maintained secure-storage/native biometric plugin or implement a minimal native secure-storage bridge.
  - Store paired-device token and session token outside browser storage in native builds.
  - Requirements: 6.3, 6.5

- [x] 8.5 Add degraded security state UI
  - Show clear status when running in browser fallback or unsupported mobile passkey mode.
  - Requirements: 6.4, 6.5

## 9. Add Backward Compatibility and Rollout Controls

- [ ] 9.1 Add backend capability discovery
  - Implement `GET /internal/v1/auth/capabilities` and use it during app startup.
  - Requirements: 1.5, 9.5

- [ ] 9.2 Add enforcement modes
  - Implement `off`, `warn`, `enforce-sensitive`, and `enforce-session` modes.
  - Requirements: 9.2, 9.3, 9.4

- [ ] 9.3 Keep legacy app behavior working
  - Confirm older app clients can use paired-device tokens in `off` and `warn` modes.
  - Requirements: 2.4, 9.1, 9.2

- [ ] 9.4 Add upgrade guidance errors
  - Ensure old clients receive actionable structured errors when enforcement is enabled.
  - Requirements: 9.5

- [ ] 9.5 Add migration safety checks
  - Ensure auth migrations are additive and do not mutate existing paired devices destructively.
  - Requirements: 9.1

## 10. Test Backend Security Behavior

- [ ] 10.1 Add WebAuthn unit tests
  - Test ceremony expiry, replay prevention, origin/RP mismatch, UV required, unknown credential, and counter updates.
  - Requirements: 3.1, 3.2, 3.3, 10.3

- [ ] 10.2 Add session tests
  - Test token hashing, idle expiry, absolute expiry, revocation, logout, and device revocation cascades.
  - Requirements: 4.1, 4.3, 4.4, 4.5

- [ ] 10.3 Add step-up policy tests
  - Test route sensitivity matrix and warn/enforce behavior.
  - Requirements: 5.1, 5.3, 9.3, 9.4

- [ ] 10.4 Add compatibility tests
  - Test existing paired-token workflows in disabled/warn modes and structured failures in enforcement mode.
  - Requirements: 2.4, 9.1, 9.5

- [ ] 10.5 Add audit tests
  - Confirm sensitive auth events are logged and raw token/credential payloads are not logged.
  - Requirements: 10.1, 10.2

## 11. Test OR3 App UX and Mobile Behavior

- [ ] 11.1 Add composable unit tests
  - Test `useAuthSession`, `usePasskeys`, WebAuthn utility error mapping, storage fallback, and API retry-on-step-up.
  - Requirements: 4.2, 5.4, 6.4

- [ ] 11.2 Add settings mapping tests
  - Verify simple settings apply expected configure fields and preserve advanced editor behavior.
  - Requirements: 1.2, 1.4, 10.5

- [ ] 11.3 Add browser WebAuthn tests
  - Use virtual authenticator support where available to test registration/login/step-up flows.
  - Requirements: 3.1, 3.2, 5.4

- [ ] 11.4 Add iOS validation checklist
  - Validate Associated Domains, `apple-app-site-association`, passkey create/get, secure storage, logout, and revoke cleanup.
  - Requirements: 6.1, 6.3, 10.4

- [ ] 11.5 Add Android validation checklist
  - Validate Digital Asset Links, debug/release fingerprints, Credential Manager/WebView behavior, secure storage, logout, and revoke cleanup.
  - Requirements: 6.2, 6.3, 10.4

## 12. Documentation and Release Preparation

- [ ] 12.1 Document setup for production domains
  - Include RP ID, associated domains, asset links, HTTPS requirements, and related-origin guidance.
  - Requirements: 7.1, 7.2, 7.5

- [ ] 12.2 Document local development limitations
  - Explain `localhost` credentials, HTTPS tunnel requirements, LAN/IP limitations, and mobile association constraints.
  - Requirements: 7.3, 7.4

- [ ] 12.3 Document recovery and revocation
  - Explain how to recover lost passkeys, revoke devices/passkeys, and rotate tokens.
  - Requirements: 8.1, 8.2, 8.3, 8.4

- [ ] 12.4 Document compatibility modes
  - Explain off/warn/enforce behavior and old-client outcomes.
  - Requirements: 9.1, 9.2, 9.3, 9.4, 9.5

- [ ] 12.5 Prepare phased release notes
  - Ship disabled first, then warn mode, then sensitive enforcement, then broader session enforcement.
  - Requirements: 9.1, 9.3, 9.4
