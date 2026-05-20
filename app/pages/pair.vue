<template>
    <AppShell desktop-title="Pair device" desktop-subtitle="Connect this device to your computer.">
        <template #sidebar><SettingsSidebar /></template>
        <AppHeader subtitle="PAIR DEVICE" />

        <div class="mx-auto flex min-h-[55vh] max-w-xl items-center justify-center">
            <SurfaceCard class-name="w-full space-y-5 text-center">
                <div class="mx-auto grid size-14 place-items-center rounded-2xl border border-(--or3-border) bg-white/70">
                    <RetroIcon :name="statusIcon" />
                </div>
                <div class="space-y-2">
                    <p class="font-mono text-lg font-semibold text-(--or3-text)">
                        {{ title }}
                    </p>
                    <p class="text-sm leading-6 text-(--or3-text-muted)">
                        {{ message }}
                    </p>
                    <p v-if="selectedRoute" class="font-mono text-xs text-(--or3-text-muted)">
                        {{ selectedRoute }}
                    </p>
                </div>
                <div v-if="status === 'connecting'" class="mx-auto h-2 w-40 overflow-hidden rounded-full bg-(--or3-border)">
                    <div class="h-full w-1/2 animate-pulse rounded-full bg-(--or3-accent)" />
                </div>
                <div v-if="status === 'failed'" class="flex justify-center gap-2">
                    <UButton label="Retry" icon="i-pixelarticons-reload" @click="connect" />
                    <UButton label="Pairing settings" color="neutral" variant="soft" to="/settings/pair" />
                </div>
            </SurfaceCard>
        </div>
    </AppShell>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { useRouter } from 'vue-router';
import {
    parsePairingInvite,
    pairingInviteToQRCodeV1,
    type PairingInviteRouteV2,
    type PairingQRCodeV1,
} from '~/utils/or3/secure-connections';
import { usePairing } from '~/composables/usePairing';

const router = useRouter();
const pairing = usePairing();
const status = ref<'connecting' | 'connected' | 'failed'>('connecting');
const message = ref('Connecting to This computer…');
const selectedRoute = ref('');
const connectedMode = ref<'secure' | 'compatibility' | null>(null);

const title = computed(() => {
    if (status.value === 'connected') return 'Connected to this computer';
    if (status.value === 'failed') return 'Could not connect';
    return 'Connecting to This computer…';
});
const statusIcon = computed(() => {
    if (status.value === 'connected') return 'i-pixelarticons-check';
    if (status.value === 'failed') return 'i-pixelarticons-close';
    return 'i-pixelarticons-scan-barcode';
});

function inviteTextFromLocation() {
    if (typeof window === 'undefined') return '';
    const url = new URL(window.location.href);
    const hash = new URLSearchParams(url.hash.replace(/^#/, ''));
    return hash.get('invite') || url.searchParams.get('invite') || '';
}

function sameOriginProxyRoute(_routes: PairingInviteRouteV2[]): PairingInviteRouteV2 | null {
    if (typeof window === 'undefined') return null;
    if (window.location.protocol !== 'http:' && window.location.protocol !== 'https:') return null;
    return {
        kind: 'app-proxy',
        baseUrl: `${window.location.origin}/api/or3`,
        priority: 0,
    };
}

function routeKey(route: PairingInviteRouteV2) {
    return `${route.kind}:${route.baseUrl.replace(/\/+$/g, '')}`;
}

function candidateRoutes(routes: PairingInviteRouteV2[]) {
    const merged = new Map<string, PairingInviteRouteV2>();
    const sameOrigin = sameOriginProxyRoute(routes);
    for (const route of [sameOrigin, ...routes].filter(Boolean) as PairingInviteRouteV2[]) {
        const normalized = { ...route, baseUrl: route.baseUrl.replace(/\/+$/g, '') };
        const existing = merged.get(routeKey(normalized));
        if (!existing || normalized.priority < existing.priority) merged.set(routeKey(normalized), normalized);
    }
    return [...merged.values()].sort((a, b) => a.priority - b.priority);
}

async function checkRoute(route: PairingInviteRouteV2, timeoutMs = 900) {
    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), timeoutMs);
    try {
        const response = await fetch(`${route.baseUrl}/internal/v1/health`, {
            method: 'GET',
            headers: { Accept: 'application/json' },
            signal: controller.signal,
        });
        const contentType = response.headers.get('content-type') || '';
        if (!response.ok || !contentType.toLowerCase().includes('application/json')) {
            throw new Error('route unavailable');
        }
        const health = await response.json().catch(() => null) as {
            status?: unknown;
            health?: unknown;
        } | null;
        const status = typeof health?.status === 'string'
            ? health.status.toLowerCase()
            : typeof health?.health === 'string'
              ? health.health.toLowerCase()
              : typeof (health?.status as { health?: unknown } | undefined)?.health === 'string'
                ? String((health?.status as { health?: unknown }).health).toLowerCase()
                : '';
        if (status !== 'ok') throw new Error('route unavailable');
        return route;
    } finally {
        window.clearTimeout(timeout);
    }
}

async function chooseRoute(routes: PairingInviteRouteV2[]) {
    const candidates = candidateRoutes(routes);
    const sameOrigin = candidates.find((route) => route.kind === 'app-proxy' && route.priority === 0);
    if (sameOrigin) {
        try {
            return await checkRoute(sameOrigin, 650);
        } catch {
            // Fall through to racing the remaining routes.
        }
    }
    const remaining = candidates.filter((route) => route !== sameOrigin);
    if (!remaining.length) throw new Error('unreachable');
    return await Promise.any(remaining.map((route) => checkRoute(route, 1100))).catch(() => {
        throw new Error('unreachable');
    });
}

function browserCanUseSecureEnrollment() {
    return Boolean(globalThis.isSecureContext && globalThis.crypto?.subtle?.generateKey);
}

function friendlyPairingError(error: unknown) {
    const text = error instanceof Error ? error.message : String(error || '');
    if (/expired/i.test(text)) return 'This code expired. Refresh the QR on your computer.';
    if (/already used|consumed/i.test(text)) return 'This code was already used. Refresh the QR.';
    if (/security|crypto|subtle|secure context/i.test(text)) return 'Connection blocked by browser security. Use the copied link or open in the OR3 app.';
    if (/unreachable|failed to fetch|network|route unavailable|load failed/i.test(text)) return 'This computer is not reachable from this device.';
    return 'This computer is not reachable from this device.';
}

async function connect() {
    status.value = 'connecting';
    selectedRoute.value = '';
    message.value = 'Connecting to This computer…';
    try {
        const parsed = parsePairingInvite(inviteTextFromLocation());
        const qr: PairingQRCodeV1 = parsed.version === 2 ? pairingInviteToQRCodeV1(parsed.invite) : parsed.qr;
        const route = await chooseRoute(parsed.routes);
        selectedRoute.value = route.baseUrl;
        if (browserCanUseSecureEnrollment()) {
            await pairing.upgradeSecurePairingPayload({
                baseUrl: route.baseUrl,
                qr,
                deviceName: 'or3-app',
            });
            connectedMode.value = 'secure';
        } else {
            await pairing.exchangeSecurePairingPayload({
                baseUrl: route.baseUrl,
                qr,
                deviceName: 'or3-app',
            });
            connectedMode.value = 'compatibility';
        }
        status.value = 'connected';
        message.value =
            connectedMode.value === 'compatibility'
                ? 'Connected in compatibility mode because this browser is using plain HTTP. Use HTTPS, localhost, or the OR3 app for a secure device certificate.'
                : 'This device can now use this computer with a secure enrollment certificate.';
        window.setTimeout(() => {
            void router.push('/computer');
        }, 450);
    } catch (error) {
        status.value = 'failed';
        message.value = friendlyPairingError(error);
    }
}

onMounted(() => {
    void connect();
});
</script>
