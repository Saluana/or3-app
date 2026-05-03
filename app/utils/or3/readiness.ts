import type { Or3AppError } from '~/types/app-state'
import type { ReadinessResponse } from '~/types/or3-api'

export function coerceReadinessPayload(error: unknown): ReadinessResponse | null {
  const candidate = error as Partial<ReadinessResponse & Or3AppError> | null
  if (!candidate || candidate.status !== 503) return null
  if (typeof candidate.ready !== 'boolean') return null

  return {
    status: typeof candidate.message === 'string' && candidate.message.trim()
      ? candidate.message
      : 'not ready',
    ready: candidate.ready,
    summary: candidate.summary,
    findings: Array.isArray(candidate.findings) ? candidate.findings : undefined,
  }
}

export function formatReadinessDetail(readiness: ReadinessResponse | null | undefined): string {
  if (!readiness) return 'Could not reach the readiness endpoint.'

  const summary = readiness.summary
  if (summary && typeof summary === 'object') {
    const parts = [
      summary.blockCount ? `${summary.blockCount} blocker${summary.blockCount === 1 ? '' : 's'}` : '',
      summary.errorCount ? `${summary.errorCount} error${summary.errorCount === 1 ? '' : 's'}` : '',
      summary.warnCount ? `${summary.warnCount} warning${summary.warnCount === 1 ? '' : 's'}` : '',
    ].filter(Boolean)

    const primaryFinding = readiness.findings?.find((finding) => finding.severity === 'block' || finding.severity === 'error')
    if (primaryFinding?.summary) {
      return `${parts.length ? `${parts.join(', ')}. ` : ''}${primaryFinding.summary}.`
    }
    if (parts.length) {
      return `${parts.join(', ')}.`
    }
  }

  if (Array.isArray(readiness.findings) && readiness.findings.length) {
    const primaryFinding = readiness.findings.find((finding) => finding.severity === 'block' || finding.severity === 'error') || readiness.findings[0]
    if (primaryFinding?.summary) return `${primaryFinding.summary}.`
  }

  return readiness.ready ? 'All systems go.' : 'Service reports it is not fully ready.'
}