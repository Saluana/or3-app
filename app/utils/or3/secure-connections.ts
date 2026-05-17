import { sha256 } from "@noble/hashes/sha2.js";
import {
  getNativeSecureStorageMode,
  readSecureConnectionStateFromNativeStorage,
  writeSecureConnectionStateToNativeStorage,
} from "~/utils/auth/nativeSecureStorage";

export const OR3_PAIRING_QR_PREFIX = "or3pair:v1:";
const BROWSER_STATE_KEY = "or3-app:v1:secure-connections";

export type SecureConnectionTrustLevel =
  | "native-hardware"
  | "native-software"
  | "web-limited"
  | "legacy";
export type SecureConnectionStorageState =
  | "hardware-backed"
  | "software-backed"
  | "browser-fallback"
  | "native-plugin-missing"
  | "restored-or-wiped";
export type SecureConnectionPairingState =
  | "idle"
  | "waiting"
  | "pending_approval"
  | "connected"
  | "rejected"
  | "expired"
  | "failed";

export interface PairingQRCodeV1 {
  version: 1;
  relayOrigin: string;
  rendezvousId: string;
  hostId: string;
  hostDisplayName: string;
  hostSigningPublicKey: string;
  hostNoisePublicKey: string;
  pairingSecret: string;
  expiresAtUnixMs: number;
  requestedAccountId?: string;
  capabilities: string[];
  qrNonce: string;
}

export interface DeviceIdentityRecord {
  version: 1;
  deviceId: string;
  displayName: string;
  platform: "ios" | "android" | "web" | "desktop";
  trustLevel: SecureConnectionTrustLevel;
  secureStorageMode: ReturnType<typeof getNativeSecureStorageMode>;
  deviceSigningPublicKey: string;
  deviceSigningPrivateKeyJwk: JsonWebKey;
  deviceNoisePublicKey: string;
  deviceNoisePrivateKeyJwk: JsonWebKey;
  createdAtUnixMs: number;
}

export interface HostEnrollmentRecord {
  hostId: string;
  hostSigningPublicKey: string;
  hostNoisePublicKey: string;
  enrollmentCertificate: unknown;
  enrollmentCertificateHash?: string;
  role: string;
  capabilities: string[];
  trustLevel: SecureConnectionTrustLevel;
  storedAtUnixMs: number;
}

export interface SecureConnectionStateRecord {
  deviceIdentity?: DeviceIdentityRecord;
  hosts: Record<string, HostEnrollmentRecord>;
}

export interface EnrollmentProposalV1 {
  version: 1;
  deviceId: string;
  deviceDisplayName: string;
  platform: DeviceIdentityRecord["platform"];
  deviceSigningPublicKey: string;
  deviceNoisePublicKey: string;
  requestedRole: "viewer" | "operator" | "admin";
  requestedCapabilities: string[];
  accountBinding?: {
    accountId: string;
    verifiedAtUnixMs: number;
  };
  secureStorageEvidence: {
    mode: ReturnType<typeof getNativeSecureStorageMode>;
    state: SecureConnectionStorageState;
    trustLevel: SecureConnectionTrustLevel;
  };
  createdAtUnixMs: number;
}

export interface SecureSessionClaims {
  host_id: string;
  device_id: string;
  enrollment_epoch: number;
  role: "viewer" | "operator" | "admin";
  capabilities: string[];
  trust_level: SecureConnectionTrustLevel;
  session_id: string;
  relay_route_id?: string;
  account_id?: string;
  step_up_at_unix_ms?: number;
  issued_at_unix_ms: number;
  expires_at_unix_ms: number;
}

export interface SecureFrameV1 {
  version: 1;
  kind: "noiseHandshake" | "noiseTransport" | "control";
  sessionId: string;
  sequence: number;
  correlationId: string;
  sentAtUnixMs: number;
  body: Uint8Array;
}

export interface WebEnrollmentPolicy {
  trustLevel: SecureConnectionTrustLevel;
  maxCertificateTtlMs: number;
  allowedCapabilities: string[];
  requiresStepUp: boolean;
}

function randomBytes(length: number) {
  if (
    typeof crypto === "undefined" ||
    typeof crypto.getRandomValues !== "function"
  ) {
    throw new Error("Secure random number generation is unavailable.");
  }
  return crypto.getRandomValues(new Uint8Array(length));
}

export function bytesToBase64URL(bytes: Uint8Array) {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary)
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
}

export function base64URLToBytes(raw: string) {
  const padded =
    raw.replace(/-/g, "+").replace(/_/g, "/") +
    "===".slice((raw.length + 3) % 4);
  const binary = atob(padded);
  const out = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) out[i] = binary.charCodeAt(i);
  return out;
}

export function hashBase64URL(...parts: Uint8Array[]) {
  const size = parts.reduce((total, part) => total + part.length + 1, 0);
  const buffer = new Uint8Array(size);
  let offset = 0;
  for (const part of parts) {
    buffer.set(part, offset);
    offset += part.length + 1;
  }
  return bytesToBase64URL(sha256(buffer));
}

export async function detectSecureConnectionStorage(): Promise<{
  mode: ReturnType<typeof getNativeSecureStorageMode>;
  state: SecureConnectionStorageState;
  trustLevel: SecureConnectionTrustLevel;
}> {
  const mode = getNativeSecureStorageMode();
  if (mode === "native-secure")
    return { mode, state: "software-backed", trustLevel: "native-software" };
  if (mode === "native-plugin-missing")
    return { mode, state: "native-plugin-missing", trustLevel: "web-limited" };
  return { mode, state: "browser-fallback", trustLevel: "web-limited" };
}

export function secureConnectionCapabilityDiscovery() {
  return {
    version: 1,
    supportedProtocolVersions: [1],
    qrPairingV2: true,
    relayRendezvous: true,
    enrollmentCertificates: true,
    secureFrames: true,
    legacyPairingRemote: false,
  };
}

export function defaultWebEnrollmentPolicy(): WebEnrollmentPolicy {
  return {
    trustLevel: "web-limited",
    maxCertificateTtlMs: 24 * 60 * 60 * 1000,
    allowedCapabilities: ["chat", "files"],
    requiresStepUp: true,
  };
}

export function applyWebEnrollmentRestrictions(
  platform: DeviceIdentityRecord["platform"],
  requestedCapabilities: string[],
  requestedExpiresAtUnixMs = 0,
  nowUnixMs = Date.now(),
) {
  const normalizedCapabilities = Array.from(
    new Set(
      requestedCapabilities
        .map((item) => item.trim().toLowerCase())
        .filter(Boolean),
    ),
  );
  if (platform !== "web") {
    return {
      capabilities: normalizedCapabilities,
      trustLevel:
        platform === "ios" || platform === "android"
          ? "native-software"
          : "web-limited",
      expiresAtUnixMs: requestedExpiresAtUnixMs,
    } satisfies {
      capabilities: string[];
      trustLevel: SecureConnectionTrustLevel;
      expiresAtUnixMs: number;
    };
  }
  const policy = defaultWebEnrollmentPolicy();
  const allowed = new Set(policy.allowedCapabilities);
  const maxExpiry = nowUnixMs + policy.maxCertificateTtlMs;
  return {
    capabilities: normalizedCapabilities.filter((item) => allowed.has(item)),
    trustLevel: policy.trustLevel,
    expiresAtUnixMs:
      requestedExpiresAtUnixMs > 0
        ? Math.min(requestedExpiresAtUnixMs, maxExpiry)
        : maxExpiry,
  };
}

export async function loadSecureConnectionState(): Promise<SecureConnectionStateRecord> {
  if (getNativeSecureStorageMode() === "native-secure") {
    const native = await readSecureConnectionStateFromNativeStorage();
    if (native) return native;
  }
  if (typeof localStorage === "undefined") return { hosts: {} };
  const raw = localStorage.getItem(BROWSER_STATE_KEY);
  if (!raw) return { hosts: {} };
  try {
    const parsed = JSON.parse(raw) as SecureConnectionStateRecord;
    return { ...parsed, hosts: parsed.hosts || {} };
  } catch {
    localStorage.removeItem(BROWSER_STATE_KEY);
    return { hosts: {} };
  }
}

export async function saveSecureConnectionState(
  state: SecureConnectionStateRecord,
) {
  const normalized = { ...state, hosts: state.hosts || {} };
  if (getNativeSecureStorageMode() === "native-secure") {
    await writeSecureConnectionStateToNativeStorage(normalized);
    if (typeof localStorage !== "undefined")
      localStorage.removeItem(BROWSER_STATE_KEY);
    return;
  }
  if (typeof localStorage !== "undefined")
    localStorage.setItem(BROWSER_STATE_KEY, JSON.stringify(normalized));
}

export async function getOrCreateDeviceIdentity(
  displayName = "or3-app",
): Promise<DeviceIdentityRecord> {
  const state = await loadSecureConnectionState();
  if (state.deviceIdentity) return state.deviceIdentity;
  const storage = await detectSecureConnectionStorage();
  const sign = (await crypto.subtle
    .generateKey({ name: "Ed25519" } as AlgorithmIdentifier, true, [
      "sign",
      "verify",
    ])
    .catch(() => {
      throw new Error(
        "This device cannot create the signing key required for secure pairing.",
      );
    })) as CryptoKeyPair;
  const noise = (await crypto.subtle
    .generateKey({ name: "X25519" } as AlgorithmIdentifier, true, [
      "deriveBits",
    ])
    .catch(() => {
      throw new Error(
        "This device cannot create the connection key required for secure pairing.",
      );
    })) as CryptoKeyPair;
  const signPublicRaw = new Uint8Array(
    await crypto.subtle.exportKey("raw", sign.publicKey),
  );
  const noisePublicRaw = new Uint8Array(
    await crypto.subtle.exportKey("raw", noise.publicKey),
  );
  const signPrivateJwk = await crypto.subtle.exportKey("jwk", sign.privateKey);
  const noisePrivateJwk = await crypto.subtle.exportKey(
    "jwk",
    noise.privateKey,
  );
  const createdAtUnixMs = Date.now();
  const identity: DeviceIdentityRecord = {
    version: 1,
    deviceId: `device_${hashBase64URL(new TextEncoder().encode(displayName), signPublicRaw, randomBytes(16)).slice(0, 22)}`,
    displayName,
    platform: detectPlatform(),
    trustLevel: storage.trustLevel,
    secureStorageMode: storage.mode,
    deviceSigningPublicKey: bytesToBase64URL(signPublicRaw),
    deviceSigningPrivateKeyJwk: signPrivateJwk,
    deviceNoisePublicKey: bytesToBase64URL(noisePublicRaw),
    deviceNoisePrivateKeyJwk: noisePrivateJwk,
    createdAtUnixMs,
  };
  await saveSecureConnectionState({ ...state, deviceIdentity: identity });
  return identity;
}

export function buildEnrollmentProposal(
  identity: DeviceIdentityRecord,
  requestedRole: "viewer" | "operator" | "admin" = "operator",
  requestedCapabilities: string[] = ["chat", "files", "terminal"],
  accountId = "",
): EnrollmentProposalV1 {
  const restricted = applyWebEnrollmentRestrictions(
    identity.platform,
    requestedCapabilities,
  );
  const accountBinding = accountId.trim()
    ? { accountId: accountId.trim(), verifiedAtUnixMs: Date.now() }
    : undefined;
  return {
    version: 1,
    deviceId: identity.deviceId,
    deviceDisplayName: identity.displayName,
    platform: identity.platform,
    deviceSigningPublicKey: identity.deviceSigningPublicKey,
    deviceNoisePublicKey: identity.deviceNoisePublicKey,
    requestedRole,
    requestedCapabilities: restricted.capabilities,
    accountBinding,
    secureStorageEvidence: {
      mode: identity.secureStorageMode,
      state:
        identity.secureStorageMode === "native-secure"
          ? "software-backed"
          : identity.secureStorageMode === "native-plugin-missing"
            ? "native-plugin-missing"
            : "browser-fallback",
      trustLevel: restricted.trustLevel,
    },
    createdAtUnixMs: Date.now(),
  };
}

export function shouldRekeySecureSession(
  claims: Pick<SecureSessionClaims, "issued_at_unix_ms" | "expires_at_unix_ms">,
  opts: {
    nowUnixMs?: number;
    appResumed?: boolean;
    messageCount?: number;
    byteCount?: number;
  } = {},
) {
  const now = opts.nowUnixMs ?? Date.now();
  if (opts.appResumed) return true;
  if (claims.expires_at_unix_ms <= now + 30_000) return true;
  if (now - claims.issued_at_unix_ms >= 10 * 60_000) return true;
  if ((opts.messageCount ?? 0) >= 8192) return true;
  if ((opts.byteCount ?? 0) >= 32 * 1024 * 1024) return true;
  return false;
}

export function rejectSensitiveDeepLink(rawUrl: string) {
  let parsed: URL;
  try {
    parsed = new URL(rawUrl);
  } catch {
    return true;
  }
  for (const key of parsed.searchParams.keys()) {
    const normalized = key.toLowerCase();
    if (
      normalized.includes("secret") ||
      normalized.includes("certificate") ||
      normalized.includes("session") ||
      normalized.includes("token")
    ) {
      return true;
    }
  }
  return false;
}

export function buildSecureFrame(
  input: Omit<SecureFrameV1, "version" | "sentAtUnixMs"> & {
    sentAtUnixMs?: number;
  },
): SecureFrameV1 {
  if (!input.sessionId || !input.correlationId || input.sequence <= 0)
    throw new Error("Secure frame metadata is incomplete.");
  return {
    version: 1,
    sentAtUnixMs: input.sentAtUnixMs ?? Date.now(),
    kind: input.kind,
    sessionId: input.sessionId,
    sequence: input.sequence,
    correlationId: input.correlationId,
    body: input.body,
  };
}

export async function storeHostEnrollment(record: HostEnrollmentRecord) {
  const state = await loadSecureConnectionState();
  await saveSecureConnectionState({
    ...state,
    hosts: {
      ...state.hosts,
      [record.hostId]: {
        ...record,
        storedAtUnixMs: record.storedAtUnixMs || Date.now(),
      },
    },
  });
}

export function parsePairingQRCode(
  raw: string,
  nowUnixMs = Date.now(),
): PairingQRCodeV1 {
  const trimmed = raw.trim();
  if (!trimmed.startsWith(OR3_PAIRING_QR_PREFIX))
    throw new Error("This is not an OR3 pairing code.");
  const payload = decodeCBOR(
    base64URLToBytes(trimmed.slice(OR3_PAIRING_QR_PREFIX.length)),
  ) as PairingQRCodeV1;
  if (payload.version !== 1)
    throw new Error("This pairing code uses an unsupported version.");
  if (
    !payload.rendezvousId ||
    !payload.hostId ||
    !payload.hostSigningPublicKey ||
    !payload.hostNoisePublicKey ||
    !payload.pairingSecret
  ) {
    throw new Error("This pairing code is incomplete.");
  }
  if (base64URLToBytes(payload.pairingSecret).length < 32)
    throw new Error("This pairing code is not secure enough.");
  if (payload.expiresAtUnixMs <= nowUnixMs)
    throw new Error("This pairing code expired. Show a new one.");
  return {
    ...payload,
    capabilities: Array.isArray(payload.capabilities)
      ? payload.capabilities
      : [],
  };
}

function detectPlatform(): DeviceIdentityRecord["platform"] {
  if (typeof navigator === "undefined") return "web";
  const ua = navigator.userAgent.toLowerCase();
  if (ua.includes("android")) return "android";
  if (ua.includes("iphone") || ua.includes("ipad")) return "ios";
  return "web";
}

function decodeCBOR(data: Uint8Array): unknown {
  let offset = 0;
  const read = (): unknown => {
    const first = data[offset++];
    if (first === undefined) throw new Error("Invalid CBOR payload.");
    const major = first >> 5;
    const additional = first & 0x1f;
    const byteAt = (index: number) => {
      const value = data[index];
      if (value === undefined) throw new Error("Invalid CBOR payload.");
      return value;
    };
    const readLen = (): number => {
      if (additional < 24) return additional;
      if (additional === 24) {
        const value = byteAt(offset);
        offset += 1;
        return value;
      }
      if (additional === 25) {
        const value = (byteAt(offset) << 8) | byteAt(offset + 1);
        offset += 2;
        return value;
      }
      if (additional === 26) {
        const value =
          byteAt(offset) * 2 ** 24 +
          (byteAt(offset + 1) << 16) +
          (byteAt(offset + 2) << 8) +
          byteAt(offset + 3);
        offset += 4;
        return value;
      }
      if (additional === 27) {
        const view = new DataView(data.buffer, data.byteOffset + offset, 8);
        const value = Number(view.getBigUint64(0));
        offset += 8;
        return value;
      }
      throw new Error("Unsupported CBOR length.");
    };
    if (major === 0) return readLen();
    if (major === 1) return -1 - readLen();
    if (major === 2) {
      const len = readLen();
      const value = data.slice(offset, offset + len);
      offset += len;
      return value;
    }
    if (major === 3) {
      const len = readLen();
      const value = new TextDecoder().decode(data.slice(offset, offset + len));
      offset += len;
      return value;
    }
    if (major === 4) {
      const len = readLen();
      return Array.from({ length: len }, () => read());
    }
    if (major === 5) {
      const len = readLen();
      const value: Record<string, unknown> = {};
      for (let i = 0; i < len; i += 1) {
        const key = read();
        value[String(key)] = read();
      }
      return value;
    }
    if (major === 7) {
      if (additional === 20) return false;
      if (additional === 21) return true;
      if (additional === 22) return null;
    }
    throw new Error("Unsupported CBOR payload.");
  };
  const decoded = read();
  if (offset !== data.length) throw new Error("Unexpected trailing CBOR data.");
  return decoded;
}
