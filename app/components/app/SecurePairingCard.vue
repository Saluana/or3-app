<template>
    <SurfaceCard class-name="space-y-4">
        <div class="flex items-start gap-3">
            <RetroIcon name="i-pixelarticons-scan-barcode" />
            <div class="min-w-0 flex-1">
                <p class="font-mono text-base font-semibold text-(--or3-text)">
                    Connect with QR
                </p>
                <p class="mt-1 text-sm leading-6 text-(--or3-text-muted)">
                    Scan the QR from your computer, or paste the copied invite link,
                    to add this device.
                </p>
                <p class="mt-1 text-xs leading-5 text-(--or3-text-muted)">
                    Secure device enrollment requires HTTPS, `localhost`, or the OR3 app. Plain HTTP browsers fall back to compatibility pairing.
                </p>
            </div>
        </div>

        <div class="grid gap-3 sm:grid-cols-[1fr_auto]">
            <UTextarea
                v-model="qrText"
                aria-label="Pairing invite link or QR text"
                placeholder="Paste invite link or QR text"
                autoresize
            />
            <div class="flex flex-col gap-2">
                <UButton
                    label="Scan"
                    icon="i-pixelarticons-camera"
                    :loading="loading"
                    @click="scan"
                />
                <UButton
                    label="Use text"
                    icon="i-pixelarticons-check"
                    color="neutral"
                    variant="soft"
                    :loading="loading"
                    @click="parse"
                />
            </div>
        </div>
        <p v-if="browserCameraNotice" class="text-sm leading-6 text-(--or3-text-muted)">
            {{ browserCameraNotice }}
        </p>

        <div
            v-if="summary"
            class="rounded-xl border border-(--or3-border) bg-white/70 p-3 text-sm"
        >
            <p class="font-mono font-semibold text-(--or3-text)">
                {{ summary.hostDisplayName || 'Computer' }}
            </p>
            <p class="mt-1 text-(--or3-text-muted)">
                {{ friendlyStatus }}
            </p>
            <p v-if="resolvedPairingBaseUrl" class="mt-1 font-mono text-xs text-(--or3-text-muted)">
                {{ resolvedPairingBaseUrl }}
            </p>
            <div class="mt-3 flex flex-wrap gap-2">
                <UBadge
                    v-for="capability in summary.capabilities"
                    :key="capability"
                    color="neutral"
                    variant="soft"
                >
                    {{ capability }}
                </UBadge>
            </div>
        </div>
    </SurfaceCard>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue';
import { useToast } from '@nuxt/ui/composables';
import {
    pairingInviteToQRCodeV1,
    parsePairingInvite,
    scanPairingQRCodeWithCamera,
    type PairingInviteRouteV2,
    type PairingQRCodeV1,
} from '../../utils/or3/secure-connections';
import { usePairing } from '../../composables/usePairing';
import { useActiveHost } from '../../composables/useActiveHost';

const { activeHost } = useActiveHost();
const {
    securePairingStatus,
    exchangeSecurePairingPayload,
    exchangeSecurePairingQR,
    upgradeSecurePairingPayload,
    upgradeLegacyDeviceToSecure,
} = usePairing();
const toast = useToast();
const qrText = ref('');
const loading = ref(false);
const summary = ref<PairingQRCodeV1 | null>(null);
const resolvedPairingBaseUrl = ref('');
const successMessage = ref('');
const connectedMode = ref<'secure' | 'compatibility' | null>(null);
const browserCameraNotice = computed(() => {
    if (!import.meta.client || window.isSecureContext) return '';
    return 'This page is using plain HTTP, so browsers cannot complete secure certificate enrollment here. Scan/paste still works, but it will connect in compatibility mode unless you use HTTPS, localhost, or the OR3 app.';
});

const friendlyStatus = computed(() => {
    if (successMessage.value) return successMessage.value;
    if (securePairingStatus.value === 'waiting')
        return 'QR verified. Finishing device enrollment now.';
    if (securePairingStatus.value === 'pending_approval')
        return 'Requesting secure enrollment from your computer.';
    if (securePairingStatus.value === 'connected')
        return 'This device is connected to your computer.';
    if (securePairingStatus.value === 'rejected')
        return 'The computer rejected this request.';
    if (securePairingStatus.value === 'expired') return 'This code expired.';
    return 'Ready to pair.';
});

function inferredLocalServiceBaseUrl() {
    if (typeof window === 'undefined') return '';
    if (window.location.protocol !== 'http:' && window.location.protocol !== 'https:') return '';
    return `${window.location.origin}/api/or3`;
}

function canUseSecureEnrollment() {
    return Boolean(globalThis.isSecureContext && globalThis.crypto?.subtle?.generateKey);
}

function normalizedHttpBaseUrl(baseUrl?: string | null) {
    const raw = baseUrl?.trim().replace(/\/+$/, '');
    if (!raw) return '';
    try {
        const parsed = new URL(raw);
        if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return '';
        return raw;
    } catch {
        return '';
    }
}

function resolveInvitePairingBaseUrl(routes?: PairingInviteRouteV2[]) {
    const appProxyRoute = routes?.find((route) => route.kind === 'app-proxy');
    if (appProxyRoute) return normalizedHttpBaseUrl(appProxyRoute.baseUrl);
    return '';
}

function uniqueBaseUrls(values: Array<string | undefined>) {
    const seen = new Set<string>();
    return values
        .map((value) => normalizedHttpBaseUrl(value))
        .filter((value) => {
            if (!value || seen.has(value)) return false;
            seen.add(value);
            return true;
        });
}

async function routeIsHealthy(baseUrl: string, timeoutMs = 750) {
    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), timeoutMs);
    try {
        const response = await fetch(`${baseUrl}/internal/v1/health`, {
            method: 'GET',
            headers: { Accept: 'application/json' },
            signal: controller.signal,
        });
        const contentType = response.headers.get('content-type') || '';
        if (!response.ok || !contentType.toLowerCase().includes('application/json')) return false;
        const health = await response.json().catch(() => null) as {
            status?: unknown;
            health?: unknown;
        } | null;
        const status = typeof health?.status === 'string'
            ? health.status.toLowerCase()
            : typeof health?.health === 'string'
              ? health.health.toLowerCase()
              : '';
        return status === 'ok';
    } catch {
        return false;
    } finally {
        window.clearTimeout(timeout);
    }
}

async function resolvePairingBaseUrl(payload?: PairingQRCodeV1 | null, routeBaseUrl = '') {
    const candidates = uniqueBaseUrls([
        inferredLocalServiceBaseUrl(),
        routeBaseUrl,
        payload?.serviceBaseUrl,
        activeHost.value?.baseUrl,
    ]);
    if (!candidates.length) return '';
    for (const candidate of candidates) {
        if (await routeIsHealthy(candidate)) return candidate;
    }
    return candidates[0] || '';
}

async function enrollFromQR(raw: string, payload?: PairingQRCodeV1 | null, routeBaseUrl = '') {
    const baseUrl = await resolvePairingBaseUrl(payload, routeBaseUrl);
    if (!baseUrl) {
        throw new Error('Could not determine the computer address for this QR code.');
    }
    resolvedPairingBaseUrl.value = baseUrl;
    const secureEnrollment = canUseSecureEnrollment();
    if (!secureEnrollment) {
        if (payload) {
            await exchangeSecurePairingPayload({
                baseUrl,
                qr: payload,
                deviceName: 'or3-app',
            });
        } else {
            await exchangeSecurePairingQR({
                baseUrl,
                qr: raw,
                deviceName: 'or3-app',
            });
        }
        connectedMode.value = 'compatibility';
    } else if (payload) {
        await upgradeSecurePairingPayload({
            baseUrl,
            qr: payload,
            deviceName: 'or3-app',
        });
        connectedMode.value = 'secure';
    } else {
        await upgradeLegacyDeviceToSecure({
            baseUrl,
            qr: raw,
            deviceName: 'or3-app',
        });
        connectedMode.value = 'secure';
    }
    toast.add({
        title:
            connectedMode.value === 'compatibility'
                ? 'Connected in compatibility mode'
                : 'Secure device connected',
        description:
            connectedMode.value === 'compatibility'
                ? 'This browser is not in a secure context, so OR3 saved a legacy pairing instead of a secure device certificate.'
                : 'This device can now use this computer with a secure enrollment certificate.',
        color: 'success',
    });
    qrText.value = '';
    successMessage.value =
        connectedMode.value === 'compatibility'
            ? 'Connected in compatibility mode because this browser is using plain HTTP.'
            : 'Connected securely. This device now has an enrollment certificate.';
}

function pairingErrorMessage(error: unknown, fallback: string) {
    if (error instanceof Error && error.message) return error.message;
    if (error && typeof error === 'object') {
        const maybe = error as { message?: unknown; error?: unknown };
        if (typeof maybe.message === 'string' && maybe.message) return maybe.message;
        if (typeof maybe.error === 'string' && maybe.error) return maybe.error;
    }
    return fallback;
}

async function scan() {
    loading.value = true;
    successMessage.value = '';
    connectedMode.value = null;
    try {
        const scanned = await scanPairingQRCodeWithCamera();
        const parsed = parsePairingInvite(scanned.raw);
        summary.value = scanned.payload;
        qrText.value = '';
        await enrollFromQR(scanned.raw, scanned.payload, resolveInvitePairingBaseUrl(parsed.routes));
    } catch (error) {
        toast.add({
            title: 'Could not scan code',
            description: pairingErrorMessage(error, 'Try pasting the QR text instead.'),
            color: 'error',
        });
    } finally {
        loading.value = false;
    }
}

async function parse() {
    loading.value = true;
    successMessage.value = '';
    connectedMode.value = null;
    try {
        const parsed = parsePairingInvite(qrText.value);
        summary.value = parsed.version === 2 ? pairingInviteToQRCodeV1(parsed.invite) : parsed.qr;
        await enrollFromQR(qrText.value, summary.value, resolveInvitePairingBaseUrl(parsed.routes));
    } catch (error) {
        toast.add({
            title: 'Could not read code',
            description: pairingErrorMessage(error, 'Use a fresh QR code.'),
            color: 'error',
        });
    } finally {
        loading.value = false;
    }
}
</script>
