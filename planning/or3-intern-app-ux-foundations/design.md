# OR3 Intern App UX Foundations Design

## Overview

The best path is to give `or3-app` a small set of **higher-level host contracts** instead of making it compose many low-level service routes at runtime.

This plan does **not** replace the underlying `or3-intern` APIs that already work. Instead, it adds an app-shaped layer on top of them:

1. **Bootstrap** for a single trustworthy host overview.
2. **Unified events** for live app state changes.
3. **High-level actions** for product tasks like restart.
4. **Requirement and metadata descriptors** so the app can explain what will happen before the user acts.

Phase 1 should focus on the first three items because they remove the most app-side glue immediately.

## Research Summary

### Current app friction points

| App surface | Current behavior | Friction introduced by current contract |
| --- | --- | --- |
| `usePairing.ts` | Directly starts pairing, exchanges the code, then verifies the host separately | The app has to infer whether the host is merely paired, actually reachable, or fully ready |
| `useComputerStatus.ts` | Requests `/health`, `/readiness`, and `/capabilities` independently | Partial failure handling is app-owned and the UI has to merge several sources into one story |
| `useApprovals.ts` | Polls approval count and refetches lists after actions | Approval badges are eventually consistent and feel less alive than jobs |
| `useJobs.ts` | Uses persisted job list + per-job SSE + history polling | The app has multiple live-state paths and must decide which source is authoritative |
| `useServiceRestart.ts` | Starts a terminal session and sends a restart command | A product action is exposed as shell automation, which is brittle and harder to explain in UI |
| `useAuthSession.ts` | Learns about auth needs from rejected requests | The user often discovers sign-in or step-up requirements after already tapping the action |

### Design principle

`or3-app` should be a thin, mobile-first client of a **host overview + event + action** model.

That means:

- keep existing low-level intern routes available
- add a small app-facing layer that composes them
- use the higher-level layer first in the app when available
- preserve fallbacks for older hosts

## Goals

- Reduce app-side request fanout for common host state.
- Replace polling-heavy UX with one coherent event stream where practical.
- Eliminate shell-orchestration UX for common maintenance actions.
- Let the app show honest availability, auth, and disabled states before the user commits.
- Keep rollout incremental and backwards compatible.

## Non-goals

- Replace every existing service route with a new app-only API.
- Add push notification transport in this phase.
- Turn `or3-intern` into a general workflow engine.
- Remove terminal APIs; they still matter for expert/manual use.
- Build a global event-history database before proving the live stream contract.

## Proposed Architecture

```mermaid
flowchart TD
    App[or3-app]
    Bootstrap[GET /internal/v1/app/bootstrap]
    Events[GET /internal/v1/app/events]
    Actions[POST /internal/v1/actions/{actionId}]
    Intern[or3-intern service]
    Health[health/readiness/capabilities]
    Auth[auth/session + step-up]
    Pairing[pairing/devices]
    Approvals[approval broker]
    Jobs[subagent jobs + job registry]
    Terminal[terminal sessions]
    Files[file roots/list/stat]

    App --> Bootstrap
    App --> Events
    App --> Actions

    Bootstrap --> Intern
    Events --> Intern
    Actions --> Intern

    Intern --> Health
    Intern --> Auth
    Intern --> Pairing
    Intern --> Approvals
    Intern --> Jobs
    Intern --> Terminal
    Intern --> Files
```

## Phase Plan

### Phase 1: Foundations

Deliver the three highest-leverage app-facing contracts:

1. `GET /internal/v1/app/bootstrap`
2. `GET /internal/v1/app/events`
3. `POST /internal/v1/actions/restart-service`

Also include capability/version markers so the app can detect whether each new surface exists.

### Phase 2: Requirement Hints and Metadata

Extend the same model with:

1. action requirement descriptors
2. richer disabled reasons in bootstrap
3. richer file/host metadata for calmer UI
4. additional action wrappers only where they clearly simplify app behavior

### Phase 3: App Simplification Pass

Once the new contracts are stable:

1. collapse redundant polling in `useApprovals()` and `useJobs()`
2. reduce multi-request status assembly in `useComputerStatus()`
3. replace terminal-based restart entirely
4. keep old flows only as compatibility fallback

## Backend Contract Design

### 1. `GET /internal/v1/app/bootstrap`

Purpose: return one host snapshot for the app home screen and action surfaces.

Suggested response shape:

```ts
interface AppBootstrapResponse {
    host: {
        id: string;
        display_name: string;
        version?: string;
        device_name?: string;
    };
    pairing: {
        paired: boolean;
        device_id?: string;
        role?: string;
    };
    auth: {
        session_required: boolean;
        session_active: boolean;
        step_up_active: boolean;
        capabilities?: {
            passkeys_supported?: boolean;
            step_up_supported?: boolean;
        };
    };
    status: {
        health?: unknown;
        readiness?: unknown;
        capabilities?: unknown;
        summary: 'ready' | 'degraded' | 'offline' | 'limited';
        warnings: Array<{
            code: string;
            message: string;
            severity: 'info' | 'warning' | 'error';
        }>;
    };
    counts: {
        pending_approvals: number;
        active_jobs: number;
        active_terminals?: number;
    };
    actions: Array<{
        id: string;
        title: string;
        available: boolean;
        disabled_reason?: string;
        session_required?: boolean;
        step_up_required?: boolean;
        approval_likely?: boolean;
    }>;
    features: {
        app_bootstrap: true;
        app_events: boolean;
        app_actions: boolean;
        file_metadata_v2: boolean;
    };
}
```

Design notes:

- This endpoint should **compose** existing health, readiness, capabilities, auth-session, approvals, jobs, and device state rather than reimplementing them.
- It should be resilient to partial failure. If readiness fails but health and auth succeed, the app should still get a usable overview plus a warning.
- The response should stay display-safe. It should never embed tokens, approval secrets, or raw sensitive metadata.
- Keep the raw underlying endpoints available; bootstrap is the app’s summary view, not a replacement for detailed routes.

### 2. `GET /internal/v1/app/events`

Purpose: give the app one live stream for host changes that matter to UI.

Suggested event envelope:

```ts
interface AppEventEnvelope {
    event_id: string;
    cursor: string;
    type:
        | 'heartbeat'
        | 'bootstrap.changed'
        | 'health.changed'
        | 'readiness.changed'
        | 'approval.changed'
        | 'job.changed'
        | 'terminal.changed'
        | 'pairing.changed'
        | 'action.changed';
    ts: string;
    payload: Record<string, unknown>;
}
```

Design notes:

- The first version does not need long-lived durable replay. A reconnect model of **reconnect -> refresh bootstrap -> resume stream** is enough.
- Support `Last-Event-ID` or a lightweight `cursor` query parameter so the app can attempt short-gap recovery cleanly.
- Emit heartbeats on a fixed cadence to keep mobile connections from looking dead.
- The stream should publish **summaries**, not giant payloads. The app can still fetch details on demand.
- Existing job-specific streams can remain in place. The unified stream is the app-default path; per-job streams stay as a detailed fallback.

### 3. `POST /internal/v1/actions/{actionId}`

Purpose: turn common host tasks into product actions instead of terminal automation.

Initial action:

```http
POST /internal/v1/actions/restart-service
```

Suggested request/response shape:

```ts
interface AppActionRequest {
    reason?: string;
    confirm?: boolean;
    parameters?: Record<string, unknown>;
}

interface AppActionResponse {
    action_id: string;
    status: 'accepted' | 'completed' | 'approval_required' | 'unsupported';
    message?: string;
    approval_id?: number;
    operation_id?: string;
}
```

Design notes:

- The restart implementation can still use existing trusted intern-side primitives internally, but that orchestration should move behind the service boundary instead of living in the mobile client.
- Preserve current auth, session, step-up, and approval enforcement. The new action route is a wrapper, not a bypass.
- Advertise action availability through bootstrap so the app can disable unsupported actions honestly.
- Do not over-generalize the first version. One real action is better than a big generic framework that the app barely uses.

### 4. Requirement Descriptors

These descriptors should appear in bootstrap action entries and, where useful, other metadata surfaces.

Recommended fields:

- `available`
- `disabled_reason`
- `session_required`
- `step_up_required`
- `approval_likely`
- `requires_online_host`

These are **hints**, not policy. The underlying action or route remains the enforcement point.

### 5. File and Host Metadata Enhancements

Phase 2 can extend file metadata with:

```ts
interface FileActionMetadata {
    editable: boolean;
    previewable: boolean;
    writable: boolean;
    blocked_reason?: string;
    recommended_action?: 'edit' | 'preview' | 'download' | 'none';
}
```

This helps the app avoid trial-and-error affordances for unsupported or read-only content.

## App Integration Plan

### `usePairing.ts`

- After exchange or app resume, prefer bootstrap for the “what state is this host really in?” answer.
- Keep existing request/exchange routes; they remain the actual pairing mechanism.

### `useComputerStatus.ts`

- Prefer bootstrap status summary first.
- Fall back to current `health + readiness + capabilities` requests when bootstrap is unavailable.

### `useApprovals.ts`

- Use unified events to keep counts and visible list freshness in sync.
- Keep explicit list/detail fetches for full approval management views.

### `useJobs.ts`

- Use unified events for high-level badges and summaries.
- Keep existing job SSE/detail fetches for detailed task inspection and compatibility fallback.

### `useServiceRestart.ts`

- Replace terminal-session orchestration with the restart action endpoint when supported.
- Keep the current fallback only until the action endpoint proves stable.

### `useAuthSession.ts`

- Consume requirement descriptors so the app can prompt for sign-in or step-up before the request when possible.
- Keep challenge handling as the final source of truth.

## Security Notes

- New app-facing routes should stay behind the same operator/admin auth rules as the detailed routes they summarize.
- Bootstrap and events must never leak tokens, approval secrets, or shell commands.
- Actions should be auditable and approval-aware.
- Richer metadata should remain display-safe and root-scoped.

## Rollout Strategy

1. Add new intern routes and capability markers.
2. Teach `or3-app` to detect and use them opportunistically.
3. Keep old polling and low-level flows as compatibility fallback.
4. Remove redundant client glue only after the new contracts prove stable.

## Explicit Deferrals

- Push notifications
- Global durable event history
- Generic arbitrary action execution
- Removal of terminal APIs
- Broad replacement of all detailed host routes
