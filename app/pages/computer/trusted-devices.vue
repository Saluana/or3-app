<template>
    <AppShell
        desktop-title="Trusted devices"
        desktop-subtitle="Review and remove devices that can access this computer."
    >
        <template #sidebar><ComputerSidebar /></template>
        <AppHeader subtitle="TRUSTED DEVICES" />

        <SurfaceCard v-if="!isElectronHostMode" class-name="space-y-3">
            <p class="font-mono text-base font-semibold text-(--or3-text)">
                Device management is on the paired computer
            </p>
            <p class="text-sm leading-6 text-(--or3-text-muted)">
                Web, iOS, Android, and Electron remote mode keep using the client pairing screen.
            </p>
            <UButton label="Open pairing" to="/settings/pair" />
        </SurfaceCard>

        <TrustedDevicesPanel v-else />
    </AppShell>
</template>

<script setup lang="ts">
import { onMounted } from 'vue';
import { useElectronHostSetup } from '~/composables/useElectronHostSetup';

const { isElectronHostMode, ensureLoaded } = useElectronHostSetup();

onMounted(() => {
    void ensureLoaded();
});
</script>
