import type { Or3AppError } from '~/types/app-state'
import type { AuthChallengeCode, AuthChallengeError } from '~/types/auth'
import type { Or3SseEvent } from '~/types/or3-api'
import { readSseStream } from '~/utils/or3/sse'
import { useActiveHost } from './useActiveHost'
import { resolvePreferredHostToken } from './useSecureHostTokens'

export interface Or3ApiRequestOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE'
  body?: unknown
  headers?: Record<string, string>
  signal?: AbortSignal
  acceptSse?: boolean
  requireAuth?: boolean
  preferPairedToken?: boolean
  onAuthChallenge?: (challenge: AuthChallengeError) => Promise<boolean | void> | boolean | void
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

function normalizeChallengeCode(code?: string): Or3AppError['code'] | undefined {
  const normalized = code?.trim().toUpperCase() as AuthChallengeCode | undefined
  switch (normalized) {
    case 'SESSION_REQUIRED':
      return 'session_required'
    case 'SESSION_EXPIRED':
      return 'session_expired'
    case 'PASSKEY_REQUIRED':
      return 'passkey_required'
    case 'STEP_UP_REQUIRED':
      return 'step_up_required'
    case 'AUTH_UNSUPPORTED':
      return 'auth_unsupported'
    default:
      return undefined
  }
}

function toAuthChallenge(payload?: string | Or3ApiErrorPayload, status?: number): AuthChallengeError | null {
  if (!payload || typeof payload === 'string') return null
  const code = payload.code?.toString().trim().toUpperCase() as AuthChallengeCode | undefined
  if (!code || !['SESSION_REQUIRED', 'SESSION_EXPIRED', 'PASSKEY_REQUIRED', 'STEP_UP_REQUIRED', 'AUTH_UNSUPPORTED'].includes(code)) {
    return null
  }
  const retryAfterSeconds = typeof payload.retry_after_seconds === 'number'
    ? payload.retry_after_seconds
    : typeof payload.retryAfterSeconds === 'number'
      ? payload.retryAfterSeconds
      : undefined
  return {
    code,
    message: payload.message?.toString() || payload.error?.toString() || 'Authentication is required.',
    status,
    retryAfterSeconds,
    retryAfterMs: retryAfterSeconds ? retryAfterSeconds * 1000 : undefined,
  }
}

function mapError(status: number, payload?: string | Or3ApiErrorPayload, cause?: unknown): Or3AppError {
  const message = typeof payload === 'string' ? payload : payload?.message || payload?.error
  const payloadCode = typeof payload === 'object' ? payload.code || payload.error : undefined
  const challengeCode = normalizeChallengeCode(typeof payloadCode === 'string' ? payloadCode : undefined)
  const code = payloadCode === 'approval_required'
    ? 'approval_required'
    : payloadCode === 'terminal_unavailable'
      ? 'terminal_unavailable'
      : challengeCode
        ? challengeCode
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
    retryAfterSeconds: typeof payload === 'object' && typeof payload.retry_after_seconds === 'number' ? payload.retry_after_seconds : undefined,
    retryAfterMs: typeof payload === 'object' && typeof payload.retry_after_seconds === 'number' ? payload.retry_after_seconds * 1000 : undefined,
    authChallengeCode: typeof payloadCode === 'string' ? payloadCode : undefined,
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

  function resolveRequestAuthToken(preferPairedToken?: boolean) {
    if (!preferPairedToken) return resolvePreferredHostToken(activeHost.value)
    return activeHost.value?.pairedToken?.trim() || undefined
  }

  async function request<T>(path: string, options: Or3ApiRequestOptions = {}): Promise<T> {
    const requiresAuth = options.requireAuth !== false
    const authToken = resolveRequestAuthToken(options.preferPairedToken)
    const sessionToken = activeHost.value?.sessionToken?.trim() || undefined
    if (requiresAuth && !authToken) {
      throw {
        code: 'auth_required',
        status: 401,
        message: 'Connect to your computer and finish pairing before using this area.',
      } satisfies Or3AppError
    }

    const headers: Record<string, string> = {
      Accept: 'application/json',
      ...options.headers,
    }

    if (options.body !== undefined) headers['Content-Type'] = 'application/json'
    if (authToken && requiresAuth) headers.Authorization = `Bearer ${authToken}`
    if (sessionToken) headers['X-Or3-Session'] = sessionToken

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

    if (!response.ok) {
		const payload = await readError(response)
		const challenge = toAuthChallenge(payload, response.status)
		if (challenge && options.onAuthChallenge) {
			const shouldRetry = await options.onAuthChallenge(challenge)
			if (shouldRetry !== false) {
				return await request<T>(path, { ...options, onAuthChallenge: undefined })
			}
		}
		throw mapError(response.status, payload)
	}
    if (response.status === 204) return undefined as T
    return await response.json() as T
  }

  async function* stream(path: string, options: Or3ApiRequestOptions = {}): AsyncIterable<Or3SseEvent> {
    const requiresAuth = options.requireAuth !== false
    const authToken = resolveRequestAuthToken(options.preferPairedToken)
    const sessionToken = activeHost.value?.sessionToken?.trim() || undefined
    if (requiresAuth && !authToken) {
      throw {
        code: 'auth_required',
        status: 401,
        message: 'Connect to your computer and finish pairing before using this area.',
      } satisfies Or3AppError
    }

    const headers: Record<string, string> = {
      Accept: 'text/event-stream',
      ...options.headers,
    }

    if (options.body !== undefined) headers['Content-Type'] = 'application/json'
    if (authToken && requiresAuth) headers.Authorization = `Bearer ${authToken}`
    if (sessionToken) headers['X-Or3-Session'] = sessionToken

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

    if (!response.ok) {
    const payload = await readError(response)
    const challenge = toAuthChallenge(payload, response.status)
    if (challenge && options.onAuthChallenge) {
      const shouldRetry = await options.onAuthChallenge(challenge)
      if (shouldRetry !== false) {
        yield* stream(path, { ...options, onAuthChallenge: undefined })
        return
      }
    }
    throw mapError(response.status, payload)
  }
    if (!response.body) throw { code: 'stream_failed', message: 'The service did not return a stream.' } satisfies Or3AppError

    yield* readSseStream(response.body)
  }

  return { request, stream, buildUrl, normalizeBaseUrl }
}
