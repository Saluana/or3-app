import type { Or3AppError } from '~/types/app-state'
import type { Or3SseEvent } from '~/types/or3-api'
import { readSseStream } from '~/utils/or3/sse'
import { useActiveHost } from './useActiveHost'

export interface Or3ApiRequestOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE'
  body?: unknown
  headers?: Record<string, string>
  signal?: AbortSignal
  acceptSse?: boolean
  requireAuth?: boolean
}

interface Or3ApiErrorPayload {
  error?: string
  message?: string
  code?: Or3AppError['code'] | string
  request_id?: number | string
  approval_id?: number | string
  [key: string]: unknown
}

function normalizeBaseUrl(baseUrl: string) {
  return baseUrl.trim().replace(/\/+$/, '')
}

function mapError(status: number, payload?: string | Or3ApiErrorPayload, cause?: unknown): Or3AppError {
  const message = typeof payload === 'string' ? payload : payload?.message || payload?.error
  const payloadCode = typeof payload === 'object' ? payload.code || payload.error : undefined
  const code = payloadCode === 'approval_required'
    ? 'approval_required'
    : payloadCode === 'terminal_unavailable'
      ? 'terminal_unavailable'
      : status === 401
    ? 'auth_required'
    : status === 403
      ? 'forbidden'
      : status === 404
        ? 'file_not_found'
        : status === 429
          ? 'rate_limited'
          : status === 400
            ? 'validation_failed'
            : status === 503
              ? 'capability_unavailable'
              : 'unknown'

  return {
    ...(typeof payload === 'object' ? payload : {}),
    code,
    status,
    message: message || `Request failed with status ${status}`,
    cause,
  }
}

async function readError(response: Response) {
  const text = await response.text().catch(() => '')
  if (!text) return response.statusText
  try {
    return JSON.parse(text) as Or3ApiErrorPayload
  } catch {
    return text
  }
}

export function useOr3Api() {
  const { activeHost } = useActiveHost()

  function buildUrl(path: string, explicitBaseUrl?: string) {
    const baseUrl = explicitBaseUrl || activeHost.value?.baseUrl
    if (!baseUrl) throw mapError(0, 'No or3-intern host is configured')
    const normalizedPath = path.startsWith('/') ? path : `/${path}`
    return `${normalizeBaseUrl(baseUrl)}${normalizedPath}`
  }

  async function request<T>(path: string, options: Or3ApiRequestOptions = {}): Promise<T> {
    const headers: Record<string, string> = {
      Accept: 'application/json',
      ...options.headers,
    }

    if (options.body !== undefined) headers['Content-Type'] = 'application/json'
    if (activeHost.value?.token && options.requireAuth !== false) headers.Authorization = `Bearer ${activeHost.value.token}`

    let response: Response
    try {
      response = await fetch(buildUrl(path), {
        method: options.method || (options.body === undefined ? 'GET' : 'POST'),
        headers,
        body: options.body === undefined ? undefined : JSON.stringify(options.body),
        signal: options.signal,
      })
    } catch (error) {
      throw { code: 'host_unreachable', message: 'Could not reach the selected computer.', cause: error } satisfies Or3AppError
    }

    if (!response.ok) throw mapError(response.status, await readError(response))
    if (response.status === 204) return undefined as T
    return await response.json() as T
  }

  async function* stream(path: string, options: Or3ApiRequestOptions = {}): AsyncIterable<Or3SseEvent> {
    const headers: Record<string, string> = {
      Accept: 'text/event-stream',
      ...options.headers,
    }

    if (options.body !== undefined) headers['Content-Type'] = 'application/json'
    if (activeHost.value?.token && options.requireAuth !== false) headers.Authorization = `Bearer ${activeHost.value.token}`

    let response: Response
    try {
      response = await fetch(buildUrl(path), {
        method: options.method || 'POST',
        headers,
        body: options.body === undefined ? undefined : JSON.stringify(options.body),
        signal: options.signal,
      })
    } catch (error) {
      throw { code: 'host_unreachable', message: 'Could not reach the selected computer.', cause: error } satisfies Or3AppError
    }

    if (!response.ok) throw mapError(response.status, await readError(response))
    if (!response.body) throw { code: 'stream_failed', message: 'The service did not return a stream.' } satisfies Or3AppError

    yield* readSseStream(response.body)
  }

  return { request, stream, buildUrl, normalizeBaseUrl }
}
