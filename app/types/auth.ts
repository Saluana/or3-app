export type AuthChallengeCode =
  | 'SESSION_REQUIRED'
  | 'PASSKEY_REQUIRED'
  | 'STEP_UP_REQUIRED'
  | 'SESSION_EXPIRED'
  | 'AUTH_UNSUPPORTED'

export interface AuthCapabilities {
  passkeysEnabled: boolean
  passkeyMode: 'off' | 'warn' | 'enforce-sensitive' | 'enforce-session' | string
  rpId?: string
  origins?: string[]
  webauthnAvailable?: boolean
  sessionRequired?: boolean
  stepUpRequiredForSensitive?: boolean
  secureStorageRecommended?: boolean
  fallbackPolicy?: string
  sessionHeader?: string
}

export interface AuthUser {
  id: string
  display_name?: string
  displayName?: string
  created_at?: number
  updated_at?: number
}

export interface AuthSessionRecord {
  id: string
  user_id: string
  device_id?: string
  credential_id?: string
  role?: string
  created_at?: number
  last_seen_at?: number
  idle_expires_at?: number
  absolute_expires_at?: number
  revoked_at?: number
  revoked_reason?: string
  last_step_up_at?: number
  last_step_up_credential_id?: string
  last_step_up_reason?: string
  user_agent_hash?: string
  remote_addr_hash?: string
}

export interface AuthSessionState {
  session: AuthSessionRecord
  user: AuthUser
  role: string
}

export interface AuthPasskey {
  id: string
  user_id: string
  device_id?: string
  nickname?: string
  credential_id?: string
  transports?: string[] | string
  sign_count?: number
  created_at?: number
  updated_at?: number
  last_used_at?: number
  revoked_at?: number
  revoked_reason?: string
  backup_eligible?: boolean
  backup_state?: boolean
}

export interface AuthChallengeError {
  code: AuthChallengeCode
  message: string
  status?: number
  retryAfterSeconds?: number
  retryAfterMs?: number
}

export interface WebAuthnCeremonyResponse {
  ceremonyId: string
  options: PublicKeyCredentialCreationOptions | PublicKeyCredentialRequestOptions | Record<string, unknown>
}

export interface PasskeyLoginResult {
  sessionToken: string
  session: AuthSessionRecord
  user: AuthUser
  role?: string
  credentialId?: string
}
