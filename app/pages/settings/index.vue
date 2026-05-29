<template>
    <AppShell
        desktop-title="Settings"
        desktop-subtitle="Configure models, memory, runtime, and connection settings."
    >
        <template #sidebar>
            <SettingsSidebar />
        </template>
        <AppHeader subtitle="SETTINGS" />

        <MobileSettingsHome v-if="!isDesktop" />
        <AdvancedSettingsHome v-else />
    </AppShell>
</template>

<script setup lang="ts">
import { useViewport } from '~/composables/useViewport';

const { matches: isDesktop } = useViewport('(min-width: 1024px)');
</script>
