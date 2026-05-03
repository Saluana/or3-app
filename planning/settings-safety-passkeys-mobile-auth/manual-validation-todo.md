# Manual Passkey and Mobile Auth Todo

Use this checklist after the implementation is built. These steps verify the parts that require local runtime configuration, Capacitor sync, production account values, or physical/signed mobile builds.

## 1. Run OR3 Intern and OR3 App Together in Local Dev

- [ ] 1.1 Confirm the OR3 app dev URL
  - Start the app dev server.
  - Note the exact URL shown by Nuxt, usually `http://localhost:3000`.
  - If Nuxt uses another port, use that exact origin in the backend auth config.

- [ ] 1.2 Enable auth in OR3 Intern for localhost
  - Set auth enabled.
  - Set RP ID to `localhost`.
  - Set allowed origins to the exact app dev origin, for example `http://localhost:3000`.
  - Use `off` or `warn` enforcement for first local testing.

- [ ] 1.3 Start OR3 Intern with the updated config
  - Confirm the intern service starts without auth config validation errors.
  - Confirm the service URL the app is paired to, usually `http://localhost:<intern-port>`.

- [ ] 1.4 Pair the app to the local intern service
  - Open the OR3 app in the browser.
  - Pair it with the running OR3 Intern instance.
  - Confirm normal low-risk app calls still work after pairing.

- [ ] 1.5 Register the first local passkey
  - Open Settings -> Passkeys or Settings -> Security.
  - Register a passkey.
  - Confirm the browser prompts for a platform authenticator.
  - Confirm the passkey appears in the passkey list.

- [ ] 1.6 Test passkey login
  - Log out of the auth session if one exists.
  - Start passkey login.
  - Confirm the browser prompts for the passkey.
  - Confirm the app receives a session and shows authenticated security state.

- [ ] 1.7 Test step-up
  - Trigger a sensitive action, such as passkey rename/revoke or a protected settings change.
  - Confirm the app asks for passkey verification again.
  - Confirm the original action succeeds after step-up.

- [ ] 1.8 Test expired or missing session recovery
  - Clear the session or wait for expiry.
  - Trigger an authenticated action.
  - Confirm the app prompts for passkey login and retries the action.

## 2. Sync Capacitor After Native Biometric Dependency Change

- [ ] 2.1 Install dependencies
  - Run `bun install` from the `or3-app` repo root.
  - Confirm `@capgo/capacitor-native-biometric` is installed.

- [ ] 2.2 Build the web app
  - Run `bun run build:web`.
  - Fix any build failures before continuing.

- [ ] 2.3 Sync Capacitor
  - Run `bunx cap sync`.
  - Confirm iOS and Android native projects are updated.
  - Check for plugin install or native dependency warnings.

- [ ] 2.4 Open the native projects
  - Run `bunx cap open ios` and confirm Xcode opens.
  - Run `bunx cap open android` and confirm Android Studio opens.
  - Confirm both projects load without dependency errors.

## 3. Fill Production Mobile Association Placeholders

- [ ] 3.1 Choose and confirm production identifiers
  - Confirm production RP ID, currently planned as `or3.chat`.
  - Confirm iOS bundle ID.
  - Confirm Apple Team ID.
  - Confirm Android application ID/package name.
  - Confirm Android debug and release signing SHA-256 fingerprints.

- [ ] 3.2 Update Apple association files
  - Edit `public/.well-known/apple-app-site-association`.
  - Edit `public/apple-app-site-association` if it is still used by the deployment.
  - Replace Apple Team ID and bundle ID placeholders with production values.
  - Confirm the JSON is valid and has no comments.

- [ ] 3.3 Update Android asset links
  - Edit `public/.well-known/assetlinks.json`.
  - Replace package name if needed.
  - Replace debug and release fingerprint placeholders.
  - Confirm `delegate_permission/common.get_login_creds` is present.
  - Confirm the JSON is valid and has no comments.

- [ ] 3.4 Host the association files
  - Deploy `https://or3.chat/.well-known/apple-app-site-association`.
  - Deploy `https://or3.chat/.well-known/assetlinks.json`.
  - Confirm both URLs return `200`.
  - Confirm neither URL redirects.
  - Confirm both are served over valid HTTPS.

- [ ] 3.5 Verify production auth config
  - Set RP ID to the production domain, for example `or3.chat`.
  - Set allowed origins to exact HTTPS origins only.
  - Do not include wildcards.
  - Do not include raw IP addresses.

## 4. Validate Signed iOS Build

- [ ] 4.1 Prepare a signed iOS build
  - Use the production or test Apple Team ID.
  - Confirm Associated Domains includes `webcredentials:<rp-domain>`.
  - Install the signed build on a real device.

- [ ] 4.2 Confirm iOS association is active
  - Confirm the AASA file is reachable from the device network.
  - Confirm there are no redirects.
  - Reinstall the app after changing Associated Domains or AASA values.

- [ ] 4.3 Test iOS pairing and secure storage
  - Pair the app with OR3 Intern.
  - Close and reopen the app.
  - Confirm the paired host remains available.
  - Confirm browser fallback storage warning is not shown.

- [ ] 4.4 Test iOS passkey registration
  - Register a passkey from the signed iOS app.
  - Confirm the iOS passkey prompt appears.
  - Confirm the new passkey appears in Settings -> Passkeys.

- [ ] 4.5 Test iOS passkey login
  - Log out of the auth session.
  - Log back in with the passkey.
  - Confirm the app receives a session.

- [ ] 4.6 Test iOS step-up and revocation
  - Trigger a sensitive action.
  - Confirm passkey step-up is shown.
  - Revoke or rename a passkey after step-up.
  - Confirm revoked credentials cannot be used again.

## 5. Validate Signed Android Build

- [ ] 5.1 Prepare a signed Android build
  - Use the application ID listed in `assetlinks.json`.
  - Sign with the certificate whose SHA-256 fingerprint is listed in `assetlinks.json`.
  - Install the signed build on a real device.

- [ ] 5.2 Confirm Android Digital Asset Links is active
  - Confirm `assetlinks.json` is reachable from the device network.
  - Confirm there are no redirects.
  - Wait for Android link verification if needed.
  - Reinstall the app after changing package name, fingerprints, or asset links.

- [ ] 5.3 Test Android pairing and secure storage
  - Pair the app with OR3 Intern.
  - Close and reopen the app.
  - Confirm the paired host remains available.
  - Confirm browser fallback storage warning is not shown.

- [ ] 5.4 Test Android passkey registration
  - Register a passkey from the signed Android app.
  - Confirm the Android credential/passkey prompt appears.
  - Confirm the new passkey appears in Settings -> Passkeys.

- [ ] 5.5 Test Android passkey login
  - Log out of the auth session.
  - Log back in with the passkey.
  - Confirm the app receives a session.

- [ ] 5.6 Test Android step-up and revocation
  - Trigger a sensitive action.
  - Confirm passkey step-up is shown.
  - Revoke or rename a passkey after step-up.
  - Confirm revoked credentials cannot be used again.

## 6. Release Readiness

- [ ] 6.1 Start rollout with enforcement off
  - Deploy with auth configured and enforcement set to `off`.
  - Confirm existing paired-token clients still work.

- [ ] 6.2 Move to warn mode
  - Set enforcement to `warn`.
  - Monitor auth warning audit events.
  - Confirm users can register and use passkeys.

- [ ] 6.3 Move to sensitive enforcement
  - Set enforcement to `enforce-sensitive`.
  - Confirm sensitive actions require passkey-backed session and recent step-up.

- [ ] 6.4 Move to session enforcement later
  - Set enforcement to `enforce-session` only after web, iOS, and Android validation passes.
  - Confirm old clients receive structured upgrade guidance errors.
