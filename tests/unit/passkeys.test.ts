import { afterEach, describe, expect, it, vi } from 'vitest'
import { useLocalCache } from '../../app/composables/useLocalCache'
import { usePasskeys } from '../../app/composables/usePasskeys'

const apiRequest = vi.fn()
const retryWithAuth = vi.fn(
  (handler: (onAuthChallenge: unknown) => Promise<unknown>) => handler(vi.fn()),
)

vi.mock('../../app/composables/useOr3Api', () => ({
  useOr3Api: () => ({
    request: apiRequest,
    buildUrl: (path: string) => `http://127.0.0.1:9100${path}`,
  }),
}))

vi.mock('../../app/composables/useAuthSession', () => ({
  useAuthSession: () => ({
    retryWithAuth,
  }),
}))

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
    vi.clearAllMocks()
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
    vi.stubGlobal('navigator', {
      credentials: { create: vi.fn(async () => new MockPublicKeyCredential()) },
    })

    let listCalls = 0
    apiRequest.mockImplementation(async (path: string, init?: RequestInit) => {
      if (path === '/internal/v1/auth/passkeys' && (!init?.method || init.method === 'GET')) {
        listCalls += 1
        const items =
          listCalls === 1
            ? [{ id: 'passkey-1', nickname: 'Phone' }]
            : [
                { id: 'passkey-1', nickname: 'Phone' },
                { id: 'passkey-2', nickname: 'Laptop' },
              ]
        return { items }
      }
      if (path === '/internal/v1/auth/passkeys/registration/begin') {
        return {
          ceremonyId: 'ceremony-1',
          options: { publicKey: { challenge: 'AQID', user: { id: 'BAUG' } } },
        }
      }
      if (path === '/internal/v1/auth/passkeys/registration/finish') {
        return { passkey: { id: 'passkey-2', nickname: 'Laptop' } }
      }
      if (path === '/internal/v1/auth/passkeys/passkey-2') {
        return { id: 'passkey-2', nickname: 'Work laptop' }
      }
      if (path === '/internal/v1/auth/passkeys/passkey-2/revoke') {
        return { id: 'passkey-2', status: 'revoked' }
      }
      throw new Error(`unexpected request: ${path}`)
    })

    const passkeys = usePasskeys()
    await expect(passkeys.listPasskeys(true)).resolves.toEqual([
      { id: 'passkey-1', nickname: 'Phone' },
    ])
    await expect(passkeys.registerPasskey({ nickname: 'Laptop' })).resolves.toMatchObject({
      id: 'passkey-2',
    })
    await passkeys.renamePasskey('passkey-2', 'Work laptop')
    expect(passkeys.passkeys.value.find((item) => item.id === 'passkey-2')).toMatchObject({
      nickname: 'Work laptop',
    })
    await passkeys.revokePasskey('passkey-2')
    expect(passkeys.passkeys.value.find((item) => item.id === 'passkey-2')).toBeUndefined()
  })
})
