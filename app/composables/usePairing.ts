import { computed, ref } from 'vue';
import type {
    AppBootstrapResponse,
    DeviceInfo,
    HealthResponse,
    PairingExchangeResponse,
    PairingRequestResponse,
} from '~/types/or3-api';
import type { Or3HostProfile } from '~/types/app-state';
import { useLocalCache } from './useLocalCache';
import { useOr3Api } from './useOr3Api';
import { createLogger } from '~/utils/logger';
import {
    buildEnrollmentProposal,
    getOrCreateDeviceIdentity,
    parsePairingQRCode,
    signEnrollmentProposal,
    storeHostEnrollment,
    type PairingQRCodeV1,
    type SecureConnectionPairingState,
} from '~/utils/or3/secure-connections';

interface StartPairingInput {
    baseUrl: string;
    displayName: string;
    deviceName: string;
}

interface ExistingPairingInput extends StartPairingInput {
    requestId: string | number;
    code: string;
}

type DeviceInfoWire = DeviceInfo & {
    DeviceID?: string;
    DisplayName?: string;
    Role?: string;
    Status?: string;
    CreatedAt?: string | number;
    LastSeenAt?: string | number;
};

type PairedDeviceWire = {
    device_id?: string;
    DeviceID?: string;
    role?: string;
    Role?: string;
    display_name?: string;
    DisplayName?: string;
};

const PENDING_PAIRING_STORAGE_KEY = 'or3-app:v1:pending-pairing';
const PENDING_PAIRING_SOURCE = 'app-created';

const pendingPairing = ref<PairingRequestResponse | null>(null);
const pairingError = ref<string | null>(null);
const pairingHost = ref<{
    baseUrl: string;
    displayName: string;
    deviceName: string;
} | null>(null);
const pairingStatus = ref<'idle' | 'waiting' | 'connected'>('idle');
const securePairingStatus = ref<SecureConnectionPairingState>('idle');
const pairingFailureDetails = ref<PairingFailureDetails | null>(null);
const logger = createLogger('pairing');

export class PairingRequestError extends Error {
    status?: number;
    statusText?: string;
    url?: string;
    responseBody?: string;
    responseJson?: unknown;
    override cause?: unknown;

    constructor(message: string, details: Partial<PairingRequestError> = {}) {
        super(message);
        this.name = 'PairingRequestError';
        Object.assign(this, details);
    }
}

export interface PairingFailureDetails {
    message: string;
    status?: number;
    statusText?: string;
    url?: string;
    responseBody?: string;
    responseJson?: unknown;
    cause?: unknown;
    updatedAt: string;
}

function resolvePairingError(error: unknown, fallbackMessage: string) {
    if (error instanceof Error && error.message) {
        return error.message;
    }

    return fallbackMessage;
}

function setPairingFailure(error: unknown, fallbackMessage: string) {
    const message = resolvePairingError(error, fallbackMessage);
    pairingError.value = message;

    if (error instanceof PairingRequestError) {
        pairingFailureDetails.value = {
            message,
            status: error.status,
            statusText: error.statusText,
            url: error.url,
            responseBody: error.responseBody,
            responseJson: error.responseJson,
            cause: error.cause,
            updatedAt: new Date().toISOString(),
        };
        return;
    }

    pairingFailureDetails.value = {
        message,
        cause: error,
        updatedAt: new Date().toISOString(),
    };
}

async function readPairingFailure(response: Response) {
    const responseBody = await response.text().catch(() => '');
    if (!responseBody)
        return { responseBody: '', responseJson: null, serverMessage: '' };

    try {
        const responseJson = JSON.parse(responseBody) as Record<
            string,
            unknown
        >;
        const serverMessage = String(
            responseJson.message || responseJson.error || '',
        ).trim();
        return { responseBody, responseJson, serverMessage };
    } catch {
        return {
            responseBody,
            responseJson: null,
            serverMessage: responseBody.trim(),
        };
    }
}

function normalizeDeviceInfo(device: DeviceInfoWire): DeviceInfo {
    return {
        device_id: String(device.device_id || device.DeviceID || '').trim(),
        display_name: device.display_name || device.DisplayName,
        role: device.role || device.Role,
        status: device.status || device.Status,
        created_at: String(device.created_at || device.CreatedAt || ''),
        last_seen_at: String(device.last_seen_at || device.LastSeenAt || ''),
    };
}

function isVisiblePairedDevice(device: DeviceInfo) {
    return device.device_id && device.status?.toLowerCase() !== 'revoked';
}

function hostIdFromUrl(baseUrl: string) {
    return (
        baseUrl
            .trim()
            .replace(/^https?:\/\//, '')
            .replace(/[^a-z0-9]+/gi, '-')
            .replace(/^-|-$/g, '')
            .toLowerCase() || 'local'
    );
}

function normalizePairingCode(code: string) {
    return code.trim().replace(/[\s-]+/g, '');
}

function isLoopbackHost(hostname: string) {
    const host = hostname.trim().toLowerCase();
    return (
        host === 'localhost' ||
        host === '127.0.0.1' ||
        host === '::1' ||
        host === '[::1]'
    );
}

function isNetworkFetchFailure(error: unknown) {
    if (error instanceof TypeError) return true;
    if (!(error instanceof Error)) return false;
    return /failed to fetch|load failed|networkerror/i.test(error.message);
}

function serviceReachabilityMessage(baseUrl: string) {
    let origin = baseUrl.trim().replace(/\/+$/, '');
    let hostname = '';
    try {
        const parsed = new URL(origin);
        origin = parsed.origin;
        hostname = parsed.hostname;
    } catch {}

    if (hostname && isLoopbackHost(hostname)) {
        return `Could not reach ${origin}. Localhost only works when or3-intern is listening on localhost on this same device. Enter the exact address printed by or3-intern service, such as a LAN or Tailscale address, then try again.`;
    }

    return `Could not reach ${origin || 'the or3-intern service'}. Confirm or3-intern service is running at that exact address and that port 9100 is reachable from this device.`;
}

function hostFromExchange(
    baseUrl: string,
    hostInput: StartPairingInput,
    exchanged: PairingExchangeResponse,
): Or3HostProfile {
    return {
        id: hostIdFromUrl(baseUrl),
        name: hostInput.displayName || 'My Computer',
        baseUrl,
        token: exchanged.token,
        pairedToken: exchanged.token,
        role: exchanged.role,
        deviceId: exchanged.device_id,
        status: 'online',
        lastSeenAt: new Date().toISOString(),
    };
}

function persistPendingPairing() {
    if (typeof window === 'undefined') return;
    const storage = typeof sessionStorage !== 'undefined' ? sessionStorage : null;
    if (!pendingPairing.value || !pairingHost.value) {
        storage?.removeItem(PENDING_PAIRING_STORAGE_KEY);
        if (typeof localStorage !== 'undefined') {
            localStorage.removeItem(PENDING_PAIRING_STORAGE_KEY);
        }
        return;
    }
    storage?.setItem(
        PENDING_PAIRING_STORAGE_KEY,
        JSON.stringify({
            pendingPairing: pendingPairing.value,
            pairingHost: pairingHost.value,
            pairingStatus: pairingStatus.value,
            source: PENDING_PAIRING_SOURCE,
        }),
    );
    if (typeof localStorage !== 'undefined') {
        localStorage.removeItem(PENDING_PAIRING_STORAGE_KEY);
    }
}

function restorePendingPairing() {
    if (typeof window === 'undefined' || pendingPairing.value || pairingHost.value)
        return;
    const sessionRaw =
        typeof sessionStorage !== 'undefined'
            ? sessionStorage.getItem(PENDING_PAIRING_STORAGE_KEY)
            : null;
    const legacyRaw =
        !sessionRaw && typeof localStorage !== 'undefined'
            ? localStorage.getItem(PENDING_PAIRING_STORAGE_KEY)
            : null;
    const raw = sessionRaw || legacyRaw;
    if (!raw) return;
    try {
        const parsed = JSON.parse(raw) as {
            pendingPairing?: PairingRequestResponse;
            pairingHost?: {
                baseUrl: string;
                displayName: string;
                deviceName: string;
            };
            pairingStatus?: 'idle' | 'waiting' | 'connected';
            source?: string;
        };
        if (parsed.source !== PENDING_PAIRING_SOURCE) {
            sessionStorage?.removeItem(PENDING_PAIRING_STORAGE_KEY);
            localStorage?.removeItem(PENDING_PAIRING_STORAGE_KEY);
            return;
        }
        if (!parsed.pendingPairing || !parsed.pairingHost) return;
        pendingPairing.value = parsed.pendingPairing;
        pairingHost.value = parsed.pairingHost;
        pairingStatus.value = parsed.pairingStatus || 'waiting';
        if (legacyRaw && typeof sessionStorage !== 'undefined') {
            sessionStorage.setItem(PENDING_PAIRING_STORAGE_KEY, raw);
            localStorage?.removeItem(PENDING_PAIRING_STORAGE_KEY);
        }
    } catch {
        logger.warn(
            'pending:restore_invalid',
            'Stored pairing state could not be restored',
        );
        sessionStorage?.removeItem(PENDING_PAIRING_STORAGE_KEY);
        localStorage?.removeItem(PENDING_PAIRING_STORAGE_KEY);
    }
}

export function usePairing() {
    const cache = useLocalCache();
    const api = useOr3Api();
    restorePendingPairing();
    const isPairing = computed(() => Boolean(pendingPairing.value));

    async function startPairing(input: StartPairingInput) {
        pairingError.value = null;
        pairingFailureDetails.value = null;
        pairingStatus.value = 'idle';
        pairingHost.value = input;
        const baseUrl = input.baseUrl.trim().replace(/\/+$/, '');
        logger.info('request:start', 'Pairing request started', {
            baseUrl,
            hasDisplayName: Boolean(input.displayName?.trim()),
            hasDeviceName: Boolean(input.deviceName?.trim()),
        });
        try {
            const response = await fetch(
                `${baseUrl}/internal/v1/pairing/requests`,
                {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        Accept: 'application/json',
                    },
                    body: JSON.stringify({
                        role: 'operator',
                        display_name: input.deviceName || 'or3-app',
                        origin: 'or3-app',
                    }),
                },
            );

            if (!response.ok) {
                const failure = await readPairingFailure(response);
                if (response.status === 401) {
                    pairingError.value =
                        'This computer is not accepting new device connections yet. On your computer, allow local device pairing in or3-intern, restart the service, and then try again.';
                } else {
                    pairingError.value =
                        failure.serverMessage ||
                        'Could not start pairing. Confirm the address is correct, that or3-intern is running, and that this phone can reach it over your local network or Tailscale.';
                }
                const requestError = new PairingRequestError(
                    pairingError.value,
                    {
                        status: response.status,
                        statusText: response.statusText,
                        url: response.url,
                        responseBody: failure.responseBody,
                        responseJson: failure.responseJson,
                    },
                );
                logger.warn(
                    'request:rejected',
                    'Pairing request was rejected',
                    {
                        baseUrl,
                        status: response.status,
                        statusText: response.statusText,
                    },
                );
                setPairingFailure(requestError, pairingError.value);
                throw requestError;
            }

            pendingPairing.value =
                (await response.json()) as PairingRequestResponse;
            pairingStatus.value = 'waiting';
            persistPendingPairing();
            logger.info('request:created', 'Pairing request created', {
                baseUrl,
                requestId:
                    pendingPairing.value.request_id ?? pendingPairing.value.id,
            });
            return pendingPairing.value;
        } catch (error) {
            if (error instanceof PairingRequestError) {
                throw error;
            }

            const requestError = new PairingRequestError(
                isNetworkFetchFailure(error)
                    ? serviceReachabilityMessage(baseUrl)
                    : resolvePairingError(
                          error,
                          'Could not reach this computer. Confirm the address is correct, that or3-intern is listening on the expected port, and that the device can reach it over your local network or Tailscale.',
                      ),
                {
                    url: `${baseUrl}/internal/v1/pairing/requests`,
                    cause: error,
                },
            );
            setPairingFailure(requestError, requestError.message);
            logger.error('request:error', 'Pairing request failed', {
                baseUrl,
                error: requestError.message,
            });
            throw requestError;
        }
    }

    async function parseSecurePairingQR(raw: string) {
        pairingError.value = null;
        pairingFailureDetails.value = null;
        try {
            const payload = parsePairingQRCode(raw);
            securePairingStatus.value = 'waiting';
            return payload;
        } catch (error) {
            securePairingStatus.value =
                error instanceof Error &&
                error.message.toLowerCase().includes('expired')
                    ? 'expired'
                    : 'failed';
            setPairingFailure(error, 'Could not read this pairing code.');
            throw error;
        }
    }

    async function buildSecureEnrollmentProposalFromPayload(
        payload: PairingQRCodeV1,
        deviceName = 'or3-app',
    ) {
        const identity = await getOrCreateDeviceIdentity(deviceName);
        return {
            qr: payload,
            identity,
            proposal: buildEnrollmentProposal(
                identity,
                'operator',
                payload.capabilities,
            ),
        };
    }

    async function buildSecureEnrollmentProposal(
        rawQR: string,
        deviceName = 'or3-app',
    ) {
        return buildSecureEnrollmentProposalFromPayload(
            await parseSecurePairingQR(rawQR),
            deviceName,
        );
    }

    async function storeSecureEnrollment(input: {
        hostId: string;
        hostSigningPublicKey: string;
        hostNoisePublicKey: string;
        certificate: unknown;
        certificateHash?: string;
        relayOrigin?: string;
        serviceBaseUrl?: string;
        accountId?: string;
        role?: string;
        capabilities?: string[];
        trustLevel?:
            | 'native-hardware'
            | 'native-software'
            | 'web-limited'
            | 'legacy';
    }) {
        await storeHostEnrollment({
            hostId: input.hostId,
            hostSigningPublicKey: input.hostSigningPublicKey,
            hostNoisePublicKey: input.hostNoisePublicKey,
            enrollmentCertificate: input.certificate,
            enrollmentCertificateHash: input.certificateHash,
            relayOrigin: input.relayOrigin,
            serviceBaseUrl: input.serviceBaseUrl,
            accountId: input.accountId,
            role: input.role || 'operator',
            capabilities: input.capabilities || [],
            trustLevel: input.trustLevel || 'web-limited',
            storedAtUnixMs: Date.now(),
        });
        securePairingStatus.value = 'connected';
    }

    function cachePairedTokenHost(input: {
        baseUrl: string;
        token: string;
        pairedDevice?: PairedDeviceWire;
        fallbackName?: string;
        fallbackRole?: string;
        fallbackDeviceId?: string;
    }) {
        const pairedDevice = input.pairedDevice || {};
        cache.updateHost({
            id: hostIdFromUrl(input.baseUrl),
            name:
                pairedDevice.display_name ||
                pairedDevice.DisplayName ||
                input.fallbackName ||
                'My Computer',
            baseUrl: input.baseUrl,
            token: input.token,
            pairedToken: input.token,
            role:
                pairedDevice.role ||
                pairedDevice.Role ||
                input.fallbackRole ||
                'operator',
            deviceId:
                pairedDevice.device_id ||
                pairedDevice.DeviceID ||
                input.fallbackDeviceId,
            status: 'online',
            lastSeenAt: new Date().toISOString(),
        });
        pairingError.value = null;
        pairingFailureDetails.value = null;
        pairingStatus.value = 'connected';
    }

    async function exchangeCode(
        code = pendingPairing.value?.code,
        options: { quietPending?: boolean } = {},
    ) {
        if (!pendingPairing.value || !pairingHost.value || !code)
            throw new Error('No pairing request is active');
        const baseUrl = pairingHost.value.baseUrl.trim().replace(/\/+$/, '');
        const requestId =
            pendingPairing.value.request_id ?? pendingPairing.value.id;
        logger.info('exchange:start', 'Pairing exchange started', {
            requestId,
            quietPending: Boolean(options.quietPending),
        });
        try {
            const response = await fetch(
                `${baseUrl}/internal/v1/pairing/exchange`,
                {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        Accept: 'application/json',
                    },
                    body: JSON.stringify({
                        request_id: requestId,
                        code: normalizePairingCode(code),
                    }),
                },
            );

            if (!response.ok) {
                if (options.quietPending) {
                    logger.debug(
                        'exchange:pending',
                        'Pairing approval is still pending',
                        { requestId },
                    );
                    throw new Error('pairing_pending');
                }
                const failure = await readPairingFailure(response);
                pairingError.value =
                    failure.serverMessage ||
                    'Pairing is not approved yet or the code expired.';
                const requestError = new PairingRequestError(
                    pairingError.value,
                    {
                        status: response.status,
                        statusText: response.statusText,
                        url: response.url,
                        responseBody: failure.responseBody,
                        responseJson: failure.responseJson,
                    },
                );
                logger.warn(
                    'exchange:rejected',
                    'Pairing exchange was rejected',
                    {
                        requestId,
                        status: response.status,
                        statusText: response.statusText,
                    },
                );
                setPairingFailure(requestError, pairingError.value);
                throw requestError;
            }

            const exchanged =
                (await response.json()) as PairingExchangeResponse;
            const host = hostFromExchange(
                baseUrl,
                pairingHost.value,
                exchanged,
            );

            cache.updateHost(host);
            pairingError.value = null;
            pairingFailureDetails.value = null;
            pairingStatus.value = 'connected';
            pendingPairing.value = null;
            pairingHost.value = null;
            persistPendingPairing();
            logger.info('exchange:complete', 'Pairing exchange completed', {
                requestId,
                hostId: host.id,
            });
            return host;
        } catch (error) {
            if (
                options.quietPending &&
                error instanceof Error &&
                error.message === 'pairing_pending'
            ) {
                throw error;
            }

            if (error instanceof PairingRequestError) {
                throw error;
            }

            const requestError = new PairingRequestError(
                isNetworkFetchFailure(error)
                    ? serviceReachabilityMessage(baseUrl)
                    : resolvePairingError(
                          error,
                          'Could not complete pairing. Confirm this phone can still reach your computer and try again.',
                      ),
                {
                    url: `${baseUrl}/internal/v1/pairing/exchange`,
                    cause: error,
                },
            );
            setPairingFailure(requestError, requestError.message);
            logger.error('exchange:error', 'Pairing exchange failed', {
                requestId,
                error: requestError.message,
            });
            throw requestError;
        }
    }

    async function exchangeExistingPairing(input: ExistingPairingInput) {
        const requestId = Number.parseInt(String(input.requestId).trim(), 10);
        const code = normalizePairingCode(input.code);
        if (!Number.isFinite(requestId) || requestId <= 0) {
            throw new Error(
                'Enter the request ID shown by or3-intern connect-device.',
            );
        }
        if (!/^\d{6}$/.test(code)) {
            throw new Error(
                'Enter the 6-digit pairing code shown by or3-intern connect-device.',
            );
        }

        const baseUrl = input.baseUrl.trim().replace(/\/+$/, '');
        pendingPairing.value = null;
        pairingHost.value = null;
        pairingStatus.value = 'idle';
        pairingError.value = null;
        pairingFailureDetails.value = null;
        persistPendingPairing();

        logger.info('exchange_existing:start', 'CLI pairing exchange started', {
            baseUrl,
            requestId,
        });

        try {
            const response = await fetch(
                `${baseUrl}/internal/v1/pairing/exchange`,
                {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        Accept: 'application/json',
                    },
                    body: JSON.stringify({
                        request_id: requestId,
                        code,
                    }),
                },
            );

            if (!response.ok) {
                const failure = await readPairingFailure(response);
                const message =
                    failure.serverMessage ||
                    'The CLI pairing code was not found or has expired. Run or3-intern connect-device again and enter the new request ID and code.';
                const requestError = new PairingRequestError(message, {
                    status: response.status,
                    statusText: response.statusText,
                    url: response.url,
                    responseBody: failure.responseBody,
                    responseJson: failure.responseJson,
                });
                setPairingFailure(requestError, message);
                logger.warn(
                    'exchange_existing:rejected',
                    'CLI pairing exchange was rejected',
                    {
                        baseUrl,
                        requestId,
                        status: response.status,
                        statusText: response.statusText,
                    },
                );
                throw requestError;
            }

            const exchanged =
                (await response.json()) as PairingExchangeResponse;
            const host = hostFromExchange(baseUrl, input, exchanged);
            cache.updateHost(host);
            pairingError.value = null;
            pairingFailureDetails.value = null;
            pairingStatus.value = 'connected';
            logger.info(
                'exchange_existing:complete',
                'CLI pairing exchange completed',
                {
                    baseUrl,
                    requestId,
                    hostId: host.id,
                },
            );
            return host;
        } catch (error) {
            if (error instanceof PairingRequestError) {
                throw error;
            }

            const requestError = new PairingRequestError(
                isNetworkFetchFailure(error)
                    ? serviceReachabilityMessage(baseUrl)
                    : resolvePairingError(
                          error,
                          'Could not exchange the CLI pairing code. Confirm the service address, then run or3-intern connect-device again if the code expired.',
                      ),
                {
                    url: `${baseUrl}/internal/v1/pairing/exchange`,
                    cause: error,
                },
            );
            setPairingFailure(requestError, requestError.message);
            logger.error(
                'exchange_existing:error',
                'CLI pairing exchange failed',
                {
                    baseUrl,
                    requestId,
                    error: requestError.message,
                },
            );
            throw requestError;
        }
    }

    async function verifyActiveHost() {
        let health: HealthResponse;
        logger.info('verify:start', 'Active host verification started', {
            hasActiveHost: Boolean(cache.state.value.activeHostId),
        });
        try {
            const bootstrap = await api.request<AppBootstrapResponse>(
                '/internal/v1/app/bootstrap',
            );
            health =
                bootstrap.status?.health ??
                ((await api.request<HealthResponse>(
                    '/internal/v1/health',
                )) as HealthResponse);
        } catch (error: any) {
            if (
                ![404, 405].includes(error?.status) &&
                error?.code !== 'capability_unavailable'
            ) {
                logger.error(
                    'verify:error',
                    'Active host verification failed',
                    {
                        error:
                            error instanceof Error
                                ? error.message
                                : String(error ?? 'unknown_error'),
                    },
                );
                throw error;
            }
            logger.warn(
                'verify:fallback',
                'App bootstrap unavailable, falling back to health endpoint',
                {
                    status: error?.status,
                    code: error?.code,
                },
            );
            health = await api.request<HealthResponse>('/internal/v1/health');
        }
        const activeHostId = cache.state.value.activeHostId;
        const activeHost = cache.state.value.hosts.find(
            (host) => host.id === activeHostId,
        );
        if (activeHost)
            cache.updateHost({
                ...activeHost,
                status: 'online',
                lastSeenAt: new Date().toISOString(),
            });
        logger.info('verify:complete', 'Active host verification completed', {
            status: health.status,
            runtimeAvailable: health.runtimeAvailable,
        });
        return health;
    }

    async function listDevices() {
        logger.info('devices:list_start', 'Listing paired devices');
        try {
            const response = await api.request<
                { items?: DeviceInfoWire[] } | DeviceInfoWire[]
            >('/internal/v1/devices');
            const rawDevices = Array.isArray(response)
                ? response
                : (response.items ?? []);
            const devices = rawDevices
                .map((device) => normalizeDeviceInfo(device))
                .filter((device) => isVisiblePairedDevice(device));
            logger.info('devices:list_complete', 'Paired devices loaded', {
                count: devices.length,
            });
            return devices;
        } catch (error) {
            logger.error(
                'devices:list_error',
                'Failed to list paired devices',
                {
                    error:
                        error instanceof Error
                            ? error.message
                            : String(error ?? 'unknown_error'),
                },
            );
            throw error;
        }
    }

    async function revokeDevice(deviceId: string) {
        const normalizedDeviceId = String(deviceId || '').trim();
        if (!normalizedDeviceId) {
            throw new Error('Device ID is required to revoke a paired device.');
        }
        logger.info('devices:revoke_start', 'Revoking paired device', {
            deviceId: normalizedDeviceId,
        });
        try {
            const response = await api.request<{
                device_id: string;
                status: string;
            }>(
                `/internal/v1/devices/${encodeURIComponent(normalizedDeviceId)}/revoke`,
                {
                    method: 'POST',
                },
            );
            logger.info('devices:revoke_complete', 'Paired device revoked', {
                deviceId: normalizedDeviceId,
                status: response.status,
            });
            return response;
        } catch (error) {
            logger.error(
                'devices:revoke_error',
                'Failed to revoke paired device',
                {
                    deviceId: normalizedDeviceId,
                    error:
                        error instanceof Error
                            ? error.message
                            : String(error ?? 'unknown_error'),
                },
            );
            throw error;
        }
    }

    async function rotateDevice(deviceId: string) {
        logger.info('devices:rotate_start', 'Rotating paired device token', {
            deviceId,
        });
        try {
            const response = await api.request<{
                device_id: string;
                token: string;
            }>(`/internal/v1/devices/${encodeURIComponent(deviceId)}/rotate`, {
                method: 'POST',
            });
            // Update the local host token cache so subsequent API calls
            // use the new token instead of the old one.
            const activeHostId = cache.state.value.activeHostId;
            const activeHost = cache.state.value.hosts.find(
                (h) => h.id === activeHostId,
            );
            if (activeHost && response.token) {
                cache.updateHost({
                    ...activeHost,
                    token: response.token,
                    pairedToken: response.token,
                });
            }
            logger.info(
                'devices:rotate_complete',
                'Paired device token rotated',
                {
                    deviceId,
                },
            );
            return response;
        } catch (error) {
            logger.error(
                'devices:rotate_error',
                'Failed to rotate paired device token',
                {
                    deviceId,
                    error:
                        error instanceof Error
                            ? error.message
                            : String(error ?? 'unknown_error'),
                },
            );
            throw error;
        }
    }

    async function upgradeSecurePairingPayload(input: {
        baseUrl: string;
        qr: PairingQRCodeV1;
        deviceName?: string;
        accountId?: string;
    }) {
        const baseUrl = input.baseUrl.trim().replace(/\/+$/, '');
        if (!baseUrl) {
            throw new Error(
                'A computer address is required for secure pairing.',
            );
        }
        const parsed = await buildSecureEnrollmentProposalFromPayload(
            input.qr,
            input.deviceName || 'or3-app',
        );
        parsed.proposal.accountBinding = input.accountId
            ? { accountId: input.accountId, verifiedAtUnixMs: Date.now() }
            : parsed.proposal.accountBinding;
        securePairingStatus.value = 'pending_approval';
        try {
            const signedProposal = await signEnrollmentProposal(
                parsed.identity,
                parsed.proposal,
            );
            const response = await api.request<{
                certificate: unknown;
                certificate_hash?: string;
                paired_token?: string;
                paired_device?: PairedDeviceWire;
                device?: {
                    role?: string;
                    capabilities?: string[];
                    trust_level?:
                        | 'native-hardware'
                        | 'native-software'
                        | 'web-limited'
                        | 'legacy';
                };
            }>('/internal/v1/secure-connections/pairing/approve', {
                method: 'POST',
                baseUrl,
                requireAuth: false,
                body: {
                    rendezvous_id: parsed.qr.rendezvousId,
                    pairing_secret: parsed.qr.pairingSecret,
                    proposal: signedProposal,
                    trust_level: parsed.identity.trustLevel,
                },
            });
            await storeSecureEnrollment({
                hostId: parsed.qr.hostId,
                hostSigningPublicKey: parsed.qr.hostSigningPublicKey,
                hostNoisePublicKey: parsed.qr.hostNoisePublicKey,
                certificate: response.certificate,
                certificateHash: response.certificate_hash,
                relayOrigin: parsed.qr.relayOrigin,
                serviceBaseUrl: baseUrl,
                accountId: input.accountId,
                role: response.device?.role || 'operator',
                capabilities: response.device?.capabilities || [],
                trustLevel:
                    response.device?.trust_level || parsed.identity.trustLevel,
            });
            if (response.paired_token) {
                cachePairedTokenHost({
                    baseUrl,
                    token: response.paired_token,
                    pairedDevice: response.paired_device,
                    fallbackName: parsed.qr.hostDisplayName,
                    fallbackRole: response.device?.role,
                    fallbackDeviceId: parsed.identity.deviceId,
                });
            }
            return { ...parsed, response };
        } catch (error) {
            securePairingStatus.value =
                error instanceof Error && /expired/i.test(error.message)
                    ? 'expired'
                    : 'failed';
            setPairingFailure(error, 'Could not finish secure pairing.');
            throw error;
        }
    }

    async function upgradeLegacyDeviceToSecure(input: {
        baseUrl: string;
        qr: string;
        deviceName?: string;
        accountId?: string;
    }) {
        return upgradeSecurePairingPayload({
            ...input,
            qr: await parseSecurePairingQR(input.qr),
        });
    }

    async function exchangeSecurePairingPayload(input: {
        baseUrl: string;
        qr: PairingQRCodeV1;
        deviceName?: string;
    }) {
        const baseUrl = input.baseUrl.trim().replace(/\/+$/, '');
        const payload = input.qr;
        securePairingStatus.value = 'pending_approval';
        try {
            const response = await api.request<{
                token: string;
                role?: string;
                device_id?: string;
                device?: PairedDeviceWire;
            }>('/internal/v1/secure-connections/pairing/exchange', {
                method: 'POST',
                baseUrl,
                requireAuth: false,
                body: {
                    rendezvous_id: payload.rendezvousId,
                    pairing_secret: payload.pairingSecret,
                    device_name: input.deviceName || 'or3-app',
                },
            });
            if (!response.token) {
                throw new Error('Pairing completed without a device token.');
            }
            cachePairedTokenHost({
                baseUrl,
                token: response.token,
                pairedDevice: response.device,
                fallbackName: payload.hostDisplayName,
                fallbackRole: response.role,
                fallbackDeviceId: response.device_id,
            });
            securePairingStatus.value = 'connected';
            return { qr: payload, response };
        } catch (error) {
            securePairingStatus.value =
                error instanceof Error && /expired/i.test(error.message)
                    ? 'expired'
                    : 'failed';
            setPairingFailure(error, 'Could not finish pairing.');
            throw error;
        }
    }

    async function exchangeSecurePairingQR(input: {
        baseUrl: string;
        qr: string;
        deviceName?: string;
    }) {
        return exchangeSecurePairingPayload({
            ...input,
            qr: await parseSecurePairingQR(input.qr),
        });
    }

    return {
        pendingPairing,
        pairingError,
        pairingFailureDetails,
        pairingStatus,
        securePairingStatus,
        isPairing,
        startPairing,
        exchangeExistingPairing,
        parseSecurePairingQR,
        buildSecureEnrollmentProposal,
        storeSecureEnrollment,
        exchangeSecurePairingQR,
        exchangeSecurePairingPayload,
        exchangeCode,
        verifyActiveHost,
        listDevices,
        revokeDevice,
        rotateDevice,
        upgradeSecurePairingPayload,
        upgradeLegacyDeviceToSecure,
    };
}
