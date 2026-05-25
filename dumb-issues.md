# Dumb Issues: Chat Leaks And Streaming Jank

Scope: main chat, Doctor/Admin chat, and adjacent leak-prone areas in `or3-app`.

This does not look like one clean detached-DOM memory leak. The nastier problem is repeated full-state work while a message streams. That still feels like a leak to the user because CPU, GC pressure, synchronous storage writes, and reactive invalidation pile up as the answer grows.

## ~~Streaming Writes The Whole App State On Every Token~~ Fixed

Status: fixed. Main assistant streaming now batches live message mutations and skips persistence during token flow, then flushes the final message state once the turn settles.

Location: `app/composables/assistant-stream/useAssistantMessageState.ts:85-90`, `app/composables/useChatSessions.ts:417-425`, `app/composables/useLocalCache.ts:209`

```ts
const appendAssistantContent = (value: string) => {
    rawAssistantContent += value;
    updateAssistant({
        content: sanitizeAssistantText(rawAssistantContent),
    });
};

function updateMessage(id: string, patch: Partial<ChatMessage>) {
    const message = cache.state.value.messages.find((item) => item.id === id);
    if (!message) return;
    Object.assign(message, patch);
    touchSession(message.sessionId);
    syncSessionMessageSummary(message.sessionId);
    cache.persist();
}

localStorage.setItem(STORAGE_KEY, JSON.stringify(serializableState()));
```

Why this is bad: every text delta calls `updateMessage`, which scans local messages, updates the session summary, serializes the entire app state, and writes it to `localStorage`. `localStorage` is synchronous. `JSON.stringify(serializableState())` gets more expensive as chat history and the currently streaming answer grow.

Real-world consequence: long streamed replies will stutter. The browser has to repeatedly serialize an expanding state object on the main thread while Vue is also rendering the same expanding text. This is a prime suspect for the slowdown that showed up during streaming.

Concrete fix: keep live streaming text in turn-local state and flush to persisted chat state on a timer or at terminal events only. For example, batch UI updates with `requestAnimationFrame` and persist final content once the stream completes. If crash recovery needs partial content, persist at a coarse cadence like every 1-2 seconds, not every token.

## ~~Markdown Repair Reparses The Entire Growing Reply~~ Fixed

Status: fixed. The app wrapper no longer runs local markdown repair; it lets `streamdown-vue` handle incomplete markdown. The upstream underscore-in-inline-code bug is covered by a Bun patch for `streamdown-vue@1.0.29` and a regression test.

Location: `app/components/assistant/StreamingMarkdown.vue:27-31`, `app/utils/streamingMarkdown.ts:42-52`

```ts
const renderedContent = computed(() =>
    repairStreamingMarkdownContent(
        props.content,
        props.repairIncompleteMarkdown,
    ),
);

export function repairStreamingMarkdownContent(
    content: string,
    repairIncompleteMarkdown: boolean,
): string {
    if (!repairIncompleteMarkdown || !content) return content;

    const closedContent = closeOpenCodeFence(content);
    const { masked, codeSpans } = maskBalancedCodeSpans(closedContent);
    const repaired = parseIncompleteMarkdown(masked);
    const restored = restoreBalancedCodeSpans(repaired, codeSpans);

    return restored;
}
```

Why this is bad: every content change runs full markdown repair over the whole answer. That function splits the full string into lines, regex-masks code spans, calls `parseIncompleteMarkdown`, and restores placeholders. Then `StreamMarkdown` still has to render the result. This is O(n) per token and O(n^2) over a long response.

Real-world consequence: the longer the assistant response gets, the more each new token costs. Code blocks and inline code make it worse. This is exactly the shape of "chat got slow while a message was streaming."

Concrete fix: throttle markdown repair/rendering to animation frames or a short interval. Only repair incomplete markdown for the visible tail, or render plain streaming text until a frame boundary and run the expensive repair after chunk coalescing. Completed messages already do not need incomplete repair; keep that behavior.

## ~~Main Chat Clones And Searches Reactive State Per Fragment~~ Fixed

Status: fixed. The main stream applier now keeps a turn-local assistant draft and commits coalesced patches on animation frames instead of searching and mutating reactive chat state for every fragment.

Location: `app/composables/assistant-stream/useAssistantMessageState.ts:75-166`

```ts
const readAssistant = () =>
    options.chat.messages.value.find((item) => item.id === options.assistantId);

const upsertPart = (part: ChatMessagePart) => {
    const current = readAssistant();
    const parts = [...(current?.parts ?? [])];
    const index = parts.findIndex((item) => item.id === part.id);
    // ...
    updateAssistant({ parts });
};

const appendTextPart = (value: string) => {
    const partId = ensureActiveTextPart();
    activeTextPartRaw += value;
    const content = sanitizeAssistantText(activeTextPartRaw);
    if (!content) return;
    upsertPart({
        id: partId,
        type: 'text',
        content,
    });
};
```

Why this is bad: the stream applier searches the computed message list, clones the parts array, scans the parts array, grows a raw string, sanitizes the whole raw string, and updates Vue state for every fragment. This happens before the storage write problem even starts.

Real-world consequence: streaming cost grows with message count, part count, and answer length. Long chats and tool-heavy turns will allocate garbage constantly and make GC fight the renderer.

Concrete fix: keep a direct reference or index for the active assistant message during the turn. Mutate a small `shallowRef`/draft object for live fragments, coalesce part changes, and commit a normalized `ChatMessage` only at frame cadence or stream completion.

## ~~Admin Chat Rewrites The Whole Message Array Per Fragment~~ Fixed

Status: fixed. Doctor/Admin streaming updates now replace the active message by index instead of mapping the whole global message array for each delta.

Location: `app/composables/useDoctorAdminChat.ts:241-248`, `app/composables/useDoctorAdminChat.ts:321-348`, `app/composables/useDoctorAdminChat.ts:420-423`

```ts
function mutateStreamingAssistant(
    id: PlaceholderID,
    mutate: (message: DoctorMessageState) => DoctorMessageState,
) {
    const key = messageIdKey(id);
    store().messages.value = store().messages.value.map((message) =>
        messageIdKey(message.id ?? '') === key ? mutate(message) : message,
    );
}

appendAssistantContent: (value) =>
    mutateStreamingAssistant(placeholderID, (message) => ({
        ...message,
        content: `${message.content ?? ''}${value}`,
    })),
```

Why this is bad: every streamed Doctor/Admin token maps over the entire global message array and creates a new array. Text-part updates also map the parts array and concatenate growing strings. The active turn is one message; the code invalidates the entire conversation.

Real-world consequence: the Admin chat gets slower as the conversation grows. It allocates a new message array on every fragment, which forces downstream computed values and render watchers to redo work that has nothing to do with the new token.

Concrete fix: store the active streaming message separately while the turn is live, or update by index with a batched `shallowRef`/`triggerRef` pattern. Do not rebuild `store().messages.value` for every single delta.

## ~~Admin Chat Rebuilds Its Entire Display Model On Every Delta~~ Fixed

Status: fixed. Doctor/Admin display messages are now rebuilt through a frame-batched `shallowRef`, and the scroll follow-up runs after the coalesced display update instead of every raw delta.

Location: `app/components/settings/SettingsHealthChat.vue:810-817`, `app/components/settings/SettingsHealthChat.vue:1367-1372`, `app/utils/doctor/doctorMessageModel.ts:1257-1316`

```ts
const doctorChatMessages = computed(() =>
    buildDoctorChatDisplayMessages(chat.messages.value, {
        isCardDismissed: isDoctorCardDismissed,
        stripUserPrompt: scrubDoctorUserMessageContent,
    }).map((message) => ({
        ...message,
        activityLog: doctorShowActivityLog(message) ? message.activityLog : [],
    })),
);

watch([doctorChatMessages, () => chat.loading.value], async () => {
    await nextTick();
    scrollDoctorMessagesToBottom(false);
});
```

Why this is bad: `buildDoctorChatDisplayMessages` sorts all Doctor messages and collapses assistant turns. The component then maps all display messages and schedules a scroll pass. Because `doctorChatMessages` depends on `chat.messages.value`, every streamed fragment rebuilds the whole display model.

Real-world consequence: Admin chat performs full conversation transforms and DOM scroll work for each incoming token. Long Doctor sessions with cards, tools, and approvals will visibly bog down.

Concrete fix: make the display model incremental. Cache collapsed turns by raw message id/generation, recompute only the active turn, and throttle scroll-to-bottom work to animation frames. Use the same virtualized list strategy as main chat if Admin chat can grow past a handful of messages.

## ~~Doctor Approval Hydration Leaves A Permanent Document Listener~~ Fixed

Status: fixed. Doctor approval hydration now returns a cleanup function, reference-counts consumers, and removes its `visibilitychange` listener when no component owns it.

Location: `app/composables/doctor/useDoctorApprovalHydration.ts:158-183`

```ts
const installDoctorApprovalHydrationWatcher = () => {
    if (!import.meta.client || doctorApprovalHydrationWatcherInstalled) {
        return;
    }
    doctorApprovalHydrationWatcherInstalled = true;
    watch(
        () => ({
            hostId: activeHost.value?.id ?? '',
            token:
                activeHost.value?.token ||
                activeHost.value?.authMode === 'secure-session'
                    ? 'ready'
                    : 'none',
            sessionKey: store.sessionKey.value ?? '',
            streaming: store.loading.value,
        }),
        () => {
            void hydratePendingDoctorApprovals();
        },
        { immediate: true },
    );
    if (typeof document !== 'undefined') {
        document.addEventListener('visibilitychange', () => {
            if (document.visibilityState === 'visible') {
                void hydratePendingDoctorApprovals();
            }
        });
    }
};
```

Why this is bad: a component calls this installer, but the installer creates app-lifetime side effects and returns no disposer. The anonymous `visibilitychange` listener cannot be removed. It retains the closure and keeps firing after the Admin chat is gone.

Real-world consequence: hidden background work survives route changes. In long-running Electron/mobile sessions, this is the kind of small leak that becomes impossible to reason about after enough global listeners accumulate.

Concrete fix: either install this once from an app plugin and document it as app-lifetime behavior, or return cleanup handles and call them from `onUnmounted`. Do not add anonymous global listeners from a route component.

## ~~Doctor Chat Host Watcher Is Installed Per Consumer~~ Fixed

Status: fixed. Doctor host-switch reset logic is installed once in a detached effect scope, so components consume the global store without each installing their own reset watcher.

Location: `app/composables/useDoctorAdminChat.ts:1007-1022`, `app/components/approvals/ApprovalsPanel.vue:237`, `app/components/settings/SettingsHealthChat.vue:660`

```ts
export function useDoctorAdminChat() {
    const api = useOr3Api();
    const authSession = useAuthSession();
    const approvals = useApprovals();
    const { activeHost } = useActiveHost();

    watch(
        () => activeHost.value?.id ?? 'default',
        (hostId, previousHostId) => {
            if (!previousHostId || hostId === previousHostId) return;
            store().bumpMessageGeneration();
            store().activeSendPromise = null;
            stopStreaming();
            store().sessionKey.value = null;
            store().messages.value = [];
            // ...
        },
    );
```

Why this is bad: `useDoctorAdminChat()` returns a global store, but it also installs a host-switch watcher every time a consumer calls it. The Admin chat and Approvals panel both call it. Vue will clean up component-scoped watchers on unmount, but while both consumers are mounted the same global store reset logic is duplicated.

Real-world consequence: host changes can abort streams, clear messages, and hydrate persisted sessions more than once. This is not a clean ownership model. It is how global-state code turns into heisenbugs when another component imports the composable later.

Concrete fix: move the host-switch watcher into the global store initializer or guard it with a module-level installer that has explicit cleanup semantics. Consumers should read actions/state, not secretly install global reset behavior.

## ~~Approval Resolution Caches Never Expire~~ Fixed

Status: fixed. Main chat and Doctor approval resolution caches are now bounded LRU-style collections instead of lifetime-only growth buckets.

Location: `app/composables/useChatSessions.ts:19`, `app/composables/useChatSessions.ts:511-518`, `app/composables/doctor/useDoctorApprovalHydration.ts:14`, `app/composables/doctor/useDoctorApprovalHydration.ts:29-37`

```ts
const resolvedApprovalKeys = new Set<string>();

function markApprovalResolved(
    approvalRequestId: number | string | undefined,
    state: NonNullable<ChatMessage['approvalState']>,
    sessionKey?: string,
    error?: string,
) {
    const keys = approvalResolutionKeys(approvalRequestId, sessionKey);
    for (const key of keys) resolvedApprovalKeys.add(key);
    // ...
}

const resolvedDoctorApprovals = ref<Record<string, string>>({});

export function markDoctorApprovalResolved(
    approvalId: number | string,
    state: string,
    sessionKey?: string,
) {
    const key = sessionKey?.trim();
    if (!key) return;
    resolvedDoctorApprovals.value = {
        ...resolvedDoctorApprovals.value,
        [resolutionKey(key, approvalId)]: state,
    };
}
```

Why this is bad: every resolved approval id gets kept for the lifetime of the app. There is no TTL, no cap, and no cleanup when sessions are cleared, hosts switch, or approvals age out.

Real-world consequence: approval-heavy usage steadily grows memory. The Doctor version also copies the entire record on every insert, so it gets slower as the cache grows.

Concrete fix: use a bounded LRU keyed by host/session/approval id, prune on session clear and host switch, or persist only currently pending approvals and drop resolved entries after a short TTL.

## ~~Persisted Chat History Has No Pruning~~ Fixed

Status: fixed. Local cache persistence now prunes old sessions, old per-session messages, and stale drafts while preserving active sessions plus pinned, streaming, and attention messages.

Location: `app/composables/useLocalCache.ts:9-16`, `app/composables/useChatSessions.ts:399-413`

```ts
const defaultState = (): Or3AppState => ({
    activeHostId: null,
    hosts: [],
    sessions: [],
    messages: [],
    drafts: {},
    recentJobs: {},
    lastKnownStatus: {},
    preferences: {},
});

function addMessage(
    message: Omit<ChatMessage, 'id' | 'createdAt'> &
        Partial<Pick<ChatMessage, 'id' | 'createdAt'>>,
) {
    const complete: ChatMessage = {
        id: message.id ?? createId('msg'),
        createdAt: message.createdAt ?? now(),
        ...message,
    };
    cache.state.value.messages.push(complete);
    // ...
    cache.persist();
    return complete;
}
```

Why this is bad: local app state keeps sessions and messages forever unless the user explicitly clears a conversation. The backend already has chat session history; the frontend cache should not act like an unbounded database.

Real-world consequence: every persisted state write gets heavier over time. Combined with per-token persistence, old chat history directly makes current streaming slower.

Concrete fix: keep only active-session messages plus a bounded recent cache per host. Hydrate older history from the backend on demand. At minimum, cap persisted messages and drafts per host/session and drop archived session payloads from local state.

## ~~Terminal Streams Survive Route Changes And Keep Buffering Output~~ Fixed

Status: fixed. Terminal sessions now expose a `detach()` action that aborts the live stream/WebSocket without closing the remote shell, and the terminal page calls it on route unmount.

Location: `app/composables/useTerminalSession.ts:14-26`, `app/composables/useTerminalSession.ts:367-398`, `app/pages/computer/terminal.vue:220-475`

```ts
const terminalLines = ref<string[]>([]);
const terminalChunks = ref<{ id: number; data: string }[]>([]);
let streamAbortController: AbortController | null = null;
let terminalSocket: WebSocket | null = null;

async function attach(sessionId = session.value?.session_id) {
    if (!sessionId) return;
    streamAbortController?.abort();
    closeTerminalSocket();
    streamAbortController = new AbortController();
    terminalStreaming.value = true;

    if (await attachWebSocket(sessionId)) return;

    try {
        for await (const event of api.stream(
            `/internal/v1/terminal/sessions/${sessionId}/stream`,
            {
                method: 'GET',
                signal: streamAbortController.signal,
            },
        )) {
            applyTerminalEvent(
                event.event,
                event.json as Record<string, any> | undefined,
            );
        }
    }
    // ...
}
```

Why this is bad: terminal state is module-level, `attach()` opens a stream or WebSocket, and the terminal page only mounts startup logic. There is no route unmount cleanup that detaches from the stream. The buffers are capped, but the live socket/stream still stays alive and keeps mutating global refs after the UI is gone.

Real-world consequence: navigate away from a noisy terminal and it can continue consuming network, CPU, and memory. This is not the chat slowdown, but it is the same lifecycle smell in an adjacent streaming surface.

Concrete fix: export a `detach()` action that aborts `streamAbortController` and closes the WebSocket without necessarily closing the remote terminal session. Call it from `onBeforeUnmount` in the terminal page. Keep `close()` for actually closing the server-side terminal.
