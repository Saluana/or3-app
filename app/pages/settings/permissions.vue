<template>
    <AppShell>
        <AppHeader subtitle="SETTINGS · PERMISSIONS" />
        <div class="space-y-4">
            <button
                type="button"
                class="inline-flex items-center gap-1 rounded-full px-2 py-1 text-sm font-medium text-(--or3-green) transition hover:bg-(--or3-green-soft)"
                @click="$router.push('/settings')"
            >
                <Icon name="i-pixelarticons-chevron-left" class="size-4" />
                All settings
            </button>
            <PermissionsReceipt :value-index="valueIndex" />
        </div>
    </AppShell>
</template>

<script setup lang="ts">
import { computed, onMounted } from 'vue'
import { useSimpleSettings } from '~/composables/settings/useSimpleSettings'

const simple = useSimpleSettings()
const valueIndex = computed(() => simple.valueIndex.value)

onMounted(async () => {
    await simple.ensureLoaded()
})
</script>
