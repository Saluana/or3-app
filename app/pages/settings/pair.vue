<template>
    <AppShell desktop-title="Settings" desktop-subtitle="Configure or3-intern.">
        <template #sidebar><SettingsSidebar /></template>
        <AppHeader :subtitle="isElectronHostMode ? 'TRUSTED DEVICES' : 'PAIR DEVICE'" />

        <div class="space-y-4">
            <button
                type="button"
                class="or3-focus-ring inline-flex items-center gap-2 rounded-full border border-(--or3-border) bg-(--or3-surface) px-3 py-1.5 font-mono text-xs font-semibold uppercase tracking-wide text-(--or3-text)"
                @click="goBack"
            >
                <Icon name="i-pixelarticons-chevron-left" class="size-4" />
                Settings
            </button>

            <SurfaceCard v-if="isElectronHostMode" class-name="space-y-3">
                <p class="font-mono text-base font-semibold text-(--or3-text)">
                    This computer is the host
                </p>
                <p class="text-sm leading-6 text-(--or3-text-muted)">
                    Use Connect devices to add phones, browsers, or remote Electron apps. Trusted devices lists secure devices first and compatibility pairings separately.
                </p>
                <div class="flex flex-wrap gap-2">
                    <UButton label="Connect devices" to="/computer/connect-device" />
                    <UButton label="Trusted devices" color="neutral" variant="soft" to="/computer/trusted-devices" />
                </div>
            </SurfaceCard>
            <template v-else>
                <SecurePairingCard />
                <details class="rounded-2xl border border-(--or3-border) bg-white/60 p-4">
                    <summary class="cursor-pointer font-mono text-sm font-semibold text-(--or3-text)">
                        Compatibility / Advanced
                    </summary>
                    <p class="mt-2 text-sm leading-6 text-(--or3-text-muted)">
                        Use one-time code pairing only for older clients or recovery. Most devices should paste the invite link or scan the QR.
                    </p>
                    <div class="mt-3">
                        <HostConnectionCard />
                    </div>
                </details>
                <SecureDeviceApprovalCard />
                <DeviceManagementCard />
            </template>
        </div>
    </AppShell>
</template>

<script setup lang="ts">
import { useRouter } from 'vue-router';
import { onMounted } from 'vue';
import { useElectronHostSetup } from '~/composables/useElectronHostSetup';

const router = useRouter();
const { isElectronHostMode, ensureLoaded } = useElectronHostSetup();

onMounted(() => {
    void ensureLoaded();
});

function goBack() {
    void router.push('/settings');
}
</script>
