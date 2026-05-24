import { describe, expect, it } from 'vitest'
import {
  getBootstrapWarningGuidance,
  getReadinessGuidance,
} from '../../app/utils/or3/computerAttention'
import type { AppBootstrapWarning } from '../../app/types/or3-api'

describe('computer attention guidance', () => {
  it.each([
    ['integration_quarantined', 'One integration was turned off', '/settings/advanced'],
    ['legacy_context_mode', 'This host is using legacy context settings', '/settings/advanced'],
    ['embedding_fingerprint_mismatch', 'Memory search needs a refresh', '/memory'],
  ])('surfaces non-blocking bootstrap warning %s', (code, title, href) => {
    const warning: AppBootstrapWarning = {
      code,
      message: `${code} warning`,
      severity: 'warning',
    }

    const guidance = getBootstrapWarningGuidance(warning, { ready: true, findings: [] })

    expect(guidance.title).toBe(title)
    expect(guidance.summary).toBe(`${code} warning`)
    expect(guidance.action.href).toBe(href)
  })

  it('routes sandbox readiness issues to the health report first', () => {
    const guidance = getReadinessGuidance({
      ready: false,
      status: 'not ready',
      findings: [
        {
          id: 'sandbox',
          severity: 'block',
          summary:
            'privileged tools are enabled without Bubblewrap sandboxing.',
        },
      ],
    })

    expect(guidance.action.href).toBe('/settings/health')
    expect(guidance.secondaryAction).toBeUndefined()
  })

  it('routes host_not_ready bootstrap warnings to the health report', () => {
    const guidance = getBootstrapWarningGuidance(
      {
        code: 'host_not_ready',
        message: 'Host is not ready',
        severity: 'warning',
      },
      {
        ready: false,
        status: 'not ready',
        findings: [{ severity: 'block', summary: 'sandbox issue' }],
      },
    )

    expect(guidance.action.href).toBe('/settings/health')
  })
})