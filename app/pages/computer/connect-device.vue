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
                                Add device
                            </p>
                            <p class="mt-1 text-sm leading-6 text-(--or3-text-muted)">
                                Scan this QR or copy the link on your phone, tablet, browser, or another OR3 App. It opens pairing and connects automatically.
                            </p>
                        </div>
                    </div>
                    <div class="flex shrink-0 items-center gap-2">
                        <UButton
                            icon="i-pixelarticons-copy"
                            color="neutral"
                            variant="soft"
                            :disabled="!primaryInviteText"
                            :label="copiedQr ? 'Copied' : copyInviteLabel"
                            @click="copyQrText"
                        />
                        <UButton label="Refresh" icon="i-pixelarticons-reload" color="neutral" variant="soft" :loading="loadingQr" @click="loadQr" />
                    </div>
                </div>

                <div class="rounded-3xl border border-dashed border-(--or3-border) bg-white/70 p-5 text-center">
                    <div class="mx-auto grid size-56 place-items-center rounded-2xl bg-white p-3 text-(--or3-text-muted)">
                        <img
                            v-if="qrImageDataUrl"
                            class="size-full rounded-xl object-contain"
                            :src="qrImageDataUrl"
                            alt="Add device pairing QR code"
                        >
                        <span v-else-if="qrLoading" class="font-mono text-xs">Generating QR…</span>
                        <span v-else-if="primaryInviteText" class="max-w-full break-all font-mono text-[10px] leading-4">
                            {{ primaryInviteText }}
                        </span>
                        <span v-else>{{ qrInvite?.message || 'Generate a secure invite to show QR text.' }}</span>
                    </div>
                    <p v-if="qrInvite?.expiresAt" class="mt-3 text-xs text-(--or3-text-muted)">
                        Expires {{ expiresLabel(qrInvite.expiresAt) }} · {{ inviteRouteHint }}
                    </p>
                </div>

                <div class="rounded-2xl border border-(--or3-border) bg-white/60 p-3">
                    <p class="font-mono text-xs font-semibold uppercase tracking-wide text-(--or3-text-muted)">
                        Access for this device
                    </p>
                    <div class="mt-2 grid gap-2 sm:grid-cols-3">
                        <button
                            v-for="level in accessLevels"
                            :key="level.id"
                            type="button"
                            class="or3-focus-ring rounded-2xl border p-3 text-left transition"
                            :class="selectedAccessId === level.id ? 'border-(--or3-accent) bg-(--or3-accent-soft)' : 'border-(--or3-border) bg-white/70'"
                            @click="selectAccess(level.id)"
                        >
                            <span class="block font-mono text-sm font-semibold text-(--or3-text)">{{ level.label }}</span>
                            <span class="mt-1 block text-xs leading-5 text-(--or3-text-muted)">{{ level.description }}</span>
                        </button>
                    </div>
                    <p class="mt-2 text-xs leading-5 text-(--or3-text-muted)">
                        Changing access refreshes the QR. For safety, new invites use viewer/operator permissions; admin is not offered here.
                    </p>
                </div>
            </SurfaceCard>

            <details class="rounded-2xl border border-(--or3-border) bg-white/60 p-4">
                <summary class="cursor-pointer font-mono text-sm font-semibold text-(--or3-text)">
                    Compatibility options
                </summary>
                <p class="mt-2 text-sm leading-6 text-(--or3-text-muted)">
                    Older one-time code pairing remains available for recovery or older clients. Prefer Add device for new devices.
                </p>
                <div class="mt-3 space-y-3">
                    <UButton label="Generate one-time code" color="neutral" variant="soft" :loading="loadingCode" @click="loadCode" />
                    <div v-if="cliInvite" class="grid gap-2 sm:grid-cols-2">
                        <code class="rounded-2xl border border-(--or3-border) bg-white/70 p-3 font-mono text-xs">Request: {{ cliInvite.requestId || '—' }}</code>
                        <code class="rounded-2xl border border-(--or3-border) bg-white/70 p-3 font-mono text-xs">Code: {{ cliInvite.code || '—' }}</code>
                    </div>
                    <p v-if="cliInvite?.message" class="text-sm text-(--or3-text-muted)">{{ cliInvite.message }}</p>
                    <UButton label="Open pairing settings" color="neutral" variant="soft" to="/settings/pair" />
                </div>
            </details>
        </div>
    </AppShell>
</template>

<script setup lang="ts">
import QRCode from 'qrcode';
import { computed, onMounted, ref, watch } from 'vue';
import type { HostDeviceInvite } from '~/types/electron-host';
import { useElectronHostSetup } from '~/composables/useElectronHostSetup';

const host = useElectronHostSetup();
const { isElectronHostMode, ensureLoaded, createSecureInvite, createCliInvite } = host;
const qrInvite = ref<HostDeviceInvite | null>(null);
const cliInvite = ref<HostDeviceInvite | null>(null);
const loadingQr = ref(false);
const loadingCode = ref(false);
const qrImageDataUrl = ref('');
const qrLoading = ref(false);
const copiedQr = ref(false);
const primaryInviteText = computed(() => qrInvite.value?.inviteLink || qrInvite.value?.qrText || '');
const copyInviteLabel = computed(() => qrInvite.value?.inviteLink ? 'Copy link' : 'Copy invite');
const inviteRouteHint = computed(() => qrInvite.value?.inviteLink ? 'opens /pair automatically' : 'scan with OR3 or paste invite text');
const selectedAccessId = ref('control');
const accessLevels = [
    {
        id: 'chat',
        label: 'Chat only',
        description: 'Send messages and view responses. No file or terminal access.',
        requestedRole: 'viewer',
        capabilities: ['chat'],
    },
    {
        id: 'files',
        label: 'Chat + files',
        description: 'Use chat and file browsing without terminal control.',
        requestedRole: 'operator',
        capabilities: ['chat', 'files'],
    },
    {
        id: 'control',
        label: 'Full control',
        description: 'Allow chat, files, and terminal actions for trusted devices.',
        requestedRole: 'operator',
        capabilities: ['chat', 'files', 'terminal'],
    },
] as const;
const selectedAccess = computed(() => accessLevels.find((level) => level.id === selectedAccessId.value) || accessLevels[2]);

onMounted(async () => {
    await ensureLoaded();
    if (isElectronHostMode.value) await loadQr();
});

watch(
    () => primaryInviteText.value,
    async (text) => {
        qrImageDataUrl.value = qrInvite.value?.qrImageDataUrl || '';
        copiedQr.value = false;
        if (!text || qrImageDataUrl.value) return;
        qrLoading.value = true;
        try {
            qrImageDataUrl.value = await QRCode.toDataURL(text, {
                errorCorrectionLevel: 'M',
                margin: 2,
                width: 224,
                color: {
                    dark: '#233222',
                    light: '#ffffff',
                },
            });
        } catch {
            qrImageDataUrl.value = '';
        } finally {
            qrLoading.value = false;
        }
    },
);

async function loadQr() {
    loadingQr.value = true;
    try {
        qrInvite.value = await createSecureInvite({
            requestedRole: selectedAccess.value.requestedRole,
            capabilities: [...selectedAccess.value.capabilities],
        });
        if (qrInvite.value?.status === 'failed' && !cliInvite.value) await loadCode();
    } finally {
        loadingQr.value = false;
    }
}

async function selectAccess(accessId: string) {
    if (selectedAccessId.value === accessId) return;
    selectedAccessId.value = accessId;
    await loadQr();
}

async function loadCode() {
    loadingCode.value = true;
    try {
        cliInvite.value = await createCliInvite();
    } finally {
        loadingCode.value = false;
    }
}

async function copyQrText() {
    const text = primaryInviteText.value;
    if (!text || !navigator?.clipboard?.writeText) return;
    await navigator.clipboard.writeText(text);
    copiedQr.value = true;
    window.setTimeout(() => {
        copiedQr.value = false;
    }, 1500);
}

function expiresLabel(value: string) {
    const date = new Date(value);
    if (!Number.isFinite(date.getTime())) return 'soon';
    return date.toLocaleTimeString();
}
</script>
