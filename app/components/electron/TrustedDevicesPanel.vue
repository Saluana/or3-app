<template>
    <div class="space-y-4" data-testid="trusted-devices-panel">
        <SurfaceCard class-name="space-y-4">
            <div class="flex items-start justify-between gap-3">
                <div class="flex items-start gap-3">
                    <RetroIcon name="i-pixelarticons-shield" />
                    <div>
                        <p class="font-mono text-base font-semibold text-(--or3-text)">
                            Trusted devices
                        </p>
                        <p class="mt-1 text-sm leading-6 text-(--or3-text-muted)">
                            Secure enrolled devices that can control this computer.
                        </p>
                    </div>
                </div>
                <UButton icon="i-pixelarticons-reload" color="neutral" variant="ghost" :loading="loading" @click="refresh" />
            </div>
            <div v-if="error" class="rounded-2xl border border-(--or3-border) bg-white/70 p-3 text-sm text-(--or3-text-muted)">
                {{ error }}
            </div>
            <div v-if="!secureDevices.length" class="rounded-2xl border border-dashed border-(--or3-border) bg-white/60 p-4 text-center text-sm text-(--or3-text-muted)">
                No secure devices are enrolled yet.
            </div>
            <div v-else class="space-y-2">
                <div v-for="device in secureDevices" :key="deviceId(device)" class="rounded-2xl border border-(--or3-border) bg-white/70 p-3">
                    <div class="flex items-center justify-between gap-3">
                        <div class="min-w-0">
                            <p class="truncate font-mono text-sm font-semibold">{{ deviceName(device) }}</p>
                            <p class="mt-1 text-xs text-(--or3-text-muted)">{{ deviceRole(device) }} · {{ deviceStatus(device) }}</p>
                        </div>
                        <UButton label="Revoke" color="error" variant="soft" size="sm" @click="askRevoke('secure', device)" />
                    </div>
                </div>
            </div>
        </SurfaceCard>

        <details class="rounded-2xl border border-(--or3-border) bg-white/60 p-4">
            <summary class="cursor-pointer font-mono text-sm font-semibold text-(--or3-text)">
                Compatibility devices
            </summary>
            <p class="mt-2 text-sm leading-6 text-(--or3-text-muted)">
                Older short-code pairings are kept separate. Remove anything you no longer recognize.
            </p>
            <div v-if="!legacyDevices.length" class="mt-3 rounded-2xl border border-dashed border-(--or3-border) bg-white/60 p-4 text-center text-sm text-(--or3-text-muted)">
                No compatibility devices are stored.
            </div>
            <div v-else class="mt-3 space-y-2">
                <div v-for="device in legacyDevices" :key="deviceId(device)" class="rounded-2xl border border-(--or3-border) bg-white/70 p-3">
                    <div class="flex items-center justify-between gap-3">
                        <div class="min-w-0">
                            <p class="truncate font-mono text-sm font-semibold">{{ deviceName(device) }}</p>
                            <p class="mt-1 text-xs text-(--or3-text-muted)">{{ deviceRole(device) }} · {{ deviceStatus(device) }}</p>
                        </div>
                        <UButton label="Remove" color="error" variant="soft" size="sm" @click="askRevoke('legacy', device)" />
                    </div>
                </div>
            </div>
        </details>

        <UModal v-model="confirmOpen" :ui="{ content: 'sm:max-w-md' }">
            <template #content>
                <div class="space-y-4 p-5">
                    <DangerCallout tone="danger" title="Revoke this device?">
                        This stops {{ pendingName }} from using this computer.
                    </DangerCallout>
                    <div class="flex justify-end gap-2">
                        <UButton label="Cancel" color="neutral" variant="ghost" @click="confirmOpen = false" />
                        <UButton label="Revoke" color="error" :loading="revoking" @click="confirmRevoke" />
                    </div>
                </div>
            </template>
        </UModal>
    </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { useElectronHostSetup } from '~/composables/useElectronHostSetup';

const host = useElectronHostSetup();
const secureDevices = ref<Array<Record<string, unknown>>>([]);
const legacyDevices = ref<Array<Record<string, unknown>>>([]);
const loading = ref(false);
const revoking = ref(false);
const error = ref('');
const confirmOpen = ref(false);
const pending = ref<{ kind: 'secure' | 'legacy'; device: Record<string, unknown> } | null>(null);

const pendingName = computed(() => (pending.value ? deviceName(pending.value.device) : 'this device'));

function deviceId(device: Record<string, unknown>) {
    return String(device.device_id || device.DeviceID || device.id || 'unknown');
}

function deviceName(device: Record<string, unknown>) {
    return String(device.display_name || device.DisplayName || device.name || deviceId(device));
}

function deviceRole(device: Record<string, unknown>) {
    return String(device.role || device.Role || 'operator');
}

function deviceStatus(device: Record<string, unknown>) {
    return String(device.status || device.Status || 'active');
}

async function refresh() {
    loading.value = true;
    error.value = '';
    try {
        const bridge = window.or3Desktop;
        secureDevices.value = (await bridge?.intern.listSecureDevices()) || [];
        legacyDevices.value = (await bridge?.intern.listLegacyDevices()) || [];
        await host.refreshStatus();
    } catch (err) {
        error.value = err instanceof Error ? err.message : 'Could not load devices. Retry when OR3 is online.';
    } finally {
        loading.value = false;
    }
}

function askRevoke(kind: 'secure' | 'legacy', device: Record<string, unknown>) {
    pending.value = { kind, device };
    confirmOpen.value = true;
}

async function confirmRevoke() {
    if (!pending.value) return;
    revoking.value = true;
    try {
        const bridge = window.or3Desktop;
        const id = deviceId(pending.value.device);
        if (pending.value.kind === 'secure') await bridge?.intern.revokeSecureDevice(id);
        else await bridge?.intern.revokeLegacyDevice(id);
        confirmOpen.value = false;
        pending.value = null;
        await refresh();
    } finally {
        revoking.value = false;
    }
}

onMounted(refresh);
</script>
