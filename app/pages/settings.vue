<template>
  <AppShell>
    <AppHeader subtitle="SETTINGS" />

    <div class="space-y-4">
      <HostConnectionCard />
      <DeviceManagementCard />

      <SurfaceCard class-name="space-y-4">
        <SectionHeader title="Host settings" subtitle="Remote configure" />
        <p class="text-sm text-(--or3-text-muted)">Choose a section to inspect and edit the live or3-intern configuration.</p>
        <p v-if="configureError" class="text-sm text-rose-600">{{ configureError }}</p>

        <div class="grid gap-3 md:grid-cols-2">
          <button
            v-for="section in sections"
            :key="section.key"
            type="button"
            class="rounded-2xl border p-4 text-left transition"
            :class="selectedSection === section.key ? 'border-(--or3-green) bg-green-50/70' : 'border-(--or3-border) bg-white/70'"
            @click="selectSection(section.key)"
          >
            <div class="flex items-start justify-between gap-3">
              <div>
                <p class="font-mono text-sm font-semibold">{{ section.label }}</p>
                <p class="mt-1 text-xs text-(--or3-text-muted)">{{ section.description }}</p>
                <p class="mt-2 text-xs text-(--or3-text-muted)">{{ section.status }}</p>
              </div>
              <Icon name="i-lucide-chevron-right" class="size-5 text-(--or3-text-muted)" />
            </div>
          </button>
        </div>
      </SurfaceCard>

      <SettingsSectionEditor
        :title="selectedSectionLabel"
        :description="selectedSectionDescription"
        :fields="fields"
        :saving="configureSaving"
        @save="saveSection"
      />

      <p class="or3-command pb-3 text-center text-xs">or3-app v1.0.0</p>
    </div>
  </AppShell>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import type { ConfigureChange, ConfigureField } from '~/types/or3-api'
import { useConfigure } from '~/composables/useConfigure'

const selectedSection = ref('provider')
const {
  sections,
  fields,
  configureSaving,
  configureError,
  loadSections,
  loadFields,
  applyChanges,
} = useConfigure()

const selectedSectionRecord = computed(() => sections.value.find((section) => section.key === selectedSection.value))
const selectedSectionLabel = computed(() => selectedSectionRecord.value?.label ?? 'Settings section')
const selectedSectionDescription = computed(() => selectedSectionRecord.value?.description ?? 'Edit or3-intern settings safely from mobile.')

async function selectSection(sectionKey: string) {
  selectedSection.value = sectionKey
  await loadFields(sectionKey)
}

async function saveSection(values: Record<string, unknown>) {
  const changes: ConfigureChange[] = fields.value.flatMap((field: ConfigureField): ConfigureChange[] => {
    const value = values[field.key]
    if (field.kind === 'toggle' || field.kind === 'boolean') {
      if (Boolean(value) === Boolean(field.value)) return []
      return [{ section: selectedSection.value, field: field.key, op: 'toggle' as const }]
    }
    if (field.kind === 'choice') {
      if (String(value ?? '') === String(field.value ?? '')) return []
      return [{ section: selectedSection.value, field: field.key, op: 'choose' as const, value }]
    }
    const normalizedValue = field.kind === 'list' && typeof value === 'string'
      ? value.split(',').map((item) => item.trim()).filter(Boolean)
      : value
    const currentValue = Array.isArray(field.value) ? field.value.join(',') : field.value
    const nextValue = Array.isArray(normalizedValue) ? normalizedValue.join(',') : normalizedValue
    if (String(nextValue ?? '') === String(currentValue ?? '')) return []
    return [{
      section: selectedSection.value,
      field: field.key,
      op: 'set' as const,
      value: normalizedValue,
    }]
  })
  if (!changes.length) return
  await applyChanges(changes)
  await Promise.all([loadSections(), loadFields(selectedSection.value)])
}

onMounted(async () => {
  await loadSections()
  if (!sections.value.find((section) => section.key === selectedSection.value)) {
    selectedSection.value = sections.value[0]?.key ?? 'provider'
  }
  await loadFields(selectedSection.value)
})
</script>
