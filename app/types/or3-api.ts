export interface ToolPolicy {
    mode: 'allow_all' | 'deny_all' | 'allow_list' | 'deny_list';
    allowed_tools?: string[];
    blocked_tools?: string[];
}

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
    kind: 'agent_turn' | 'system_event' | 'agent_cli_run' | string;
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

export type AgentRunnerId = 'or3-intern' | 'opencode' | 'codex' | 'claude' | 'gemini' | string;

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
}

export interface AgentRunnersResponse {
    runners: AgentRunnerInfo[];
}

export type AgentRunMode = 'review' | 'safe_edit' | 'sandbox_auto';
export type AgentRunIsolation =
    | 'host_readonly'
    | 'host_workspace_write'
    | 'sandbox_workspace_write'
    | 'sandbox_dangerous';

export interface AgentCliRunRequest {
    parent_session_key: string;
    runner_id: Exclude<AgentRunnerId, 'or3-intern'>;
    task: string;
    timeout_seconds?: number;
    cwd?: string;
    model?: string;
    mode?: AgentRunMode;
    isolation?: AgentRunIsolation;
    max_turns?: number;
    meta?: Record<string, unknown>;
}

export interface AgentCliRunResponse {
    job_id: string;
    run_id?: string;
    status: 'queued' | 'running' | string;
}

export type PersistedAgentCliStatus =
    | 'queued'
    | 'starting'
    | 'running'
    | 'succeeded'
    | 'failed'
    | 'aborted'
    | 'timed_out';

export interface PersistedAgentCliJob {
    job_id: string;
    run_id?: string;
    kind: `agent_cli:${string}` | string;
    runner_id: string;
    parent_session_key: string;
    task: string;
    status: PersistedAgentCliStatus | string;
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

export interface AgentCliListResponse {
    items: PersistedAgentCliJob[];
}

export interface AgentCliSseOutputEvent {
    type: 'output';
    ts?: string;
    seq?: number;
    job_id?: string;
    runner_id?: string;
    stream: 'stdout' | 'stderr';
    chunk: string;
}

export interface AgentCliSseStructuredEvent {
    type: 'structured';
    ts?: string;
    seq?: number;
    job_id?: string;
    runner_id?: string;
    payload?: unknown;
}

export interface AgentCliSseCompletionEvent {
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

export interface AgentCliSseErrorEvent {
    type: 'error';
    ts?: string;
    job_id?: string;
    runner_id?: string;
    code?: string;
    message?: string;
}

// ── Existing types ──

export interface TurnRequest {
    session_key: string;
    message: string;
    tool_policy?: ToolPolicy;
    profile_name?: string;
    meta?: Record<string, unknown>;
}

export interface TurnResponse {
    job_id: string;
    kind: 'turn';
    status:
        | 'queued'
        | 'running'
        | 'completed'
        | 'failed'
        | 'aborted'
        | 'approval_required';
    final_text?: string;
    error?: string;
    message?: string;
    code?: string;
    request_id?: number | string;
    approval_id?: number | string;
}

export interface SubagentRequest {
    parent_session_key: string;
    task: string;
    prompt_snapshot?: string;
    tool_policy?: ToolPolicy;
    timeout_seconds?: number;
    profile_name?: string;
    channel?: string;
    reply_to?: string;
    meta?: Record<string, unknown>;
}

export interface SubagentResponse {
    job_id: string;
    child_session_key: string;
    status: 'queued' | string;
}

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
    subagentManagerEnabled?: boolean;
    approvalBrokerAvailable?: boolean;
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
    mcpServers?: unknown[];
    [key: string]: unknown;
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
}

export interface ApprovalRequest {
    id: number | string;
    status: string;
    type?: string;
    domain?: string;
    subject?: unknown;
    created_at?: string;
    expires_at?: string;
}

export interface ApprovalActionResponse {
    request_id: number | string;
    token?: string;
    allowlist_id?: number | string;
    resume_job_id?: string;
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

export type PersistedSubagentStatus =
    | 'queued'
    | 'running'
    | 'succeeded'
    | 'failed'
    | 'interrupted';

export interface PersistedSubagentJob {
    job_id: string;
    kind: 'subagent';
    parent_session_key: string;
    child_session_key: string;
    task: string;
    status: PersistedSubagentStatus;
    result_preview?: string;
    artifact_id?: string;
    error?: string;
    requested_at: string;
    started_at?: string;
    finished_at?: string;
    updated_at: string;
    attempts?: number;
}

export interface SubagentListResponse {
    items: PersistedSubagentJob[];
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
