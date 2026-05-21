<template>
    <SurfaceCard class-name="space-y-4">
        <div class="flex items-center justify-between gap-3">
            <div class="flex items-start gap-3">
                <RetroIcon class="shrink-0" name="i-pixelarticons-smartphone" />
                <div>
                    <p
                        class="font-mono text-base font-semibold text-(--or3-text)"
                    >
                        Legacy pairings
                    </p>
                    <p class="mt-1 text-sm text-(--or3-text-muted)">
                        These are older short-code device tokens. Secure
                        certificate-backed devices are listed in the secure
                        devices card above.
                    </p>
                </div>
            </div>
            <UButton
                icon="i-pixelarticons-reload"
                color="neutral"
                variant="ghost"
                aria-label="Refresh devices"
                :disabled="!isConnected"
                @click="refresh"
            />
        </div>

        <div
            v-if="isPaired && !isConnected"
            class="rounded-2xl border border-dashed border-(--or3-border) bg-white/60 px-4 py-6 text-center text-sm text-(--or3-text-muted)"
        >
            Legacy tokens are saved for this computer, but it is not reachable
            right now.
        </div>

        <div
            v-else-if="!devices.length"
            class="rounded-2xl border border-dashed border-(--or3-border) bg-white/60 px-4 py-6 text-center text-sm text-(--or3-text-muted)"
        >
            No legacy paired devices are stored.
        </div>

        <div
            v-else
            class="divide-y divide-(--or3-border) overflow-hidden rounded-2xl border border-(--or3-border) bg-white/70"
        >
            <div
                v-for="device in devices"
                :key="device.device_id"
                class="flex items-center gap-3 p-3"
            >
                <div
                    class="grid size-10 place-items-center rounded-xl bg-(--or3-green-soft) text-(--or3-green)"
                >
                    <Icon name="i-pixelarticons-smartphone" class="size-5" />
                </div>
                <div class="min-w-0 flex-1">
                    <p class="truncate font-mono text-sm font-semibold">
                        {{ device.display_name || device.device_id }}
                    </p>
                    <p class="text-xs text-(--or3-text-muted)">
                        {{ friendlyRole(device.role) }} ·
                        {{ friendlyStatus(device.status) }}
                    </p>
                </div>
                <UButton
                    icon="i-pixelarticons-close"
                    color="error"
                    variant="soft"
                    size="sm"
                    aria-label="Remove device"
                    @click="askRevoke(device)"
                />
            </div>
        </div>

        <UModal v-model:open="confirmOpen" :ui="{ content: 'sm:max-w-md' }">
            <template #content>
                <div class="space-y-4 p-5">
                    <DangerCallout tone="danger" title="Remove this device?">
                        This will remove the legacy token for
                        <span class="font-semibold">{{
                            pendingDevice?.display_name ||
                            pendingDevice?.device_id
                        }}</span>
                        right away. Secure certificate-backed devices are
                        managed separately.
                    </DangerCallout>
                    <p v-if="revokeError" class="text-sm text-(--or3-red)">
                        {{ revokeError }}
                    </p>
                    <div class="flex justify-end gap-2">
                        <UButton
                            label="Cancel"
                            color="neutral"
                            variant="ghost"
                            @click="confirmOpen = false"
                        />
                        <UButton
                            label="Yes, remove"
                            color="error"
                            :loading="revoking"
                            @click="confirmRevoke"
                        />
                    </div>
                </div>
            </template>
        </UModal>
    </SurfaceCard>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue';
import { useToast } from '@nuxt/ui/composables';
import type { DeviceInfo } from '../../types/or3-api';
import { usePairing } from '../../composables/usePairing';
import { useActiveHost } from '../../composables/useActiveHost';

const { listDevices, revokeDevice, securePairingStatus } = usePairing();
const { activeHost, isConnected, isPaired } = useActiveHost();
const toast = useToast();
const devices = ref<DeviceInfo[]>([]);
const confirmOpen = ref(false);
const pendingDevice = ref<DeviceInfo | null>(null);
const revoking = ref(false);
const revokeError = ref('');

function friendlyRole(role?: string) {
    if (!role) return 'User';
    if (role === 'operator') return 'Operator';
    if (role === 'admin') return 'Admin';
    return role;
}

function friendlyStatus(status?: string) {
    if (!status) return 'Active';
    if (status === 'active') return 'Active';
    if (status === 'revoked') return 'Removed';
    return status;
}

async function refresh() {
    if (!isPaired.value || !isConnected.value) {
        devices.value = [];
        return;
    }
    devices.value = await listDevices().catch(() => []);
}

function askRevoke(device: DeviceInfo) {
    pendingDevice.value = device;
    revokeError.value = '';
    confirmOpen.value = true;
}

async function confirmRevoke() {
    if (!pendingDevice.value) return;
    revoking.value = true;
    revokeError.value = '';
    try {
        await revokeDevice(pendingDevice.value.device_id);
        await refresh();
        confirmOpen.value = false;
        pendingDevice.value = null;
    } catch (error) {
        revokeError.value =
            error instanceof Error
                ? error.message
                : 'Could not remove this device.';
        toast.add({
            title: 'Could not remove device',
            description: revokeError.value,
            color: 'error',
        });
    } finally {
        revoking.value = false;
    }
}

watch(
    [() => activeHost.value?.id, isPaired, isConnected, () => securePairingStatus.value],
    ([, paired, connected]) => {
        if (!paired || !connected) {
            devices.value = [];
            return;
        }
        void refresh();
    },
    { immediate: true },
);
</script>
