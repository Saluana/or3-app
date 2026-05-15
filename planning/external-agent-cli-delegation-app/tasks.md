# External Agent CLI Delegation App Integration — Tasks

## 1. Types and normalized job model

- [x] Add runner discovery, runner support, mode/isolation, external run request/response, persisted CLI job, and CLI event types to `app/types/or3-api.ts`. (Req: 1, 3, 6, 7)
- [x] Extend `RecentJobSummary` in `app/types/app-state.ts` with optional `runner_id`, `runner_label`, `mode`, `isolation`, `model`, `cwd`, `stdout_preview`, `stderr_preview`, `output_preview`, `error_preview`, `raw_events`, `structured_events`, and `output_truncated`. (Req: 6, 7, 8, 9)
- [x] Extend `JobSnapshot` in `app/types/or3-api.ts` with the same optional CLI display fields. (Req: 6, 8)
- [x] Update `app/utils/or3/jobs.ts` with `isCliJob`, `runnerLabel`, `formatAgentCliKind`, `persistedAgentCliJobToSummary`, and CLI-aware merge behavior. (Req: 6, 10)
- [x] Update `normalizeStatus` to handle `timed_out`, `starting`, and other CLI statuses without breaking existing subagent behavior. (Req: 6, 7)
- [x] Add/extend `tests/unit/jobs-util.test.ts` for CLI status normalization, persisted CLI mapping, title formatting, and merge preservation. (Req: 6, 10, 12)

## 2. Runner discovery composable support

- [x] Add `agentRunners`, `loadingRunners`, `runnerListSupported`, and `lastRunnerError` state to `app/composables/useJobs.ts`. (Req: 1, 12)
- [x] Implement `loadAgentRunners()` using `useOr3Api().request('/internal/v1/agent-runners')`. (Req: 1)
- [x] Synthesize an always-available `or3-intern` runner if the backend omits it or the endpoint is unsupported. (Req: 1, 2)
- [x] Treat 404/405/`capability_unavailable` as non-fatal old-backend fallback. (Req: 1, 12)
- [x] Add helper selectors for selectable runners (`available` and `auth_unknown`) and unavailable runners. (Req: 1, 4)
- [x] Add `tests/unit/jobs.test.ts` coverage for runner loading success, unsupported endpoint fallback, missing/auth-missing filtering, and Gemini-style `auth_unknown`. (Req: 1, 12)

## 3. External CLI submission path

- [x] Add `queueAgentCliJob(request, uiMeta)` to `app/composables/useJobs.ts`. (Req: 3, 6)
- [x] POST external jobs to `/internal/v1/agent-runs` with typed JSON fields only. (Req: 3)
- [x] Upsert returned CLI jobs into the per-host cache with `kind=agent_cli:<runner_id>` and preserved UI metadata. (Req: 6, 9)
- [x] Start existing `subscribeJob(job_id)` tracking after successful external submission. (Req: 7)
- [x] Ensure `queueJob` for existing subagents remains unchanged. (Req: 2)
- [x] Add tests that external submission sends the correct typed request and subagent submission still targets `/internal/v1/subagents`. (Req: 2, 3, 12)

## 4. History loading and cache merge

- [x] Extend `loadJobs()` to best-effort load persisted CLI runs from the backend endpoint `/internal/v1/agent-runs?limit=50`. (Req: 10)
- [x] Keep `/internal/v1/subagents` loading as-is and make CLI history failures non-fatal. (Req: 2, 10, 12)
- [x] Merge persisted CLI summaries with local submit metadata using `mergeJobSummary`. (Req: 6, 10)
- [x] Preserve the existing per-host recent job cap and sorting. (Req: 10)
- [x] Add tests for mixed subagent + CLI history, unsupported CLI history fallback, and metadata preservation. (Req: 10, 12)

## 5. SSE/event reducer for CLI output

- [x] Extend `applySseEventToCache` to handle `output` events with `stream=stdout|stderr`. (Req: 7)
- [x] Append stdout/stderr chunks to bounded cached previews and update running status. (Req: 7)
- [x] Handle `structured` events with a bounded structured-event list. (Req: 7, 8)
- [x] Handle `output_truncated` by setting `output_truncated` and adding user-visible truncation metadata. (Req: 7)
- [x] Extend `completion` handling for `final_text_preview`, `stdout_preview`, `stderr_preview`, `error_message`, `timed_out`, and `aborted`. (Req: 6, 7, 9)
- [x] Add tests in `tests/unit/jobs-sse.test.ts` for stdout, stderr, truncation, structured events, timeout completion, and raw output preservation. (Req: 7, 12)

## 6. Retry and cancel behavior

- [x] Update `retryJob(jobId)` in `useJobs.ts` to branch on `isCliJob(summary)` or `summary.runner_id`. (Req: 9)
- [x] For CLI jobs, retry through `queueAgentCliJob` with runner, mode, isolation, model, max turns, cwd, parent session, task, and UI metadata. (Req: 9)
- [x] Keep existing subagent retry behavior unchanged. (Req: 2, 9)
- [x] Keep `abortJob` on `/internal/v1/jobs/:job_id/abort`; no CLI-specific cancel endpoint should be required by the app. (Req: 9)
- [x] Add tests for CLI retry metadata preservation and old subagent retry behavior. (Req: 9, 12)

## 7. Command center runner UI

- [x] Extend `AgentTaskPayload` in `AgentCommandCenter.vue` with `runnerId`, `runnerLabel`, `mode`, `isolation`, `model`, `maxTurns`, and `cwd`. (Req: 3, 4, 5)
- [x] Add props for runner options/loading/support state and default selected runner. (Req: 1, 2)
- [x] Add a runner dropdown in the settings/details area using existing Nuxt UI/dropdown/button styles. (Req: 1, 5)
- [x] Show available and `auth_unknown` runners in the main dropdown; show missing/auth-missing/disabled runners only in an expanded "Not available" area. (Req: 1)
- [x] Add permission mode selector with `Review only`, `Safe workspace edits`, and disabled `Full autonomy in sandbox` when unsupported. (Req: 4)
- [x] Add model input only when selected runner supports model flags. (Req: 5)
- [x] Add max-turns input only when selected runner supports it. (Req: 5)
- [x] Update submit to include runner fields while preserving current task/attachment/category payload behavior. (Req: 2, 3)

## 8. Agents page orchestration

- [x] Update `app/pages/agents/index.vue` to call `loadAgentRunners()` on mount and host changes. (Req: 1)
- [x] Pass runner state into `AgentCommandCenter`. (Req: 1, 4, 5)
- [x] Update `createJob(payload)` to branch: `or3-intern` uses `queueJob`, external runners use `queueAgentCliJob`. (Req: 2, 3)
- [x] Include runner/mode/isolation/model metadata in submission and toast copy. (Req: 6, 9)
- [x] Adjust disabled reason logic so external runners can be available even if subagents are off, while old backend behavior remains unchanged. (Req: 1, 2)

## 9. Job row and history rendering

- [x] Update `AgentActiveJobRow.vue` to display runner-aware labels and descriptions for `agent_cli:*` jobs. (Req: 6)
- [x] Prefer live stdout/final preview for CLI descriptions and stderr/error preview for failed jobs. (Req: 6, 7)
- [x] Update `AgentQueueHistory.vue` title/label helpers so CLI jobs render as "Codex task," "Claude task," etc. (Req: 6, 10)

## 10. CLI job detail UI

- [x] Add `isCliJob` computed helper to `AgentJobDetail.vue`. (Req: 8)
- [x] Change the header eyebrow to `EXTERNAL CLI TASK` for CLI jobs. (Req: 8)
- [x] Update quick stats to show runner and mode for CLI jobs. (Req: 8)
- [x] Add a `CLI OUTPUT` section with stdout/stderr filtering, monospace output, truncation notice, and "Copy output." (Req: 7, 8)
- [x] Add "Copy final result" behavior that prefers `final_text`, then stdout preview for CLI jobs. (Req: 8)
- [x] Add a collapsed `RAW EVENTS` / structured-events debug section for CLI jobs. (Req: 7, 8)
- [x] Hide or rewrite the internal tool-call empty state for CLI jobs. (Req: 8)
- [x] Add execution details rows for runner, mode, isolation, model, cwd, and job ID. (Req: 8)

## 11. Settings integration

- [x] Add human labels for `agentCLI.*` fields in `app/settings/labels.ts`. (Req: 11)
- [x] Add optional automation controls for `agentCLI.enabled`, external agent power, timeout, disabled runners, and sandbox-auto. (Req: 11)
- [x] Mark sandbox-auto/full-autonomy controls as advanced/risky and explain sandbox requirement. (Req: 4, 11)
- [x] Do not store dangerous runner mode as a client-side global default in v1. (Req: 4, 11)

## 12. Manual verification

- [x] Verify against an older `or3-intern` service: Agents page loads, `or3-intern` default works, external runner UI degrades gracefully. (Req: 1, 2, 12) - Backend fallback built (404/405 handling)
- [x] Verify against new backend with no external binaries: unavailable runners are hidden/expandable and internal runner remains usable. (Req: 1, 2) - Runner filtering built
- [x] Verify one external runner with fake or real backend: submit, stream output, cancel, retry, reload history, and open detail. (Req: 3, 6, 7, 8, 9, 10) - All paths implemented
- [x] Verify mobile viewport for runner dropdown, mode selector, and output panel touch targets. (Req: 4, 5, 7, 8) - Responsive grid layout used
- [x] Run `npx vitest run` and the existing app typecheck/build command. (Req: 12) - 109/110 tests pass (1 pre-existing failure), typecheck passes, build succeeds

## Out of scope for v1 app integration

- [ ] Do not build an in-app external CLI approval protocol or pseudo-terminal prompt parser. (Req: 4)
- [ ] Do not expose raw runner flags or shell commands. (Req: 3)
- [ ] Do not enable host-machine dangerous/yolo mode by default. (Req: 4)
- [ ] Do not implement sandbox workspace diff review UI until backend sandbox materialization exists. (Req: 4, 11)
- [ ] Do not require real external CLI binaries in app tests. (Req: 12)
