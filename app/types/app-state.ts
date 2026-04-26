export interface Or3HostProfile {
  id: string
  name: string
  baseUrl: string
  token?: string
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

export interface ChatMessage {
  id: string
  sessionId: string
  role: 'user' | 'assistant' | 'system' | 'tool'
  content: string
  status: 'sending' | 'streaming' | 'complete' | 'failed'
  createdAt: string
  jobId?: string
  error?: string
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
  cause?: unknown
}
