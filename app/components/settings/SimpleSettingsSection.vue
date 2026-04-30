<template>
    <div class="space-y-4">
        <SurfaceCard class-name="space-y-2">
            <button
                type="button"
                class="inline-flex items-center gap-1 rounded-full px-2 py-1 text-sm font-medium text-(--or3-green) transition hover:bg-(--or3-green-soft)"
                @click="$router.push('/settings')"
            >
                <Icon name="i-pixelarticons-chevron-left" class="size-4" />
                All settings
            </button>
            <div class="flex items-start gap-3">
                <RetroIcon :name="section.icon" size="sm" />
                <div class="min-w-0 flex-1">
                    <p class="font-mono text-base font-semibold text-(--or3-text)">{{ section.label }}</p>
                    <p class="mt-1 text-sm leading-6 text-(--or3-text-muted)">{{ section.description }}</p>
                </div>
            </div>
            <p class="rounded-xl border border-(--or3-border) bg-white/70 px-3 py-2 font-mono text-xs leading-5 text-(--or3-text)">
                {{ simple.summaryFor(section) }}
            </p>
        </SurfaceCard>

        <SettingCard
            v-for="control in section.controls"
            :key="control.key"
            :control="control"
            :value-index="valueIndex"
            :focus-key="focusKey"
            @change="onChange"
        />

        <!--
          Sticky pending-changes bar. Bottom offset has to clear the fixed
          BottomNav (~5.5rem) plus the iOS safe-area inset, otherwise the
          bar gets covered until the user scrolls all the way down.
        -->
        <SurfaceCard
            v-if="pendingChanges.length"
            tone="tip"
            class-name="space-y-3 sticky z-30 bottom-[calc(var(--or3-safe-bottom)+5.75rem)]"
        >
            <p class="font-mono text-sm font-semibold text-(--or3-text)">{{ pendingChanges.length }} pending change{{ pendingChanges.length === 1 ? '' : 's' }}</p>
            <p class="text-xs leading-5 text-(--or3-text-muted)">Review the plain-language summary before saving.</p>
            <div class="flex items-center justify-end gap-2">
                <UButton
                    size="sm"
                    color="neutral"
                    variant="outline"
                    label="Discard"
                    @click="pendingChanges = []"
                />
                <UButton
                    size="sm"
                    color="primary"
                    label="Review &amp; save"
                    icon="i-pixelarticons-arrow-right"
                    @click="reviewing = true"
                />
            </div>
        </SurfaceCard>

        <SettingSaveReview
            v-if="reviewing"
            :changes="pendingChanges"
            :saving="saving"
            @cancel="reviewing = false"
            @confirm="onConfirmSave"
        />
    </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import type { SimpleSettingChange, SimpleSettingSection } from '~/settings/simpleSettings'
import { useSimpleSettings } from '~/composables/settings/useSimpleSettings'
import { useSettingsSnapshots } from '~/composables/settings/useSettingsSnapshots'

const props = defineProps<{ section: SimpleSettingSection }>()

const route = useRoute()
const simple = useSimpleSettings()
const snapshots = useSettingsSnapshots()

const focusKey = computed(() => {
    const q = route.query.focus
    return Array.isArray(q) ? (q[0] ?? null) : (q ?? null)
})

const pendingChanges = ref<SimpleSettingChange[]>([])
const reviewing = ref(false)
const saving = ref(false)

const valueIndex = computed(() => simple.valueIndex.value)

function onChange(changes: SimpleSettingChange[]) {
    // Merge with existing pending: latest write wins per (section,channel,field).
    const map = new Map<string, SimpleSettingChange>()
    for (const c of pendingChanges.value) {
        map.set(`${c.section}::${c.channel ?? ''}::${c.field}`, c)
    }
    for (const c of changes) {
        map.set(`${c.section}::${c.channel ?? ''}::${c.field}`, c)
    }
    pendingChanges.value = Array.from(map.values())
}

async function onConfirmSave() {
    saving.value = true
    try {
        // Capture inverse from current cached values.
        const inverse: SimpleSettingChange[] = pendingChanges.value.map((c) => ({
            section: c.section,
            channel: c.channel,
            field: c.field,
            value: simple.findField(c.section, c.field, c.channel)?.value ?? null,
        }))
        await simple.applyChanges(pendingChanges.value)
        snapshots.record(`${props.section.label} change`, [...pendingChanges.value], inverse)
        pendingChanges.value = []
        reviewing.value = false
        // Reload backend values for this section.
        simple.reset()
        await simple.ensureLoaded()
    } catch (err: any) {
        console.error('[settings] apply failed', err)
    } finally {
        saving.value = false
    }
}

onMounted(async () => {
    await simple.ensureLoaded(props.section.key)
})
</script>
