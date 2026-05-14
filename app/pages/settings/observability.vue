<template>
    <AppShell>
        <AppHeader subtitle="SETTINGS · OBSERVABILITY" />

        <div class="space-y-4">
            <NuxtLink
                to="/settings/advanced"
                class="inline-flex items-center gap-1 rounded-full px-2 py-1 text-sm font-medium text-(--or3-green) transition hover:bg-(--or3-green-soft)"
            >
                <Icon name="i-pixelarticons-chevron-left" class="size-4" />
                Advanced settings
            </NuxtLink>

            <SettingsObservabilityPanel />
        </div>
    </AppShell>
</template>

<script setup lang="ts">
// Dedicated page for runtime and service logs.
</script>
