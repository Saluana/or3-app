# Terminal Session Review

Focused review target: xterm.js lifecycle, terminal transport cleanup, reconnect behavior, and buffer management across `or3-app` and `or3-intern`.

Validation run: `go test ./cmd/or3-intern -run 'Test(ServiceTerminal|TerminalWebSocket|CollectTerminalOutput|WriteTerminalInput|AppendTerminal|ResizeTerminalSession)'`

## Replay History Is an Unbounded Memory Leak

Code: `or3-intern/cmd/or3-intern/service_terminal.go:110-137`, `or3-intern/cmd/or3-intern/service_terminal.go:597-624`, `or3-intern/cmd/or3-intern/service_terminal.go:766-817`

Why this is bad:

`appendEvent()` appends every PTY chunk into `session.events` forever. `subscribe()` clones that whole slice on every attach. Both the SSE path and the WebSocket path replay the full history before streaming live events. That is a memory leak disguised as reconnect support.

Real-world consequences:

Long-running terminals with noisy output will keep growing resident memory. Reconnect latency gets worse the longer the shell runs because every reconnect has to copy and resend stale output again. A terminal that should reconnect fast turns into a history dump.

Concrete fix:

Replace the unbounded `events` slice with a bounded replay window. Cap by bytes, not just event count. Coalesce adjacent `output` events. Keep only the last status/snapshot metadata and a recent output tail that is actually useful for reconnect.

## Transport Drops Leave a Running Shell With a Dead UI

Code: `app/composables/useTerminalSession.ts:398-440`, `app/composables/useTerminalSession.ts:536-577`, `app/pages/computer/terminal.vue:321-327`, `app/components/computer/terminal/TerminalSurface.vue:1-61`

Why this is bad:

After a WebSocket successfully opens, `socket.onclose` only flips `terminalStreaming` to `false`. There is no retry, no fallback back to SSE, and no disconnected state that the page actually renders. The page only offers reconnect when `session.status !== 'running'`, which misses the exact case that matters here: the shell is still running, but the transport died.

Real-world consequences:

The user gets a terminal that looks alive but is no longer receiving output. Connection drops turn into silent hangs instead of a recoverable state. That is exactly how you ship a terminal that feels flaky even when the backend shell is still fine.

Concrete fix:

Make transport loss a first-class state. On unexpected close, attempt fast reattach with bounded backoff and fall back to SSE if WebSocket recovery fails. Surface a visible disconnected banner and gate input until the stream is live again.

## Stale Attach Work Can Reopen Hidden Connections After Unmount

Code: `app/composables/useTerminalSession.ts:165-178`, `app/composables/useTerminalSession.ts:243-243`, `app/composables/useTerminalSession.ts:327-329`, `app/composables/useTerminalSession.ts:359-359`, `app/composables/useTerminalSession.ts:494-577`, `app/pages/computer/terminal.vue:485-496`

Why this is bad:

`start()`, `attachExistingSession()`, and `restoreSession()` all fire `void attach(...)` from a module-scoped singleton. The page only calls `detach()` on unmount. If the route disappears while create/restore or the WebSocket ticket request is still in flight, the stale async completion can still open a socket or SSE stream after the view is gone. `closeTerminalSocket()` also nulls handlers before `close()`, which means a canceled in-progress WebSocket connect can be left unresolved instead of being cleanly settled.

Real-world consequences:

You get orphan transports, background state mutation after navigation, and duplicate live streams that are hard to reproduce and harder to debug. This is how memory leaks and phantom terminal activity show up in production.

Concrete fix:

Thread an owner token or generation counter through `start()`, `restoreSession()`, and `attach()`. Abort or ignore stale completions after unmount. Pass cancellation into the ws-ticket fetch and explicitly settle canceled WebSocket connects.

## xterm Can Leak If the Component Unmounts During Async Setup

Code: `app/components/computer/terminal/TerminalConsole.vue:63-115`, `app/components/computer/terminal/TerminalConsole.vue:192-196`

Why this is bad:

`setup()` waits on dynamic imports, then allocates `Terminal`, `FitAddon`, and `WebLinksAddon`, and only after that checks whether the mount node is still connected. If unmount happens during the import gap, `onBeforeUnmount()` runs while `term` is still `null`. Then setup resumes, allocates xterm objects, hits the second early return, and never disposes them.

Real-world consequences:

Fast route changes can leak xterm instances and addon state. It will not explode immediately, which is exactly why this kind of lifecycle bug hangs around until the terminal page starts feeling mysteriously heavier over time.

Concrete fix:

Track an `unmounted` or `disposed` flag through `setup()`. If the component is stale after imports resolve, dispose any newly created terminal/addons before returning. Do not allocate xterm objects until the ownership check is still valid.

## The Client Buffer Path Does O(n) Allocation and O(n) Scanning Per Chunk

Code: `app/composables/useTerminalSession.ts:50-58`, `app/components/computer/terminal/TerminalConsole.vue:151-157`

Why this is bad:

Every incoming chunk clones the entire `terminalChunks` array and the entire `terminalLines` array. Then the console watcher loops the whole retained chunk buffer again just to find the new tail. You are paying repeated copy and scan costs on top of xterm's own scrollback buffer.

Real-world consequences:

High-output sessions turn into avoidable garbage-collection churn and main-thread work. The terminal will feel progressively worse under exactly the workloads people open a terminal for: builds, logs, package installs, and noisy CLIs.

Concrete fix:

Use a bounded mutable queue or ring buffer for retained chunks, and feed xterm only the new chunks instead of rescanning the full buffer. If batching is needed, batch writes for a frame; do not clone 2,000-entry arrays on every packet.

## One Missing Session Poisons the WebSocket Fast Path for Everything After It

Code: `app/composables/useTerminalSession.ts:500-513`

Why this is bad:

The ws-ticket error handler sets `terminalWebSocketUnsupported = true` for `404`, `405`, and `400`. `405` or some `400` shapes can mean feature unsupported. `404` does not. A missing or expired session is a normal race, not proof that the server lacks WebSocket support.

Real-world consequences:

One transient missing-session race can permanently downgrade every later terminal in the current app lifetime to SSE only. That makes future connects and reconnects slower for no good reason, and the user will never know why the fast path vanished.

Concrete fix:

Only set the global unsupported flag for real capability signals. Treat `404` as a session problem, not a transport capability problem. Add a regression test that starts a fresh session after a ws-ticket `404` and verifies WebSocket is still attempted.

## The Server Sends Pings but Never Requires a Pong

Code: `or3-intern/cmd/or3-intern/service_terminal.go:758-820`

Why this is bad:

The WebSocket handler sets a read limit and sends periodic ping frames, but it never sets a read deadline and never installs a pong handler. That means half-open or badly degraded connections are cleaned up only when some other read or write path happens to fail.

Real-world consequences:

Connection-drop cleanup can be slower and less predictable than it needs to be. Stale goroutines and subscribers can linger longer after network loss, which directly works against the goal of fast reconnect and reliable recovery.

Concrete fix:

Set a read deadline, refresh it from a pong handler, and fail the socket promptly when the peer stops responding. Add a disconnect test that proves the handler exits on missed pongs instead of waiting for some unrelated failure.

## Coverage Barely Touches the Failure Modes That Matter

Code: `../or3-intern/cmd/or3-intern/service_terminal_test.go:209-323`, `../or3-intern/cmd/or3-intern/service_terminal_test.go:395-649`, `tests/unit/service-restart-composable.test.ts:50-98`

Why this is bad:

The backend tests cover the happy path, some buffer behavior, and basic WebSocket lifecycle. The app side only has a restart fallback test that happens to create a terminal and send input. There is no focused client coverage for transport drop, reconnect, stale attach after unmount, or async xterm setup cancellation.

Real-world consequences:

The exact code that will break under flaky networks and fast navigation is the exact code the test suite is ignoring. Regressions here will ship quietly.

Concrete fix:

Add frontend tests that mock `WebSocket` and `api.stream` for close/reconnect/unmount races, and backend tests that exercise replay bounding and missed-pong cleanup. Right now the suite proves the happy path works and says almost nothing about the hard parts.
