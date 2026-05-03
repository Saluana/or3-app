import { afterEach, describe, expect, it } from 'vitest'
import { useSecureHostTokens, resolveHostAuthTokens, resolvePreferredHostToken, withResolvedHostTokens } from '../../app/composables/useSecureHostTokens'

describe('useSecureHostTokens', () => {
  afterEach(() => {
    sessionStorage.clear()
    localStorage.clear()
  })

  it('keeps paired and session tokens in browser session fallback storage', () => {
    const store = useSecureHostTokens()

    store.setTokens('host-1', { pairedToken: 'paired-token', sessionToken: 'session-token', origin: 'http://127.0.0.1:9100' })

    expect(store.getTokens('host-1')).toEqual({ pairedToken: 'paired-token', sessionToken: 'session-token', origin: 'http://127.0.0.1:9100' })
    expect(store.loadAllTokens()).toEqual({ 'host-1': { pairedToken: 'paired-token', sessionToken: 'session-token', origin: 'http://127.0.0.1:9100' } })
    expect(sessionStorage.getItem('or3-app:v1:secure-host-tokens')).toContain('paired-token')
    expect(localStorage.getItem('or3-app:v1:secure-host-tokens')).toBeNull()
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

  it('binds tokens to the paired host origin', () => {
    const resolved = withResolvedHostTokens({
      id: 'host-1',
      baseUrl: 'http://127.0.0.1:9100',
      pairedToken: 'paired',
      sessionToken: 'session',
    })

    expect(resolved).toMatchObject({
      tokenOrigin: 'http://127.0.0.1:9100',
      token: 'session',
    })
    expect(resolveHostAuthTokens(resolved)).toEqual({
      authToken: 'session',
      sessionToken: 'session',
    })
    expect(resolvePreferredHostToken({
      ...resolved,
      baseUrl: 'http://evil.example',
    })).toBeUndefined()
  })

  it('purges legacy persistent browser token storage after one session migration', () => {
    localStorage.setItem('or3-app:v1:secure-host-tokens', JSON.stringify({
      'host-1': { pairedToken: 'paired-token', origin: 'http://127.0.0.1:9100' },
    }))

    const store = useSecureHostTokens()

    expect(store.loadAllTokens()).toEqual({
      'host-1': { pairedToken: 'paired-token', sessionToken: undefined, origin: 'http://127.0.0.1:9100' },
    })
    expect(localStorage.getItem('or3-app:v1:secure-host-tokens')).toBeNull()
  })

  it('clears browser fallback storage when no host tokens remain', () => {
    const store = useSecureHostTokens()
    store.setTokens('host-1', { pairedToken: 'paired-token' })
    store.clearTokens('host-1')

    expect(store.loadAllTokens()).toEqual({})
  })
})
