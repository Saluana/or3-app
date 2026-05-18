import { sha256 } from '@noble/hashes/sha2.js';
import { Capacitor } from '@capacitor/core';
import jsQR from 'jsqr';
import {
    getNativeSecureStorageMode,
    readSecureConnectionStateFromNativeStorage,
    writeSecureConnectionStateToNativeStorage,
} from '~/utils/auth/nativeSecureStorage';

export const OR3_PAIRING_QR_PREFIX = 'or3pair:v1:';
export const OR3_PAIRING_INVITE_V2_PREFIX = 'or3pair:v2:';
const BROWSER_STATE_KEY = 'or3-app:v1:secure-connections';
const textEncoder = new TextEncoder();
const ENROLLMENT_PROPOSAL_SIGNATURE_DOMAIN = textEncoder.encode(
    'OR3-ENROLLMENT-PROPOSAL-V1',
);
const NOISE_PROLOGUE_DOMAIN = textEncoder.encode('OR3-NOISE-PROLOGUE-V1');
const NOISE_TRANSCRIPT_DOMAIN = textEncoder.encode(
    'OR3-NOISE-IK-TRANSCRIPT-V1',
);

export type SecureConnectionTrustLevel =
    | 'native-hardware'
    | 'native-software'
    | 'web-limited'
    | 'legacy';
export type SecureConnectionStorageState =
    | 'hardware-backed'
    | 'software-backed'
    | 'browser-fallback'
    | 'native-plugin-missing'
    | 'restored-or-wiped';
export type SecureConnectionPairingState =
    | 'idle'
    | 'waiting'
    | 'pending_approval'
    | 'connected'
    | 'rejected'
    | 'expired'
    | 'failed';

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
    serviceBaseUrl?: string;
    requestedAccountId?: string;
    capabilities: string[];
    qrNonce: string;
}

export interface PairingInviteRouteV2 {
    kind: 'app-proxy' | 'direct' | 'loopback';
    baseUrl: string;
    priority: number;
}

export interface PairingInviteV2 {
    version: 2;
    kind: 'or3.pair.invite';
    inviteId: string;
    issuedAtUnixMs: number;
    expiresAtUnixMs: number;
    host: {
        id: string;
        displayName: string;
        signingPublicKey: string;
        noisePublicKey: string;
    };
    pairing: {
        rendezvousId: string;
        pairingSecret: string;
        qrNonce: string;
    };
    capabilities: string[];
    routes: PairingInviteRouteV2[];
    checksum?: string;
    signature?: string;
    legacyQr?: string;
}

export type ParsedPairingInvite =
    | { version: 1; qr: PairingQRCodeV1; raw: string; routes: PairingInviteRouteV2[] }
    | { version: 2; invite: PairingInviteV2; raw: string; routes: PairingInviteRouteV2[] };

export interface DeviceIdentityRecord {
    version: 1;
    deviceId: string;
    displayName: string;
    platform: 'ios' | 'android' | 'web' | 'desktop';
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
    relayOrigin?: string;
    serviceBaseUrl?: string;
    accountId?: string;
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
    platform: DeviceIdentityRecord['platform'];
    deviceSigningPublicKey: string;
    deviceNoisePublicKey: string;
    requestedRole: 'viewer' | 'operator' | 'admin';
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
    signature?: string;
}

export interface SessionPrologueV1 {
    protocol: 'or3-secure-runtime';
    version: 1;
    relayOrigin: string;
    routeId: string;
    hostId: string;
    deviceIdHash: string;
    enrollmentCertificateHash: string;
    accountId?: string;
    minProtocolVersion: 1;
    maxProtocolVersion: 1;
}

export interface SecureSessionStartRequest {
    device_id: string;
    device_noise_public_key: string;
    relay_route_id: string;
    relay_origin: string;
    enrollment_certificate_hash: string;
    account_id?: string;
    noise_handshake: NoiseHandshakeInitV1;
    ttl_seconds: number;
}

export interface SecureSessionClaims {
    host_id: string;
    device_id: string;
    enrollment_epoch: number;
    role: 'viewer' | 'operator' | 'admin';
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
    kind: 'noiseHandshake' | 'noiseTransport' | 'control';
    sessionId: string;
    sequence: number;
    correlationId: string;
    sentAtUnixMs: number;
    body: Uint8Array;
}

export interface NoiseHandshakeInitV1 {
    version: 1;
    prologueHash: string;
    deviceId: string;
    deviceNoisePublicKey: string;
    deviceEphemeralKey: string;
    enrollmentCertHash: string;
}

export interface WebEnrollmentPolicy {
    trustLevel: SecureConnectionTrustLevel;
    maxCertificateTtlMs: number;
    allowedCapabilities: string[];
    requiresStepUp: boolean;
}

function randomBytes(length: number) {
    if (
        typeof crypto === 'undefined' ||
        typeof crypto.getRandomValues !== 'function'
    ) {
        throw new Error('Secure random number generation is unavailable.');
    }
    return crypto.getRandomValues(new Uint8Array(length));
}

export function bytesToBase64URL(bytes: Uint8Array) {
    let binary = '';
    for (const byte of bytes) binary += String.fromCharCode(byte);
    return btoa(binary)
        .replace(/\+/g, '-')
        .replace(/\//g, '_')
        .replace(/=+$/g, '');
}

export function base64URLToBytes(raw: string) {
    const padded =
        raw.replace(/-/g, '+').replace(/_/g, '/') +
        '==='.slice((raw.length + 3) % 4);
    const binary = atob(padded);
    const out = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i += 1) out[i] = binary.charCodeAt(i);
    return out;
}

function bytesToUtf8(bytes: Uint8Array) {
    return new TextDecoder().decode(bytes);
}

function utf8ToBytes(value: string) {
    return new TextEncoder().encode(value);
}

function extractInviteText(raw: string) {
    const trimmed = raw.trim();
    try {
        const parsed = new URL(trimmed);
        const hash = new URLSearchParams(parsed.hash.replace(/^#/, ''));
        const query = parsed.searchParams;
        return hash.get('invite') || query.get('invite') || trimmed;
    } catch {
        const hashIndex = trimmed.indexOf('#');
        if (hashIndex >= 0) {
            const hash = new URLSearchParams(trimmed.slice(hashIndex + 1));
            return hash.get('invite') || trimmed;
        }
        return trimmed;
    }
}

function normalizeInviteRoutes(routes: PairingInviteRouteV2[] = []) {
    return routes
        .filter((route) => route?.baseUrl && route?.kind)
        .map((route) => ({
            kind: route.kind,
            baseUrl: route.baseUrl.trim().replace(/\/+$/g, ''),
            priority: Number.isFinite(route.priority) ? route.priority : 100,
        }))
        .sort((a, b) => a.priority - b.priority);
}

export function encodePairingInviteV2(invite: PairingInviteV2) {
    return bytesToBase64URL(utf8ToBytes(JSON.stringify(invite)));
}

export function encodePairingInviteV2Text(invite: PairingInviteV2) {
    return `${OR3_PAIRING_INVITE_V2_PREFIX}${encodePairingInviteV2(invite)}`;
}

export function pairingInviteLink(origin: string, invite: PairingInviteV2) {
    return `${origin.replace(/\/+$/g, '')}/pair#invite=${encodePairingInviteV2(invite)}`;
}

export function pairingInviteToQRCodeV1(invite: PairingInviteV2): PairingQRCodeV1 {
    return {
        version: 1,
        relayOrigin: '',
        rendezvousId: invite.pairing.rendezvousId,
        hostId: invite.host.id,
        hostDisplayName: invite.host.displayName,
        hostSigningPublicKey: invite.host.signingPublicKey,
        hostNoisePublicKey: invite.host.noisePublicKey,
        pairingSecret: invite.pairing.pairingSecret,
        expiresAtUnixMs: invite.expiresAtUnixMs,
        serviceBaseUrl: normalizeInviteRoutes(invite.routes)[0]?.baseUrl,
        capabilities: Array.isArray(invite.capabilities) ? invite.capabilities : [],
        qrNonce: invite.pairing.qrNonce,
    };
}

export function parsePairingInvite(raw: string, nowUnixMs = Date.now()): ParsedPairingInvite {
    const extracted = extractInviteText(raw);
    if (extracted.startsWith(OR3_PAIRING_QR_PREFIX)) {
        const qr = parsePairingQRCode(extracted, nowUnixMs);
        return {
            version: 1,
            qr,
            raw: extracted,
            routes: qr.serviceBaseUrl
                ? [{ kind: 'direct', baseUrl: qr.serviceBaseUrl, priority: 50 }]
                : [],
        };
    }
    const encoded = extracted.startsWith(OR3_PAIRING_INVITE_V2_PREFIX)
        ? extracted.slice(OR3_PAIRING_INVITE_V2_PREFIX.length)
        : extracted;
    let invite: PairingInviteV2;
    try {
        invite = JSON.parse(bytesToUtf8(base64URLToBytes(encoded))) as PairingInviteV2;
    } catch {
        throw new Error('This is not an OR3 pairing invite.');
    }
    if (invite.version !== 2 || invite.kind !== 'or3.pair.invite') {
        throw new Error('This pairing invite uses an unsupported version.');
    }
    if (invite.expiresAtUnixMs <= nowUnixMs) {
        throw new Error('This code expired. Refresh the QR on your computer.');
    }
    if (
        !invite.inviteId ||
        !invite.host?.id ||
        !invite.host?.signingPublicKey ||
        !invite.host?.noisePublicKey ||
        !invite.pairing?.rendezvousId ||
        !invite.pairing?.pairingSecret
    ) {
        throw new Error('This pairing invite is incomplete. Refresh the QR on your computer.');
    }
    if (base64URLToBytes(invite.pairing.pairingSecret).length < 32) {
        throw new Error('This pairing invite is not secure enough. Refresh the QR on your computer.');
    }
    return {
        version: 2,
        invite: {
            ...invite,
            capabilities: Array.isArray(invite.capabilities) ? invite.capabilities : [],
            routes: normalizeInviteRoutes(invite.routes),
        },
        raw: extracted,
        routes: normalizeInviteRoutes(invite.routes),
    };
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

function concatByteArrays(...parts: Uint8Array[]) {
    const total = parts.reduce((sum, part) => sum + part.length, 0);
    const out = new Uint8Array(total);
    let offset = 0;
    for (const part of parts) {
        out.set(part, offset);
        offset += part.length;
    }
    return out;
}

function compareBytes(left: Uint8Array, right: Uint8Array) {
    if (left.length !== right.length) return left.length - right.length;
    for (let index = 0; index < left.length; index += 1) {
        const diff = left[index]! - right[index]!;
        if (diff !== 0) return diff;
    }
    return 0;
}

function encodeCborHeader(majorType: number, value: number | bigint) {
    const asBigInt = typeof value === 'bigint' ? value : BigInt(value);
    if (asBigInt < 24n)
        return Uint8Array.of((majorType << 5) | Number(asBigInt));
    if (asBigInt <= 0xffn)
        return Uint8Array.of((majorType << 5) | 24, Number(asBigInt));
    if (asBigInt <= 0xffffn) {
        return Uint8Array.of(
            (majorType << 5) | 25,
            Number((asBigInt >> 8n) & 0xffn),
            Number(asBigInt & 0xffn),
        );
    }
    if (asBigInt <= 0xffff_ffffn) {
        return Uint8Array.of(
            (majorType << 5) | 26,
            Number((asBigInt >> 24n) & 0xffn),
            Number((asBigInt >> 16n) & 0xffn),
            Number((asBigInt >> 8n) & 0xffn),
            Number(asBigInt & 0xffn),
        );
    }
    return Uint8Array.of(
        (majorType << 5) | 27,
        Number((asBigInt >> 56n) & 0xffn),
        Number((asBigInt >> 48n) & 0xffn),
        Number((asBigInt >> 40n) & 0xffn),
        Number((asBigInt >> 32n) & 0xffn),
        Number((asBigInt >> 24n) & 0xffn),
        Number((asBigInt >> 16n) & 0xffn),
        Number((asBigInt >> 8n) & 0xffn),
        Number(asBigInt & 0xffn),
    );
}

function encodeCanonicalCBOR(value: unknown): Uint8Array {
    if (value === null) return Uint8Array.of(0xf6);
    if (value === false) return Uint8Array.of(0xf4);
    if (value === true) return Uint8Array.of(0xf5);
    if (typeof value === 'number') {
        if (Number.isSafeInteger(value)) {
            if (value >= 0) return encodeCborHeader(0, value);
            return encodeCborHeader(1, -1 - value);
        }
        const bytes = new Uint8Array(9);
        bytes[0] = 0xfb;
        new DataView(bytes.buffer).setFloat64(1, value, false);
        return bytes;
    }
    if (typeof value === 'bigint') {
        if (value >= 0n) return encodeCborHeader(0, value);
        return encodeCborHeader(1, -1n - value);
    }
    if (typeof value === 'string') {
        const encoded = textEncoder.encode(value);
        return concatByteArrays(encodeCborHeader(3, encoded.length), encoded);
    }
    if (value instanceof Uint8Array) {
        return concatByteArrays(encodeCborHeader(2, value.length), value);
    }
    if (Array.isArray(value)) {
        return concatByteArrays(
            encodeCborHeader(4, value.length),
            ...value.map((item) => encodeCanonicalCBOR(item)),
        );
    }
    if (typeof value === 'object') {
        const entries = Object.entries(value as Record<string, unknown>)
            .filter(([, item]) => item !== undefined)
            .map(([key, item]) => ({
                key: encodeCanonicalCBOR(key),
                value: encodeCanonicalCBOR(item),
            }))
            .sort((left, right) => compareBytes(left.key, right.key));
        return concatByteArrays(
            encodeCborHeader(5, entries.length),
            ...entries.flatMap((entry) => [entry.key, entry.value]),
        );
    }
    throw new Error('Unsupported secure-connection value.');
}

export function buildEnrollmentProposalSigningBytes(
    proposal: EnrollmentProposalV1,
) {
    return concatByteArrays(
        ENROLLMENT_PROPOSAL_SIGNATURE_DOMAIN,
        encodeCanonicalCBOR({ ...proposal, signature: undefined }),
    );
}

export async function signEnrollmentProposal(
    identity: DeviceIdentityRecord,
    proposal: EnrollmentProposalV1,
) {
    const privateKey = await crypto.subtle.importKey(
        'jwk',
        identity.deviceSigningPrivateKeyJwk,
        { name: 'Ed25519' },
        false,
        ['sign'],
    );
    const signature = await crypto.subtle.sign(
        { name: 'Ed25519' },
        privateKey,
        buildEnrollmentProposalSigningBytes(proposal),
    );
    return {
        ...proposal,
        signature: bytesToBase64URL(new Uint8Array(signature)),
    } satisfies EnrollmentProposalV1;
}

export function buildSecureSessionPrologue(
    identity: DeviceIdentityRecord,
    host: HostEnrollmentRecord,
    routeId: string,
    accountId = host.accountId || '',
): SessionPrologueV1 {
    const relayOrigin =
        host.relayOrigin?.trim() || host.serviceBaseUrl?.trim() || '';
    if (!relayOrigin) {
        throw new Error('Secure session routing is missing a relay origin.');
    }
    if (!host.enrollmentCertificateHash?.trim()) {
        throw new Error('Secure enrollment certificate hash is missing.');
    }
    return {
        protocol: 'or3-secure-runtime',
        version: 1,
        relayOrigin,
        routeId: routeId.trim(),
        hostId: host.hostId,
        deviceIdHash: hashBase64URL(textEncoder.encode(identity.deviceId)),
        enrollmentCertificateHash: host.enrollmentCertificateHash,
        accountId: accountId.trim() || undefined,
        minProtocolVersion: 1,
        maxProtocolVersion: 1,
    };
}

export function buildSecureSessionPrologueHash(prologue: SessionPrologueV1) {
    return hashBase64URL(NOISE_PROLOGUE_DOMAIN, encodeCanonicalCBOR(prologue));
}

export async function detectSecureConnectionStorage(): Promise<{
    mode: ReturnType<typeof getNativeSecureStorageMode>;
    state: SecureConnectionStorageState;
    trustLevel: SecureConnectionTrustLevel;
}> {
    const mode = getNativeSecureStorageMode();
    if (mode === 'native-secure')
        return { mode, state: 'software-backed', trustLevel: 'web-limited' };
    if (mode === 'native-plugin-missing')
        return {
            mode,
            state: 'native-plugin-missing',
            trustLevel: 'web-limited',
        };
    return { mode, state: 'browser-fallback', trustLevel: 'web-limited' };
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
        trustLevel: 'web-limited',
        maxCertificateTtlMs: 24 * 60 * 60 * 1000,
        allowedCapabilities: ['chat', 'files'],
        requiresStepUp: true,
    };
}

export function applyWebEnrollmentRestrictions(
    platform: DeviceIdentityRecord['platform'],
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
    if (platform !== 'web') {
        return {
            capabilities: normalizedCapabilities,
            trustLevel:
                platform === 'ios' || platform === 'android'
                    ? 'native-software'
                    : 'web-limited',
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
        capabilities: normalizedCapabilities.filter((item) =>
            allowed.has(item),
        ),
        trustLevel: policy.trustLevel,
        expiresAtUnixMs:
            requestedExpiresAtUnixMs > 0
                ? Math.min(requestedExpiresAtUnixMs, maxExpiry)
                : maxExpiry,
    };
}

export async function loadSecureConnectionState(): Promise<SecureConnectionStateRecord> {
    if (getNativeSecureStorageMode() === 'native-secure') {
        const native = await readSecureConnectionStateFromNativeStorage();
        if (native) return native;
    }
    if (typeof localStorage === 'undefined') return { hosts: {} };
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
    if (getNativeSecureStorageMode() === 'native-secure') {
        await writeSecureConnectionStateToNativeStorage(normalized);
        if (typeof localStorage !== 'undefined')
            localStorage.removeItem(BROWSER_STATE_KEY);
        return;
    }
    if (typeof localStorage !== 'undefined')
        localStorage.setItem(BROWSER_STATE_KEY, JSON.stringify(normalized));
}

export async function getOrCreateDeviceIdentity(
    displayName = 'or3-app',
): Promise<DeviceIdentityRecord> {
    const state = await loadSecureConnectionState();
    if (state.deviceIdentity) return state.deviceIdentity;
    const storage = await detectSecureConnectionStorage();
    const sign = (await crypto.subtle
        .generateKey({ name: 'Ed25519' } as AlgorithmIdentifier, true, [
            'sign',
            'verify',
        ])
        .catch(() => {
            throw new Error(
                'This device cannot create the signing key required for secure pairing.',
            );
        })) as CryptoKeyPair;
    const noise = (await crypto.subtle
        .generateKey({ name: 'X25519' } as AlgorithmIdentifier, true, [
            'deriveBits',
        ])
        .catch(() => {
            throw new Error(
                'This device cannot create the connection key required for secure pairing.',
            );
        })) as CryptoKeyPair;
    const signPublicRaw = new Uint8Array(
        await crypto.subtle.exportKey('raw', sign.publicKey),
    );
    const noisePublicRaw = new Uint8Array(
        await crypto.subtle.exportKey('raw', noise.publicKey),
    );
    const signPrivateJwk = await crypto.subtle.exportKey(
        'jwk',
        sign.privateKey,
    );
    const noisePrivateJwk = await crypto.subtle.exportKey(
        'jwk',
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
    requestedRole: 'viewer' | 'operator' | 'admin' = 'operator',
    requestedCapabilities: string[] = ['chat', 'files', 'terminal'],
    accountId = '',
): EnrollmentProposalV1 {
    const restricted = applyWebEnrollmentRestrictions(
        identity.platform,
        requestedCapabilities,
    );
    const downgraded =
        identity.trustLevel !== 'native-software' &&
        identity.trustLevel !== 'native-hardware';
    const fallbackPolicy = defaultWebEnrollmentPolicy();
    const capabilities = downgraded
        ? restricted.capabilities.filter((item) =>
              fallbackPolicy.allowedCapabilities.includes(item),
          )
        : restricted.capabilities;
    const trustLevel = downgraded
        ? fallbackPolicy.trustLevel
        : restricted.trustLevel;
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
        requestedCapabilities: capabilities,
        accountBinding,
        secureStorageEvidence: {
            mode: identity.secureStorageMode,
            state:
                identity.secureStorageMode === 'native-secure'
                    ? 'software-backed'
                    : identity.secureStorageMode === 'native-plugin-missing'
                      ? 'native-plugin-missing'
                      : 'browser-fallback',
            trustLevel,
        },
        createdAtUnixMs: Date.now(),
    };
}

export function shouldRekeySecureSession(
    claims: Pick<
        SecureSessionClaims,
        'issued_at_unix_ms' | 'expires_at_unix_ms'
    >,
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
            normalized.includes('secret') ||
            normalized.includes('certificate') ||
            normalized.includes('session') ||
            normalized.includes('token')
        ) {
            return true;
        }
    }
    return false;
}

export function buildSecureFrame(
    input: Omit<SecureFrameV1, 'version' | 'sentAtUnixMs'> & {
        sentAtUnixMs?: number;
    },
): SecureFrameV1 {
    if (!input.sessionId || !input.correlationId || input.sequence <= 0)
        throw new Error('Secure frame metadata is incomplete.');
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

export async function buildMobileNoiseHandshake(
    identity: DeviceIdentityRecord,
    host: HostEnrollmentRecord,
    routeId: string,
) {
    const ephemeral = (await crypto.subtle.generateKey(
        { name: 'X25519' } as AlgorithmIdentifier,
        true,
        ['deriveBits'],
    )) as CryptoKeyPair;
    const hostPublicKey = await crypto.subtle.importKey(
        'raw',
        base64URLToBytes(host.hostNoisePublicKey),
        { name: 'X25519' } as AlgorithmIdentifier,
        false,
        [],
    );
    const devicePrivateKey = await crypto.subtle.importKey(
        'jwk',
        identity.deviceNoisePrivateKeyJwk,
        { name: 'X25519' } as AlgorithmIdentifier,
        false,
        ['deriveBits'],
    );
    const es = new Uint8Array(
        await crypto.subtle.deriveBits(
            { name: 'X25519', public: hostPublicKey } as AlgorithmIdentifier,
            ephemeral.privateKey,
            256,
        ),
    );
    const ss = new Uint8Array(
        await crypto.subtle.deriveBits(
            { name: 'X25519', public: hostPublicKey } as AlgorithmIdentifier,
            devicePrivateKey,
            256,
        ),
    );
    const ephemeralPublic = new Uint8Array(
        await crypto.subtle.exportKey('raw', ephemeral.publicKey),
    );
    const prologue = buildSecureSessionPrologue(identity, host, routeId);
    const prologueHash = buildSecureSessionPrologueHash(prologue);
    const transcript = hashBase64URL(
        NOISE_TRANSCRIPT_DOMAIN,
        textEncoder.encode(prologueHash),
        base64URLToBytes(identity.deviceNoisePublicKey),
        ephemeralPublic,
        es,
        ss,
    );
    const material = await crypto.subtle.digest(
        'SHA-256',
        concatBytes(es, ss, new TextEncoder().encode(transcript)),
    );
    return {
        init: {
            version: 1,
            prologueHash,
            deviceId: identity.deviceId,
            deviceNoisePublicKey: identity.deviceNoisePublicKey,
            deviceEphemeralKey: bytesToBase64URL(ephemeralPublic),
            enrollmentCertHash: host.enrollmentCertificateHash || '',
        } satisfies NoiseHandshakeInitV1,
        sessionKeyPreview: bytesToBase64URL(new Uint8Array(material)),
        transcript,
    };
}

export async function buildSecureSessionStartPayload(
    identity: DeviceIdentityRecord,
    host: HostEnrollmentRecord,
    routeId: string,
    ttlSeconds = 20 * 60,
): Promise<SecureSessionStartRequest> {
    const handshake = await buildMobileNoiseHandshake(identity, host, routeId);
    return {
        device_id: identity.deviceId,
        device_noise_public_key: identity.deviceNoisePublicKey,
        relay_route_id: routeId,
        relay_origin:
            host.relayOrigin?.trim() || host.serviceBaseUrl?.trim() || '',
        enrollment_certificate_hash: host.enrollmentCertificateHash || '',
        account_id: host.accountId?.trim() || undefined,
        noise_handshake: handshake.init,
        ttl_seconds: Math.max(60, ttlSeconds),
    };
}

export async function scanPairingQRCodeWithCamera() {
    if (
        typeof window !== 'undefined' &&
        typeof document !== 'undefined' &&
        !Capacitor.isNativePlatform()
    ) {
        return await scanPairingQRCodeWithBrowserCamera();
    }
    const { BarcodeScanner } =
        await import('@capacitor-mlkit/barcode-scanning');
    const permission = await BarcodeScanner.requestPermissions();
    if (permission.camera !== 'granted' && permission.camera !== 'limited') {
        throw new Error(
            'Camera permission is required to scan a pairing code.',
        );
    }
    const result = await BarcodeScanner.scan();
    const raw = result.barcodes?.[0]?.rawValue || '';
    if (!raw) throw new Error('No pairing code was found.');
    const parsed = parsePairingInvite(raw);
    return {
        raw,
        payload: parsed.version === 2 ? pairingInviteToQRCodeV1(parsed.invite) : parsed.qr,
    };
}

async function scanPairingQRCodeWithBrowserCamera() {
    if (!window.isSecureContext) {
        throw new Error(
            'Browser camera scanning requires HTTPS. Open OR3 with https:// or localhost, or paste the QR text instead.',
        );
    }
    if (!navigator.mediaDevices?.getUserMedia) {
        throw new Error(
            'This browser does not expose camera scanning here. Paste the QR text instead.',
        );
    }

    let stream: MediaStream;
    try {
        stream = await navigator.mediaDevices.getUserMedia({
            video: {
                facingMode: { ideal: 'environment' },
                width: { ideal: 1280 },
                height: { ideal: 720 },
            },
            audio: false,
        });
    } catch (error) {
        const name = error instanceof DOMException ? error.name : '';
        if (name === 'NotAllowedError' || name === 'SecurityError') {
            throw new Error(
                'Camera permission was blocked. Allow camera access for this site, or paste the QR text instead.',
            );
        }
        throw new Error(
            'Could not start the camera. Paste the QR text instead.',
        );
    }

    const overlay = document.createElement('div');
    overlay.setAttribute('role', 'dialog');
    overlay.setAttribute('aria-modal', 'true');
    overlay.style.cssText = [
        'position:fixed',
        'inset:0',
        'z-index:9999',
        'display:grid',
        'place-items:center',
        'padding:20px',
        'background:rgba(32,29,24,.78)',
    ].join(';');

    const panel = document.createElement('div');
    panel.style.cssText = [
        'width:min(520px,100%)',
        'display:grid',
        'gap:12px',
        'padding:14px',
        'border-radius:20px',
        'background:#fffdf8',
        'border:1px solid #ded4c5',
        'box-shadow:0 18px 48px rgba(0,0,0,.24)',
    ].join(';');

    const video = document.createElement('video');
    video.autoplay = true;
    video.muted = true;
    video.playsInline = true;
    video.srcObject = stream;
    video.style.cssText = [
        'width:100%',
        'aspect-ratio:1',
        'object-fit:cover',
        'border-radius:14px',
        'background:#111',
    ].join(';');

    const row = document.createElement('div');
    row.style.cssText = 'display:flex;align-items:center;justify-content:space-between;gap:12px';
    const label = document.createElement('div');
    label.textContent = 'Point the camera at the OR3 QR code.';
    label.style.cssText = 'font:600 14px ui-monospace,SFMono-Regular,Menlo,monospace;color:#272520';
    const cancel = document.createElement('button');
    cancel.type = 'button';
    cancel.textContent = 'Cancel';
    cancel.style.cssText = [
        'border:1px solid #ded4c5',
        'border-radius:999px',
        'padding:10px 14px',
        'background:#f5f1ea',
        'color:#272520',
        'font:600 14px system-ui,sans-serif',
    ].join(';');
    row.append(label, cancel);
    panel.append(video, row);
    overlay.append(panel);
    document.body.append(overlay);

    const canvas = document.createElement('canvas');
    const context = canvas.getContext('2d', { willReadFrequently: true });
    if (!context) {
        stream.getTracks().forEach((track) => track.stop());
        overlay.remove();
        throw new Error('This browser cannot scan QR codes here. Paste the QR text instead.');
    }

    return await new Promise<{ raw: string; payload: PairingQRCodeV1 }>(
        (resolve, reject) => {
            let animationFrame = 0;
            let done = false;

            const cleanup = () => {
                done = true;
                if (animationFrame) cancelAnimationFrame(animationFrame);
                stream.getTracks().forEach((track) => track.stop());
                overlay.remove();
            };

            cancel.addEventListener('click', () => {
                cleanup();
                reject(new Error('QR scan canceled.'));
            });

            const scanFrame = () => {
                if (done) return;
                if (video.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA) {
                    const width = video.videoWidth;
                    const height = video.videoHeight;
                    if (width > 0 && height > 0) {
                        canvas.width = width;
                        canvas.height = height;
                        context.drawImage(video, 0, 0, width, height);
                        const image = context.getImageData(0, 0, width, height);
                        const code = jsQR(image.data, width, height, {
                            inversionAttempts: 'attemptBoth',
                        });
                        const raw = code?.data?.trim() || '';
                        if (raw) {
                            try {
                                const parsed = parsePairingInvite(raw);
                                const payload = parsed.version === 2 ? pairingInviteToQRCodeV1(parsed.invite) : parsed.qr;
                                cleanup();
                                resolve({ raw, payload });
                                return;
                            } catch {
                                // Keep scanning until a valid OR3 QR is in frame.
                            }
                        }
                    }
                }
                animationFrame = requestAnimationFrame(scanFrame);
            };

            video.play().then(scanFrame).catch(() => {
                cleanup();
                reject(new Error('Could not start the camera preview. Paste the QR text instead.'));
            });
        },
    );
}

function concatBytes(...parts: Uint8Array[]) {
    const out = new Uint8Array(
        parts.reduce((total, part) => total + part.length, 0),
    );
    let offset = 0;
    for (const part of parts) {
        out.set(part, offset);
        offset += part.length;
    }
    return out;
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
        throw new Error('This is not an OR3 pairing code.');
    const payload = decodeCBOR(
        base64URLToBytes(trimmed.slice(OR3_PAIRING_QR_PREFIX.length)),
    ) as PairingQRCodeV1;
    if (payload.version !== 1)
        throw new Error('This pairing code uses an unsupported version.');
    if (
        !payload.rendezvousId ||
        !payload.hostId ||
        !payload.hostSigningPublicKey ||
        !payload.hostNoisePublicKey ||
        !payload.pairingSecret
    ) {
        throw new Error('This pairing code is incomplete.');
    }
    if (base64URLToBytes(payload.pairingSecret).length < 32)
        throw new Error('This pairing code is not secure enough.');
    if (payload.expiresAtUnixMs <= nowUnixMs)
        throw new Error('This pairing code expired. Show a new one.');
    return {
        ...payload,
        capabilities: Array.isArray(payload.capabilities)
            ? payload.capabilities
            : [],
    };
}

function detectPlatform(): DeviceIdentityRecord['platform'] {
    if (typeof navigator === 'undefined') return 'web';
    const ua = navigator.userAgent.toLowerCase();
    if (ua.includes('android')) return 'android';
    if (ua.includes('iphone') || ua.includes('ipad')) return 'ios';
    return 'web';
}

function decodeCBOR(data: Uint8Array): unknown {
    let offset = 0;
    const read = (): unknown => {
        const first = data[offset++];
        if (first === undefined) throw new Error('Invalid CBOR payload.');
        const major = first >> 5;
        const additional = first & 0x1f;
        const byteAt = (index: number) => {
            const value = data[index];
            if (value === undefined) throw new Error('Invalid CBOR payload.');
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
                const view = new DataView(
                    data.buffer,
                    data.byteOffset + offset,
                    8,
                );
                const value = Number(view.getBigUint64(0));
                offset += 8;
                return value;
            }
            throw new Error('Unsupported CBOR length.');
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
            const value = new TextDecoder().decode(
                data.slice(offset, offset + len),
            );
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
        throw new Error('Unsupported CBOR payload.');
    };
    const decoded = read();
    if (offset !== data.length)
        throw new Error('Unexpected trailing CBOR data.');
    return decoded;
}
