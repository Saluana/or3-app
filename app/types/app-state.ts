export interface Or3HostProfile {
  id: string
  name: string
  baseUrl: string
  token?: string
  pairedToken?: string
  sessionToken?: string
  role?: 'operator' | 'admin' | string
  deviceId?: string
  lastSeenAt?: string
  status?: 'online' | 'offline' | 'unauthorized' | 'unknown'
}

export interface ChatSession {
  id: string
  hostId: string
  sessionKey: string
  title: string
  createdAt: string
  updatedAt: string
}

export interface ChatToolCall {
  id: string
  name: string
  status: 'running' | 'complete' | 'error'
  arguments?: string
  result?: string
  error?: string
  startedAt: string
  completedAt?: string
}

export interface ChatActivityEntry {
  id: string
  type: string
  label: string
  detail?: string
  status?: 'running' | 'complete' | 'error'
  createdAt: string
}

export interface ChatAttachment {
  id: string
  kind: 'file' | 'text'
  name: string
  preview?: string
  mimeType?: string
  size?: number
  source?: 'local' | 'workspace'
  path?: string
  rootId?: string
}

export interface AssistantSendPayload {
  text: string
  transportText?: string
  attachments?: ChatAttachment[]
}

export interface ChatMessage {
  id: string
  sessionId: string
  role: 'user' | 'assistant' | 'system' | 'tool'
  content: string
  status: 'sending' | 'streaming' | 'complete' | 'failed'
  createdAt: string
  jobId?: string
  error?: string
  reasoningText?: string
  toolCalls?: ChatToolCall[]
  activityLog?: ChatActivityEntry[]
  attachments?: ChatAttachment[]
}

export interface RecentJobSummary {
  job_id: string
  kind: string
  status: string
  title: string
  updated_at: string
  final_text?: string
  error?: string
}

export interface Or3AppState {
  activeHostId: string | null
  hosts: Or3HostProfile[]
  sessions: ChatSession[]
  messages: ChatMessage[]
  drafts: Record<string, string>
  recentJobs: Record<string, RecentJobSummary[]>
  lastKnownStatus: Record<string, unknown>
  preferences: Record<string, unknown>
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
  | 'file_not_found'
  | 'path_forbidden'
  | 'terminal_unavailable'
  | 'unknown'

export interface Or3AppError {
  code: Or3AppErrorCode
  message: string
  status?: number
  retryAfterMs?: number
  retryAfterSeconds?: number
  authChallengeCode?: string
  cause?: unknown
}
