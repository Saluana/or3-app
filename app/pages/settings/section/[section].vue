<template>
    <AppShell>
        <AppHeader subtitle="SETTINGS" />
        <div class="space-y-4">
            <SimpleSettingsSection v-if="section" :section="section" />
            <SurfaceCard v-else class-name="text-sm text-(--or3-text-muted) text-center">
                <p v-if="loading">Loading…</p>
                <p v-else>No settings group named “{{ sectionKey }}”.</p>
                <NuxtLink to="/settings" class="mt-2 inline-block text-(--or3-green-dark) underline">Back to settings</NuxtLink>
            </SurfaceCard>
        </div>
    </AppShell>
</template>

<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import type { SimpleSettingSectionKey } from '~/settings/simpleSettings'
import { useSimpleSettings } from '~/composables/settings/useSimpleSettings'

const route = useRoute()
const simple = useSimpleSettings()
const loading = ref(true)

const sectionKey = computed(() => String(route.params.section ?? '') as SimpleSettingSectionKey)
const section = computed(() => simple.getSection(sectionKey.value))

async function ensure() {
    loading.value = true
    try {
        await simple.ensureLoaded(sectionKey.value)
    } finally {
        loading.value = false
    }
}

watch(sectionKey, () => {
    void ensure()
})

onMounted(() => {
    void ensure()
})
</script>
