import { computed, ref } from 'vue';
import type {
    DeviceInfo,
    HealthResponse,
    PairingExchangeResponse,
    PairingRequestResponse,
} from '~/types/or3-api';
import type { Or3HostProfile } from '~/types/app-state';
import { useLocalCache } from './useLocalCache';
import { useOr3Api } from './useOr3Api';

interface StartPairingInput {
    baseUrl: string;
    displayName: string;
    deviceName: string;
}

const PENDING_PAIRING_STORAGE_KEY = 'or3-app:v1:pending-pairing';

const pendingPairing = ref<PairingRequestResponse | null>(null);
const pairingError = ref<string | null>(null);
const pairingHost = ref<{
    baseUrl: string;
    displayName: string;
    deviceName: string;
} | null>(null);
const pairingStatus = ref<'idle' | 'waiting' | 'connected'>('idle');
const pairingFailureDetails = ref<PairingFailureDetails | null>(null);

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

function persistPendingPairing() {
    if (!import.meta.client) return;
    if (!pendingPairing.value || !pairingHost.value) {
        localStorage.removeItem(PENDING_PAIRING_STORAGE_KEY);
        return;
    }
    localStorage.setItem(
        PENDING_PAIRING_STORAGE_KEY,
        JSON.stringify({
            pendingPairing: pendingPairing.value,
            pairingHost: pairingHost.value,
            pairingStatus: pairingStatus.value,
        }),
    );
}

function restorePendingPairing() {
    if (!import.meta.client || pendingPairing.value || pairingHost.value)
        return;
    const raw = localStorage.getItem(PENDING_PAIRING_STORAGE_KEY);
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
        };
        if (!parsed.pendingPairing || !parsed.pairingHost) return;
        pendingPairing.value = parsed.pendingPairing;
        pairingHost.value = parsed.pairingHost;
        pairingStatus.value = parsed.pairingStatus || 'waiting';
    } catch {
        localStorage.removeItem(PENDING_PAIRING_STORAGE_KEY);
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
                setPairingFailure(requestError, pairingError.value);
                throw requestError;
            }

            pendingPairing.value =
                (await response.json()) as PairingRequestResponse;
            pairingStatus.value = 'waiting';
            persistPendingPairing();
            return pendingPairing.value;
        } catch (error) {
            if (error instanceof PairingRequestError) {
                throw error;
            }

            const requestError = new PairingRequestError(
                resolvePairingError(
                    error,
                    'Could not reach this computer. Confirm the address is correct, that or3-intern is listening on the expected port, and that the device can reach it over your local network or Tailscale.',
                ),
                {
                    url: `${baseUrl}/internal/v1/pairing/requests`,
                    cause: error,
                },
            );
            setPairingFailure(requestError, requestError.message);
            throw requestError;
        }
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
        try {
            const response = await fetch(
                `${baseUrl}/internal/v1/pairing/exchange`,
                {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        Accept: 'application/json',
                    },
                    body: JSON.stringify({ request_id: requestId, code }),
                },
            );

            if (!response.ok) {
                if (options.quietPending) throw new Error('pairing_pending');
                pairingError.value =
                    'Pairing is not approved yet or the code expired.';
                throw new Error(pairingError.value);
            }

            const exchanged =
                (await response.json()) as PairingExchangeResponse;
            const host: Or3HostProfile = {
                id: hostIdFromUrl(baseUrl),
                name: pairingHost.value.displayName || 'My Computer',
                baseUrl,
                token: exchanged.token,
                pairedToken: exchanged.token,
                role: exchanged.role,
                deviceId: exchanged.device_id,
                status: 'online',
                lastSeenAt: new Date().toISOString(),
            };

            cache.updateHost(host);
            pairingError.value = null;
            pairingFailureDetails.value = null;
            pairingStatus.value = 'connected';
            pendingPairing.value = null;
            pairingHost.value = null;
            persistPendingPairing();
            return host;
        } catch (error) {
            if (
                options.quietPending &&
                error instanceof Error &&
                error.message === 'pairing_pending'
            ) {
                throw error;
            }

            pairingError.value = resolvePairingError(
                error,
                'Could not complete pairing. Confirm this phone can still reach your computer and try again.',
            );
            throw new Error(pairingError.value);
        }
    }

    async function verifyActiveHost() {
        const health = await api.request<HealthResponse>('/internal/v1/health');
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
        return health;
    }

    async function listDevices() {
        const response = await api.request<
            { items?: DeviceInfo[] } | DeviceInfo[]
        >('/internal/v1/devices');
        return Array.isArray(response) ? response : (response.items ?? []);
    }

    async function revokeDevice(deviceId: string) {
        return await api.request<{ device_id: string; status: string }>(
            `/internal/v1/devices/${encodeURIComponent(deviceId)}/revoke`,
            { method: 'POST' },
        );
    }

    async function rotateDevice(deviceId: string) {
        return await api.request<{ device_id: string; token: string }>(
            `/internal/v1/devices/${encodeURIComponent(deviceId)}/rotate`,
            { method: 'POST' },
        );
    }

    return {
        pendingPairing,
        pairingError,
        pairingFailureDetails,
        pairingStatus,
        isPairing,
        startPairing,
        exchangeCode,
        verifyActiveHost,
        listDevices,
        revokeDevice,
        rotateDevice,
    };
}
