import { computed, ref } from 'vue';
import {
    buildSecureSessionStartPayload,
    buildSecureFrame,
    loadSecureConnectionState,
    shouldRekeySecureSession,
    type HostEnrollmentRecord,
    type SecureSessionClaims,
} from '~/utils/or3/secure-connections';
import { useOr3Api } from '~/composables/useOr3Api';

export function useSecureConnectionSession() {
    const api = useOr3Api();
    const claims = ref<SecureSessionClaims | null>(null);
    const activeHost = ref<HostEnrollmentRecord | null>(null);
    const sequence = ref(0);
    const connected = computed(
        () =>
            Boolean(claims.value) &&
            (claims.value?.expires_at_unix_ms || 0) > Date.now(),
    );

    async function discoverStoredHosts() {
        const state = await loadSecureConnectionState();
        return Object.values(state.hosts || {});
    }

    async function start(hostId: string, routeId: string) {
        const state = await loadSecureConnectionState();
        const identity = state.deviceIdentity;
        const host = state.hosts?.[hostId];
        if (!identity || !host)
            throw new Error('Pair this device before connecting.');
        const payload = await buildSecureSessionStartPayload(
            identity,
            host,
            routeId,
        );
        const response = await api.request<{ claims: SecureSessionClaims }>(
            '/internal/v1/secure-connections/sessions',
            {
                method: 'POST',
                body: payload,
                baseUrl: host.serviceBaseUrl,
            },
        );
        activeHost.value = host;
        claims.value = response.claims;
        sequence.value = 0;
        return { claims: claims.value, handshake: payload.noise_handshake };
    }

    function nextFrame(
        kind: 'noiseHandshake' | 'noiseTransport' | 'control',
        body: Uint8Array,
    ) {
        if (!claims.value) throw new Error('No secure session is active.');
        sequence.value += 1;
        return buildSecureFrame({
            kind,
            sessionId: claims.value.session_id,
            sequence: sequence.value,
            correlationId:
                crypto.randomUUID?.() || `corr-${Date.now()}-${sequence.value}`,
            body,
        });
    }

    function needsRekey() {
        return claims.value ? shouldRekeySecureSession(claims.value) : false;
    }

    function clear() {
        claims.value = null;
        activeHost.value = null;
        sequence.value = 0;
    }

    return {
        claims,
        activeHost,
        connected,
        discoverStoredHosts,
        start,
        nextFrame,
        needsRekey,
        clear,
    };
}
