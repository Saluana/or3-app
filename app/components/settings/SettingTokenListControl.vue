<template>
  <div class="space-y-2">
    <div v-if="items.length" class="flex flex-wrap gap-2">
      <span
        v-for="item in items"
        :key="item"
        class="inline-flex items-center gap-1 rounded-full border border-(--or3-border) bg-white/80 px-2.5 py-1 font-mono text-xs text-(--or3-text)"
      >
        {{ item }}
        <button
          type="button"
          class="rounded-full text-(--or3-text-muted) transition hover:text-(--or3-red)"
          :aria-label="`Remove ${item}`"
          @click="removeItem(item)"
        >
          <Icon name="i-pixelarticons-close" class="size-3" />
        </button>
      </span>
    </div>

    <div class="flex flex-wrap gap-2">
      <UInput
        v-model="draft"
        class="min-w-44 flex-1"
        :placeholder="placeholder"
        :ui="{ base: 'font-mono' }"
        @keydown.enter.prevent="addDraft"
        @paste="onPaste"
      />
      <UButton
        color="neutral"
        variant="soft"
        icon="i-pixelarticons-plus"
        label="Add"
        :disabled="!draft.trim()"
        @click="addDraft"
      />
    </div>

    <p class="text-[11px] leading-5 text-(--or3-text-muted)">
      Add one ID at a time. Pasting a list is okay — OR3 will split it into chips for you.
    </p>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'

const props = withDefaults(defineProps<{
  modelValue: string
  placeholder?: string
}>(), {
  placeholder: 'Paste a Telegram chat ID',
})

const emit = defineEmits<{
  'update:modelValue': [value: string]
}>()

const draft = ref('')
const items = computed(() => parseItems(props.modelValue))

watch(
  () => props.modelValue,
  () => {
    draft.value = ''
  },
)

function parseItems(value: string) {
  return String(value ?? '')
    .split(/[\s,]+/)
    .map((item) => item.trim())
    .filter(Boolean)
    .filter((item, index, all) => all.indexOf(item) === index)
}

function emitItems(nextItems: string[]) {
  emit('update:modelValue', nextItems.join(','))
}

function addValues(value: string) {
  const next = [...items.value]
  for (const item of parseItems(value)) {
    if (!next.includes(item)) next.push(item)
  }
  emitItems(next)
  draft.value = ''
}

function addDraft() {
  addValues(draft.value)
}

function removeItem(item: string) {
  emitItems(items.value.filter((candidate) => candidate !== item))
}

function onPaste(event: ClipboardEvent) {
  const text = event.clipboardData?.getData('text') ?? ''
  if (!/[\s,]/.test(text.trim())) return
  event.preventDefault()
  addValues(text)
}
</script>
