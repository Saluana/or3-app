<template>
    <AppShell
        desktop-title="Connect device"
        desktop-subtitle="Add your phone, browser, or another OR3 App to this computer."
    >
        <template #sidebar><ComputerSidebar /></template>
        <AppHeader subtitle="CONNECT DEVICE" />

        <div v-if="!isElectronHostMode" class="space-y-4">
            <SurfaceCard class-name="space-y-3">
                <p class="font-mono text-base font-semibold text-(--or3-text)">
                    Connect to computer
                </p>
                <p class="text-sm leading-6 text-(--or3-text-muted)">
                    This page is only for Electron when it is using this computer. Use the pairing screen to connect this app to another computer.
                </p>
                <UButton label="Open pairing" to="/settings/pair" />
            </SurfaceCard>
        </div>

        <div v-else class="space-y-4" data-testid="host-connect-device-page">
            <SurfaceCard class-name="space-y-4">
                <div class="flex items-start justify-between gap-3">
                    <div class="flex items-start gap-3">
                        <RetroIcon name="i-pixelarticons-scan-barcode" />
                        <div>
                            <p class="font-mono text-base font-semibold text-(--or3-text)">
                                Scan secure QR
                            </p>
                            <p class="mt-1 text-sm leading-6 text-(--or3-text-muted)">
                                Open OR3 App on another device, choose scan or paste text, then confirm the new trusted device here.
                            </p>
                        </div>
                    </div>
                    <UButton label="Refresh" icon="i-pixelarticons-reload" color="neutral" variant="soft" :loading="loadingQr" @click="loadQr" />
                </div>

                <div class="rounded-3xl border border-dashed border-(--or3-border) bg-white/70 p-5 text-center">
                    <div class="mx-auto grid size-56 place-items-center rounded-2xl bg-white font-mono text-[10px] leading-4 text-(--or3-text-muted)">
                        <span v-if="qrInvite?.qrText">{{ qrInvite.qrText }}</span>
                        <span v-else>{{ qrInvite?.message || 'Generate a secure invite to show QR text.' }}</span>
                    </div>
                    <p v-if="qrInvite?.expiresAt" class="mt-3 text-xs text-(--or3-text-muted)">
                        Expires {{ formatTime(qrInvite.expiresAt) }} · {{ qrInvite.serviceBaseUrl }}
                    </p>
                </div>
            </SurfaceCard>

            <SurfaceCard class-name="space-y-3">
                <div class="flex items-start justify-between gap-3">
                    <div>
                        <p class="font-mono text-base font-semibold text-(--or3-text)">
                            Use a code instead
                        </p>
                        <p class="mt-1 text-sm leading-6 text-(--or3-text-muted)">
                            Secondary path for devices that cannot scan QR codes.
                        </p>
                    </div>
                    <UButton label="Generate code" color="neutral" variant="soft" :loading="loadingCode" @click="loadCode" />
                </div>
                <div class="grid gap-2 sm:grid-cols-2">
                    <code class="rounded-2xl border border-(--or3-border) bg-white/70 p-3 font-mono text-xs">Request: {{ cliInvite?.requestId || '—' }}</code>
                    <code class="rounded-2xl border border-(--or3-border) bg-white/70 p-3 font-mono text-xs">Code: {{ cliInvite?.code || '—' }}</code>
                </div>
                <p v-if="cliInvite?.message" class="text-sm text-(--or3-text-muted)">{{ cliInvite.message }}</p>
            </SurfaceCard>

            <details class="rounded-2xl border border-(--or3-border) bg-white/60 p-4">
                <summary class="cursor-pointer font-mono text-sm font-semibold text-(--or3-text)">
                    Compatibility options
                </summary>
                <p class="mt-2 text-sm leading-6 text-(--or3-text-muted)">
                    Older short-code pairing remains available for recovery or older clients. Prefer secure QR for new devices.
                </p>
                <UButton class="mt-3" label="Open compatibility pairing" color="neutral" variant="soft" to="/settings/pair" />
            </details>
        </div>
    </AppShell>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import type { HostDeviceInvite } from '~/types/electron-host';
import { useElectronHostSetup } from '~/composables/useElectronHostSetup';

const host = useElectronHostSetup();
const { isElectronHostMode, ensureLoaded, createSecureInvite, createCliInvite } = host;
const qrInvite = ref<HostDeviceInvite | null>(null);
const cliInvite = ref<HostDeviceInvite | null>(null);
const loadingQr = ref(false);
const loadingCode = ref(false);

onMounted(async () => {
    await ensureLoaded();
    if (isElectronHostMode.value) await loadQr();
});

async function loadQr() {
    loadingQr.value = true;
    try {
        qrInvite.value = await createSecureInvite();
        if (qrInvite.value?.status === 'failed' && !cliInvite.value) await loadCode();
    } finally {
        loadingQr.value = false;
    }
}

async function loadCode() {
    loadingCode.value = true;
    try {
        cliInvite.value = await createCliInvite();
    } finally {
        loadingCode.value = false;
    }
}

function formatTime(value: string) {
    try {
        return new Date(value).toLocaleTimeString();
    } catch {
        return value;
    }
}
</script>
