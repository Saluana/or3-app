export interface ToolPolicy {
    mode: 'allow_all' | 'deny_all' | 'allow_list' | 'deny_list';
    allowed_tools?: string[];
    blocked_tools?: string[];
}

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
    status: 'queued' | 'running' | 'completed' | 'failed' | 'aborted';
    final_text?: string;
    error?: string;
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

export interface ApprovalRequest {
    id: number | string;
    status: string;
    type?: string;
    domain?: string;
    subject?: unknown;
    created_at?: string;
    expires_at?: string;
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
