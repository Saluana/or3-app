import { afterEach, describe, expect, it, vi } from 'vitest'
import { useLocalCache } from '../../app/composables/useLocalCache'
import { usePasskeys } from '../../app/composables/usePasskeys'

class MockPublicKeyCredential {
  id = 'credential-id'
  rawId = new Uint8Array([1]).buffer
  type = 'public-key'
  authenticatorAttachment = 'platform'
  response = {
    clientDataJSON: new Uint8Array([2]).buffer,
    attestationObject: new Uint8Array([3]).buffer,
    getTransports: () => ['internal'],
  } as unknown as AuthenticatorAttestationResponse

  getClientExtensionResults() {
    return {}
  }
}

describe('usePasskeys', () => {
  afterEach(() => {
    useLocalCache().clearAll()
    sessionStorage.clear()
    localStorage.clear()
    vi.unstubAllGlobals()
  })

  it('lists, registers, renames, and revokes passkeys through authenticated API calls', async () => {
    useLocalCache().updateHost({
      id: 'host-1',
      name: 'Host',
      baseUrl: 'http://127.0.0.1:9100',
      token: 'session-token',
      pairedToken: 'paired-token',
      sessionToken: 'session-token',
    })
    vi.stubGlobal('PublicKeyCredential', MockPublicKeyCredential)
    vi.stubGlobal('navigator', { credentials: { create: vi.fn(async () => new MockPublicKeyCredential()) } })
    let listCalls = 0
    const fetchMock = vi.fn(async (_url: string | URL | Request, init?: RequestInit) => {
      const url = String(_url)
      expect(init?.headers).toMatchObject({ Authorization: 'Bearer session-token', 'X-Or3-Session': 'session-token' })
      if (url.endsWith('/internal/v1/auth/passkeys') && (!init?.method || init.method === 'GET')) {
        listCalls += 1
        const items = listCalls === 1
          ? [{ id: 'passkey-1', nickname: 'Phone' }]
          : [{ id: 'passkey-1', nickname: 'Phone' }, { id: 'passkey-2', nickname: 'Laptop' }]
        return new Response(JSON.stringify({ items }), { status: 200, headers: { 'Content-Type': 'application/json' } })
      }
      if (url.endsWith('/internal/v1/auth/passkeys/registration/begin')) {
        return new Response(JSON.stringify({ ceremonyId: 'ceremony-1', options: { publicKey: { challenge: 'AQID', user: { id: 'BAUG' } } } }), { status: 200, headers: { 'Content-Type': 'application/json' } })
      }
      if (url.endsWith('/internal/v1/auth/passkeys/registration/finish')) {
        return new Response(JSON.stringify({ passkey: { id: 'passkey-2', nickname: 'Laptop' } }), { status: 200, headers: { 'Content-Type': 'application/json' } })
      }
      if (url.endsWith('/internal/v1/auth/passkeys/passkey-2')) {
        return new Response(JSON.stringify({ id: 'passkey-2', nickname: 'Work laptop' }), { status: 200, headers: { 'Content-Type': 'application/json' } })
      }
      if (url.endsWith('/internal/v1/auth/passkeys/passkey-2/revoke')) {
        return new Response(JSON.stringify({ id: 'passkey-2', status: 'revoked' }), { status: 200, headers: { 'Content-Type': 'application/json' } })
      }
      return new Response('{}', { status: 404, headers: { 'Content-Type': 'application/json' } })
    })
    vi.stubGlobal('fetch', fetchMock)

    const passkeys = usePasskeys()
    await expect(passkeys.listPasskeys(true)).resolves.toEqual([{ id: 'passkey-1', nickname: 'Phone' }])
    await expect(passkeys.registerPasskey({ nickname: 'Laptop' })).resolves.toMatchObject({ id: 'passkey-2' })
    await passkeys.renamePasskey('passkey-2', 'Work laptop')
    expect(passkeys.passkeys.value.find((item) => item.id === 'passkey-2')).toMatchObject({ nickname: 'Work laptop' })
    await passkeys.revokePasskey('passkey-2')
    expect(passkeys.passkeys.value.find((item) => item.id === 'passkey-2')).toBeUndefined()
  })
})
