<template>
  <UModal v-model:open="open" :ui="{ content: 'sm:max-w-md' }">
    <template #content>
      <form class="or3-edit-name-modal" @submit.prevent="submit">
        <div>
          <p v-if="eyebrow" class="or3-edit-name-modal__eyebrow">{{ eyebrow }}</p>
          <h2 class="or3-edit-name-modal__title">{{ title }}</h2>
        </div>

        <UFormField :label="label" name="edit-name">
          <UInput
            v-model="value"
            autofocus
            class="w-full"
            :placeholder="placeholder"
          />
        </UFormField>

        <div class="or3-edit-name-modal__actions">
          <UButton
            type="button"
            color="neutral"
            variant="ghost"
            @click="open = false"
          >
            Cancel
          </UButton>
          <UButton
            type="submit"
            color="primary"
            icon="i-pixelarticons-check"
            :disabled="!canSubmit"
          >
            {{ submitLabel }}
          </UButton>
        </div>
      </form>
    </template>
  </UModal>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'

const props = withDefaults(
  defineProps<{
    title: string
    initialValue?: string
    eyebrow?: string
    label?: string
    placeholder?: string
    submitLabel?: string
  }>(),
  {
    initialValue: '',
    eyebrow: '',
    label: 'Name',
    placeholder: '',
    submitLabel: 'Save',
  },
)

const open = defineModel<boolean>('open', { default: false })

const emit = defineEmits<{
  submit: [value: string]
}>()

const value = ref('')

const normalizedInitialValue = computed(() => props.initialValue.trim())

const canSubmit = computed(() => {
  const next = value.value.trim()
  return Boolean(next && next !== normalizedInitialValue.value)
})

watch(
  () => [open.value, props.initialValue] as const,
  ([isOpen]) => {
    if (!isOpen) return
    value.value = props.initialValue
  },
  { immediate: true },
)

function submit() {
  const next = value.value.trim()
  if (!canSubmit.value) return
  emit('submit', next)
  open.value = false
}
</script>

<style scoped>
.or3-edit-name-modal {
  display: grid;
  gap: 1rem;
  padding: 1.25rem;
  background: var(--or3-surface);
}

.or3-edit-name-modal__eyebrow {
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
  font-size: 0.7rem;
  font-weight: 800;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  color: var(--or3-text-muted);
}

.or3-edit-name-modal__title {
  margin-top: 0.1rem;
  font-size: 1.2rem;
  font-weight: 850;
  color: var(--or3-text);
}

.or3-edit-name-modal__actions {
  display: flex;
  justify-content: flex-end;
  gap: 0.5rem;
}
</style>
