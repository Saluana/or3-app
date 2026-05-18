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
const browserCameraNotice = computed(() => {
    if (!import.meta.client || window.isSecureContext) return '';
    return 'Mobile browsers only allow camera scanning on HTTPS or localhost. Use a secure URL, or paste the QR text.';
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
    return `${window.location.origin}/api/or3`;
}

function resolveInvitePairingBaseUrl(routes?: PairingInviteRouteV2[]) {
    const appProxyRoute = routes?.find((route) => route.kind === 'app-proxy');
    if (appProxyRoute) return inferredLocalServiceBaseUrl() || appProxyRoute.baseUrl;
    return routes?.[0]?.baseUrl || '';
}

function resolvePairingBaseUrl(payload?: PairingQRCodeV1 | null, routeBaseUrl = '') {
    return (
        activeHost.value?.baseUrl ||
        routeBaseUrl ||
        payload?.serviceBaseUrl ||
        inferredLocalServiceBaseUrl()
    ).trim().replace(/\/+$/, '');
}

async function enrollFromQR(raw: string, payload?: PairingQRCodeV1 | null, routeBaseUrl = '') {
    const baseUrl = resolvePairingBaseUrl(payload, routeBaseUrl);
    if (!baseUrl) {
        throw new Error('Could not determine the computer address for this QR code.');
    }
    resolvedPairingBaseUrl.value = baseUrl;
    if (!globalThis.isSecureContext || !globalThis.crypto?.subtle?.generateKey) {
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
    } else if (payload) {
        await upgradeSecurePairingPayload({
            baseUrl,
            qr: payload,
            deviceName: 'or3-app',
        });
    } else {
        await upgradeLegacyDeviceToSecure({
            baseUrl,
            qr: raw,
            deviceName: 'or3-app',
        });
    }
    toast.add({
        title: 'Device connected',
        description: 'This device can now use this computer.',
        color: 'success',
    });
    qrText.value = '';
    successMessage.value = 'Connected. This device can now use this computer.';
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
