<template>
  <SurfaceCard class-name="space-y-4">
    <div>
      <SectionHeader :title="title" :subtitle="subtitle" />
      <p class="mt-1 text-sm text-(--or3-text-muted)">{{ description }}</p>
    </div>

    <div v-if="!fields.length" class="rounded-2xl border border-dashed border-(--or3-border) px-4 py-5 text-center text-sm text-(--or3-text-muted)">
      {{ emptyStateText }}
    </div>

    <div v-else class="space-y-3">
      <div v-for="field in fields" :key="field.key" class="rounded-2xl border border-(--or3-border) bg-white/70 p-3">
        <div class="flex items-start justify-between gap-3">
          <div class="min-w-0 flex-1">
            <p class="font-mono text-sm font-semibold">{{ field.label }}</p>
            <p v-if="field.description" class="mt-1 text-xs leading-5 text-(--or3-text-muted)">{{ field.description }}</p>
          </div>
          <USwitch
            v-if="isToggle(field)"
            :model-value="toggleValue(field)"
            class="shrink-0"
            @update:model-value="(value: boolean) => updateValue(field.key, value)"
          />
          <span v-else-if="field.kind === 'secret'" class="shrink-0 rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-amber-800">
            secret
          </span>
        </div>

        <div v-if="!isToggle(field)" class="mt-2">
          <USelectMenu
            v-if="field.kind === 'choice'"
            :items="choiceItems(field)"
            :model-value="selectedChoice(field)"
            @update:model-value="(value: any) => updateValue(field.key, value?.value ?? value)"
          />

          <UTextarea
            v-else-if="field.kind === 'list'"
            :model-value="String(localValues[field.key] ?? '')"
            autoresize
            :rows="3"
            placeholder="Separate items with commas"
            @update:model-value="(value: string) => updateValue(field.key, value)"
          />

          <UInput
            v-else
            :type="field.kind === 'secret' ? 'password' : 'text'"
            :model-value="String(localValues[field.key] ?? '')"
            :placeholder="field.placeholder || field.emptyHint"
            @update:model-value="(value: string) => updateValue(field.key, value)"
          />
        </div>
      </div>
    </div>

    <div class="flex justify-end">
      <UButton
        label="Save changes"
        icon="i-pixelarticons-save"
        color="primary"
        size="lg"
        :loading="saving"
        :disabled="!fields.length"
        @click="emitSave"
      />
    </div>
  </SurfaceCard>
</template>

<script setup lang="ts">
import { reactive, watch } from 'vue'
import type { ConfigureField } from '~/types/or3-api'

const props = withDefaults(defineProps<{
  title: string
  subtitle?: string
  description?: string
  fields: ConfigureField[]
  saving?: boolean
  emptyStateText?: string
}>(), {
  subtitle: 'Remote configure',
  description: 'Edit host settings safely from your phone.',
  saving: false,
  emptyStateText: 'Pick a section above to see what you can change.',
})

const emit = defineEmits<{
  save: [values: Record<string, unknown>]
}>()

const localValues = reactive<Record<string, unknown>>({})

watch(
  () => props.fields,
  (nextFields) => {
    for (const key of Object.keys(localValues)) delete localValues[key]
    for (const field of nextFields) {
      localValues[field.key] = Array.isArray(field.value) ? field.value.join(', ') : field.value ?? ''
    }
  },
  { immediate: true },
)

function choiceItems(field: ConfigureField) {
  return (field.choices ?? []).map((choice) => {
    if (typeof choice === 'string') return { label: choice, value: choice }
    return { label: choice.label ?? choice.value, value: choice.value }
  })
}

function selectedChoice(field: ConfigureField) {
  return choiceItems(field).find((choice) => choice.value === String(localValues[field.key] ?? ''))
}

function isToggle(field: ConfigureField) {
  const kind = String(field.kind ?? '').toLowerCase()
  return ['toggle', 'boolean', 'bool', 'switch', 'checkbox'].includes(kind) || typeof field.value === 'boolean'
}

// Backend may emit either a real boolean (current contract) or the legacy
// 'on' / 'off' / 'true' / 'false' string. Normalize to a clean boolean so
// USwitch can never end up stuck "on" because of `Boolean('off') === true`.
function toggleValue(field: ConfigureField) {
  const raw = localValues[field.key]
  if (typeof raw === 'boolean') return raw
  if (typeof raw === 'string') {
    const normalized = raw.trim().toLowerCase()
    return normalized === 'true' || normalized === 'on' || normalized === '1' || normalized === 'yes'
  }
  return Boolean(raw)
}

function updateValue(key: string, value: unknown) {
  localValues[key] = value
}

function emitSave() {
  emit('save', { ...localValues })
}
</script>
