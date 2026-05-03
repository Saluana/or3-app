import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  createWebAuthnCredential,
  getWebAuthnAssertion,
  getWebAuthnCapabilities,
  normalizeWebAuthnError,
  parseCreationOptions,
  parseRequestOptions,
} from '../../app/utils/auth/webauthn'

class MockPublicKeyCredential {
  id = 'credential-id'
  rawId = new Uint8Array([1, 2, 3]).buffer
  type = 'public-key'
  authenticatorAttachment = 'platform'
  response: AuthenticatorAttestationResponse | AuthenticatorAssertionResponse

  constructor(response: AuthenticatorAttestationResponse | AuthenticatorAssertionResponse) {
    this.response = response
  }

  getClientExtensionResults() {
    return {}
  }

  static isUserVerifyingPlatformAuthenticatorAvailable = vi.fn(async () => true)
  static isConditionalMediationAvailable = vi.fn(async () => false)
}

describe('webauthn utilities', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('parses server JSON options into browser credential options', () => {
    const creation = parseCreationOptions({
      challenge: 'AQID',
      user: { id: 'BAUG', name: 'owner', displayName: 'Owner' },
      excludeCredentials: [{ type: 'public-key', id: 'BwgJ' }],
    })
    expect(creation.challenge).toBeInstanceOf(ArrayBuffer)
    expect(creation.user.id).toBeInstanceOf(ArrayBuffer)
    expect(creation.excludeCredentials?.[0].id).toBeInstanceOf(ArrayBuffer)

    const request = parseRequestOptions({
      challenge: 'AQID',
      allowCredentials: [{ type: 'public-key', id: 'BwgJ' }],
    })
    expect(request.challenge).toBeInstanceOf(ArrayBuffer)
    expect(request.allowCredentials?.[0].id).toBeInstanceOf(ArrayBuffer)

    const wrapped = parseRequestOptions({
      publicKey: {
        challenge: 'AQID',
        allowCredentials: [{ type: 'public-key', id: 'BwgJ' }],
      },
      mediation: 'optional',
    })
    expect(wrapped.challenge).toBeInstanceOf(ArrayBuffer)
    expect(wrapped.allowCredentials?.[0].id).toBeInstanceOf(ArrayBuffer)
  })

  it('detects platform WebAuthn support and serializes create/get responses', async () => {
    vi.stubGlobal('PublicKeyCredential', MockPublicKeyCredential)
    const create = vi.fn(async () => new MockPublicKeyCredential({
      clientDataJSON: new Uint8Array([4]).buffer,
      attestationObject: new Uint8Array([5]).buffer,
      getTransports: () => ['internal'],
    } as unknown as AuthenticatorAttestationResponse))
    const get = vi.fn(async () => new MockPublicKeyCredential({
      clientDataJSON: new Uint8Array([6]).buffer,
      authenticatorData: new Uint8Array([7]).buffer,
      signature: new Uint8Array([8]).buffer,
      userHandle: new Uint8Array([9]).buffer,
    } as unknown as AuthenticatorAssertionResponse))
    vi.stubGlobal('navigator', { credentials: { create, get } })

    await expect(getWebAuthnCapabilities()).resolves.toMatchObject({
      supported: true,
      platformAuthenticatorAvailable: true,
      conditionalMediationAvailable: false,
    })
    await expect(createWebAuthnCredential({ challenge: 'AQID', user: { id: 'BAUG' } })).resolves.toMatchObject({
      id: 'credential-id',
      rawId: 'AQID',
      response: { attestationObject: 'BQ', transports: ['internal'] },
    })
    await expect(getWebAuthnAssertion({ publicKey: { challenge: 'AQID' }, mediation: 'optional' })).resolves.toMatchObject({
      id: 'credential-id',
      response: { authenticatorData: 'Bw', signature: 'CA', userHandle: 'CQ' },
    })
    expect(get).toHaveBeenLastCalledWith(expect.objectContaining({ mediation: 'optional' }))
  })

  it('normalizes browser passkey errors for inline auth prompts', () => {
    const cancelled = normalizeWebAuthnError(new DOMException('No credential', 'NotAllowedError'))
    expect(cancelled).toMatchObject({ code: 'PASSKEY_REQUIRED', message: 'Passkey verification was cancelled or timed out.' })
  })
})
