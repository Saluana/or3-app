<template>
  <AppShell>
    <AppHeader subtitle="SETTINGS" />

    <div class="space-y-4">
      <SurfaceCard class-name="space-y-4">
        <button
          type="button"
          class="inline-flex items-center gap-1 rounded-full px-2 py-1 text-sm font-medium text-(--or3-green) transition hover:bg-(--or3-green-soft)"
          @click="goBack"
        >
          <Icon name="i-lucide-chevron-left" class="size-4" />
          Settings
        </button>

        <div>
          <p class="font-mono text-base font-semibold">{{ selectedSectionLabel }}</p>
          <p class="mt-1 text-sm text-(--or3-text-muted)">{{ selectedSectionDescription }}</p>
        </div>

        <p v-if="configureError" class="text-sm text-rose-600">{{ configureError }}</p>
      </SurfaceCard>

      <SettingsSectionEditor
        :title="selectedSectionLabel"
        subtitle="Category settings"
        :description="selectedSectionDescription"
        :fields="fields"
        :saving="configureSaving"
        empty-state-text="No editable options were found for this category."
        @save="saveSection"
      />
    </div>
  </AppShell>
</template>

<script setup lang="ts">
import { computed, onMounted, watch } from 'vue'
import type { ConfigureChange, ConfigureField } from '~/types/or3-api'
import { useConfigure } from '~/composables/useConfigure'

const route = useRoute()
const router = useRouter()

const sectionKey = computed(() => String(route.params.section ?? 'provider'))
const {
  sections,
  fields,
  configureSaving,
  configureError,
  loadSections,
  loadFields,
  applyChanges,
} = useConfigure()

const selectedSectionRecord = computed(() => sections.value.find((section) => section.key === sectionKey.value))
const selectedSectionLabel = computed(() => selectedSectionRecord.value?.label ?? 'Settings category')
const selectedSectionDescription = computed(() => selectedSectionRecord.value?.description ?? 'Edit this category safely from your phone.')
const selectedSectionExists = computed(() => !!selectedSectionRecord.value)

function goBack() {
  router.push('/settings')
}

async function saveSection(values: Record<string, unknown>) {
  const changes: ConfigureChange[] = fields.value.flatMap((field: ConfigureField): ConfigureChange[] => {
    const value = values[field.key]
    if (field.kind === 'toggle' || field.kind === 'boolean') {
      if (Boolean(value) === Boolean(field.value)) return []
      return [{ section: sectionKey.value, field: field.key, op: 'toggle' as const }]
    }
    if (field.kind === 'choice') {
      if (String(value ?? '') === String(field.value ?? '')) return []
      return [{ section: sectionKey.value, field: field.key, op: 'choose' as const, value }]
    }
    const normalizedValue = field.kind === 'list' && typeof value === 'string'
      ? value.split(',').map((item) => item.trim()).filter(Boolean)
      : value
    const currentValue = Array.isArray(field.value) ? field.value.join(',') : field.value
    const nextValue = Array.isArray(normalizedValue) ? normalizedValue.join(',') : normalizedValue
    if (String(nextValue ?? '') === String(currentValue ?? '')) return []
    return [{
      section: sectionKey.value,
      field: field.key,
      op: 'set' as const,
      value: normalizedValue,
    }]
  })

  if (!changes.length) return

  await applyChanges(changes).catch(() => null)
  if (!configureError.value) {
    await Promise.all([loadSections(), loadFields(sectionKey.value).catch(() => null)])
  }
}

async function loadCurrentSection() {
  if (!sections.value.length) {
    await loadSections()
  }
  await loadFields(sectionKey.value).catch(() => null)
}

watch(sectionKey, () => {
  void loadCurrentSection()
})

onMounted(async () => {
  await loadCurrentSection()
})
</script>
