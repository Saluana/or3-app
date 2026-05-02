# OR3 Intern App UX Foundations Requirements

## Introduction

`or3-app` already has strong building blocks, but several of its most important host-facing workflows still depend on stitching together low-level `or3-intern` routes:

- pairing is handled as a multi-step bootstrap plus a separate health verification pass
- host status is assembled from separate health, readiness, and capabilities requests
- approvals use polling for counts and full lists
- jobs mix per-job SSE with periodic history refresh
- service restart is currently implemented by opening a terminal session and typing a shell command
- auth requirements are often discovered reactively after the user already tried an action

The goal of this planning set is to make `or3-intern` more product-shaped for `or3-app`, so the app can behave like a calm mobile control surface instead of a bundle of API adapters.

Chosen scope:

1. Cover all six improvement areas in one phased roadmap.
2. Keep **Phase 1** focused on the biggest leverage points: bootstrap, unified events, and high-level actions.
3. Preserve backward compatibility with older `or3-intern` builds while the app migrates.

Current findings:

- `usePairing.ts` directly calls pairing request/exchange endpoints, persists pending pairing locally, then separately verifies host reachability.
- `useComputerStatus.ts` merges `/health`, `/readiness`, and `/capabilities` with partial failure logic.
- `useApprovals.ts` polls pending approval count every 15 seconds and refetches lists after mutations.
- `useJobs.ts` combines a persisted subagent list, per-job SSE streams, and history polling.
- `useServiceRestart.ts` creates a terminal session and sends a restart shell command.
- `useAuthSession.ts` resolves session and step-up challenges after protected routes reject the request.

## Requirements

### 1. Unified Bootstrap and Host Overview

**User Story:** As a mobile user, I want one authoritative bootstrap response for the active host, so that the app can show a trustworthy connection state without guessing across many endpoints.

#### Acceptance Criteria

1. WHEN `or3-app` connects to or resumes a paired host THEN `or3-intern` SHALL provide a single bootstrap/overview endpoint that summarizes pairing state, auth/session state, host identity, health, readiness, capabilities, and key pending counts.
2. WHEN some subsystems are degraded THEN the bootstrap response SHALL still return a usable partial overview with warnings and degraded-state hints instead of forcing the app to infer meaning from several failed requests.
3. WHEN the user is paired but not signed in with a passkey session THEN the bootstrap response SHALL say so explicitly.
4. WHEN the host supports app-specific higher-level surfaces THEN the bootstrap response SHALL advertise them through clear capability flags or descriptors.
5. IF the app talks to an older `or3-intern` build that does not support the bootstrap endpoint THEN `or3-app` SHALL be able to fall back to the current multi-request behavior.

### 2. Unified Realtime App Event Stream

**User Story:** As a mobile user, I want one live event stream for important host changes, so that approvals, jobs, and status changes feel immediate without lots of polling.

#### Acceptance Criteria

1. WHEN the app is connected to a supported host THEN `or3-intern` SHALL expose a single SSE stream for app-relevant events.
2. WHEN approvals, jobs, pairing state, host status, terminal status, or high-level actions change THEN the stream SHALL emit typed events with a stable envelope shape.
3. WHEN the stream disconnects THEN the app SHALL be able to reconnect safely and resynchronize without losing correctness.
4. WHEN no new events occur THEN the stream SHALL emit heartbeat/keepalive events often enough to keep mobile clients from assuming the connection is dead.
5. IF the unified stream is unavailable on an older host THEN the app SHALL keep current polling and per-job stream fallbacks.

### 3. High-Level Action Endpoints

**User Story:** As a mobile user, I want common host actions to be real product actions, so that tasks like restarting the service do not depend on shell orchestration.

#### Acceptance Criteria

1. WHEN `or3-app` needs to perform a common maintenance action THEN `or3-intern` SHALL provide a first-class action endpoint instead of requiring a terminal session.
2. WHEN the user restarts `or3-intern` from the app THEN the host SHALL use a structured restart action contract rather than typed shell input.
3. WHEN an action requires approval, session login, or step-up THEN the endpoint SHALL preserve current security policy and return a structured challenge/result shape the app can explain cleanly.
4. WHEN an action succeeds THEN the response and/or event stream SHALL provide a trackable result state.
5. WHEN a host does not support a given action THEN the app SHALL be able to hide or disable that action honestly.

### 4. Proactive Auth and Approval Requirement Hints

**User Story:** As a mobile user, I want the app to know what an action will require before I tap it, so that sign-in, step-up, and approval prompts feel expected instead of surprising.

#### Acceptance Criteria

1. WHEN the app renders a protected action THEN `or3-intern` SHALL expose requirement hints such as session-required, step-up-required, or approval-likely where practical.
2. WHEN an auth requirement changes during a session THEN the app SHALL be able to refresh and reflect that state.
3. WHEN an action can proceed only after a passkey session or step-up THEN the app SHALL be able to prompt before sending the action request.
4. WHEN exact approval requirements cannot be known in advance THEN the app SHALL still receive a clear best-effort hint without weakening enforcement.
5. IF an older host cannot provide proactive hints THEN existing challenge-after-request behavior SHALL continue to work.

### 5. Richer File and Host Metadata for Calmer UI

**User Story:** As a mobile user, I want the app to know what is editable, previewable, writable, or blocked before I try it, so that the UI can avoid trial-and-error.

#### Acceptance Criteria

1. WHEN the app requests file or host metadata THEN `or3-intern` SHALL expose enough information for the app to label supported actions honestly.
2. WHEN a file is read-only, too large, unsupported, or non-previewable THEN metadata SHALL include a reason or recommended fallback path.
3. WHEN the host has warnings or degraded subsystems THEN the overview response SHALL include concise, user-facing summary hints.
4. WHEN action availability depends on runtime posture or config THEN the app SHALL receive a machine-readable disabled reason.
5. WHEN richer metadata is added THEN existing file routes SHALL remain safe and root-scoped.

### 6. Small, Phased, Backward-Compatible Delivery

**User Story:** As a developer, I want these improvements to reduce app complexity without forcing a risky big-bang rewrite.

#### Acceptance Criteria

1. WHEN new app-facing routes are added THEN they SHALL wrap or compose existing intern subsystems where possible instead of duplicating business logic.
2. WHEN `or3-app` adopts the new surfaces THEN it SHALL keep graceful fallbacks for older `or3-intern` builds during rollout.
3. WHEN Phase 1 ships THEN bootstrap, unified events, and at least one high-value action SHALL provide measurable simplification to app code.
4. WHEN later phases add auth hints or richer metadata THEN they SHALL extend the same bootstrap/action model rather than introducing parallel contracts.
5. WHEN scope decisions arise THEN the plan SHALL prefer fewer, clearer contracts over many narrow app-only endpoints.

### 7. Security and Safety Boundaries

**User Story:** As an OR3 owner, I want app-friendly APIs without weakening the service’s existing auth, approval, and root-scoping protections.

#### Acceptance Criteria

1. WHEN new app-facing endpoints are added THEN they SHALL use the existing operator/admin authorization model unless a route is intentionally public today.
2. WHEN bootstrap or event responses include auth- or action-related state THEN they SHALL not expose secrets, approval tokens, bearer tokens, or shell commands.
3. WHEN high-level actions wrap existing maintenance flows THEN they SHALL preserve current approval and step-up enforcement.
4. WHEN metadata is added for app convenience THEN it SHALL be display-safe and not leak privileged intern-only details.
5. WHEN the app renders errors from these routes THEN messages SHALL stay user-safe and avoid internal stack traces or sensitive payloads.

### 8. Testing and Validation

**User Story:** As a developer, I want confidence that these higher-level contracts simplify the app without silently breaking existing behavior.

#### Acceptance Criteria

1. WHEN bootstrap behavior is tested THEN healthy, degraded, unauthenticated, and partially available cases SHALL be covered.
2. WHEN unified event streaming is tested THEN reconnect, heartbeat, event typing, and fallback behavior SHALL be covered.
3. WHEN high-level actions are tested THEN success, approval-required, auth-required, and unsupported cases SHALL be covered.
4. WHEN app integration is tested THEN the app SHALL prove fallback compatibility with older hosts that lack the new endpoints.
5. WHEN the implementation is complete THEN existing backend tests, app tests, and type-checking SHALL pass.
