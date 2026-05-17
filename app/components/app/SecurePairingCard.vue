<template>
    <SurfaceCard class-name="space-y-4">
        <div class="flex items-start gap-3">
            <RetroIcon name="i-pixelarticons-scan-barcode" />
            <div class="min-w-0 flex-1">
                <p class="font-mono text-base font-semibold text-(--or3-text)">
                    Connect with QR
                </p>
                <p class="mt-1 text-sm leading-6 text-(--or3-text-muted)">
                    Scan the secure QR from a computer you already connected to,
                    and this app will enroll a signed secure device record.
                </p>
            </div>
        </div>

        <div
            v-if="!activeHost?.baseUrl"
            class="rounded-xl border border-dashed border-(--or3-border) bg-white/60 p-3 text-sm text-(--or3-text-muted)"
        >
            Finish the one-time connection above first. Secure QR enrollment
            upgrades an already connected device instead of replacing the
            initial pairing step.
        </div>

        <div class="grid gap-3 sm:grid-cols-[1fr_auto]">
            <UTextarea
                v-model="qrText"
                aria-label="Pairing QR text"
                placeholder="Paste QR text here if camera scanning is unavailable"
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
    scanPairingQRCodeWithCamera,
    type PairingQRCodeV1,
} from '../../utils/or3/secure-connections';
import { usePairing } from '../../composables/usePairing';
import { useActiveHost } from '../../composables/useActiveHost';

const { activeHost } = useActiveHost();
const {
    parseSecurePairingQR,
    securePairingStatus,
    upgradeLegacyDeviceToSecure,
} = usePairing();
const toast = useToast();
const qrText = ref('');
const loading = ref(false);
const summary = ref<PairingQRCodeV1 | null>(null);

const friendlyStatus = computed(() => {
    if (securePairingStatus.value === 'waiting')
        return activeHost.value?.baseUrl
            ? 'QR verified. Finish secure enrollment on this connected computer.'
            : 'Connect with a one-time code first, then scan again for secure enrollment.';
    if (securePairingStatus.value === 'pending_approval')
        return 'Requesting secure enrollment from your computer.';
    if (securePairingStatus.value === 'connected')
        return 'Secure enrollment is active for this computer.';
    if (securePairingStatus.value === 'rejected')
        return 'The computer rejected this request.';
    if (securePairingStatus.value === 'expired') return 'This code expired.';
    return 'Ready to pair.';
});

async function maybeUpgrade(raw: string) {
    if (!activeHost.value?.baseUrl) return;
    await upgradeLegacyDeviceToSecure({
        baseUrl: activeHost.value.baseUrl,
        qr: raw,
        deviceName: 'or3-app',
    });
}

async function scan() {
    loading.value = true;
    try {
        const scanned = await scanPairingQRCodeWithCamera();
        summary.value = scanned.payload;
        qrText.value = '';
        await maybeUpgrade(scanned.raw);
    } catch (error) {
        toast.add({
            title: 'Could not scan code',
            description:
                error instanceof Error
                    ? error.message
                    : 'Try pasting the QR text instead.',
            color: 'error',
        });
    } finally {
        loading.value = false;
    }
}

async function parse() {
    loading.value = true;
    try {
        summary.value = await parseSecurePairingQR(qrText.value);
        await maybeUpgrade(qrText.value);
    } catch (error) {
        toast.add({
            title: 'Could not read code',
            description:
                error instanceof Error ? error.message : 'Use a fresh QR code.',
            color: 'error',
        });
    } finally {
        loading.value = false;
    }
}
</script>
