import type { AuthChallengeError } from '~/types/auth'

function base64UrlToBuffer(value: string) {
  const normalized = value.replace(/-/g, '+').replace(/_/g, '/')
  const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, '=')
  const binary = atob(padded)
  const bytes = new Uint8Array(binary.length)
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index)
  }
  return bytes.buffer
}

function bufferToBase64Url(value: ArrayBuffer | ArrayBufferView | null | undefined) {
  if (!value) return undefined
  const bytes = value instanceof ArrayBuffer
    ? new Uint8Array(value)
    : new Uint8Array(value.buffer, value.byteOffset, value.byteLength)
  let binary = ''
  for (const byte of bytes) binary += String.fromCharCode(byte)
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '')
}

function normalizeDescriptor(descriptor: Record<string, unknown>) {
  return {
    ...descriptor,
    id: typeof descriptor.id === 'string' ? base64UrlToBuffer(descriptor.id) : descriptor.id,
  }
}

function unwrapPublicKeyOptions(input: Record<string, unknown>) {
  const publicKey = input.publicKey
  if (publicKey && typeof publicKey === 'object') return publicKey as Record<string, unknown>
  return input
}

function credentialMediation(input: Record<string, unknown>) {
  return typeof input.mediation === 'string' ? input.mediation as CredentialMediationRequirement : undefined
}

export function parseCreationOptions(input: Record<string, unknown>) {
  const options = unwrapPublicKeyOptions(input)
  return {
    ...options,
    challenge: typeof options.challenge === 'string' ? base64UrlToBuffer(options.challenge) : options.challenge,
    user: options.user && typeof options.user === 'object'
      ? {
          ...(options.user as Record<string, unknown>),
          id: typeof (options.user as Record<string, unknown>).id === 'string'
            ? base64UrlToBuffer((options.user as Record<string, unknown>).id as string)
            : (options.user as Record<string, unknown>).id,
        }
      : options.user,
    excludeCredentials: Array.isArray(options.excludeCredentials)
      ? options.excludeCredentials.map((descriptor) => normalizeDescriptor(descriptor as Record<string, unknown>))
      : options.excludeCredentials,
  } as PublicKeyCredentialCreationOptions
}

export function parseRequestOptions(input: Record<string, unknown>) {
  const options = unwrapPublicKeyOptions(input)
  return {
    ...options,
    challenge: typeof options.challenge === 'string' ? base64UrlToBuffer(options.challenge) : options.challenge,
    allowCredentials: Array.isArray(options.allowCredentials)
      ? options.allowCredentials.map((descriptor) => normalizeDescriptor(descriptor as Record<string, unknown>))
      : options.allowCredentials,
  } as PublicKeyCredentialRequestOptions
}

export function serializeCredential(credential: PublicKeyCredential) {
  const response = credential.response
  const clientExtensionResults = typeof credential.getClientExtensionResults === 'function'
    ? credential.getClientExtensionResults()
    : {}

  return {
    id: credential.id,
    rawId: bufferToBase64Url(credential.rawId),
    type: credential.type,
    authenticatorAttachment: credential.authenticatorAttachment ?? undefined,
    clientExtensionResults,
    response: {
      clientDataJSON: bufferToBase64Url(response.clientDataJSON),
      attestationObject: 'attestationObject' in response ? bufferToBase64Url((response as AuthenticatorAttestationResponse).attestationObject) : undefined,
      authenticatorData: 'authenticatorData' in response ? bufferToBase64Url((response as AuthenticatorAssertionResponse).authenticatorData) : undefined,
      signature: 'signature' in response ? bufferToBase64Url((response as AuthenticatorAssertionResponse).signature) : undefined,
      userHandle: 'userHandle' in response ? bufferToBase64Url((response as AuthenticatorAssertionResponse).userHandle) : undefined,
      transports: typeof (response as AuthenticatorAttestationResponse).getTransports === 'function'
        ? (response as AuthenticatorAttestationResponse).getTransports()
        : undefined,
    },
  }
}

export async function isWebAuthnSupported() {
  return typeof window !== 'undefined' && typeof window.PublicKeyCredential !== 'undefined'
}

export async function getWebAuthnCapabilities() {
  const supported = await isWebAuthnSupported()
  if (!supported) {
    return { supported: false, platformAuthenticatorAvailable: false, conditionalMediationAvailable: false }
  }
  const ctor = window.PublicKeyCredential as typeof PublicKeyCredential & {
    isUserVerifyingPlatformAuthenticatorAvailable?: () => Promise<boolean>
    isConditionalMediationAvailable?: () => Promise<boolean>
  }
  const platformAuthenticatorAvailable = typeof ctor.isUserVerifyingPlatformAuthenticatorAvailable === 'function'
    ? await ctor.isUserVerifyingPlatformAuthenticatorAvailable().catch(() => false)
    : false
  const conditionalMediationAvailable = typeof ctor.isConditionalMediationAvailable === 'function'
    ? await ctor.isConditionalMediationAvailable().catch(() => false)
    : false
  return { supported, platformAuthenticatorAvailable, conditionalMediationAvailable }
}

export async function createWebAuthnCredential(options: Record<string, unknown>, signal?: AbortSignal) {
  if (!await isWebAuthnSupported()) throw new Error('WebAuthn is not available on this device.')
  const credential = await navigator.credentials.create({ publicKey: parseCreationOptions(options), signal })
  if (!(credential instanceof PublicKeyCredential)) throw new Error('Passkey registration was cancelled.')
  return serializeCredential(credential)
}

export async function getWebAuthnAssertion(options: Record<string, unknown>, signal?: AbortSignal) {
  if (!await isWebAuthnSupported()) throw new Error('WebAuthn is not available on this device.')
  const mediation = credentialMediation(options)
  const credential = await navigator.credentials.get({ publicKey: parseRequestOptions(options), signal, ...(mediation ? { mediation } : {}) })
  if (!(credential instanceof PublicKeyCredential)) throw new Error('Passkey verification was cancelled.')
  return serializeCredential(credential)
}

export function normalizeWebAuthnError(error: unknown): AuthChallengeError | Error {
  if (error instanceof DOMException) {
    const message = error.name === 'NotAllowedError'
      ? 'Passkey verification was cancelled or timed out.'
      : error.name === 'InvalidStateError'
        ? 'This passkey is already registered on this device.'
        : error.message || 'Passkey verification failed.'
    return { code: 'PASSKEY_REQUIRED', message, status: 400 }
  }
  if (error instanceof Error) return error
  return new Error('Passkey verification failed.')
}
