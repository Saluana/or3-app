<template>
  <form ref="dropZone" class="sticky bottom-22 z-20 mt-4 rounded-[26px] border border-(--or3-border) bg-(--or3-surface) p-3 shadow-(--or3-shadow)" @submit.prevent="submit">
    <div v-if="isDragging" class="mb-3 rounded-2xl border border-dashed border-(--or3-green) bg-(--or3-green-soft) p-3 text-center text-sm text-(--or3-green-dark)">
      Drop files to attach them
    </div>

    <textarea
      v-model="text"
      rows="2"
      class="max-h-36 min-h-14 w-full resize-none bg-transparent px-2 py-2 text-base leading-6 text-(--or3-text) outline-none placeholder:text-(--or3-text-muted)"
      placeholder="Ask or3-intern to help with your computer…"
      aria-label="Message or3-intern"
      @keydown.meta.enter.prevent="submit"
      @keydown.ctrl.enter.prevent="submit"
    />

    <div class="mt-2 flex items-center gap-2">
      <UButton icon="i-lucide-paperclip" color="neutral" variant="ghost" class="or3-touch-target" aria-label="Attach file" type="button" @click="fileInput?.click()" />
      <input ref="fileInput" type="file" multiple class="hidden" @change="handleFiles" />

      <div class="flex flex-1 gap-1 overflow-x-auto pb-1">
        <UButton v-for="entry in actions" :key="entry.action.id" size="xs" color="neutral" variant="soft" :icon="entry.action.icon" :label="entry.action.label" :disabled="entry.disabled" type="button" @click="entry.action.handler(actionContext)" />
      </div>

      <UButton v-if="!streaming" icon="i-lucide-send" class="or3-touch-target bg-(--or3-green) text-white hover:bg-(--or3-green-dark)" aria-label="Send message" type="submit" :disabled="!text.trim()" />
      <UButton v-else icon="i-lucide-square" color="error" variant="soft" class="or3-touch-target" aria-label="Stop generation" type="button" @click="emit('stop')" />
    </div>
  </form>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, ref } from 'vue'
import { registerPaneInput, unregisterPaneInput } from '~/composables/useChatInputBridge'
import { useComposerActions } from '~/composables/useComposerActions'

const props = withDefaults(defineProps<{ modelValue?: string; streaming?: boolean; paneId?: string }>(), {
  modelValue: '',
  streaming: false,
  paneId: 'main',
})

const emit = defineEmits<{
  'update:modelValue': [value: string]
  send: [value: string]
  stop: []
  files: [files: File[]]
}>()

const fileInput = ref<HTMLInputElement | null>(null)
const isDragging = ref(false)
const pendingBridgeText = ref<string | null>(null)
const text = computed({
  get: () => pendingBridgeText.value ?? props.modelValue,
  set: (value: string) => {
    pendingBridgeText.value = null
    emit('update:modelValue', value)
  },
})

const actionContext = computed(() => ({
  text: text.value,
  isStreaming: props.streaming,
  setText: (value: string) => emit('update:modelValue', value),
  send: submit,
}))

const actions = useComposerActions(() => actionContext.value)

function submit() {
  const value = text.value.trim()
  if (!value || props.streaming) return
  pendingBridgeText.value = null
  emit('send', value)
  emit('update:modelValue', '')
}

function handleFiles(event: Event) {
  const input = event.target as HTMLInputElement
  emit('files', Array.from(input.files ?? []))
  input.value = ''
}

registerPaneInput(props.paneId, {
  setText: (value) => {
    pendingBridgeText.value = value
    emit('update:modelValue', value)
  },
  triggerSend: submit,
})

onBeforeUnmount(() => unregisterPaneInput(props.paneId))
</script>
