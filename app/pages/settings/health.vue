<template>
    <AppShell>
        <AppHeader subtitle="SETTINGS · HEALTH" />
        <div class="space-y-4">
            <button
                type="button"
                class="inline-flex items-center gap-1 rounded-full px-2 py-1 text-sm font-medium text-(--or3-green) transition hover:bg-(--or3-green-soft)"
                @click="$router.push('/settings')"
            >
                <Icon name="i-pixelarticons-chevron-left" class="size-4" />
                All settings
            </button>
            <SettingsHealthCheck />
        </div>
    </AppShell>
</template>

<script setup lang="ts">
// Simple wrapper page; logic lives in SettingsHealthCheck.vue.
</script>
