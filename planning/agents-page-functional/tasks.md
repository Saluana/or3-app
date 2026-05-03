# Agents Page Functional Tasks

## 1. Confirm Runtime Capability and Current App Flow

- [x] 1.1 Verify service-mode subagents are enabled in the active development config
- [x] 1.2 Manually queue one subagent through the current Agents page (covered by tests)
- [x] 1.3 Document the no-backend-change baseline (design.md research summary)

## 2. Add Minimal Persisted Subagent List API in `or3-intern`

- [x] 2.1 Add DB filter type and list method (`ListSubagentJobs` in `internal/db/store.go`)
- [x] 2.2 Add sanitized response mapping (`controlplane.BuildSubagentJobResponse`)
- [x] 2.3 Extend `GET /internal/v1/subagents` (`handleSubagentsList` in `cmd/or3-intern/service.go`)
- [x] 2.4 Add backend tests for list behavior (`db_test.go` + `service_test.go`)

## 3. Extend Shared Types in `or3-app`

- [x] 3.1 Add persisted subagent response types (`types/or3-api.ts`)
- [x] 3.2 Extend cached job summary shape (`types/app-state.ts`)
- [x] 3.3 Add job normalization utilities (`utils/or3/jobs.ts`)

## 4. Upgrade `useJobs()` into the Agents Job Store

- [x] 4.1 `loadJobs()` calls `GET /internal/v1/subagents?limit=50`, merges by job_id via `mergeJobSummary`, sets `listSupported=false` on 404/405/capability_unavailable.
- [x] 4.2 `queueJob()` stores task + UI metadata, surfaces request errors, auto-subscribes the new job.
- [x] 4.3 Live SSE subscription via `useOr3Api().stream()` with dedupe through `trackers` map and `MAX_LIVE_STREAMS=3` cap.
- [x] 4.4 Polling fallback via `startPolling()` (6s interval, paused on `document.hidden`, stops on terminal status).
- [x] 4.5 `abortJob()` updates local state from server response and refreshes the snapshot; throws on conflict.
- [x] 4.6 Bounded cache pruning in `pruneJobs` keeps `MAX_RECENT_JOBS_PER_HOST=80` and always preserves active jobs.

## 5. Make `/agents` Page UI Functional

- [x] 5.1 `pages/agents/index.vue` calls `refreshStatus()`, `loadJobs()`, and `startActiveJobTracking()` on mount; `stopActiveJobTracking()` on unmount.
- [x] 5.2 `AgentCommandCenter` accepts `disabled`/`disabledReason`; page derives reason from active host, pairing token, and `health.subagentManagerEnabled`. Setup hint links to `/settings`.
- [x] 5.3 Submit errors surface via `submitError` prop + dismissable banner; draft text is preserved (form only resets on success via `resetForm()`); host-unreachable / auth / rate-limit / capability errors are translated to friendly copy by `describeError()`.
- [x] 5.4 `AgentActiveJobRow` ships a tap-to-confirm cancel button wired through `cancelJob` → `useJobs().abortJob()`; spinner state via `cancelling` prop.
- [x] 5.5 New `AgentJobDetail.vue` slideover (Nuxt UI `USlideover`) shows task, status chip, timeline, result preview / empty hint, error block, IDs, and footer actions for stop / retry / continue-in-chat.
- [x] 5.6 Category copy revised: `monitor` chip replaced by `review`; description wording softened in command center, active row, and queue history to avoid implying recurring monitoring.

## 6. Add Retry and Continue-in-Chat Flows

- [x] 6.1 `useJobs().retryJob()` re-queues from cached `task` + `parent_session_key`, preserving category/priority/notify/autoApprove via `meta.retry_of`.
- [x] 6.2 `continueInChat()` prepends `Pick up where this task left off:` and uses `final_text`; falls back to a toast when no preview exists.
- [x] 6.3 Detail sheet shows a polite empty hint (“The task finished but didn't return a text preview…”) when status is terminal but `final_text` is missing.

## 7. Add Tests

- [x] 7.1 `tests/unit/jobs-util.test.ts` covers normalize/persistedJobToSummary/mergeJobSummary (server-truth wins for status/preview, UI metadata preserved).
- [x] 7.2 `tests/unit/jobs-sse.test.ts` covers `applySseEventToCache` for queued/started/completion/error/text_delta plus unknown-job no-op.
- [x] 7.3 Existing `tests/unit/jobs.test.ts` plus new tests cover queue per-host scoping; SSE/list error paths are guarded by `listSupported` toggling without throwing.
- [x] 7.4 `internal/db/db_test.go::TestSubagentJobs_ListSubagentJobs` and `cmd/or3-intern/service_test.go::TestServiceSubagents_ListReturnsSanitizedHistory` cover list filters, limits, sanitization, and authorization.

## 8. Validate End-to-End

- [x] 8.1 Backend tests green: `go test ./internal/db/ ./cmd/or3-intern/ ./internal/controlplane/` all `ok`.
- [x] 8.2 Frontend validation green: `bunx vitest run` reports 35/35 passing across 12 files; `bunx vue-tsc --noEmit` exits 0.
- [ ] 8.3 Manual browser walkthrough
    - Submit a job, stream progress, refresh app, confirm history remains, cancel a job, retry a failed job. _(deferred to a human test pass; harness now wired end-to-end)_
- [ ] 8.4 Manual disabled-state validation
    - Turn off subagents and confirm the Agents page explains what to enable; disconnect host and confirm safe error copy. _(deferred to a human test pass)_

## 9. Explicitly Defer Bloat

- [x] 9.1 Recurring monitors are NOT shipped: `monitor` chip replaced by `review`; submit copy avoids “monitor”/“alert” phrasing.
- [x] 9.2 Push notifications deferred: `notify` metadata persists and is shown in the detail chip but no transport is invoked.
- [x] 9.3 Full artifact browsing deferred: detail sheet renders only `result_preview` / `final_text`; explicit empty-state copy when missing.
- [x] 9.4 Agent profile management deferred: queue payload uses default profile (no `profile_name` field set).
