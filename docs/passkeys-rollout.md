# Passkeys, Mobile Auth, and Rollout Guide

This guide covers production setup, local development limits, recovery, compatibility modes, and release sequencing for OR3 passkeys. Pairing remains device enrollment. Passkeys prove owner presence. Short-lived sessions carry API access after a successful passkey ceremony.

## Production Domain Setup

- Canonical production RP ID: `or3.chat`.
- Production origins must be exact HTTPS origins under the RP ID, currently `https://or3.chat`, `https://app.or3.chat`, and optionally `https://auth.or3.chat`.
- Do not use wildcard origins. Do not use raw IP addresses or plain HTTP outside localhost development.
- If a self-hosted deployment enables passkeys, set the RP ID to an operator-controlled registrable domain and configure exact HTTPS origins on that domain.
- Related origins are only for narrow controlled origins that need to share the same RP ID. Host `https://<rp-id>/.well-known/webauthn` when related origins are enabled.

iOS requirements:

- Add `webcredentials:or3.chat` to the associated domains entitlement.
- Host `https://or3.chat/.well-known/apple-app-site-association` with no redirect and a valid TLS certificate.
- Replace `TEAMID.com.or3.app` placeholders with the production Apple Team ID and bundle ID before release.

Android requirements:

- Host `https://or3.chat/.well-known/assetlinks.json`.
- Include `delegate_permission/common.get_login_creds`.
- Replace debug and release fingerprint placeholders with actual SHA-256 signing certificate fingerprints.
- Keep debug and release entries explicit because Digital Asset Links verification can be cached.

## Local Development Limits

- `localhost` is the only HTTP development exception. Local passkeys use RP ID `localhost` and are separate from production credentials.
- LAN IP addresses do not work as passkey RP IDs. Use pairing-only mode or an HTTPS domain/tunnel for real-device testing.
- HTTPS tunnels must be configured as exact HTTPS origins and should use a distinct RP ID or controlled subdomain.
- Native app association files are not exercised by plain browser development; validate them on device before enabling enforcement.

## Recovery And Revocation

- First rollout recovery uses local admin bootstrap through OR3 Intern control of the machine.
- An already-paired admin device may be used as a secondary recovery path when policy allows it.
- Removing the last passkey is blocked unless local bootstrap, another active passkey, or an active paired admin device remains available.
- Revoking a passkey invalidates sessions authenticated by that credential.
- Revoking or rotating a paired device invalidates sessions bound to that device.
- Logout revokes only the current auth session and keeps the paired enrollment token unless the device is separately revoked.

## Compatibility Modes

- `off`: passkey/session checks are disabled. Existing paired-device clients continue working.
- `warn`: sensitive routes emit auth warnings and audit events, but legacy paired-device workflows continue.
- `enforce-sensitive`: sensitive routes require an auth session and recent passkey step-up; low-risk routes keep legacy compatibility.
- `enforce-session`: low-risk routes require auth sessions too, except public health/capability/pairing/auth-bootstrap routes.

Old clients that cannot satisfy enforcement receive structured errors:

- `SESSION_REQUIRED`: sign in with a passkey to create a short-lived session.
- `SESSION_EXPIRED`: repeat passkey login.
- `PASSKEY_REQUIRED`: this route needs passkey-backed owner authentication.
- `STEP_UP_REQUIRED`: repeat passkey verification for the original sensitive action.
- `AUTH_UNSUPPORTED`: the backend does not have passkey auth enabled or configured.

## Mobile Validation Checklists

iOS:

- Confirm `ios/App/App/App.entitlements` includes `webcredentials:<rp-domain>`.
- Confirm the hosted `apple-app-site-association` response has no redirect and `Content-Type: application/json`.
- Install a signed build, pair the device, register a passkey, log out, log in, run step-up, revoke the passkey, and confirm sessions are cleared.
- Confirm browser fallback storage is not used when the native secure-storage plugin is present.

Android:

- Confirm `assetlinks.json` includes `delegate_permission/common.get_login_creds` and the debug/release fingerprints used for the installed build.
- Install a signed build, pair the device, register a passkey, log out, log in, run step-up, revoke the passkey, and confirm sessions are cleared.
- Confirm Android App Links/Digital Asset Links verification has settled before testing passkey create/get.
- Confirm browser fallback storage is not used when the native secure-storage plugin is present.

## Phased Release Notes

1. Ship with auth configured but enforcement `off`.
2. Enable `warn` mode and monitor `auth.policy.warn`, passkey registration, login, logout, step-up, and denial audit events.
3. Move to `enforce-sensitive` after old-client usage has been remediated.
4. Move to `enforce-session` only after app startup capability discovery and passkey login work reliably across web, iOS, and Android.
