import { ref } from 'vue';
import type {
    AppBootstrapResponse,
    HealthResponse,
} from '~/types/or3-api';
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

const pairingError = ref<string | null>(null);
const securePairingStatus = ref<SecureConnectionPairingState>('idle');
const pairingFailureDetails = ref<PairingFailureDetails | null>(null);
const logger = createLogger('pairing');

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

    pairingFailureDetails.value = {
        message,
        cause: error,
        updatedAt: new Date().toISOString(),
    };
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

export function usePairing() {
    const cache = useLocalCache();
    const api = useOr3Api();

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
            | 'web-limited';
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
        if (input.serviceBaseUrl) {
            cache.updateHost({
                id: input.hostId,
                name: input.hostId,
                baseUrl: input.serviceBaseUrl,
                authMode: 'secure-session',
                secureHostId: input.hostId,
                secureSessionRouteId: `direct:${input.serviceBaseUrl}`,
                role: input.role || 'operator',
                status: 'online',
                lastSeenAt: new Date().toISOString(),
            });
        }
        securePairingStatus.value = 'connected';
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
                device?: {
                    role?: string;
                    capabilities?: string[];
                    trust_level?:
                        | 'native-hardware'
                        | 'native-software'
                        | 'web-limited';
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
            const activeHost = cache.state.value.hosts.find(
                (host) => host.id === parsed.qr.hostId,
            );
            if (activeHost) {
                cache.updateHost({
                    ...activeHost,
                    name: parsed.qr.hostDisplayName || activeHost.name,
                    deviceId: parsed.identity.deviceId,
                    status: 'online',
                    lastSeenAt: new Date().toISOString(),
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

    return {
        pairingError,
        pairingFailureDetails,
        securePairingStatus,
        parseSecurePairingQR,
        buildSecureEnrollmentProposal,
        storeSecureEnrollment,
        verifyActiveHost,
        upgradeSecurePairingPayload,
    };
}
