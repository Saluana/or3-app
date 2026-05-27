# DI Observability: Neckbeard Review

Audit of the or3-app observability, logging, and connection-health subsystem. Focus: memory leaks, performance, correctness, and things that will bite in production.

---

## 1. `logger.ts` Reads `localStorage` on Every Single Log Call

`app/utils/logger.ts:27-47`

```ts
function storageLogLevel(): ChatRuntimeLogLevel {
    if (typeof window === 'undefined' || !window.localStorage) return 'info';
    try {
        const value = window.localStorage.getItem('or3.logLevel')?.trim();
        ...
    } catch { ... }
    return 'info';
}

function shouldLog(level: ChatRuntimeLogLevel) {
    return logLevelOrder[level] >= logLevelOrder[storageLogLevel()];
}
```

`shouldLog()` is called from `write()` on every log call. During streaming, the logger fires on every SSE event — `event:apply`, `send:start`, `send:complete`, tool calls, activity entries, etc. Each one does a `localStorage.getItem()` with a try/catch.

**Why this is bad:** `localStorage` is synchronous and can block the main thread. On some browsers/platforms (especially Capacitor mobile), `localStorage` access can take 1-5ms. During a fast-streaming session with 50+ events per second, that's 50-250ms of main thread blocking per second just to check a log level.

**Real-world consequence:** Streaming performance degrades. The log level check is the hottest path in the logging system and it hits a synchronous storage API every time.

**Fix:** Cache the log level in a module-level variable. Update it when `setDebugLoggingEnabled` is called. Read from localStorage once on module init, not on every call.

```ts
let cachedLogLevel: ChatRuntimeLogLevel = storageLogLevel();

export function setDebugLoggingEnabled(enabled: boolean) {
    cachedLogLevel = enabled ? 'debug' : 'info';
    // ... write to localStorage
}

function shouldLog(level: ChatRuntimeLogLevel) {
    return logLevelOrder[level] >= logLevelOrder[cachedLogLevel];
}
```

---

## 2. `useChatRuntimeLog.add()` Creates a Full Array Copy on Every Entry

`app/composables/useChatRuntimeLog.ts:62-74`

```ts
function add(area, event, detail, data, level, traceId) {
    entries.value = [
        ...entries.value,
        {
            id: createId(),
            createdAt: new Date().toISOString(),
            level,
            area,
            event,
            detail,
            data: redactValue(data) as Record<string, unknown> | undefined,
            traceId: normalizedTraceId,
        },
    ].slice(-MAX_ENTRIES);
}
```

Every log entry creates a new array via spread (`[...entries.value, newEntry]`), then slices it. With `MAX_ENTRIES = 250`, each call allocates a 251-element array, copies 250 references, then slices to 250. This happens on every log call during streaming.

**Why this is bad:** During a streaming session, `add()` is called 20-50 times per second. Each call allocates a new array and triggers Vue's reactivity system (the `entries.value = ...` assignment). Vue then diffs the old and new arrays to determine what changed, which is O(n) for array diffs.

**Real-world consequence:** The runtime log becomes a performance tax on streaming. Each log entry triggers: array allocation → array copy → Vue reactivity notification → dependent computed re-evaluation (`latestEntries`, `exportText`).

**Fix:** Use `entries.value.push(entry)` followed by `if (entries.value.length > MAX_ENTRIES) entries.value.shift()`. This mutates in place and Vue's reactivity tracks the push/shift operations more efficiently than a full array replacement.

---

## 3. `redactValue()` Recursively Walks Every Log Payload

`app/composables/useChatRuntimeLog.ts:24-45`

```ts
function redactValue(value: unknown): unknown {
    if (typeof value === 'string') {
        return value.length > 500 ? `${value.slice(0, 500)}\n...` : value;
    }
    if (!value || typeof value !== 'object') return value;
    if (Array.isArray(value)) return value.slice(0, 20).map(redactValue);
    const out: Record<string, unknown> = {};
    for (const [key, child] of Object.entries(value)) {
        const normalized = key.toLowerCase();
        if (normalized.includes('token') || normalized.includes('secret') || ...) {
            out[key] = '[redacted]';
            continue;
        }
        out[key] = redactValue(child);
    }
    return out;
}
```

This recursively clones and redacts every object passed to the logger. For tool call results with large payloads (file contents, command output), this creates deep copies of potentially large objects.

**Why this is bad:** The redaction is correct and necessary (security), but it runs synchronously on every log call. A tool result with a 50KB JSON payload gets deep-cloned and redacted on the main thread. During streaming with rapid tool calls, this adds up.

**Real-world consequence:** Main thread stalls during tool-heavy streaming sessions. The redaction cost scales with payload size.

**Fix:** The redaction is fine for small payloads. Add a size check: if the serialized payload exceeds a threshold (e.g., 10KB), truncate before redacting. Or defer redaction to a microtask batch. The `previewValue` utility in the activity module already truncates to 2000 chars — the logger should do the same before redacting.

---

## 4. `latestEntries` and `exportText` Are Computed Properties That Re-Derive on Every Entry

`app/composables/useChatRuntimeLog.ts:81-86`

```ts
const exportText = computed(() => JSON.stringify(entries.value, null, 2));

return {
    entries,
    latestEntries: computed(() => [...entries.value].reverse()),
    exportText,
    ...
};
```

`latestEntries` reverses the entire array on every access. `exportText` JSON-serializes all 250 entries on every access. Both are computed properties that re-evaluate whenever `entries` changes.

**Why this is bad:** `latestEntries` is consumed by `SettingsObservabilityPanel.vue` which passes it to `SettingsLogViewer`. Every new log entry triggers: array copy → reverse → Vue reactivity cascade → log viewer re-render. `exportText` is even worse — `JSON.stringify` on 250 entries with nested data payloads can produce megabytes of text, and it re-runs on every entry.

**Real-world consequence:** The observability panel becomes increasingly laggy as entries accumulate. Each new log entry causes a full re-serialization of all entries.

**Fix:** `latestEntries` should not be a computed — reverse the array in the template or use a method. `exportText` should be a function called on demand (the "Export all" button click), not a computed that re-evaluates on every entry.

---

## 5. `useServerLogs.pushEntry()` Does a Linear Scan for ID Collision on Every Entry

`app/composables/useServerLogs.ts:77-84`

```ts
function pushEntry(entry: ServerLogEntry) {
    const nextEntry = entries.value.some((existing) => existing.id === entry.id)
        ? { ...entry, id: `${entry.id}_${++localCollisionId}` }
        : entry;
    entries.value = [...entries.value, nextEntry].slice(
        -MAX_SERVER_LOG_ENTRIES,
    );
}
```

For every incoming server log entry, this scans up to 500 existing entries to check for ID collisions. Then it creates a new array via spread and slice.

**Why this is bad:** Server logs can arrive rapidly during high-activity periods. Each entry is O(n) for the collision check plus O(n) for the array copy. At 500 entries with rapid log output, that's 250,000 iterations per second.

**Real-world consequence:** Server log streaming becomes a CPU hog during high-throughput periods. The main thread stutters.

**Fix:** Use a `Set<string>` to track seen IDs. O(1) collision check instead of O(n). Or just skip the collision check entirely — server log IDs should be unique by design. If they're not, that's a server bug, not a client problem.

---

## 6. `useServerLogs` Module-Level State Survives HMR and Never Resets

`app/composables/useServerLogs.ts:27-35`

```ts
const entries = ref<ServerLogEntry[]>([]);
const isStreaming = ref(false);
const error = ref<string | null>(null);
const activeFilters = ref<ServerLogFilters>({ level: 'info' });
let controller: AbortController | null = null;
let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
let reconnectAttempt = 0;
let manualDisconnect = false;
let localCollisionId = 0;
```

All state is module-level. During HMR (hot module replacement in development), the old module's state persists while a new module is loaded. The old `controller` and `reconnectTimer` become orphaned — the new module creates new refs but the old SSE connection and timer keep running.

**Why this is bad:** During development, every HMR cycle leaks an SSE connection and a reconnect timer. The old connection keeps pushing entries to the old `entries` ref (which nobody reads), and the old reconnect timer keeps firing. After several HMR cycles, you have multiple concurrent SSE connections to the server.

**Real-world consequence:** In development, the server gets hammered with duplicate log stream connections. In production, this is a non-issue (no HMR), but it makes development painful.

**Fix:** Move state into a composable-scoped ref or use `useState` with a cleanup hook. At minimum, add an `import.meta.hot?.dispose()` handler to clean up the controller and timer on HMR.

---

## 7. `useServerLogs` Reconnect Has No Jitter — Thundering Herd Risk

`app/composables/useServerLogs.ts:135-146`

```ts
function scheduleReconnect() {
    if (manualDisconnect || reconnectTimer) return;
    reconnectAttempt += 1;
    const delay = Math.min(30000, 1000 * 2 ** Math.min(reconnectAttempt - 1, 5));
    reconnectTimer = setTimeout(() => {
        reconnectTimer = null;
        if (!manualDisconnect) void runConnection(activeFilters.value);
    }, delay);
}
```

Exponential backoff: 1s, 2s, 4s, 8s, 16s, 30s. No jitter. If the server restarts and 10 clients all disconnected at the same time, they all reconnect at the same time.

**Why this is bad:** Classic thundering herd. All clients that lost connection simultaneously will retry at the same intervals. The server, which just restarted, gets hit by all clients at once.

**Real-world consequence:** Server restart causes a stampede of reconnection attempts. On a local network this is minor, but if the app ever has multiple instances (Electron + web + mobile all connected to the same host), it matters.

**Fix:** Add random jitter: `delay * (0.5 + Math.random() * 0.5)`.

---

## 8. `SettingsLogViewer.entryPayload()` Calls `JSON.stringify` on Every Render

`app/components/settings/SettingsLogViewer.vue:271-274`

```ts
function entryPayload(entry: SettingsLogViewerEntry) {
    const payload = entry.data || entry.fields;
    return payload ? JSON.stringify(payload, null, 2) : '';
}
```

This is called from the template for every visible entry on every render. With 80 entries per page, that's 80 `JSON.stringify` calls per render. If any entry has a large payload (tool results, file contents), each stringify can be expensive.

**Why this is bad:** The function is not memoized. Vue re-renders the `<details>` element when any reactive dependency changes. During streaming, new entries arrive, which changes `paginatedEntries`, which re-renders all visible entries, which calls `entryPayload` 80 times.

**Real-world consequence:** Log viewer rendering stutters when entries have large payloads. Each render cycle does 80 JSON serializations.

**Fix:** Pre-compute the payload string when the entry is created, or use a `watchEffect` to cache it. Alternatively, only render the payload when the `<details>` element is opened (use a `v-if` on the `<pre>` block gated by an `open` state).

---

## 9. `SettingsLogViewer` Has No Virtualization — Pagination Is a Band-Aid

`app/components/settings/SettingsLogViewer.vue:82-138`

The log viewer renders up to 80 `<details>` elements per page. Each `<details>` contains a `<summary>`, optional `<p>`, optional `<div>`, and optional `<pre>` with formatted JSON. With 80 entries, that's 80+ DOM nodes with nested content.

**Why this is bad:** Pagination helps, but 80 entries per page is still a lot of DOM. Each `<details>` element with an expanded `<pre>` block containing formatted JSON can be hundreds of pixels tall. The `max-h-72` (288px) viewport with `overflow-auto` means the browser still lays out all 80 entries even though only ~5 are visible.

**Real-world consequence:** Scrolling within the log viewer is janky when entries have large payloads. The browser has to layout all 80 entries to calculate scroll height.

**Fix:** Either reduce the page size to 20-30, or use virtual scrolling for the log entries. The `Or3Scroll` component already exists in the codebase — use it here.

---

## 10. `copyAllLogs` in `SettingsObservabilityPanel` Double-Serializes

`app/components/settings/SettingsObservabilityPanel.vue:103-114`

```ts
async function copyAllLogs() {
    await navigator.clipboard?.writeText(
        JSON.stringify(
            {
                app: JSON.parse(chatRuntimeExportText.value),
                server: JSON.parse(serverLogExportText.value),
            },
            null,
            2,
        ),
    );
}
```

This takes `chatRuntimeExportText.value` (which is already `JSON.stringify(entries, null, 2)`), parses it back to an object, then re-serializes the combined object. The `exportText` computed properties are already running `JSON.stringify` on every entry change — this function then `JSON.parse`s that result and `JSON.stringify`s it again.

**Why this is bad:** Triple serialization. The computed `exportText` serializes on every entry change (wasteful). Then `copyAllLogs` parses that string and re-serializes it (more wasteful). With 250 runtime entries + 500 server entries, each with nested data payloads, this can produce a multi-megabyte string that gets serialized → parsed → serialized.

**Real-world consequence:** Clicking "Export all" freezes the UI for a noticeable moment. The clipboard write of a multi-megabyte string can also be slow.

**Fix:** Don't use the `exportText` computed. Build the export object directly from `entries.value` on demand:

```ts
async function copyAllLogs() {
    const text = JSON.stringify({
        app: chatRuntimeEntries.value,
        server: serverLogEntries.value,
    }, null, 2);
    await navigator.clipboard?.writeText(text);
}
```

---

## 11. `secureSessionCache` in `useOr3Api` Grows Unbounded and Never Clears

`app/composables/useOr3Api.ts:52-58`

```ts
const secureSessionCache: Record<string, {
    claims?: SecureSessionClaims;
    pending?: Promise<SecureSessionClaims>;
}> = {};
```

Entries are added at line 491 and deleted on error at line 497. But successful entries are never deleted. If a user pairs and unpairs multiple hosts, or if host IDs change, the cache accumulates stale entries.

**Why this is bad:** Each cache entry holds a `SecureSessionClaims` object with cryptographic material. Stale entries are never cleaned up. The cache is also checked at line 435 with an expiry check (`expires_at_unix_ms > now + 30_000`), but expired entries are not deleted — they just fall through to the `pending` path.

**Real-world consequence:** Memory leak over long sessions with multiple host connections. Stale claims objects hold references to crypto material.

**Fix:** Delete expired entries when they're detected as expired. Add a cleanup on host disconnect/unpair.

---

## 12. `useOr3Api.stream()` Duplicates ~100 Lines of Auth Resolution from `requestOnce()`

`app/composables/useOr3Api.ts:728-898` vs `529-726`

The `stream()` method duplicates nearly the entire auth resolution, header construction, and error handling logic from `requestOnce()`. The only difference is the `Accept` header (`text/event-stream` vs `application/json`) and the response body handling.

**Why this is bad:** Code duplication means bugs fixed in one path may not be fixed in the other. For example, `requestOnce()` uses `shouldLogNetworkError()` to suppress network errors during restart (line 625), but `stream()` always logs network errors at `error` level (line 814). This means the `suppressOr3ApiNetworkErrorLogsFor(65000)` call in `useServiceRestart.ts` doesn't suppress stream network errors — only request network errors.

**Real-world consequence:** During service restart, the runtime log gets spammed with stream network errors that should be suppressed. The observability panel shows errors that are expected and transient.

**Fix:** Extract the shared auth/header/fetch logic into a private helper. Both `request` and `stream` should call it with different response handlers.

---

## 13. `useServiceRestart` Creates a Terminal Session That Is Never Cleaned Up

`app/composables/useServiceRestart.ts:160-175`

```ts
const session = await createTerminalSession(root);
await sendRestartCommand(session.session_id);
suppressOr3ApiNetworkErrorLogsFor(65000);
return {
    mode: 'terminal' as const,
    root,
    sessionId: session.session_id,
};
```

When the restart falls back to the terminal path, it creates a terminal session, sends the restart command, and returns the session ID. The terminal session is never explicitly closed. The service is about to restart, which will kill the session server-side, but if the restart fails, the orphaned terminal session persists.

**Why this is bad:** Terminal sessions hold resources on the server (PTY, shell process). If the restart command fails (e.g., the script doesn't exist), the terminal session leaks.

**Real-world consequence:** Orphaned terminal sessions on the host. Each one holds a shell process and PTY. Over time, this accumulates.

**Fix:** Add a `finally` block that attempts to close the terminal session if the restart didn't succeed. Or set a server-side TTL on terminal sessions used for restart.

---

## 14. `useApprovals` Polling Timer Is Never Cleaned Up on HMR

`app/composables/useApprovals.ts:27,424-430`

```ts
let approvalsPollTimer: ReturnType<typeof setInterval> | null = null;

function startPolling(intervalMs = 15000) {
    stopApprovalsPolling();
    if (!import.meta.client || hostKnownUnavailable()) return;
    approvalsPollTimer = setInterval(() => {
        if (document.visibilityState === 'visible') void loadPendingCount();
    }, intervalMs);
}
```

The polling timer is module-level. During HMR, the old timer keeps running. The new module creates a new timer. After several HMR cycles, multiple `setInterval` timers are running concurrently, each calling `loadPendingCount()`.

**Why this is bad:** Each HMR cycle leaks a 15-second interval timer. After 10 HMR cycles, 10 timers are polling the approvals count endpoint every 15 seconds. The server gets hammered with redundant requests.

**Real-world consequence:** In development, the approvals count endpoint gets called 10x more often than intended. The `pendingCountInFlight` guard prevents concurrent requests within a single module instance, but each HMR-leaked timer has its own `pendingCountInFlight` variable.

**Fix:** Add `import.meta.hot?.dispose(() => stopApprovalsPolling())` to clean up on HMR.

---

## 15. `useApprovals` `approvalActionsInFlight` Set Uses String Keys but Approval IDs Can Be Numbers

`app/composables/useApprovals.ts:29,117-134`

```ts
const approvalActionsInFlight = new Set<string>();

async function withApprovalAction<T>(id: number | string, fn: () => Promise<T>) {
    const key = approvalTokenKey(id);
    if (!key) throw new Error('Approval id is required.');
    if (approvalActionsInFlight.has(key)) {
        throw new Error('Another approval action is already in progress.');
    }
    approvalActionsInFlight.add(key);
    ...
}
```

`approvalTokenKey` converts to string via `String(id).trim()`. This works, but the `approvalActionsInFlight` Set is never bounded. If an approval action throws before reaching the `finally` block (e.g., a synchronous error in `fn()`), the key is never removed.

**Why this is bad:** The `finally` block at line 132 should always run, but if `fn()` throws synchronously before returning a promise, the `await` at line 130 never happens, and the `finally` still runs (this is actually fine in JS). However, the real risk is if `withApprovalAction` itself is called with a bad `id` that passes the `approvalTokenKey` check but then the action fails in an unexpected way. The Set entry persists.

**Real-world consequence:** If an approval action fails in an unexpected way, that approval ID becomes permanently locked — the user can never retry it without reloading the app.

**Fix:** Add a timeout or a maximum Set size. If the Set exceeds a threshold, clear it. Or use a `Map<string, number>` with timestamps and prune stale entries.

---

## 16. `useHostReachability.reconcileStatus()` Has No Debouncing

`app/composables/useHostReachability.ts:32-59`

```ts
async function reconcileStatus() {
    const host = activeHost.value;
    if (!host || !isPaired.value || needsUnlock()) return;
    if (host.id === ELECTRON_HOST_PROFILE_ID) return;
    if (host.status === 'online') return;
    ...
    try {
        await api.request<{ status?: string }>('/internal/v1/health', {
            requireAuth: false,
            trackHostStatus: false,
            baseUrl: host.baseUrl,
        });
        ...
    } catch { ... }
}
```

This makes a health check API call with no debouncing. If multiple components call `reconcileStatus()` in quick succession (e.g., on page mount, on watcher trigger, on visibility change), each one fires a separate health check request.

**Why this is bad:** The health endpoint gets called multiple times in rapid succession. Each call goes through the full `useOr3Api` auth resolution path (even though `requireAuth: false`, it still does `ensureElectronHostLoaded()` and other setup).

**Real-world consequence:** Burst of health check requests on page load or reconnection. Minor, but wasteful.

**Fix:** Debounce `reconcileStatus` with a 1-2 second window. Or use the `dedupeGetRequest` pattern already in `useOr3Api`.

---

## 17. `useWhenHostApiReady` Calls `bootstrapHostWorkspace()` on Every Host Change

`app/composables/useWhenHostApiReady.ts:16-27`

```ts
return watch(
    () => canUseHostApi(activeHost.value) ? activeHost.value?.id ?? '' : '',
    (hostId) => {
        if (!hostId) return;
        void (async () => {
            await bootstrapHostWorkspace();
            await Promise.resolve(run());
        })();
    },
    { immediate: options?.immediate ?? true },
);
```

Every caller of `useWhenHostApiReady` creates a watcher that calls `bootstrapHostWorkspace()` on every host ID change. If multiple components use this composable, each one independently calls `bootstrapHostWorkspace()`.

**Why this is bad:** `bootstrapHostWorkspace()` likely makes API calls to set up workspace state. Multiple concurrent calls are wasteful and could race.

**Real-world consequence:** On host connection, N components each call `bootstrapHostWorkspace()`, creating N concurrent bootstrap operations.

**Fix:** `bootstrapHostWorkspace()` should be internally deduplicated (check if it's already running or recently completed). Or `useWhenHostApiReady` should share a single bootstrap promise across all callers.

---

## 18. `useHostApiGate` Settlement State Machine Has No Error Recovery

`app/composables/useHostApiGate.ts:15-33`

```ts
export function beginHostApiSettlement(): void {
    settling.value = true;
    settled.value = false;
    void import('./useHostWorkspaceBootstrap').then(({ resetHostWorkspaceBootstrap }) =>
        resetHostWorkspaceBootstrap(),
    );
}

export function completeHostApiSettlement(): void {
    settling.value = false;
    if (needsUnlock()) {
        settled.value = false;
        return;
    }
    settled.value = true;
    void import('./useHostWorkspaceBootstrap').then(({ bootstrapHostWorkspace }) =>
        bootstrapHostWorkspace({ force: true }),
    );
}
```

If `resetHostWorkspaceBootstrap()` or `bootstrapHostWorkspace()` throws, the error is swallowed by the `void` promise. The settlement state machine transitions to `settled: true` regardless of whether the bootstrap succeeded.

**Why this is bad:** If the workspace bootstrap fails (e.g., API error, network issue), the app thinks it's settled and ready. Components that depend on workspace state may render with stale or missing data. The error is silently lost.

**Real-world consequence:** After a failed bootstrap, the app appears functional but workspace-dependent features (file browser, terminal, computer overview) may show stale data or fail silently.

**Fix:** Add error handling to the bootstrap calls. If bootstrap fails, set an error state and allow retry. At minimum, log the error so it appears in the observability panel.

---

## 19. `SettingsObservabilityPanel` Auto-Connects Server Logs on Mount Without Checking Host Reachability

`app/components/settings/SettingsObservabilityPanel.vue:116-119`

```ts
onMounted(() => {
    debugLogging.value = isDebugLoggingEnabled();
    if (isPaired.value) connectServerLogStream();
});
```

This checks `isPaired` but not whether the host is actually reachable (`isConnected`, `activeHost.value?.status === 'online'`). If the host is paired but offline, the SSE connection attempt will fail, trigger the reconnect loop, and spam the runtime log with connection errors.

**Why this is bad:** Opening the observability page while the host is offline immediately starts a reconnect loop that generates error log entries, which appear in the "App Events" section, which is the very thing the user is trying to observe. The observability tool pollutes its own data.

**Real-world consequence:** Opening observability while disconnected creates a cascade of error entries that obscure the actual logs the user wants to see.

**Fix:** Check `isConnected.value` or `activeHost.value?.status === 'online'` before auto-connecting. Show a "Host is offline" message instead of attempting to connect.

---

## 20. `logTrace.ts` Uses a Module-Level String — Not Thread-Safe for Concurrent Turns

`app/utils/logTrace.ts:1-13`

```ts
let activeTraceId = '';

export function setActiveTraceId(traceId?: string | null) {
    activeTraceId = traceId?.trim() || '';
}

export function clearActiveTraceId() {
    activeTraceId = '';
}
```

This is a single global trace ID. If two assistant turns somehow overlap (e.g., a retry starts before the original finishes, or a recovery turn fires while a manual turn is in progress), the trace ID gets overwritten. All log entries from both turns share the same trace ID, making it impossible to distinguish them.

**Why this is bad:** The `isStreaming` guard in `useAssistantStream` should prevent concurrent turns, but the stream recovery watcher in `useStreamRecovery` can trigger a recovery turn from a `queueMicrotask` call. If the timing is wrong, two turns share a trace ID.

**Real-world consequence:** Log entries from different turns get mixed under the same trace ID. Debugging becomes impossible.

**Fix:** Pass the trace ID explicitly through the turn lifecycle rather than relying on a global. Or use a stack-based approach where each turn pushes/pops its trace ID.

---

## 21. `suppressOr3ApiNetworkErrorLogsFor` Uses a Module-Level Timestamp — No Granularity

`app/composables/useOr3Api.ts:24,104-114`

```ts
let suppressNetworkErrorLogsUntil = 0;

export function suppressOr3ApiNetworkErrorLogsFor(ms: number) {
    const duration = Math.max(0, Number(ms) || 0);
    suppressNetworkErrorLogsUntil = Math.max(
        suppressNetworkErrorLogsUntil,
        Date.now() + duration,
    );
}
```

This is a global suppression flag. When `useServiceRestart` calls `suppressOr3ApiNetworkErrorLogsFor(65000)`, ALL network error logs from ALL API calls are suppressed for 65 seconds — not just the ones related to the restart.

**Why this is bad:** If the user navigates to a different page during the 65-second window and a legitimate network error occurs (e.g., they switch hosts, or a different API call fails), that error is silently suppressed. The user gets no feedback about what went wrong.

**Real-world consequence:** Legitimate network errors are hidden during the restart suppression window. Debugging connection issues during this window is impossible.

**Fix:** Scope the suppression to specific paths or request types. Or use a shorter suppression window (the restart should complete in 10-15 seconds, not 65). Or pass a request ID / context that the logger can match against.

---

## 22. `SettingsLogViewer` Filter Computed Re-Filters All Entries on Every Keystroke

`app/components/settings/SettingsLogViewer.vue:276-294`

```ts
const filteredEntries = computed(() => {
    const component = componentQuery.value.trim().toLowerCase();
    const trace = traceQuery.value.trim().toLowerCase();
    return props.entries.filter((entry) => {
        if (selectedLevel.value !== 'all' && entryLevel(entry) !== selectedLevel.value)
            return false;
        if (component && !entryComponent(entry).toLowerCase().includes(component))
            return false;
        if (trace && !entryTrace(entry).toLowerCase().includes(trace))
            return false;
        return true;
    });
});
```

Each keystroke in the component or trace search input triggers a full re-filter of all entries. With 500 server log entries, each keystroke does 500 iterations with string operations.

**Why this is bad:** The `componentQuery` and `traceQuery` refs are `v-model` bound to `<input>` elements. Every keystroke updates the ref, which invalidates `filteredEntries`, which re-filters all entries, which invalidates `paginatedEntries`, which re-renders the log viewer.

**Real-world consequence:** Typing in the filter inputs feels laggy with many log entries. Each keystroke triggers a full filter + re-render cycle.

**Fix:** Debounce the filter inputs with a 150-300ms delay. Or use `v-model.lazy` to only update on blur/change instead of every keystroke.

---

## Summary: Top Priority Fixes

| Priority | Issue | Impact |
|----------|-------|--------|
| **1st** | Cache log level instead of reading localStorage per call (#1) | Eliminates main thread blocking during streaming |
| **2nd** | Stop double/triple serialization in export (#4, #10) | Eliminates UI freeze on export |
| **3rd** | Mutate log arrays in place instead of spread+slice (#2, #5) | Reduces GC pressure and reactivity overhead |
| **4th** | Fix stream error suppression parity with request (#12) | Correct observability during restarts |
| **5th** | HMR cleanup for timers and SSE connections (#6, #14) | Stops resource leaks in development |
| **6th** | Lazy-render log entry payloads (#8) | Eliminates 80 JSON.stringify calls per render |
| **7th** | Debounce filter inputs (#22) | Fixes laggy search in log viewer |
| **8th** | Scope network error suppression (#21) | Prevents hiding legitimate errors |
