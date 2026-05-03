# OR3 Intern App UX Foundations Tasks

## 1. Capture the current baseline and lock the contract shape

- [x] 1.1 Confirm the current pain points in app composables and intern routes
  - Keep `usePairing.ts`, `useComputerStatus.ts`, `useApprovals.ts`, `useJobs.ts`, `useServiceRestart.ts`, and `useAuthSession.ts` reflected in the design research summary.
  - Requirements: 1, 2, 3, 4, 5, 6

- [x] 1.2 Decide capability/version signaling for new app-facing routes
  - Choose whether bootstrap advertises features directly, or whether capability flags also live in `/internal/v1/capabilities`.
  - Keep rollout compatibility with older hosts explicit.
  - Requirements: 1.4, 2.5, 3.5, 6.2

- [x] 1.3 Lock Phase 1 scope
  - Keep Phase 1 limited to bootstrap, unified events, and restart-service action.
  - Defer richer file metadata and extra action wrappers to later phases.
  - Requirements: 3, 5, 6

## 2. Add `GET /internal/v1/app/bootstrap` in `or3-intern`

- [x] 2.1 Add the bootstrap route and shared response types
  - Add `GET /internal/v1/app/bootstrap` to the service route inventory.
  - Define a stable response shape for host, pairing, auth, status, counts, actions, warnings, and features.
  - Requirements: 1.1, 1.4, 6.1

- [x] 2.2 Compose the bootstrap response from existing subsystems
  - Reuse current health, readiness, capabilities, auth-session, approval, job, and device state rather than duplicating logic.
  - Requirements: 1.1, 1.2, 6.1

- [x] 2.3 Add degraded-state and warning mapping
  - Return partial but useful summaries when some subsystems are unavailable.
  - Include concise machine-readable warning codes and user-facing messages.
  - Requirements: 1.2, 5.3

- [x] 2.4 Add backend bootstrap tests
  - Cover healthy, degraded, paired-without-session, unsupported-subsystem, and auth-protected cases.
  - Requirements: 7.1, 7.5

## 3. Add `GET /internal/v1/app/events` in `or3-intern`

- [ ] 3.1 Add a unified app event stream route and envelope
  - Define the SSE envelope with type, timestamp, cursor/event ID, and payload.
  - Requirements: 2.1, 2.2

- [ ] 3.2 Publish app-relevant summaries from existing subsystems
  - Emit updates for approvals, jobs, pairing, host status, terminal lifecycle, and action state changes.
  - Keep payloads summary-sized rather than detail-heavy.
  - Requirements: 2.2, 6.1

- [ ] 3.3 Add reconnect and heartbeat behavior
  - Support `Last-Event-ID` or a simple cursor model.
  - Emit heartbeat events on a fixed cadence.
  - Requirements: 2.3, 2.4

- [ ] 3.4 Add backend event-stream tests
  - Cover event typing, heartbeat delivery, reconnect behavior, and fallback-friendly disconnect handling.
  - Requirements: 7.2, 7.5

## 4. Add high-level action endpoints in `or3-intern`

- [x] 4.1 Add action descriptors to bootstrap
  - Include action availability, disabled reason, and requirement hints in the bootstrap response.
  - Requirements: 3.5, 4.1, 4.3, 5.4

- [x] 4.2 Add `POST /internal/v1/actions/restart-service`
  - Move restart orchestration behind the service boundary.
  - Preserve current auth, session, step-up, and approval policies.
  - Requirements: 3.1, 3.2, 3.3, 7.3

- [ ] 4.3 Emit action status updates into the unified event stream
  - Publish accepted, approval-required, running, completed, or failed summaries where applicable.
  - Requirements: 2.2, 3.4

- [x] 4.4 Add backend action tests
  - Cover success, unsupported, approval-required, session-required, and step-up-required behavior.
  - Requirements: 7.3, 7.5

## 5. Add proactive requirement hints and richer metadata

- [x] 5.1 Add requirement hint fields for protected actions
  - Expose session-required, step-up-required, approval-likely, and disabled-reason hints where practical.
  - Requirements: 4.1, 4.2, 4.3

- [ ] 5.2 Extend file/host metadata with calmer UI hints
  - Add editability, previewability, writeability, blocked reason, and recommended action metadata where it clearly reduces app guesswork.
  - Requirements: 5.1, 5.2, 5.4

- [ ] 5.3 Add tests for requirement and metadata descriptors
  - Cover safe shaping, unsupported behavior, and no-secret exposure.
  - Requirements: 5.5, 7.1, 7.3

## 6. Integrate the new surfaces in `or3-app`

- [x] 6.1 Add bootstrap-aware host state loading
  - Prefer the new bootstrap route in `useComputerStatus.ts` and pairing resume flows.
  - Keep current multi-request fallback for older hosts.
  - Requirements: 1.5, 6.2

- [ ] 6.2 Add unified event-stream consumption
  - Use the app event stream for top-level badges, job/approval freshness, and host status changes.
  - Keep existing polling and job-specific stream paths as compatibility fallback.
  - Requirements: 2.5, 6.2

- [x] 6.3 Replace terminal-based restart with the action endpoint
  - Update `useServiceRestart.ts` to call the new restart-service action when supported.
  - Preserve honest unsupported/approval/auth messaging.
  - Requirements: 3.2, 3.3, 3.5, 6.2

- [ ] 6.4 Use requirement hints to improve pre-action UX
  - Let the app prompt for passkey session or step-up before protected actions when hints are available.
  - Keep challenge-after-request handling as the final fallback.
  - Requirements: 4.1, 4.3, 4.5

- [x] 6.5 Add app tests for new contract adoption and fallback
  - Cover bootstrap success/fallback, event-stream fallback, restart action behavior, and requirement-hint-driven UX.
  - Requirements: 7.4, 7.5

## 7. Validate end-to-end

- [x] 7.1 Run backend tests
  - Run the relevant `go test` targets covering service routes, auth, and action/event behavior.
  - Requirements: 8.5

- [x] 7.2 Run app tests and type-checking
  - Run the relevant app unit tests and `bun run typecheck`.
  - Requirements: 8.5

- [ ] 7.3 Do a manual app walkthrough
  - Verify connect/resume, status load, approval badge freshness, job freshness, restart flow, and old-host fallback behavior.
  - Requirements: 8.1, 8.2, 8.3, 8.4
