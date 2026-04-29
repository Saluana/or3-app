<template>
    <AppShell>
        <AppHeader subtitle="SETTINGS" />

        <div class="space-y-4">
            <!-- Connection summary card -->
            <SurfaceCard class-name="space-y-3">
                <div class="flex items-start gap-3">
                    <BrandMark size="md" />
                    <div class="min-w-0 flex-1">
                        <div class="flex flex-wrap items-center gap-2">
                            <p class="font-mono text-base font-semibold text-(--or3-text)">
                                {{ activeHost?.token ? `Connected to ${activeHost.name || 'My Computer'}` : 'No computer paired' }}
                            </p>
                            <StatusPill
                                v-if="activeHost?.token"
                                label="Connected"
                                tone="green"
                                pulse
                            />
                        </div>
                        <p class="mt-1 text-sm leading-6 text-(--or3-text-muted)">
                            {{ activeHost?.token ? 'Your or3-intern app is connected and ready.' : 'Pair this app to your computer to get started.' }}
                        </p>
                    </div>
                </div>
                <div v-if="!activeHost?.token" class="flex items-center gap-2">
                    <UButton
                        label="Pair new computer"
                        icon="i-pixelarticons-link"
                        color="primary"
                        variant="solid"
                        size="sm"
                        class="shrink-0 rounded-full"
                        to="/settings/pair"
                    />
                </div>
            </SurfaceCard>

            <SimpleSettingsHome />

            <SurfaceCard v-if="latestSnapshot" tone="tip" class-name="space-y-2">
                <p class="font-mono text-xs uppercase tracking-wide text-(--or3-green-dark)">Last change</p>
                <p class="text-xs leading-5 text-(--or3-text)">{{ latestSnapshot.label }} — {{ formattedTime }}</p>
                <div class="flex justify-end gap-2">
                    <UButton
                        size="xs"
                        color="neutral"
                        variant="outline"
                        label="Undo last change"
                        icon="i-pixelarticons-undo"
                        :loading="undoing"
                        @click="undoLast"
                    />
                </div>
            </SurfaceCard>
        </div>
    </AppShell>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import { useActiveHost } from '~/composables/useActiveHost'
import { useSettingsSnapshots } from '~/composables/settings/useSettingsSnapshots'
import { useSimpleSettings } from '~/composables/settings/useSimpleSettings'

const { activeHost } = useActiveHost()
const snapshots = useSettingsSnapshots()
const simple = useSimpleSettings()
const undoing = ref(false)

const latestSnapshot = computed(() => snapshots.latest())
const formattedTime = computed(() => {
    const s = latestSnapshot.value
    if (!s) return ''
    try {
        return new Date(s.createdAt).toLocaleString()
    } catch {
        return s.createdAt
    }
})

async function undoLast() {
    const s = snapshots.latest()
    if (!s) return
    undoing.value = true
    try {
        await simple.applyChanges(s.inverse)
        snapshots.remove(s.id)
        simple.reset()
        await simple.ensureLoaded()
    } catch (err) {
        console.error('[settings] undo failed', err)
    } finally {
        undoing.value = false
    }
}
</script>
