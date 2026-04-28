import { afterEach, describe, expect, it } from 'vitest'
import { useSecureHostTokens, resolvePreferredHostToken, withResolvedHostTokens } from '../../app/composables/useSecureHostTokens'

describe('useSecureHostTokens', () => {
  afterEach(() => {
    sessionStorage.clear()
    localStorage.clear()
  })

  it('keeps paired and session tokens in browser session fallback storage', () => {
    const store = useSecureHostTokens()

    store.setTokens('host-1', { pairedToken: 'paired-token', sessionToken: 'session-token' })

    expect(store.getTokens('host-1')).toEqual({ pairedToken: 'paired-token', sessionToken: 'session-token' })
    expect(store.loadAllTokens()).toEqual({ 'host-1': { pairedToken: 'paired-token', sessionToken: 'session-token' } })
  })

  it('prefers session tokens while preserving paired enrollment tokens', () => {
    expect(resolvePreferredHostToken({ pairedToken: 'paired', token: 'paired' })).toBe('paired')
    expect(resolvePreferredHostToken({ pairedToken: 'paired', sessionToken: 'session', token: 'session' })).toBe('session')
    expect(withResolvedHostTokens({ id: 'host-1', token: 'paired' })).toMatchObject({
      pairedToken: 'paired',
      sessionToken: undefined,
      token: 'paired',
    })
    expect(withResolvedHostTokens({ id: 'host-1', pairedToken: 'paired', sessionToken: 'session' })).toMatchObject({
      pairedToken: 'paired',
      sessionToken: 'session',
      token: 'session',
    })
  })

  it('clears browser fallback storage when no host tokens remain', () => {
    const store = useSecureHostTokens()
    store.setTokens('host-1', { pairedToken: 'paired-token' })
    store.clearTokens('host-1')

    expect(store.loadAllTokens()).toEqual({})
  })
})
