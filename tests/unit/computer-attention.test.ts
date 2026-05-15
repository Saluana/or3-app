import { describe, expect, it } from 'vitest'
import { getBootstrapWarningGuidance } from '../../app/utils/or3/computerAttention'
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
})