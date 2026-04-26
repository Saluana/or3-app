<template>
  <SurfaceCard class-name="space-y-4">
    <div>
      <SectionHeader :title="title" :subtitle="subtitle" />
      <p class="mt-1 text-sm text-(--or3-text-muted)">{{ description }}</p>
    </div>

    <div v-if="!fields.length" class="rounded-2xl border border-dashed border-(--or3-border) px-4 py-5 text-sm text-(--or3-text-muted)">
      Choose a settings section to load editable fields.
    </div>

    <div v-else class="space-y-3">
      <div v-for="field in fields" :key="field.key" class="rounded-2xl border border-(--or3-border) bg-white/70 p-3">
        <div class="mb-2">
          <p class="font-mono text-sm font-semibold">{{ field.label }}</p>
          <p v-if="field.description" class="mt-1 text-xs text-(--or3-text-muted)">{{ field.description }}</p>
        </div>

        <USwitch
          v-if="field.kind === 'toggle' || field.kind === 'boolean'"
          :model-value="Boolean(localValues[field.key])"
          @update:model-value="(value) => updateValue(field.key, value)"
        />

        <USelectMenu
          v-else-if="field.kind === 'choice'"
          :items="choiceItems(field)"
          :model-value="selectedChoice(field)"
          @update:model-value="(value) => updateValue(field.key, value?.value ?? value)"
        />

        <UTextarea
          v-else-if="field.kind === 'list'"
          :model-value="String(localValues[field.key] ?? '')"
          autoresize
          :rows="3"
          @update:model-value="(value) => updateValue(field.key, value)"
        />

        <UInput
          v-else
          :type="field.kind === 'secret' ? 'password' : 'text'"
          :model-value="String(localValues[field.key] ?? '')"
          :placeholder="field.placeholder || field.emptyHint"
          @update:model-value="(value) => updateValue(field.key, value)"
        />
      </div>
    </div>

    <div class="flex justify-end">
      <UButton label="Save changes" icon="i-lucide-save" color="primary" class="or3-touch-target" :loading="saving" :disabled="!fields.length" @click="emitSave" />
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
}>(), {
  subtitle: 'Remote configure',
  description: 'Edit host settings safely from your phone.',
  saving: false,
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

function updateValue(key: string, value: unknown) {
  localValues[key] = value
}

function emitSave() {
  emit('save', { ...localValues })
}
</script>
