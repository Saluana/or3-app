<template>
  <AppShell>
    <AppHeader subtitle="PROMPT EDITOR" />
    <div class="space-y-4">
      <div class="flex flex-wrap gap-2">
        <UButton label="Back to prompts" icon="i-pixelarticons-arrow-left" color="neutral" variant="ghost" @click="goBack" />
        <UButton v-if="promptState" label="Use in Chat" icon="i-pixelarticons-message-text" color="neutral" variant="soft" @click="useInChat" />
      </div>

      <SurfaceCard v-if="loading" class-name="space-y-3">
        <div class="h-8 w-48 animate-pulse rounded-xl bg-(--or3-surface-soft)" />
        <div class="h-72 animate-pulse rounded-3xl bg-(--or3-surface-soft)" />
      </SurfaceCard>

      <DangerCallout v-else-if="loadError && !promptState" tone="caution" title="Prompt editor needs attention">
        {{ loadError.message }}
      </DangerCallout>

      <MarkdownEditor
        v-else-if="promptState"
        v-model="draftContent"
        :title="promptState.title"
        :path="promptState.path"
        :status-label="statusLabel"
        :metadata-label="metadataLabel"
        :saving="saving"
        :read-only="!promptState.writable"
        :unsupported-message="unsupportedMessage"
        :conflict-message="conflictMessage"
        @save="savePromptDocument"
        @save-copy="savePromptCopy"
        @reload="reloadPrompt"
        @dismiss-conflict="dismissConflict"
      />
    </div>
  </AppShell>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { navigateTo, useRoute } from '#app'
import { useToast } from '@nuxt/ui/composables'
import type { Or3AppError } from '~/types/app-state'
import { usePromptFiles } from '~/composables/usePromptFiles'

const route = useRoute()
const toast = useToast()
const { readPrompt, savePrompt, usePromptInChat } = usePromptFiles()

const loading = ref(true)
const saving = ref(false)
const draftContent = ref('')
const promptState = ref<Awaited<ReturnType<typeof readPrompt>> | null>(null)
const loadError = ref<Or3AppError | null>(null)
const saveError = ref<Or3AppError | null>(null)
const statusLabel = ref('')

const promptPath = computed(() => typeof route.query.path === 'string' ? route.query.path : '')
const unsupportedMessage = computed(() => {
  if (loadError.value?.code === 'file_unsupported' || saveError.value?.code === 'file_unsupported') {
    return loadError.value?.message || saveError.value?.message || 'This prompt file cannot be edited here yet.'
  }
  return null
})
const conflictMessage = computed(() => saveError.value?.code === 'file_conflict' ? saveError.value.message : null)
const metadataLabel = computed(() => {
  if (!promptState.value) return ''
  return promptState.value.modifiedAt ? `Updated ${new Date(promptState.value.modifiedAt).toLocaleString()}` : ''
})

function buildCopyPath(path: string) {
  const dotIndex = path.lastIndexOf('.')
  if (dotIndex < 0) return `${path}-copy`
  return `${path.slice(0, dotIndex)}-copy${path.slice(dotIndex)}`
}

async function goBack() {
  await navigateTo('/prompts')
}

function dismissConflict() {
  if (saveError.value?.code === 'file_conflict') saveError.value = null
}

async function loadPromptDocument() {
  loading.value = true
  loadError.value = null
  saveError.value = null
  statusLabel.value = ''
  if (!promptPath.value) {
    loadError.value = { code: 'validation_failed', message: 'No prompt path was provided.' }
    loading.value = false
    return
  }
  try {
    const prompt = await readPrompt(promptPath.value)
    promptState.value = prompt
    draftContent.value = prompt.content
    statusLabel.value = 'Ready to edit'
  } catch (nextError: any) {
    promptState.value = null
    loadError.value = nextError as Or3AppError
  } finally {
    loading.value = false
  }
}

async function savePromptDocument(reason: 'manual' | 'autosave') {
  if (!promptState.value || saving.value || unsupportedMessage.value) return
  saving.value = true
  saveError.value = null
  try {
    const response = await savePrompt(promptState.value.path, draftContent.value, promptState.value.revision, false)
    promptState.value = {
      ...promptState.value,
      content: draftContent.value,
      revision: response.revision,
      modifiedAt: response.modified_at || new Date().toISOString(),
    }
    statusLabel.value = reason === 'autosave' ? 'Autosaved just now' : 'Saved just now'
    if (reason === 'manual') {
      toast.add({ title: 'Prompt saved', description: `${promptState.value.title} is up to date.` })
    }
  } catch (nextError: any) {
    saveError.value = nextError as Or3AppError
    if (saveError.value.code !== 'file_conflict' && reason === 'manual') {
      toast.add({ title: 'Could not save prompt', description: saveError.value.message, color: 'error' })
    }
  } finally {
    saving.value = false
  }
}

async function savePromptCopy() {
  if (!promptState.value || saving.value) return
  saving.value = true
  try {
    const copyPath = buildCopyPath(promptState.value.path)
    const response = await savePrompt(copyPath, draftContent.value, undefined, true)
    toast.add({ title: 'Prompt copy saved', description: `Saved a new prompt at ${response.path}.` })
    await navigateTo({ path: '/prompts/edit', query: { path: response.path } })
  } catch (nextError: any) {
    const typedError = nextError as Or3AppError
    saveError.value = typedError
    toast.add({ title: 'Could not save prompt copy', description: typedError.message, color: 'error' })
  } finally {
    saving.value = false
  }
}

async function reloadPrompt() {
  await loadPromptDocument()
}

async function useInChat() {
  if (!promptState.value) return
  await usePromptInChat(draftContent.value)
  toast.add({ title: 'Prompt ready in chat', description: 'You can review or tweak it before sending.' })
}

onMounted(async () => {
  await loadPromptDocument()
})
</script>