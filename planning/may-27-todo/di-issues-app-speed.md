# DI Issues: App Speed & Performance Audit

Neckbeard review of the or3-app chat pipeline. Focus: memory leaks, watcher issues, reactivity problems, and anything that nukes performance. Specifically investigating the janky chat switching and sluggish feel.

---

## 1. Chat Switching Flashes Empty State (The Jank) ✅

`app/composables/useSessionHistory.ts:322-329` — `openSession()`

```ts
async function openSession(meta, options) {
    const session = chat.applyBackendSessionMeta(meta);
    await hydrate(meta.session_key, 100, { replaceLocal: options.replaceLocal });
    historyOpen.value = false;
    return session;
}
```

`hydrate()` at line 289-291 calls `chat.clearSessionMessages(local.id)` BEFORE fetching new messages from the API. This creates a synchronous window where `messages` is empty. `ChatThread.vue:14` renders `v-else-if="!messages.length"` — the empty state — during this gap. The API call then takes hundreds of ms to return, so the user sees the empty state flash before messages appear.

**Why this is bad:** This is THE cause of the "briefly shows empty state" jank when switching chats. The session changes immediately (activeSession updates), messages get wiped, then there's a network round-trip before new messages arrive.

**Real-world consequence:** Every chat switch looks broken. Users see a flash of "Hi, I'm or3-intern" before their conversation loads. Feels janky and slow.

**Fix:** Don't clear local messages until the new ones arrive. Fetch first, then swap atomically. Or keep a per-session message cache and show stale messages instantly while refreshing in the background. At minimum, add a loading skeleton instead of the empty state during hydration.

---

## 2. Chat Switching Is Sequential and Blocking (The Slowness) ✅

`app/composables/useSessionHistory.ts:280-298` — `hydrate()`

```ts
async function hydrate(sessionKey, limit = 100, options) {
    await ensureHostReady();
    if (!credentialsReadyForHost(activeHost.value)) return null;
    const local = chat.activateSessionByKey(sessionKey);
    if (!local) return null;
    if (options.replaceLocal !== false) {
        chat.clearSessionMessages(local.id);
    }
    const params = new URLSearchParams({ limit: String(limit) });
    const response = await api.request<ChatMessagePageResponse>(...);
    chat.hydrateBackendMessages(local, response.messages ?? []);
    return local;
}
```

The entire switch path is: `ensureHostReady` → `activateSessionByKey` → `clearSessionMessages` → **network request** → `hydrateBackendMessages`. The user waits for the full API round-trip before seeing anything.

**Why this is bad:** No optimistic rendering. No cached messages shown instantly. The user stares at nothing while the network does its thing.

**Real-world consequence:** Switching chats takes 1-2 seconds on a good connection, worse on mobile or high-latency networks.

**Fix:** Show locally cached messages immediately (they're already in `cache.state.value.messages`). Only fetch to reconcile/refresh. If messages exist locally for that session, render them instantly and hydrate in the background.

---

## 3. `messages` Computed Does a Full Linear Scan on Every Update ✅

`app/composables/useChatSessions.ts:320-323`

```ts
const messages = computed(() =>
    cache.state.value.messages.filter(
        (message) => message.sessionId === activeSession.value?.id,
    ),
);
```

Every time ANY message in ANY session changes (streaming delta, status update, tool call resolution), this re-evaluates by scanning the entire `messages` array. With hundreds of messages across sessions, this is O(n) on every reactive tick.

**Why this is bad:** During streaming, message content updates on every animation frame. Each update triggers this filter across ALL messages, not just the active session's messages.

**Real-world consequence:** As message history grows, streaming gets progressively slower. The UI stutters during fast text output.

**Fix:** Maintain a per-session message index (Map<sessionId, ChatMessage[]>). Or at minimum, use a `watchEffect` that only re-filters when the active session changes or when messages for the active session change, not when any message changes.

---

## 4. `persist()` Runs `prunePersistedChatCache()` on Every Call ✅

`app/composables/useLocalCache.ts:30-43` and `51-136`

```ts
function serializableState() {
    prunePersistedChatCache();
    return { ... };
}

function persist() {
    if (!import.meta.client) return;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(serializableState()));
    persistSessionTokens();
}
```

`prunePersistedChatCache()` sorts sessions by timestamp, groups them by host, slices, filters messages by session, sorts messages, filters pinned/streaming, sorts again, and compacts drafts. This runs on EVERY `persist()` call.

**Why this is bad:** `persist()` is called from `addMessage`, `updateMessage`, `touchSession`, `setActiveChatSessionId`, `newSession`, `clearSessionMessages`, `setSessionRunnerMetadata`, etc. During session switching, `hydrateBackendMessages` calls `updateMessage` for each of ~100 messages, each triggering `persist()` → `prunePersistedChatCache()` → `JSON.stringify` → `localStorage.setItem`. That's 100 full cache prunes and 100 synchronous localStorage writes.

**Real-world consequence:** Session hydration is O(n²) in practice. The main thread blocks on each localStorage write (which is synchronous and can take 1-5ms on large payloads). This directly causes the "takes a second or two" feeling.

**Fix:** Debounce `persist()`. Batch writes. Don't prune on every write — prune on a timer or on app background. At minimum, `hydrateBackendMessages` should batch all message updates and call `persist()` once at the end (it already calls `cache.persist()` at line 1193, but each `updateMessage` inside the loop also calls it).

---

## 5. `hydrateBackendMessages` Is an O(n*m) Nightmare ✅

`app/composables/useChatSessions.ts:864-1194`

For each backend message (up to 100), this function:
- Calls `sessionMessages()` which filters ALL messages (O(n))
- Calls `existingByBackendID()` which creates a new Map from scratch (O(n))
- Calls `attachToolResultToAssistant` which calls `sessionMessages()` again and does `[...messages].reverse().find(...)` (O(n))
- Calls `updateMessage` which calls `syncSessionMessageSummary` which filters and reverses again (O(n))
- Calls `persist()` which prunes and writes to localStorage

**Why this is bad:** 100 messages × O(n) per message = O(n²). With 300 persisted messages, that's 30,000 iterations plus 100 localStorage writes.

**Real-world consequence:** Opening a chat with history freezes the main thread for hundreds of milliseconds. This is the core of the "takes a second or two" problem.

**Fix:** Build the `existingByBackendID` map ONCE before the loop. Build a `sessionMessages` array ONCE. Batch all `updateMessage` calls with `persist: false` and call `persist()` once at the end. The function already calls `cache.persist()` at line 1193, but the inner `updateMessage` calls at lines 940, 1114, 1134, 1149, 1179 also trigger persist by default.

---

## 6. `syncSessionMessageSummary` Is Called on Every Message Mutation ✅

`app/composables/useChatSessions.ts:440-459`

```ts
function syncSessionMessageSummary(sessionId) {
    const sessionMessages = cache.state.value.messages.filter(
        (message) => message.sessionId === sessionId,
    );
    session.backendMessageCount = sessionMessages.length;
    const latestVisible = [...sessionMessages]
        .reverse()
        .find((message) => messagePreview(message.content));
    ...
}
```

This filters all messages, copies the array, reverses it, and searches for the latest visible message. It's called from `addMessage` (line 475) and `applyMessagePatch` (line 489, unless `syncSummary: false`).

**Why this is bad:** During streaming, `updateMessageRecord` is called with `syncSummary: false` (good), but `addMessage` at the start of `send()` calls it. More critically, `hydrateBackendMessages` calls `updateMessage` (not `updateMessageRecord`) for each backend message, and `updateMessage` defaults to `syncSummary: true`. So hydrating 100 messages runs 100 linear scans.

**Real-world consequence:** Contributes to the O(n²) hydration cost.

**Fix:** Pass `{ syncSummary: false, persist: false }` to `updateMessage` calls inside `hydrateBackendMessages`. The final `touchSession` + `compactSessionMessages` + `cache.persist()` at lines 1191-1193 already handles the final state.

---

## 7. `findMessageById` Is a Linear Scan — No Index ✅

`app/composables/useChatSessions.ts:494-498`

```ts
function findMessageById(id) {
    return cache.state.value.messages.find((item) => item.id === id) ?? null;
}
```

Called from `updateMessage`, `flushMessage`, `toggleMessagePin`, and critically from `commitAssistantPatch` in `useAssistantMessageState.ts:109` on every animation frame during streaming.

**Why this is bad:** O(n) lookup on every frame during streaming. With 300 messages, that's 300 iterations per frame.

**Real-world consequence:** Streaming performance degrades as message count grows. Each frame takes longer to commit.

**Fix:** Maintain a `Map<string, ChatMessage>` index alongside the messages array. Update it on add/remove. Lookups become O(1).

---

## 8. `ChatMessage.vue` Creates ~15 Computed Properties Per Instance ✅ (v-memo on list items)

`app/components/assistant/ChatMessage.vue:345-462`

Each `ChatMessage` instance creates: `shouldRepairIncompleteMarkdown`, `friendlyError`, `showErrorStrip`, `errorStripText`, `copyText`, `canCopy`, `orderedParts`, `hasOrderedParts`, `activityItems`, `canRetry`, `canFork`, `approvalRequestKey`, `approvalIsPending`, `composerHandlesApproval`, `showApprovalActions`, `showInlineApprovalActions`, `approvalNeedsAttention`, `approvalMetaLabel`, `hasMeta`, `timestamp`.

**Why this is bad:** With 50 visible messages, that's ~1000 computed property instances. Each one tracks dependencies and re-evaluates when its dependencies change. During streaming, the streaming message's properties change on every frame, and Vue's dependency tracking has overhead for each computed.

**Real-world consequence:** Memory usage scales linearly with visible messages. Reactivity overhead grows with message count.

**Fix:** Most of these computed properties are trivial and could be inline template expressions or methods. Alternatively, use `v-memo` on the message component to skip re-renders when the message object hasn't changed.

---

## 9. `ChatMessage.vue` Has an `{ immediate: true }` Watcher on Every Instance ✅

`app/components/assistant/ChatMessage.vue:766-793`

```ts
watch(
    () => [
        props.message.approvalRequestId,
        props.message.approvalState,
        props.message.retryPayload,
        isStreaming.value,
    ],
    () => {
        const message = currentMessage();
        if (message.approvalState !== 'pending' || ...) return;
        void retryApprovedRequest().catch(...);
    },
    { immediate: true },
);
```

This watcher fires immediately for EVERY rendered message. For the vast majority of messages (non-approval), it evaluates the condition and returns early. But the watcher setup, dependency tracking, and initial evaluation still happen.

**Why this is bad:** With 50 messages, 50 watchers are created and immediately evaluated. The `currentMessage()` call inside does a linear scan via `messages.value.find(...)`. So it's 50 × O(n) on mount.

**Real-world consequence:** Rendering a chat with many messages has a noticeable mount cost. Switching to a chat with many messages stalls while all these watchers initialize.

**Fix:** Move this logic to a parent-level watcher that only watches messages with pending approvals. Or gate the watcher on whether the message has an `approvalRequestId` before setting it up.

---

## 10. `ChatMessage.vue` Calls Multiple Composables Per Instance ✅

`app/components/assistant/ChatMessage.vue:301-335`

```ts
const toast = useToast();
const { activeSession, markApprovalResolved, messages, toggleMessagePin, updateMessage } = useChatSessions();
const { isStreaming, send } = useAssistantStream();
const sessionHistory = useSessionHistory();
const { approve, deny, fetchApproval, consumeIssuedApprovalToken } = useApprovals();
```

Each `ChatMessage` instance calls 5 composables. While Nuxt composables are typically singletons (backed by `useState` or module-level state), the destructuring and function binding still has per-instance cost.

**Why this is bad:** 50 messages × 5 composable calls = 250 composable invocations on render. Even if they return cached state, the function call overhead and destructuring add up.

**Real-world consequence:** Slower component mounting. More GC pressure from temporary objects.

**Fix:** Pass needed values as props from the parent. The parent (`ChatMessageList`) can call these composables once and pass down the relevant functions/state.

---

## 11. `copiedTimer` in `ChatMessage.vue` Is Never Cleaned Up on Unmount ✅

`app/components/assistant/ChatMessage.vue:339,496-499`

```ts
let copiedTimer: ReturnType<typeof setTimeout> | null = null;
...
copiedTimer = setTimeout(() => {
    copied.value = false;
    copiedTimer = null;
}, 1500);
```

If the component unmounts before the 1500ms timer fires, it attempts to set `copied.value = false` on an unmounted component's ref.

**Why this is bad:** Vue will warn about setting state on an unmounted component. Not a memory leak (the timer fires once and completes), but it's sloppy lifecycle management.

**Real-world consequence:** Console warnings. Potential edge-case bugs if the ref is reused.

**Fix:** Clear the timer in `onBeforeUnmount`:
```ts
onBeforeUnmount(() => {
    if (copiedTimer) clearTimeout(copiedTimer);
});
```

---

## 12. Event Applier Creates Unbounded Sets During Streaming ✅

`app/utils/assistant-stream/event-applier.ts:79-80`

```ts
const appliedEventSequenceKeys = new Set<string>();
const streamedEventPayloadKeys = new Set<string>();
```

These sets grow for the entire duration of a streaming session. The `payloadKey` at line 155 includes `JSON.stringify(payload ?? {})` which can produce very large strings for tool results with big payloads.

**Why this is bad:** For long-running sessions with many tool calls, these sets accumulate hundreds of entries with potentially large string keys. The `JSON.stringify` on every event is also wasteful for deduplication.

**Real-world consequence:** Memory grows during long streaming sessions. String comparison on large keys slows down the `has()` check.

**Fix:** Use a bounded LRU cache or clear the sets when the stream completes. For `payloadKey`, use a hash or a smaller fingerprint instead of full JSON serialization.

---

## 13. `scheduleJumpToBottom` Stacks Nested Animation Frames ✅

`app/components/assistant/ChatMessageList.vue:99-114`

```ts
function scheduleJumpToBottom() {
    void nextTick(() => {
        scroller.value?.reset?.();
        scroller.value?.refreshMeasurements?.();
        jumpToBottom();
        if (typeof requestAnimationFrame !== 'function') return;
        requestAnimationFrame(() => {
            scroller.value?.refreshMeasurements?.();
            jumpToBottom();
            requestAnimationFrame(() => {
                scroller.value?.refreshMeasurements?.();
                jumpToBottom();
            });
        });
    });
}
```

This schedules a `nextTick` → `rAF` → `rAF` chain. It's called from `onMounted` and from the watcher on last message ID (line 120-132). During streaming, the last message ID doesn't change (same streaming message), so the watcher doesn't re-fire. But on mount and on new message arrival, it stacks 4 scroll operations.

**Why this is bad:** Each call schedules 4 async operations. If called rapidly (e.g., during session switching where mount fires + watcher fires), you get 8+ pending scroll operations competing with each other.

**Real-world consequence:** Scroll position jumps erratically during session transitions. Contributes to the janky feel.

**Fix:** Debounce or cancel previous scheduled jumps before scheduling a new one. Use a single `rAF` with a measurement retry counter instead of nested callbacks.

---

## 14. `index.vue` Has 8+ Watchers Evaluating on Every Reactive Change ✅

`app/pages/index.vue:403-637`

The main page sets up watchers on:
1. `activeSession.value?.runnerId` (line 403)
2. `activeSession.value?.id` (line 412)
3. `activeSession.value?.sessionKey` with `canUseHostApi` (line 420)
4. `selectedRunnerId` (line 429)
5. `activeHost.value?.id` with `canUseHostApi` (line 530)
6. `canUseHostApi(activeHost.value)` (line 549)
7. `liveChannelPaused` (line 562)
8. `historyError` (line 585)
9. `runnersError` (line 616)

**Why this is bad:** Each watcher's getter function is evaluated on every reactive dependency change. Watchers 3 and 5 call `canUseHostApi()` which accesses multiple reactive properties. During session switching, `activeSession` changes, which triggers watchers 1, 2, 3, and potentially 4 and 5.

**Real-world consequence:** Session switching triggers a cascade of watcher evaluations and side effects (live channel stream start/stop, session history refresh, runner sync).

**Fix:** Consolidate related watchers. Use `watchEffect` with explicit dependency tracking where possible. Debounce side effects like `startLiveChannelStream` and `sessionHistory.refresh`.

---

## 15. `startLiveChannelStream` Watcher Fires on Every Session Change ✅

`app/pages/index.vue:420-427`

```ts
watch(
    () => canUseHostApi(activeHost.value)
        ? activeSession.value?.sessionKey ?? ''
        : '',
    (sessionKey) => startLiveChannelStream(sessionKey || null),
    { immediate: true },
);
```

`startLiveChannelStream` (line 349-372) calls `stopLiveChannelStream()`, then checks `canUseHostApi` and `isExternalChannelSession`. For the vast majority of sessions (non-external-channel), it aborts the previous controller and returns early.

**Why this is bad:** Every session switch aborts any live channel stream and re-evaluates the external channel check. The `stopLiveChannelStream()` call aborts the controller even when no stream was active (no-op abort, but still creates/assigns a new controller).

**Real-world consequence:** Minor overhead on every session switch, but it's unnecessary work for 99% of sessions.

**Fix:** Guard the watcher to only fire when the session key actually changes to/from an external channel session. Or move the external channel check into the watcher condition.

---

## 16. `useSessionHistory.sessions` Computed Merges and Sorts on Every Access ✅

`app/composables/useSessionHistory.ts:176-207`

```ts
const sessions = computed(() => {
    const merged = new Map<string, ChatSessionMeta>();
    for (const meta of backendSessions.value) {
        merged.set(meta.session_key, meta);
    }
    const localSessions = chat.sessions?.value ?? [];
    const activeMessages = chat.messages?.value ?? [];
    for (const local of localSessions) {
        const localMeta = localSessionToMeta(local, ...);
        const existing = merged.get(localMeta.session_key);
        merged.set(localMeta.session_key, mergeSessionMeta(existing, localMeta));
    }
    return [...merged.values()].sort(...);
});
```

`localSessionToMeta` (line 86-121) does `[...activeMessages].reverse().find(...)` for the active session. This copies and reverses the entire active session's messages array.

**Why this is bad:** This computed depends on `backendSessions`, `chat.sessions`, `chat.messages`, and `chat.activeSession`. Any change to any of these triggers a full re-merge. During streaming, `chat.messages` changes on every frame (because the `messages` computed re-evaluates), which invalidates this computed.

**Real-world consequence:** The sidebar session list re-computes on every streaming frame. With many sessions, this is expensive.

**Fix:** The sidebar doesn't need real-time updates during streaming. Debounce the sidebar session list, or compute it from a less reactive source that doesn't change during streaming.

---

## 17. `sessions` Computed in `useChatSessions` Filters by Host on Every Access ✅

`app/composables/useChatSessions.ts:272-276`

```ts
const sessions = computed(() =>
    cache.state.value.sessions.filter(
        (session) => session.hostId === activeHost.value?.id,
    ),
);
```

**Why this is bad:** This re-evaluates whenever `cache.state.value.sessions` or `activeHost.value` changes. Since `sessions` is a dependency of `activeSession`, `messages`, `draftKey`, and `useSessionHistory.sessions`, any invalidation cascades through the entire chat system.

**Real-world consequence:** Adding a session (e.g., during `activateSessionByKey`) invalidates `sessions`, which invalidates `activeSession`, which invalidates `messages`, which invalidates the `ChatMessageList` and the sidebar.

**Fix:** This is structurally fine as a computed, but consider whether the filter is necessary on every evaluation. If the host rarely changes, a `watch` that updates a ref might be cheaper than a computed that re-filters on every session add/remove.

---

## 18. `applyMessagePatch` Uses `Object.assign` on Reactive Objects ✅

`app/composables/useChatSessions.ts:486`

```ts
Object.assign(message, patch);
```

**Why this is bad:** `Object.assign` sets each property individually on the reactive proxy, triggering Vue's reactivity system for each property. A patch with 5 properties triggers 5 separate reactivity notifications, which cascade to all dependents.

**Real-world consequence:** During `hydrateBackendMessages`, each `updateMessage` call with a large patch (lines 1000-1095 have patches with 10+ properties) triggers 10+ reactivity cascades. With 100 messages, that's 1000+ reactivity notifications.

**Fix:** Batch reactivity updates. Vue 3's `triggerRef` or wrapping in a single reactive assignment would help. Alternatively, build the complete message object and replace it in the array in one operation.

---

## 19. `ChatSessionsSidebar` Search Creates a New String Per Session Per Keystroke ✅

`app/components/desktop/sidebars/ChatSessionsSidebar.vue:154-174`

```ts
const visibleSessions = computed(() => {
    const q = query.value.trim().toLowerCase();
    return props.sessions.filter((s) => {
        ...
        if (!q) return true;
        return [s.title, s.last_message_preview, s.runner_label, s.runner_id]
            .filter(Boolean)
            .join(' ')
            .toLowerCase()
            .includes(q);
    });
});
```

**Why this is bad:** For each session, on every keystroke, this creates an array, filters it, joins it, lowercases it, and searches it. With 50 sessions and fast typing, that's hundreds of string allocations per second.

**Real-world consequence:** Search input feels laggy with many sessions. Each keystroke triggers N string operations.

**Fix:** Debounce the search input. Pre-compute a lowercase search string for each session and cache it. Or use a simpler search that doesn't allocate intermediate arrays.

---

## 20. `groupedSessions` Computed Sorts and Buckets on Every Change ✅

`app/components/desktop/sidebars/ChatSessionsSidebar.vue:181-210`

```ts
const groupedSessions = computed<SessionGroup[]>(() => {
    const sorted = [...visibleSessions.value].sort(
        (a, b) => (b.last_message_at || b.updated_at || 0) - (a.last_message_at || a.updated_at || 0),
    );
    for (const s of sorted) {
        const ts = s.last_message_at || s.updated_at || 0;
        if (ts >= todayStart) today.push(s);
        ...
    }
    ...
});
```

**Why this is bad:** Creates a full copy, sorts it, then iterates to bucket. Depends on `visibleSessions` which depends on `sessions` which changes during streaming (see issue #16).

**Real-world consequence:** Sidebar re-renders during streaming even though the sidebar content hasn't meaningfully changed.

**Fix:** Debounce the sidebar grouping. Or disconnect it from the streaming-reactive `messages` computed.

---

## 21. Module-Level `ref()` Singletons in `useAssistantStream` ✅

`app/composables/useAssistantStream.ts:42-48`

```ts
const isStreaming = ref(false);
const activeJobId = ref<string | null>(null);
const chatMode = ref<'ask' | 'work' | 'admin'>('work');
const serviceCapabilityCeilingHosts = loadPersistedServiceCapabilityCeilingHosts();
let controller: AbortController | null = null;
let chatStreamInitialized = false;
```

**Why this is bad:** These are module-level singletons. They persist across the entire app lifetime. If the module were ever hot-reloaded during development, the old refs persist while new ones are created, leading to stale state. The `controller` variable is a raw `let` — if two `send()` calls somehow overlap (the `isStreaming` guard should prevent this, but race conditions exist), the first controller reference is lost.

**Real-world consequence:** HMR during development causes ghost streaming state. The "stop" button may not work if the controller reference was lost during a hot reload.

**Fix:** Move these into a `useState` or a proper store pattern. For the controller, store it on the reactive state so it survives HMR.

---

## 22. `recoveryAttempted` Set in `useStreamRecovery` Has Unbounded Growth Potential ✅

`app/composables/assistant-stream/useStreamRecovery.ts:22`

```ts
const recoveryAttempted = new Set<string>();
```

Keys are added at line 111 and deleted in the `finally` block at line 133. However, the `finally` block also calls `recoverPendingMessages()` recursively via `queueMicrotask` (line 135-137) if streaming is not active. If a message stays in a recoverable state but recovery keeps failing (e.g., network issues), the key is added, deleted, then re-added on the next microtask, creating a tight loop.

**Why this is bad:** The recursive `queueMicrotask` call at line 135-137 can create a microtask storm if recovery keeps failing. Each iteration adds and removes from the Set, but the microtask queue grows.

**Real-world consequence:** If the network is down and a streaming message is stuck, the recovery watcher creates a microtask loop that burns CPU.

**Fix:** Add a retry limit or exponential backoff. Don't recursively call `recoverPendingMessages` from the `finally` block — let the watcher re-trigger it naturally.

---

## 23. `useApprovalHydration` Watcher Has a Complex Multi-Source Dependency ✅

`app/composables/assistant-stream/useApprovalHydration.ts:141-157`

```ts
stopApprovalHydrationWatch = watch(
    [
        () => options.activeHost.value?.id ?? '',
        () => options.activeHost.value?.pairedToken || options.activeHost.value?.token || ... ? 'ready' : 'none',
        () => options.chat.activeSession.value?.sessionKey ?? '',
        () => options.isStreaming.value,
    ],
    () => { void hydratePendingApprovalsForActiveSession(); },
    { immediate: true },
);
```

**Why this is bad:** The second getter accesses `pairedToken`, `token`, and `authMode` — all reactive properties. Any change to any of these triggers the watcher. During session switching, `activeSession` changes, which triggers this watcher, which makes an API call to `/internal/v1/approvals?status=pending`. This is an unnecessary network request for most session switches.

**Real-world consequence:** Every session switch triggers an approvals API call, adding latency and network overhead.

**Fix:** Only hydrate approvals when the session actually has pending approvals (check local state first). Debounce the API call.

---

## 24. `useSessionHistory.refresh()` Has Retry Logic That Delays UI ✅

`app/composables/useSessionHistory.ts:234-248`

```ts
for (let attempt = 0; attempt < 3; attempt++) {
    if (attempt > 0) await delay(250 * attempt);
    try {
        const response = await api.request<ChatSessionListResponse>(...);
        ...
    } catch (err) {
        lastError = err;
        if (!isRetryableSessionListError(err) || attempt >= 2) break;
    }
}
```

**Why this is bad:** On 503/429 errors, this retries with delays of 250ms and 500ms. The `loading` ref stays `true` during this entire period. The sidebar shows "Loading conversations…" for up to 750ms+ of retry delays.

**Real-world consequence:** If the service is briefly unavailable, the sidebar is blocked for over a second.

**Fix:** Show stale data immediately while retrying in the background. Don't block the UI on retries.

---

## 25. `Or3Scroll` Virtualization Estimate May Cause Layout Thrash ✅ (estimate 160px)

`app/components/assistant/ChatMessageList.vue:2-16`

```html
<Or3Scroll
    :items="messages"
    item-key="id"
    :estimate-height="112"
    :overscan="400"
    :maintain-bottom="true"
    :bottom-threshold="24"
    :autoscroll-threshold="2"
    :tail-count="4"
    :padding-top="72"
    :padding-bottom="effectivePaddingBottom"
>
```

The `estimate-height` of 112px is a fixed estimate. Chat messages vary wildly in height (a single-line user message vs. a multi-paragraph assistant message with code blocks and tool calls). When the actual height differs significantly from the estimate, the virtualizer miscalculates scroll position, causing jumps.

**Why this is bad:** During streaming, the active message grows continuously. The estimate of 112px is wrong for a streaming message that may be 500px+ tall. This causes the virtualizer to miscalculate which items are visible, leading to scroll jumps and re-measurements.

**Real-world consequence:** Scroll position jumps during streaming. The "scroll to bottom" behavior fights with the virtualizer's measurements.

**Fix:** Use a larger estimate for assistant messages. Or use dynamic measurement with a cache that persists across re-renders. Consider whether `maintain-bottom` mode handles the growing last item correctly.

---

## Summary: Top Priority Fixes for Speed

1. **Don't clear messages before hydration** (Issue #1) — eliminates the empty state flash
2. **Show cached messages instantly, hydrate in background** (Issue #2) — eliminates the switching delay
3. **Batch `persist()` calls during hydration** (Issue #4, #5, #6) — eliminates the O(n²) hydration cost
4. **Add a message ID index** (Issue #7) — O(1) lookups during streaming
5. **Debounce `persist()`** (Issue #4) — stops localStorage from blocking the main thread
6. **Consolidate watchers in `index.vue`** (Issue #14) — reduces cascade re-evaluations on session switch
7. **Disconnect sidebar from streaming reactivity** (Issue #16, #20) — stops unnecessary sidebar re-renders during streaming
