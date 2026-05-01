# Agents Page Functional Requirements

## Introduction

The current Agents page has the right product direction but only a thin implementation: it can submit a background subagent request, then stores an optimistic local job entry. It does not reliably track job progress, recover jobs after refresh, show meaningful history, handle queue errors, or let the user manage running work.

This plan makes the Agents page a real mobile control center for `or3-intern` background work while keeping the scope simple. The goal is not to build a new scheduler, notification platform, or agent marketplace. The first functional version should use the existing `or3-intern service` subagent system wherever possible, then add only one small backend gap: a persisted subagent list endpoint backed by the existing SQLite `subagent_jobs` table.

Current findings:

- `or3-app` already has `/agents` UI at `app/pages/agents/index.vue`, command input components, and a `useJobs()` composable.
- `or3-app` already calls `POST /internal/v1/subagents`, `GET /internal/v1/jobs/{jobId}`, `GET /internal/v1/jobs/{jobId}/stream`, and `POST /internal/v1/jobs/{jobId}/abort` through the existing API wrapper.
- `or3-intern` already supports service-mode subagent queueing, job snapshots, SSE job streams, cancellation, health, readiness, and capability discovery.
- `or3-intern` does not currently expose a durable list/history endpoint for subagent jobs, even though `subagent_jobs` are persisted in SQLite.
- The in-memory `JobRegistry` retains terminal jobs only briefly, so it is not enough for durable mobile history.

## Requirements

### 1. Submit Background Agent Work

**User Story:** As a mobile user, I want to hand off a task to `or3-intern`, so that work can continue while I use other parts of the app.

#### Acceptance Criteria

1. WHEN the user submits a non-empty task THEN the app SHALL call `POST /internal/v1/subagents` with the current chat session key as `parent_session_key`.
2. WHEN the request succeeds THEN the app SHALL create or update a local job record with `job_id`, `child_session_key`, task title, category, priority, timestamps, and status.
3. WHEN the task is blank THEN the app SHALL not submit a request and SHALL keep the command input focused for correction.
4. WHEN `or3-intern` returns `429` for a full queue THEN the app SHALL show a queue-full message and SHALL not create a fake running job.
5. WHEN subagents are disabled or unavailable THEN the app SHALL show a clear setup action pointing to the runtime subagent setting instead of silently failing.

### 2. Track Live Job Progress

**User Story:** As a mobile user, I want to see background job progress update live, so that I know whether the intern is queued, working, finished, or stuck.

#### Acceptance Criteria

1. WHEN a job is queued or running THEN the app SHALL subscribe to `GET /internal/v1/jobs/{jobId}/stream` when available.
2. WHEN SSE events arrive THEN the app SHALL update job status, activity text, progress estimate, final preview, errors, and updated timestamp.
3. WHEN the stream disconnects THEN the app SHALL fall back to low-frequency polling of `GET /internal/v1/jobs/{jobId}` while the document is visible.
4. WHEN a job reaches `succeeded`, `completed`, `failed`, `interrupted`, or `aborted` THEN the app SHALL stop live tracking that job.
5. IF a job snapshot is unavailable because the in-memory registry expired THEN the app SHALL keep the persisted subagent history item and mark live details as unavailable.

### 3. Show Durable Queue and History

**User Story:** As a mobile user, I want the Agents page to remember queued, running, and completed background work, so that refreshes and app restarts do not make work disappear.

#### Acceptance Criteria

1. WHEN the Agents page opens THEN the app SHALL load recent persisted subagent jobs for the active host.
2. WHEN local cache and backend history both contain the same job THEN the app SHALL merge them by `job_id`, preferring server status and preserving local UI metadata such as category and priority.
3. WHEN jobs are returned with persisted statuses THEN the app SHALL normalize `queued`, `running`, `succeeded`, `failed`, and `interrupted` to UI statuses.
4. WHEN no backend history endpoint is available from an older `or3-intern` build THEN the app SHALL gracefully fall back to local cached jobs.
5. WHEN history grows beyond the app display limit THEN the app SHALL keep the newest records and avoid unbounded local storage growth.

### 4. Manage Running Jobs

**User Story:** As a mobile user, I want to stop a background job that I no longer need, so that it does not keep spending time or provider capacity.

#### Acceptance Criteria

1. WHEN a job is queued or running THEN the app SHALL expose a cancel/stop action.
2. WHEN the user confirms cancellation THEN the app SHALL call `POST /internal/v1/jobs/{jobId}/abort`.
3. WHEN cancellation succeeds THEN the UI SHALL update the job to `aborted` or the returned terminal status.
4. WHEN cancellation is not possible THEN the app SHALL show a non-destructive explanation and refresh the job snapshot.
5. WHEN cancellation fails because the host is unreachable THEN the app SHALL leave the local job state unchanged and show retry guidance.

### 5. Surface Results and Continue in Chat

**User Story:** As a mobile user, I want to inspect a background job result and continue from it in chat, so that finished work becomes useful immediately.

#### Acceptance Criteria

1. WHEN a job has a final preview or final text THEN the app SHALL show that preview in the job row/detail view.
2. WHEN the user taps a completed job THEN the app SHALL open a lightweight detail sheet or route with task, status, timeline, result preview, and actions.
3. WHEN the user chooses to continue in chat THEN the app SHALL navigate to chat and seed the composer or send a prompt using the job result context.
4. WHEN a job failed THEN the detail view SHALL show the error and provide retry-with-same-task.
5. IF full artifacts are not available through a stable API THEN the first version SHALL show the stored result preview only and leave artifact browsing for a later phase.

### 6. Represent Capabilities Honestly

**User Story:** As a mobile user, I want the page to explain what this build can and cannot do, so that I do not think placeholder controls are real automation.

#### Acceptance Criteria

1. WHEN health reports `subagentManagerEnabled: false` or capabilities report `subagentsEnabled: false` THEN the command center SHALL disable submission and show a setup hint.
2. WHEN the app cannot confirm host health THEN the command center SHALL show a connection warning before submission.
3. WHEN the user selects category chips THEN the category SHALL only affect task framing and UI labeling unless a real backend feature exists.
4. WHEN true recurring monitoring is requested THEN the app SHALL not pretend it has scheduled monitoring unless a future cron/heartbeat API is added.
5. WHEN `autoApprove` is enabled THEN the app SHALL pass safe intent metadata only; it SHALL not bypass existing `or3-intern` approval or step-up policies.

### 7. Keep the Implementation Small and Performant

**User Story:** As a developer, I want the Agents page to use the current control plane instead of adding duplicate infrastructure, so that it remains maintainable.

#### Acceptance Criteria

1. WHEN adding backend functionality THEN the implementation SHALL prefer read-only access to existing `subagent_jobs` data over a new job database.
2. WHEN adding frontend state THEN the implementation SHALL extend `useJobs()` rather than introducing a second job store.
3. WHEN tracking multiple jobs THEN the app SHALL limit simultaneous SSE streams and polling to active visible jobs.
4. WHEN the app is hidden or offline THEN polling SHALL pause or slow down.
5. WHEN tests run THEN the feature SHALL pass existing typecheck, unit tests, and targeted new tests without requiring new heavy dependencies.

### 8. Preserve Security Boundaries

**User Story:** As an OR3 owner, I want background task control to respect pairing, sessions, and approvals, so that mobile delegation does not weaken runtime safety.

#### Acceptance Criteria

1. WHEN the app calls any Agents API THEN it SHALL use the existing `useOr3Api()` authentication behavior.
2. WHEN the backend exposes persisted subagent history THEN it SHALL require operator/admin authorization like the existing subagent and job endpoints.
3. WHEN listing jobs THEN the backend SHALL not expose raw approval tokens, prompt snapshots, secrets, or unrestricted metadata.
4. WHEN a job includes service metadata THEN the app SHALL treat it as display-only and validate expected field types.
5. WHEN errors occur THEN the UI SHALL show safe messages without leaking bearer tokens, approval tokens, or internal stack traces.
