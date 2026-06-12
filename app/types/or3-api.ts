export type CronScheduleKind = 'at' | 'every' | 'cron';

export interface CronSchedule {
    kind: CronScheduleKind;
    at_ms?: number;
    every_ms?: number;
    expr?: string;
    tz?: string;
}

export interface CronAgentRunPayload {
    runner_id: string;
    task: string;
    timeout_seconds?: number;
    cwd?: string;
    model?: string;
    mode?: AgentRunMode | string;
    isolation?: AgentRunIsolation | string;
    max_turns?: number;
    meta?: Record<string, unknown>;
}

export interface CronPayload {
    kind: 'system_event' | 'runner_run' | string;
    message?: string;
    deliver?: boolean;
    channel?: string;
    to?: string;
    session_key?: string;
    agent_run?: CronAgentRunPayload;
}

export interface CronJobState {
    next_run_at_ms?: number | null;
    last_run_at_ms?: number | null;
    last_status?: 'ok' | 'error' | 'skipped' | string;
    last_error?: string;
    last_enqueued_job_id?: string;
    last_enqueued_run_id?: string;
}

export interface CronJob {
    id: string;
    name: string;
    enabled: boolean;
    schedule: CronSchedule;
    payload: CronPayload;
    state?: CronJobState;
    created_at_ms?: number;
    updated_at_ms?: number;
    delete_after_run?: boolean;
}

export interface CronStatusResponse {
    enabled?: boolean;
    available?: boolean;
    jobs?: number;
    next_wake_at_ms?: number | null;
}

export interface CronJobsResponse {
    items: CronJob[];
}

export interface CronJobResponse {
    job: CronJob;
}

// ── External Agent CLI Delegation ──

export type AgentRunnerId =
    | 'opencode'
    | 'codex'
    | 'claude'
    | 'gemini'
    | string;

export type AgentRunnerStatus =
    | 'available'
    | 'missing'
    | 'not_executable'
    | 'auth_missing'
    | 'auth_unknown'
    | 'unsupported_version'
    | 'disabled_by_config'
    | 'error';

export type AgentRunnerAuthStatus = 'ready' | 'missing' | 'unknown';

export interface AgentRunnerSupports {
    structuredOutput: boolean;
    streamingJson: boolean;
    modelFlag: boolean;
    permissionsMode: boolean;
    safeSandboxFlag: boolean;
    dangerousBypassFlag: boolean;
    stdinPrompt: boolean;
    maxTurns?: boolean;
    chat?: RunnerChatCapabilities;
}

export type RunnerChatContinuationMode = 'replay' | 'native';

export interface RunnerChatCapabilities {
    chatSelectable?: boolean;
    chatReplay?: boolean;
    chatNativeSession?: boolean;
    chatResume?: boolean;
    chatSessionRefExtractable?: boolean;
    streamToolEvents?: boolean;
    supportsNativeFork?: boolean;
}

export interface AgentRunnerInfo {
    id: AgentRunnerId;
    display_name: string;
    binary_name?: string;
    binary_path?: string;
    version?: string;
    status: AgentRunnerStatus;
    disabled_reason?: string;
    auth_status?: AgentRunnerAuthStatus;
    supports: AgentRunnerSupports;
    default_args_preview?: string[];
    runtime?: RunnerRuntimeInfo;
    models?: RunnerModelInfo[];
    default_model?: string;
}

export interface RunnerModelInfo {
    id: string;
    display_name?: string;
    provider?: string;
    provider_name?: string;
    default?: boolean;
    reasoning?: string[];
    reasoning_default?: string;
    options?: RunnerModelOption[];
    capabilities?: RunnerModelCapabilities;
}

export interface RunnerModelCapabilities {
    reasoning?: boolean;
    fast_mode?: boolean;
    tool_use?: boolean;
    vision?: boolean;
}

export interface RunnerModelOption {
    id: string;
    label?: string;
    kind: 'mode' | 'isolation' | 'thinking_level' | string;
    values?: { id: string; label?: string; default?: boolean }[];
    default?: string;
}

export interface RunnerRuntimeInfo {
    kind?: 'cli' | 'native';
    mode?: 'auto' | 'native' | 'cli';
    state?: 'unavailable' | 'ready' | 'starting' | 'error' | 'fallback';
    ownership?: 'none' | 'managed' | 'external' | 'unknown';
    endpoint?: string;
    message?: string;
    fallback?: boolean;
    fallback_reason?: string;
    models?: RunnerModelInfo[];
    default_model?: string;
    /**
     * Suggested next action for the user when the runtime is in a
     * non-ready state (e.g. "authenticate", "install", "restart").
     */
    next_action?: string;
    /** Human-readable, single-sentence runtime message for the UI. */
    runtime_message?: string;
    /** Detailed auth state (account, key hint, validation errors). */
    auth_detail?: RunnerAuthDetail;
    /** Available providers as advertised by the runtime. */
    providers?: RunnerProviderInfo[];
    /** Available agents / modes the runtime exposes. */
    agents?: RunnerAgentInfo[];
    /** Available skills the runtime can invoke. */
    skills?: RunnerSkillInfo[];
    /** Allowed runtime options (mode / isolation / etc). */
    runner_options?: RunnerRuntimeOption[];
    /** Liveness, build version, and last-known probe timestamp. */
    native_health?: RunnerNativeHealth;
    /** Backend-native health snapshot (`runtime.health` from discovery). */
    health?: RunnerNativeHealth;
}

export interface RunnerAuthDetail {
    state: 'ready' | 'missing' | 'expired' | 'unknown' | string;
    account?: string;
    source?: string;
    message?: string;
    scopes?: string[];
    expires_at?: number;
}

export interface RunnerProviderInfo {
    id: string;
    name?: string;
    type?: string;
    auth_state?: 'ready' | 'missing' | 'unknown' | string;
    account?: string;
    default_model?: string;
    models?: string[];
}

export interface RunnerAgentInfo {
    name: string;
    display_name?: string;
    description?: string;
    default?: boolean;
    built_in?: boolean;
    mode?: string;
}

export interface RunnerSkillInfo {
    id: string;
    name?: string;
    description?: string;
    version?: string;
    trust_state?: string;
    enabled?: boolean;
}

export interface RunnerRuntimeOption {
    id: string;
    label?: string;
    kind: 'mode' | 'isolation' | 'thinking_level' | string;
    values: { id: string; label?: string; default?: boolean }[];
    default?: string;
}

export interface RunnerNativeHealth {
    state?: 'unavailable' | 'ready' | 'starting' | 'error' | 'fallback' | string;
    reachable?: boolean;
    pid?: number;
    endpoint?: string;
    started_at?: number;
    last_checked_at?: number;
    last_heartbeat_at?: number;
    latency_ms?: number;
    server_version?: string;
    /** Backend probe summary (`detail`); normalized to `message` in the app. */
    detail?: string;
    message?: string;
    next_action?: string;
    version?: string;
    auth_status?: string;
    auth_detail?: string;
}

export interface AgentRunnersResponse {
    runners: AgentRunnerInfo[];
}

export interface ChatRunnerInfo extends AgentRunnerInfo {
    chat_capabilities?: RunnerChatCapabilities;
    default_mode?: string;
    default_isolation?: string;
    default_cwd?: string;
    /** Normalized from `runtime.health` / `runtime.native_health` in the app. */
    native_health?: RunnerNativeHealth;
}

export interface ChatRunnersResponse {
    runners: ChatRunnerInfo[];
    /** Service default runner id (e.g. opencode). */
    default_runner?: string;
}

export type RunnerChatTurnStatus =
    | 'queued'
    | 'running'
    | 'succeeded'
    | 'approval_required'
    | 'failed'
    | 'aborted'
    | 'timed_out';

export interface RunnerPermissionRequest {
    runner_id?: string;
    kind?: string;
    access?: string;
    target_path?: string;
}

/**
 * Reference to a native runtime request (codex app-server or opencode
 * server) that the chat manager has surfaced for an interactive decision.
 */
export interface NativeRequestRef {
    runner_id?: AgentRunnerId;
    kind?: 'approval' | 'question' | 'input' | 'unknown' | string;
    request_id?: string;
    session_id?: string;
    thread_id?: string;
    method?: string;
    summary?: string;
    issued_at?: number;
}

/** Payload of an `approval_response` chat event. */
export interface ApprovalResponseEvent {
    status?: 'approval_response' | string;
    code?: string;
    decision?: 'approve' | 'reject' | 'cancel' | string;
    approval_id?: number;
    route?: 'native' | 'broker' | string;
    native_continued?: boolean;
    fallback_to_token?: boolean;
    allowlist_session?: boolean;
    runner_id?: AgentRunnerId;
    runner_chat_session_id?: string;
    runner_chat_turn_id?: string;
}

export interface RunnerChatSession {
    id: string;
    app_session_key: string;
    runner_id: AgentRunnerId;
    continuation_mode: RunnerChatContinuationMode | string;
    native_session_ref?: string;
    model?: string;
    mode?: string;
    isolation?: string;
    cwd?: string;
    max_turns?: number;
    meta?: unknown;
    created_at: number;
    updated_at: number;
}

export interface RunnerChatTurn {
    id: string;
    session_id: string;
    sequence: number;
    status: RunnerChatTurnStatus | string;
    continuation_mode: RunnerChatContinuationMode | string;
    requested_at: number;
    started_at?: number;
    completed_at?: number;
    user_message?: string;
    final_text?: string;
    error?: string;
    error_message?: string;
    runner_run_id?: string;
    runner_job_id?: string;
    user_message_id?: number;
    assistant_message_id?: number;
    model?: string;
    mode?: string;
    isolation?: string;
    cwd?: string;
}

export interface RunnerChatEvent {
    id?: number;
    turn_id: string;
    seq: number;
    ts?: number;
    type: string;
    stream?: string;
    text?: string;
    job_id?: string;
    payload?: RunnerChatEventPayload | Record<string, unknown> | unknown;
}

export type RunnerChatEventPayload =
    | TextDeltaEvent
    | ReasoningDeltaEvent
    | TurnPlanEvent
    | TurnDiffEvent
    | TurnCompletedEvent
    | RequestOpenedEvent
    | RequestResolvedEvent
    | TokenUsageEvent
    | ConfigWarningEvent
    | ModelRerouteEvent
    | SkillInvokedEvent
    | ApprovalRequiredEvent
    | ApprovalResponseEvent
    | RuntimeErrorEvent
    | Record<string, unknown>;

export interface TextDeltaEvent {
    type?: 'text_delta' | 'content.delta' | string;
    stream_kind?: string;
    delta?: string;
    raw?: unknown;
}

export interface ReasoningDeltaEvent {
    type?: 'reasoning_delta' | string;
    stream_kind?: string;
    delta?: string;
    raw?: unknown;
}

export interface TurnPlanEvent {
    type?: 'turn.plan.updated' | 'turn.proposed.delta' | string;
    plan?: unknown;
    explanation?: string;
    delta?: string;
    raw?: unknown;
}

export interface TurnDiffEvent {
    type?: 'turn.diff.updated' | string;
    unified_diff?: string;
    raw?: unknown;
}

export interface TurnCompletedEvent {
    type?: 'turn.completed' | string;
    state?: 'completed' | 'failed' | 'cancelled' | 'interrupted' | string;
    raw?: unknown;
}

export interface RequestOpenedEvent {
    type?: 'request.opened' | 'user-input.requested' | string;
    request_type?: string;
    detail?: string;
    args?: unknown;
    questions?: unknown;
    raw?: unknown;
}

export interface RequestResolvedEvent {
    type?: 'request.resolved' | 'user-input.resolved' | string;
    request_type?: string;
    decision?: string;
    answers?: unknown;
    resolution?: unknown;
    raw?: unknown;
}

export interface TokenUsageEvent {
    type?: 'token.usage' | string;
    usage?: {
        input_tokens?: number;
        output_tokens?: number;
        cached_input_tokens?: number;
        total_tokens?: number;
        model?: string;
    };
    raw?: unknown;
}

export interface ConfigWarningEvent {
    type?: 'config.warning' | string;
    code?: string;
    kind?: string;
    message?: string;
    context?: unknown;
    raw?: unknown;
}

export interface ModelRerouteEvent {
    type?: 'model.reroute' | string;
    from?: string;
    to?: string;
    reason?: string;
    raw?: unknown;
}

export interface SkillInvokedEvent {
    type?: 'skill.invoked' | string;
    skill_id?: string;
    name?: string;
    version?: string;
    trust_state?: string;
    raw?: unknown;
}

export interface ApprovalRequiredEvent {
    type?: 'approval_required' | string;
    status?: string;
    code?: string;
    approval_id?: number;
    approval_request_id?: number;
    approval_state?: 'pending' | 'approved' | 'denied' | 'canceled' | string;
    message?: string;
    runner_permission?: RunnerPermissionRequest;
    native_request_ref?: NativeRequestRef;
    raw?: unknown;
}

export interface RuntimeErrorEvent {
    type?: 'runtime.error' | string;
    message?: string;
    raw?: unknown;
}

export interface RunnerChatSessionRequest {
    app_session_key: string;
    runner_id: AgentRunnerId;
    continuation_mode?: RunnerChatContinuationMode | string;
    model?: string;
    mode?: string;
    isolation?: string;
    cwd?: string;
    max_turns?: number;
}

export interface RunnerChatTurnRequest {
    user_message: string;
    continuation_mode?: RunnerChatContinuationMode | string;
    model?: string;
    mode?: string;
    isolation?: string;
    cwd?: string;
    max_turns?: number;
    timeout_seconds?: number;
    meta?: Record<string, unknown>;
    approval_token?: string;
    runner_permission?: RunnerPermissionRequest;
}

export interface RunnerChatTurnStartResponse {
    session_id: string;
    turn_id: string;
    job_id?: string;
    status: RunnerChatTurnStatus | string;
}

export interface RunnerChatEventsResponse {
    events: RunnerChatEvent[];
}

export interface ChatSessionMeta {
    session_key: string;
    host_id?: string;
    title: string;
    runner_id?: AgentRunnerId;
    runner_label?: string;
    runner_chat_session_id?: string;
    runner_continuation_mode?: RunnerChatContinuationMode | string;
    runner_model?: string;
    runner_mode?: string;
    runner_isolation?: string;
    runner_cwd?: string;
    message_count?: number;
    last_message_preview?: string;
    last_message_at?: number;
    parent_session_key?: string;
    fork_anchor_message_id?: number;
    forked_from_runner_id?: AgentRunnerId | string;
    fork_strategy?: string;
    archived?: boolean;
    created_at?: number;
    updated_at?: number;
}

export interface ChatSessionListResponse {
    sessions: ChatSessionMeta[];
}

export interface ChatSessionCreateRequest {
    session_key: string;
    title?: string;
    runner_id?: AgentRunnerId;
    runner_label?: string;
}

export interface ChatSessionUpdateRequest {
    title?: string;
    archived?: boolean;
}

export interface ChatSessionForkRequest {
    new_session_key: string;
    anchor_message_id: number;
    target_runner_id?: AgentRunnerId | string;
    title?: string;
    allow_incomplete_anchor?: boolean;
    fork_strategy?: string;
}

export interface ChatHistoryMessage {
    id: number;
    session_key: string;
    role: 'user' | 'assistant' | 'system' | 'tool' | string;
    content: string;
    created_at: number;
    payload?: Record<string, unknown> | unknown;
}

export interface ChatMessagePageResponse {
    messages: ChatHistoryMessage[];
    next_cursor?: number;
}

export type AgentRunMode = 'review' | 'safe_edit' | 'sandbox_auto';
export type AgentRunIsolation =
    | 'host_readonly'
    | 'host_workspace_write'
    | 'sandbox_workspace_write'
    | 'sandbox_dangerous';

export interface RunnerRunRequest {
    parent_session_key: string;
    runner_id: AgentRunnerId;
    task: string;
    timeout_seconds?: number;
    cwd?: string;
    model?: string;
    mode?: AgentRunMode;
    isolation?: AgentRunIsolation;
    max_turns?: number;
    meta?: Record<string, unknown>;
}

export interface RunnerRunResponse {
    job_id: string;
    run_id?: string;
    status: 'queued' | 'running' | string;
}

export type PersistedRunnerRunStatus =
    | 'queued'
    | 'starting'
    | 'running'
    | 'succeeded'
    | 'failed'
    | 'aborted'
    | 'timed_out';

export interface PersistedRunnerRunJob {
    job_id: string;
    run_id?: string;
    kind: `runner:${string}` | string;
    runner_id: string;
    parent_session_key: string;
    task: string;
    status: PersistedRunnerRunStatus | string;
    requested_at: string;
    started_at?: string;
    completed_at?: string;
    updated_at: string;
    mode?: string;
    isolation?: string;
    model?: string;
    cwd?: string;
    stdout_preview?: string;
    stderr_preview?: string;
    final_text_preview?: string;
    error?: string;
    attempts?: number;
}

export interface RunnerRunListResponse {
    items: PersistedRunnerRunJob[];
}

export interface RunnerRunSseOutputEvent {
    type: 'output';
    ts?: string;
    seq?: number;
    job_id?: string;
    runner_id?: string;
    stream: 'stdout' | 'stderr';
    chunk: string;
}

export interface RunnerRunSseStructuredEvent {
    type: 'structured';
    ts?: string;
    seq?: number;
    job_id?: string;
    runner_id?: string;
    payload?: unknown;
}

export interface RunnerRunSseCompletionEvent {
    type: 'completion';
    ts?: string;
    job_id?: string;
    runner_id?: string;
    status: string;
    exit_code?: number;
    final_text_preview?: string;
    stdout_preview?: string;
    stderr_preview?: string;
    error_message?: string;
    duration_ms?: number;
    message?: string;
}

export interface RunnerRunSseErrorEvent {
    type: 'error';
    ts?: string;
    job_id?: string;
    runner_id?: string;
    code?: string;
    message?: string;
}

// ── Existing types ──

export interface JobEvent {
    type: string;
    message?: string;
    text?: string;
    final_text?: string;
    error?: string;
    created_at?: string;
    [key: string]: unknown;
}

export interface JobSnapshot {
    job_id: string;
    kind: string;
    status: 'queued' | 'running' | 'completed' | 'failed' | 'aborted' | string;
    created_at: string;
    updated_at: string;
    events?: JobEvent[];
    final_text?: string;
    error?: string;
    /** UI-friendly title (task line, populated by useJobs from cached metadata). */
    title?: string;
    /** Original task text. */
    task?: string;
    /** Optional category/priority/notify metadata captured at submit time. */
    category?: string;
    priority?: string;
    notify?: string;
    autoApprove?: boolean;
    started_at?: string;
    finished_at?: string;
    child_session_key?: string;
    parent_session_key?: string;
    /** Stored full-result artifact id when the final text exceeds the inline preview cap. */
    artifact_id?: string;
    /** External CLI delegation fields */
    runner_id?: string;
    runner_label?: string;
    mode?: string;
    isolation?: string;
    model?: string;
    cwd?: string;
    stdout_preview?: string;
    stderr_preview?: string;
    output_preview?: string;
    error_preview?: string;
    raw_events?: unknown[];
    structured_events?: unknown[];
    output_truncated?: boolean;
}

export interface PairingRequestResponse {
    id: number | string;
    request_id?: number | string;
    device_id: string;
    code: string;
    role: string;
    expires_at: string;
}

export interface PairingExchangeResponse {
    device_id: string;
    role: string;
    token: string;
}

export interface DeviceInfo {
    device_id: string;
    display_name?: string;
    role?: string;
    status?: string;
    created_at?: string;
    last_seen_at?: string;
}

export interface HealthResponse {
    status: string;
    runtimeAvailable?: boolean;
    jobRegistryAvailable?: boolean;
    approvalBrokerAvailable?: boolean;
    processId?: number;
    startedAt?: string;
}

export interface ReadinessResponse {
    status: string;
    ready: boolean;
    summary?: {
        status?: string;
        infoCount?: number;
        warnCount?: number;
        errorCount?: number;
        blockCount?: number;
        fixableCount?: number;
    };
    findings?: Array<{
        id?: string;
        area?: string;
        severity?: string;
        summary?: string;
        detail?: string;
        evidence?: string[];
        fixMode?: string;
        fixHint?: string;
        metadata?: Record<string, string>;
    }>;
}

export interface CapabilitiesResponse {
    runtimeProfile?: string;
    hostedPosture?: string;
    approvalModes?: Record<string, string>;
    execAvailable?: boolean;
    shellModeAvailable?: boolean;
    sandboxAvailable?: boolean;
    enabledMcpServers?: CapabilitiesMCPServerInfo[];
    mcpServers?: CapabilitiesMCPServerInfo[];
    [key: string]: unknown;
}

export type MCPTransport = 'stdio' | 'sse' | 'streamable-http' | string;

export interface MCPServerConfig {
    enabled: boolean;
    transport: MCPTransport;
    command?: string;
    args?: string[];
    env?: Record<string, string>;
    childEnvAllowlist?: string[];
    url?: string;
    headers?: Record<string, string>;
    toolTimeoutSeconds?: number;
    connectTimeoutSeconds?: number;
    allowInsecureHttp?: boolean;
}

export interface MCPServerStatus {
    connected: boolean;
    toolCount: number;
    tools?: string[];
    lastError?: string;
}

export interface MCPServerDetail {
    name: string;
    config: MCPServerConfig;
    status?: MCPServerStatus;
}

export interface MCPServersResponse {
    servers: MCPServerDetail[];
}

export interface MCPServerSaveResponse {
    ok: boolean;
    config_path?: string;
    restartRequired?: boolean;
}

export interface MCPServerToolInfo {
    name: string;
    description?: string;
}

export interface MCPServerTestResult {
    ok: boolean;
    toolCount?: number;
    tools?: MCPServerToolInfo[];
    error?: string;
}

export interface CapabilitiesMCPServerInfo {
    name: string;
    transport: string;
    toolCount: number;
    connected: boolean;
}

export interface AppBootstrapWarning {
    code: string;
    message: string;
    severity: 'info' | 'warning' | 'error' | string;
}

export interface AppActionDescriptor {
    id: string;
    title: string;
    available: boolean;
    disabled_reason?: string;
    session_required?: boolean;
    step_up_required?: boolean;
    approval_likely?: boolean;
}

export interface AppBootstrapResponse {
    host?: {
        id?: string;
        display_name?: string;
        version?: string;
    };
    pairing?: {
        paired?: boolean;
        device_id?: string;
        role?: string;
    };
    auth?: {
        session_required?: boolean;
        session_active?: boolean;
        step_up_active?: boolean;
        kind?: string;
        role?: string;
        exec_allowed?: boolean;
        capabilities?: {
            passkeys_supported?: boolean;
            step_up_supported?: boolean;
        };
    };
    status?: {
        health?: HealthResponse | null;
        readiness?: ReadinessResponse | null;
        capabilities?: CapabilitiesResponse | null;
        summary?: string;
        warnings?: AppBootstrapWarning[];
    };
    counts?: {
        pending_approvals?: number;
        active_jobs?: number;
        active_terminals?: number;
    };
    actions?: AppActionDescriptor[];
    features?: {
        app_bootstrap?: boolean;
        app_events?: boolean;
        app_actions?: boolean;
        file_metadata_v2?: boolean;
    };
}

export interface AppActionResponse {
    action_id: string;
    status:
        | 'accepted'
        | 'completed'
        | 'approval_required'
        | 'unsupported'
        | string;
    message?: string;
    approval_id?: number;
    operation_id?: string;
    log_path?: string;
}

export interface ApprovalModeratorMetadata {
    status?: string;
    risk?: string;
    action?: string;
    reason?: string;
    alternative?: string;
    model?: string;
    policy_hash?: string;
    reviewed_at?: number;
    latency_ms?: number;
}

export interface ApprovalRequest {
    id: number | string;
    status: string;
    type?: string;
    domain?: string;
    preview?: string;
    subject?: unknown;
    created_at?: string;
    expires_at?: string;
    requester_session_id?: string;
    requester_context?: {
        channel?: string;
        session_key?: string;
        from?: string;
        reply_target?: string;
        reply_meta?: Record<string, unknown>;
        source_message_id?: string;
    };
    moderator?: ApprovalModeratorMetadata;
}

export interface ApprovalActionResponse {
    request_id: number | string;
    token?: string;
    allowlist_id?: number | string;
    session_key?: string;
    status?: string;
}

export interface ApprovalAllowlist {
    id: number | string;
    domain?: string;
    scope?: Record<string, unknown>;
    matcher?: Record<string, unknown>;
    created_at?: string;
    expires_at?: string;
    status?: string;
}

export interface FileRoot {
    id: string;
    label: string;
    path?: string;
    writable?: boolean;
}

export interface FileEntry {
    name: string;
    path: string;
    type: 'file' | 'directory';
    size?: number;
    modified_at?: string;
    mime_type?: string;
}

export interface FileSearchItem extends FileEntry {
    root_id: string;
    root_label: string;
}

export interface FileListResponse {
    root_id: string;
    path: string;
    entries: FileEntry[];
}

export interface FileSearchResponse {
    root_id: string;
    query: string;
    items: FileSearchItem[];
}

export interface FileReadResponse {
    root_id: string;
    path: string;
    name: string;
    mime_type?: string;
    size?: number;
    modified_at?: string;
    revision: string;
    writable: boolean;
    content: string;
}

export interface FileWriteRequest {
    root_id: string;
    path: string;
    content: string;
    expected_revision?: string;
    create?: boolean;
}

export interface FileWriteResponse {
    root_id: string;
    path: string;
    status: 'written' | 'created' | string;
    modified_at?: string;
    revision: string;
}

export interface TerminalSessionSnapshot {
    session_id: string;
    root_id: string;
    path: string;
    cwd: string;
    shell: string;
    created_at: string;
    expires_at: string;
    last_active_at: string;
    status: string;
    rows: number;
    cols: number;
    approval_mode?: string;
    approval_id?: number;
    approval_state?: string;
    event_count?: number;
}

export interface CreateTerminalSessionRequest {
    root_id: string;
    path?: string;
    shell?: string;
    rows?: number;
    cols?: number;
    approval_token?: string;
}

export interface TerminalInputRequest {
    input: string;
}

export interface TerminalResizeRequest {
    rows?: number;
    cols?: number;
}

export interface ConfigureSectionSummary {
    key: string;
    label: string;
    description?: string;
    status?: string;
}

export interface ConfigureFieldOption {
    label?: string;
    value: string;
}

export interface ConfigureField {
    key: string;
    label: string;
    description?: string;
    /** active | compatibility — hidden fields are omitted from API responses. */
    status?: string;
    kind: 'text' | 'secret' | 'toggle' | 'boolean' | 'choice' | 'list' | string;
    value?: string | boolean | string[] | null;
    choices?: ConfigureFieldOption[] | string[];
    emptyHint?: string;
    placeholder?: string;
}

export interface ConfigureFieldsResponse {
    section: string;
    channel?: string;
    fields: ConfigureField[];
}

export interface ConfigureChange {
    section: string;
    channel?: string;
    field: string;
    op?: 'set' | 'toggle' | 'choose';
    value?: unknown;
}

export type DoctorRiskLevel = 'safe' | 'notice' | 'warning' | 'danger' | string;

export interface DoctorAdminBrainProvider {
    kind?: string;
    available: boolean;
    display_name?: string;
    runner_id?: string;
    reason?: string;
    actions?: string[];
}

export interface DoctorFindingCard {
    id: string;
    what_i_found: string;
    what_this_means?: string;
    recommended_fix?: string;
    risk_level?: DoctorRiskLevel;
    approval_needed?: boolean;
    restart_needed?: boolean;
    advanced_details?: unknown;
}

export interface DoctorStatusResponse {
    basic_doctor_available: boolean;
    admin_brain?: DoctorAdminBrainProvider;
    health?: unknown;
    readiness?: unknown;
    app_bootstrap?: unknown;
    report?: any;
    finding_cards?: DoctorFindingCard[];
    skills?: { count?: number; items?: SkillItem[] };
    recent_logs?: unknown[];
    pending_recovery?: unknown;
}

export interface DoctorConfigFieldMetadata {
    section: string;
    key: string;
    path: string;
    label: string;
    description?: string;
    default_value?: unknown;
    allowed_values?: string[];
    current_value?: unknown;
    secret?: boolean;
    risk_level?: DoctorRiskLevel;
    restart_required?: boolean;
    requires_approval?: boolean;
    requires_step_up_auth?: boolean;
    user_intents?: string[];
    advanced_only?: boolean;
    status?: string;
    docs?: string;
    rollback_behavior?: {
        safe?: boolean;
        manual_only?: boolean;
        restart_required?: boolean;
        instructions?: string;
    };
}

export interface DoctorConfigMetadataResponse {
    fields: DoctorConfigFieldMetadata[];
}

export interface DoctorRedactedValue {
    value?: unknown;
    redacted?: boolean;
    present?: boolean;
    summary?: string;
}

export interface DoctorSettingsPlanChange {
    config_path?: string;
    section: string;
    channel?: string;
    field: string;
    operation?: string;
    old_value?: DoctorRedactedValue;
    new_value?: DoctorRedactedValue;
    impact?: string;
    risk_reason?: string;
    validation_status?: string;
    metadata_risk?: DoctorRiskLevel;
}

export interface DoctorConfigDiffLine {
    path: string;
    old_value?: string;
    new_value?: string;
    added?: boolean;
    removed?: boolean;
}

export interface DoctorSettingsChangePlan {
    id?: string;
    title: string;
    summary?: string;
    created_by?: string;
    created_at?: number;
    risk_level?: DoctorRiskLevel;
    restart_required?: boolean;
    requires_approval?: boolean;
    requires_step_up_auth?: boolean;
    affected_areas?: string[];
    changes: DoctorSettingsPlanChange[];
    validation_results?: Array<{
        check: string;
        status: string;
        message?: string;
    }>;
    estimated_impact?: string;
    rollback_plan?: {
        available?: boolean;
        safe?: boolean;
        manual_only?: boolean;
        instructions?: string;
        restart_required?: boolean;
    };
    post_apply_checks?: Array<{
        id: string;
        description: string;
        timeout_seconds?: number;
    }>;
    user_facing_explanation?: string;
    exact_config_diff?: DoctorConfigDiffLine[];
    advanced?: Record<string, unknown>;
}

export interface DoctorPlanResponse {
    plan: DoctorSettingsChangePlan;
    status?: string;
    approval?: unknown;
    live_reloaded?: unknown;
    rollback_id?: string;
    post_check_pending?: boolean;
    error?: string;
    checkpoint?: unknown;
    doctor_report?: unknown;
}

export interface DoctorPlanApplyResponse {
    ok?: boolean;
    rolled_back?: boolean;
    plan_id?: string;
    rollback_id?: string;
    restart_required?: boolean;
    restart_requested?: boolean;
    restart_status?: string;
    restart_error?: string;
    approval_state?: string;
    post_check_pending?: boolean;
    post_check_ids?: string[];
    manual_recovery?: string;
    post_restart_recovery?: unknown;
}

export interface DoctorPostCheckResponse {
    checkpoint_id?: string;
    status: string;
    results?: unknown[];
    doctor_report?: unknown;
}

export interface DoctorChatSessionResponse {
    session?: unknown;
    messages?: Array<{
        id?: number;
        ID?: number;
        role?: string;
        Role?: string;
        content?: string;
        Content?: string;
        created_at?: number;
        CreatedAt?: number;
        meta?: unknown;
        Meta?: unknown;
        payload_json?: unknown;
        PayloadJSON?: unknown;
    }>;
    events?: Array<{
        id?: number;
        ID?: number;
        role?: string;
        Role?: string;
        content?: string;
        Content?: string;
        created_at?: number;
        CreatedAt?: number;
        meta?: unknown;
        Meta?: unknown;
        payload_json?: unknown;
        PayloadJSON?: unknown;
    }>;
    next_cursor?: number;
    admin_brain?: DoctorAdminBrainProvider;
    transport?: 'job' | 'runner_chat' | 'sync' | 'unavailable';
    job_id?: string;
    runner_chat?: { session_id?: string; turn_id?: string; job_id?: string };
    error?: string;
    message?: string;
    code?: string;
}

export interface SkillItem {
    name: string;
    key: string;
    description?: string;
    summary?: string;
    homepage?: string;
    source: string;
    location: string;
    eligible: boolean;
    disabled: boolean;
    hidden: boolean;
    status: string;
    permission_state: string;
    permission_notes?: string[];
    missing?: string[];
    unsupported?: string[];
    parse_error?: string;
    user_invocable: boolean;
    primary_env?: string;
    required_env?: string[];
    config_fields?: string[];
    api_key_configured?: boolean;
}

export interface SkillRoot {
    path: string;
    source: string;
    enabled: boolean;
}

export interface SkillsResponse {
    items: SkillItem[];
    roots?: SkillRoot[];
    global_dir?: string;
    global_skills_enabled?: boolean;
}

export interface SkillSettingsRequest {
    enabled?: boolean;
    apiKey?: string;
    env?: Record<string, string>;
    config?: Record<string, unknown>;
}

export interface Or3SseEvent {
    event?: string;
    data: string;
    id?: string;
    retry?: number;
    json?: unknown;
}

export interface ArtifactResponse {
    id: string;
    mime: string;
    size_bytes: number;
    offset: number;
    read_bytes: number;
    truncated: boolean;
    content: string;
}
