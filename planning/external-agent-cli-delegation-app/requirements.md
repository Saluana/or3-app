# External Agent CLI Delegation App Integration — Requirements

## Overview

Integrate `or3-app` with the future `or3-intern` external agent CLI delegation backend after the intern-side endpoints and job persistence are complete. The app should let users choose an external runner, choose a safe permission mode, submit typed run requests, monitor live stdout/stderr output, cancel/retry jobs, and keep the existing internal `or3-intern` subagent flow as the default fallback.

Scope assumptions:

- Backend dependency: `or3-intern` exposes `GET /internal/v1/agent-runners`, `POST /internal/v1/agent-runs`, `GET /internal/v1/agent-runs/:id`, optional durable events, and normalized `/internal/v1/jobs/:job_id` / stream / abort responses as planned in `or3-intern/planning/external-agent-cli-delegation/`.
- The app remains Nuxt/Vue client-first and uses existing composables: `useOr3Api`, `useJobs`, `useLocalCache`, `useChatSessions`, `useComputerStatus`, and the current agents page.
- The UI must not expose raw runner flags or generic command execution. It only sends typed backend fields.
- Dangerous/yolo behavior is not a host-machine default. If surfaced at all, it appears as “Full autonomy in sandbox” and is disabled unless the backend reports support/readiness.

## Requirements

1. **Runner discovery is visible and resilient.**
   - As a user, I can see which delegation runners are available on the connected computer without breaking the existing agents page when the backend is older.
   - Acceptance criteria:
     - `useJobs` or a new companion composable fetches `GET /internal/v1/agent-runners` when the agents page mounts or the active host changes.
     - The app treats 404/405/capability errors as “external runners unsupported” and continues to show the existing `or3-intern` subagent workflow.
     - Available and `auth_unknown` runners are selectable; missing/auth-missing/disabled runners are shown only in an expandable “Not available” section.
     - Gemini-style `auth_unknown` is clearly labeled as “Installed; account readiness checked on first run.”

2. **`or3-intern` remains the default safe path.**
   - As an existing user, my current background agent workflow keeps working unchanged if I ignore external runners.
   - Acceptance criteria:
     - The default runner selection is `or3-intern`.
     - Selecting `or3-intern` still calls the existing `queueJob` / `/internal/v1/subagents` flow.
     - Existing category, priority, notify, auto-approve, attachments, active job tracking, retry, cancel, and continue-in-chat behavior still work for subagent jobs.

3. **External run submission uses typed options only.**
   - As a user, I can start external CLI jobs without the app becoming a raw command/flag interface.
   - Acceptance criteria:
     - `queueAgentCliJob` sends only typed fields: `parent_session_key`, `runner_id`, `task`, `timeout_seconds`, `cwd`, `model`, `mode`, `isolation`, `max_turns`, and `meta`.
     - The command center never accepts arbitrary extra args or shell strings.
     - Prompt/task text is sent as JSON data, not interpolated into a command line by the app.
     - App-side validation rejects unsupported runner/mode combinations using runner capabilities when possible, while backend remains source of truth.

4. **Permission modes are understandable and safe by default.**
   - As a user, I choose what the external CLI may do using OR3 language, not raw yolo/bypass flags.
   - Acceptance criteria:
     - The command center exposes: `Review only`, `Safe workspace edits`, and optionally `Full autonomy in sandbox`.
     - The default for external runners is `Safe workspace edits` unless the product decides to default to `Review only`; it is never dangerous/yolo.
     - `Full autonomy in sandbox` is disabled unless the backend runner/capabilities indicate it can be used safely.
     - If disabled, the UI explains: “Full autonomy requires an isolated OR3 sandbox. Use Safe workspace edits on this computer.”
     - The UI never labels a host-machine setting as “yolo” or “bypass permissions” as the primary user-facing action.

5. **Runner options stay compact and capability-aware.**
   - As a user, I can optionally set a model and runner-specific simple options without seeing unsupported controls.
   - Acceptance criteria:
     - Model input appears only for runners with `supports.modelFlag`.
     - `max_turns` appears only for runners that support it, initially Claude if the backend exposes that capability.
     - Workspace/cwd selection is limited to known workspace roots or a simple “current workspace/default” choice in v1.
     - Unsafe settings require explicit expansion and are not saved as the global default unless a future settings task explicitly adds that.

6. **CLI job summaries normalize into the existing job UI.**
   - As a user, external CLI jobs appear in Active jobs and Queue & history alongside subagent jobs.
   - Acceptance criteria:
     - `JobSnapshot` and `RecentJobSummary` support `kind=agent_cli:<runner_id>`, `runner_id`, `mode`, `isolation`, `model`, `stdout_preview`, `stderr_preview`, `final_text`, `error`, and CLI timestamps.
     - `normalizeStatus` maps backend `succeeded`, `failed`, `aborted`, `timed_out`, and `interrupted` into the existing UI status vocabulary.
     - Active rows show runner identity and useful output/error previews instead of generic “Agent task” text when available.
     - Persisted CLI history survives app reload through the existing per-host cache.

7. **Live CLI output is readable and bounded.**
   - As a user watching a job, I can see stdout and stderr as the process runs.
   - Acceptance criteria:
     - `applySseEventToCache` handles `output`, `structured`, `output_truncated`, `completion`, and `error` events.
     - Raw stdout/stderr chunks append to bounded per-job output buffers in local cache or detail-local state.
     - Stderr is visually distinguishable from stdout.
     - Output panels use monospace formatting and avoid expensive re-render loops for large output.
     - If output is truncated, the UI shows a clear truncation notice.

8. **Job detail supports CLI-specific inspection.**
   - As a user, I can inspect an external CLI run without confusing it with internal tool calls.
   - Acceptance criteria:
     - `AgentJobDetail` keeps the existing timeline and result sections.
     - CLI jobs show an Output panel with stdout/stderr tabs or filters, “Copy output,” “Copy final result,” “Show stderr only,” and a collapsed Raw events debug area.
     - Structured events are kept in a collapsed/debug section until specialized renderers are added.
     - Tool-call UI remains for internal subagent jobs and does not show misleading “No tool calls” copy for CLI jobs.
     - Execution details include runner, mode, isolation, model, cwd, and job ID when available.

9. **Cancel and retry preserve runner context.**
   - As a user, I can stop or retry external CLI jobs predictably.
   - Acceptance criteria:
     - Cancel uses existing `POST /internal/v1/jobs/:job_id/abort` and updates local state optimistically as today.
     - Retry of an external CLI job calls `queueAgentCliJob`, not the subagent endpoint.
     - Retry preserves runner, mode, isolation, model, max turns, task, parent session, category, priority, notify, and attachments metadata where available.
     - If required fields are missing, the detail sheet shows the existing “Not enough info to retry” path.

10. **History loading merges subagent and CLI persisted jobs.**
    - As a user, I see recent internal and external jobs after reload.
    - Acceptance criteria:
      - History loading calls existing `/internal/v1/subagents` and also the new CLI history endpoint when supported, or consumes a unified backend job list if the intern implementation provides one.
      - Missing CLI history support is non-fatal.
      - Merging preserves UI-only submit metadata while server-truth status/output/error fields win.
      - Per-host recent job cap remains bounded.

11. **Settings reflect external delegation readiness without overexposing danger.**
    - As an operator, I can discover and enable external CLI delegation from settings when backend config fields exist.
    - Acceptance criteria:
      - Settings mappings include `agentCLI.enabled`, runner disable list, concurrency/queue/timeout controls, and sandbox-auto enablement only if returned by `/configure` metadata.
      - Human labels describe risk clearly: “External CLI agents,” “External agent power,” and “Full autonomy in sandbox.”
      - Dangerous/sandbox-auto settings are placed in advanced/risk-marked controls, not the basic onboarding path.

12. **Testing covers old and new backends.**
    - As a maintainer, I can ship the app without breaking older `or3-intern` builds.
    - Acceptance criteria:
      - Unit tests cover runner detection success, unsupported endpoint fallback, selectable filtering, typed external submission, subagent fallback, SSE output events, retry preservation, and CLI persisted job normalization.
      - Existing job tests continue to pass.
      - Tests mock `fetch`/SSE and do not require real OpenCode/Codex/Claude/Gemini binaries.

## Non-functional constraints

- **Compatibility:** Older `or3-intern` services without external CLI endpoints must keep the agents page usable.
- **Safety:** The app must never send raw flags, shell command strings, or host-machine dangerous mode by default.
- **Performance:** Large output must be bounded, append-only, and rendered in collapsed panels by default when appropriate.
- **Mobile usability:** Controls must remain touch-friendly and fit the existing retro/iOS card style.
- **Local-first cache discipline:** Job metadata stays per active host in `useLocalCache`; secrets and runner auth details are never stored in app state.
- **Accessibility:** Runner/mode dropdowns, output tabs/filters, copy buttons, and disabled-danger explanations need labels and keyboard-safe controls.
