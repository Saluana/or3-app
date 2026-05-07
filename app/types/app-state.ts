import type { ToolPolicy } from './or3-api';

export interface Or3HostProfile {
    id: string;
    name: string;
    baseUrl: string;
    token?: string;
    pairedToken?: string;
    sessionToken?: string;
    tokenOrigin?: string;
    role?: 'operator' | 'admin' | string;
    deviceId?: string;
    lastSeenAt?: string;
    status?: 'online' | 'offline' | 'unauthorized' | 'unknown';
}

export interface ChatSession {
    id: string;
    hostId: string;
    sessionKey: string;
    title: string;
    createdAt: string;
    updatedAt: string;
}

export interface ChatToolCall {
    id: string;
    name: string;
    status: 'running' | 'complete' | 'error' | 'attention';
    arguments?: string;
    result?: string;
    error?: string;
    startedAt: string;
    completedAt?: string;
}

export interface ChatActivityEntry {
    id: string;
    type: string;
    label: string;
    detail?: string;
    status?: 'running' | 'complete' | 'error' | 'attention';
    createdAt: string;
}

export interface ChatAttachment {
    id: string;
    kind: 'file' | 'text';
    name: string;
    preview?: string;
    mimeType?: string;
    size?: number;
    source?: 'local' | 'workspace';
    path?: string;
    rootId?: string;
}

export interface AssistantReplayToolCall {
    name: string;
    arguments?: string;
}

export interface AssistantSendPayload {
    text: string;
    transportText?: string;
    attachments?: ChatAttachment[];
    mode?: 'ask' | 'work' | 'admin';
    toolPolicy?: ToolPolicy;
    approvalToken?: string;
    followJobId?: string;
    replayToolCall?: AssistantReplayToolCall;
    continueMessageId?: string;
    suppressUserEcho?: boolean;
}

export interface ChatMessagePart {
    id: string;
    type: 'text' | 'tool';
    content?: string;
    toolCallId?: string;
    name?: string;
    status?: ChatToolCall['status'];
    argumentsPreview?: string;
    resultPreview?: string;
    errorPreview?: string;
    artifactId?: string;
    publicCode?: string;
}

export interface ChatMessage {
    id: string;
    sessionId: string;
    role: 'user' | 'assistant' | 'system' | 'tool';
    content: string;
    status: 'sending' | 'streaming' | 'complete' | 'failed' | 'attention';
    createdAt: string;
    pinned?: boolean;
    jobId?: string;
    error?: string;
    errorCode?: Or3AppErrorCode;
    approvalRequestId?: number | string;
    approvalState?:
        | 'pending'
        | 'retrying'
        | 'approved'
        | 'denied'
        | 'canceled'
        | 'expired'
        | 'failed';
    retryPayload?: AssistantSendPayload;
    reasoningText?: string;
    toolCalls?: ChatToolCall[];
    parts?: ChatMessagePart[];
    activityLog?: ChatActivityEntry[];
    attachments?: ChatAttachment[];
}

export interface RecentJobSummary {
    job_id: string;
    kind: string;
    status: string;
    title: string;
    updated_at: string;
    final_text?: string;
    error?: string;
    task?: string;
    category?: string;
    priority?: string;
    notify?: string;
    autoApprove?: boolean;
    child_session_key?: string;
    parent_session_key?: string;
    created_at?: string;
    started_at?: string;
    finished_at?: string;
    artifact_id?: string;
    source?: 'local' | 'persisted' | 'live';
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

export interface Or3AppState {
    activeHostId: string | null;
    hosts: Or3HostProfile[];
    sessions: ChatSession[];
    messages: ChatMessage[];
    drafts: Record<string, string>;
    recentJobs: Record<string, RecentJobSummary[]>;
    lastKnownStatus: Record<string, unknown>;
    preferences: Record<string, unknown>;
}

export type Or3AppErrorCode =
    | 'host_unreachable'
    | 'auth_required'
    | 'session_required'
    | 'session_expired'
    | 'passkey_required'
    | 'step_up_required'
    | 'auth_unsupported'
    | 'forbidden'
    | 'rate_limited'
    | 'validation_failed'
    | 'capability_unavailable'
    | 'approval_required'
    | 'stream_failed'
    | 'provider_error'
    | 'stream_error'
    | 'validation_error'
    | 'policy_error'
    | 'tool_execution_error'
    | 'tool_loop_limit'
    | 'aborted'
    | 'file_not_found'
    | 'file_conflict'
    | 'file_read_only'
    | 'file_unsupported'
    | 'file_too_large'
    | 'invalid_file_target'
    | 'path_forbidden'
    | 'terminal_unavailable'
    | 'unknown';

export interface Or3AppError {
    code: Or3AppErrorCode;
    message: string;
    status?: number;
    retryAfterMs?: number;
    retryAfterSeconds?: number;
    authChallengeCode?: string;
    cause?: unknown;
}
