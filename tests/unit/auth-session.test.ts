import { afterEach, describe, expect, it, vi } from 'vitest'
import { useAuthSession } from '../../app/composables/useAuthSession'
import { useLocalCache } from '../../app/composables/useLocalCache'

class MockPublicKeyCredential {
  id = 'credential-id'
  rawId = new Uint8Array([1]).buffer
  type = 'public-key'
  authenticatorAttachment = 'platform'
  response = {
    clientDataJSON: new Uint8Array([2]).buffer,
    authenticatorData: new Uint8Array([3]).buffer,
    signature: new Uint8Array([4]).buffer,
    userHandle: new Uint8Array([5]).buffer,
  } as unknown as AuthenticatorAssertionResponse

  getClientExtensionResults() {
    return {}
  }
}

describe('useAuthSession', () => {
  afterEach(() => {
    useLocalCache().clearAll()
    sessionStorage.clear()
    localStorage.clear()
    vi.unstubAllGlobals()
  })

  it('loads backend auth capabilities without requiring an enrollment token', async () => {
    useLocalCache().updateHost({ id: 'host-1', name: 'Host', baseUrl: 'http://127.0.0.1:9100' })
    const fetchMock = vi.fn(async (_url: string | URL | Request, init?: RequestInit) => {
      expect(String(_url)).toBe('http://127.0.0.1:9100/internal/v1/auth/capabilities')
      expect(init?.headers).not.toMatchObject({ Authorization: expect.any(String) })
      return new Response(JSON.stringify({ passkeysEnabled: true, passkeyMode: 'warn', sessionRequired: false }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      })
    })
    vi.stubGlobal('fetch', fetchMock)

    await expect(useAuthSession().loadCapabilities(true)).resolves.toMatchObject({ passkeyMode: 'warn' })
  })

  it('logs in with a passkey, stores the short-lived session token, and refreshes session state', async () => {
    const cache = useLocalCache()
    cache.updateHost({ id: 'host-1', name: 'Host', baseUrl: 'http://127.0.0.1:9100', token: 'paired-token', pairedToken: 'paired-token' })
    vi.stubGlobal('PublicKeyCredential', MockPublicKeyCredential)
    vi.stubGlobal('navigator', { credentials: { get: vi.fn(async () => new MockPublicKeyCredential()) } })
    const fetchMock = vi.fn(async (_url: string | URL | Request, init?: RequestInit) => {
      const url = String(_url)
      if (url.endsWith('/internal/v1/auth/passkeys/login/begin')) {
        expect(init?.headers).toMatchObject({ Authorization: 'Bearer paired-token' })
        return new Response(JSON.stringify({ ceremonyId: 'ceremony-1', options: { publicKey: { challenge: 'AQID' } } }), { status: 200, headers: { 'Content-Type': 'application/json' } })
      }
      if (url.endsWith('/internal/v1/auth/passkeys/login/finish')) {
        expect(init?.headers).toMatchObject({ Authorization: 'Bearer paired-token' })
        return new Response(JSON.stringify({ sessionToken: 'session-token', session: { id: 'session-1', role: 'admin' }, user: { id: 'owner' } }), { status: 200, headers: { 'Content-Type': 'application/json' } })
      }
      if (url.endsWith('/internal/v1/auth/session')) {
        return new Response(JSON.stringify({ session: { id: 'session-1' }, user: { id: 'owner' }, role: 'admin' }), { status: 200, headers: { 'Content-Type': 'application/json' } })
      }
      return new Response('{}', { status: 404, headers: { 'Content-Type': 'application/json' } })
    })
    vi.stubGlobal('fetch', fetchMock)

    await expect(useAuthSession().loginWithPasskey('test-login')).resolves.toMatchObject({ sessionToken: 'session-token' })

    expect(cache.state.value.hosts[0]).toMatchObject({
      pairedToken: 'paired-token',
      sessionToken: 'session-token',
      token: 'session-token',
    })
    expect(fetchMock.mock.calls.length).toBeGreaterThanOrEqual(3)
  })

  it('resolves a step-up challenge and clears expired sessions', async () => {
    const cache = useLocalCache()
    cache.updateHost({ id: 'host-1', name: 'Host', baseUrl: 'http://127.0.0.1:9100', token: 'session-token', pairedToken: 'paired-token', sessionToken: 'session-token' })
    vi.stubGlobal('PublicKeyCredential', MockPublicKeyCredential)
    vi.stubGlobal('navigator', { credentials: { get: vi.fn(async () => new MockPublicKeyCredential()) } })
    const fetchMock = vi.fn(async (_url: string | URL | Request) => {
      const url = String(_url)
      if (url.endsWith('/internal/v1/auth/step-up/begin')) {
        return new Response(JSON.stringify({ ceremonyId: 'ceremony-2', options: { publicKey: { challenge: 'AQID' } } }), { status: 200, headers: { 'Content-Type': 'application/json' } })
      }
      if (url.endsWith('/internal/v1/auth/step-up/finish')) {
        return new Response(JSON.stringify({ session: { id: 'session-1', last_step_up_at: 1 } }), { status: 200, headers: { 'Content-Type': 'application/json' } })
      }
      if (url.endsWith('/internal/v1/auth/session')) {
        return new Response(JSON.stringify({ session: { id: 'session-1', last_step_up_at: 1 }, user: { id: 'owner' }, role: 'admin' }), { status: 200, headers: { 'Content-Type': 'application/json' } })
      }
      return new Response('{}', { status: 404, headers: { 'Content-Type': 'application/json' } })
    })
    vi.stubGlobal('fetch', fetchMock)

    await expect(useAuthSession().resolveChallenge({ code: 'STEP_UP_REQUIRED', message: 'step up' }, 'test-step-up')).resolves.toBe(true)

    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({ code: 'SESSION_EXPIRED', message: 'session expired' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    })))
    await expect(useAuthSession().refreshSession()).rejects.toMatchObject({ code: 'session_expired' })
    expect(cache.state.value.hosts[0].sessionToken).toBeUndefined()
  })
})
