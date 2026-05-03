<template>
  <AppShell>
    <AppHeader subtitle="NOTE EDITOR" />
    <div class="space-y-4">
      <SurfaceCard v-if="loading" class-name="space-y-3">
        <div class="h-8 w-48 animate-pulse rounded-xl bg-(--or3-surface-soft)" />
        <div class="h-72 animate-pulse rounded-3xl bg-(--or3-surface-soft)" />
      </SurfaceCard>

      <DangerCallout v-else-if="loadError && !noteState" tone="caution" title="Note editor needs attention">
        {{ loadError.message }}
      </DangerCallout>

      <MarkdownEditor
        v-else-if="noteState"
        v-model="draftContent"
        :title="noteState.title"
        :path="noteState.path"
        :status-label="statusLabel"
        :metadata-label="metadataLabel"
        :saving="saving"
        :read-only="!noteState.writable"
        :unsupported-message="unsupportedMessage"
        :conflict-message="conflictMessage"
        back-label="Notes"
        @save="saveNoteDocument"
        @save-copy="saveNoteCopy"
        @reload="reloadNote"
        @dismiss-conflict="dismissConflict"
        @back="goBack"
      />
    </div>
  </AppShell>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { navigateTo, useRoute } from '#app'
import { useToast } from '@nuxt/ui/composables'
import type { Or3AppError } from '~/types/app-state'
import { useNoteFiles } from '~/composables/useNoteFiles'

const route = useRoute()
const toast = useToast()
const { readNote, saveNote } = useNoteFiles()

const loading = ref(true)
const saving = ref(false)
const draftContent = ref('')
const noteState = ref<Awaited<ReturnType<typeof readNote>> | null>(null)
const loadError = ref<Or3AppError | null>(null)
const saveError = ref<Or3AppError | null>(null)
const statusLabel = ref('')

const notePath = computed(() => typeof route.query.path === 'string' ? route.query.path : '')
const unsupportedMessage = computed(() => {
  if (loadError.value?.code === 'file_unsupported' || saveError.value?.code === 'file_unsupported') {
    return loadError.value?.message || saveError.value?.message || 'This note file cannot be edited here yet.'
  }
  return null
})
const conflictMessage = computed(() => saveError.value?.code === 'file_conflict' ? saveError.value.message : null)
const metadataLabel = computed(() => {
  if (!noteState.value) return ''
  return noteState.value.modifiedAt ? `Updated ${new Date(noteState.value.modifiedAt).toLocaleString()}` : ''
})

function buildCopyPath(path: string) {
  const dotIndex = path.lastIndexOf('.')
  if (dotIndex < 0) return `${path}-copy`
  return `${path.slice(0, dotIndex)}-copy${path.slice(dotIndex)}`
}

async function goBack() {
  await navigateTo('/notes')
}

function dismissConflict() {
  if (saveError.value?.code === 'file_conflict') saveError.value = null
}

async function loadNoteDocument() {
  loading.value = true
  loadError.value = null
  saveError.value = null
  statusLabel.value = ''
  if (!notePath.value) {
    loadError.value = { code: 'validation_failed', message: 'No note path was provided.' }
    loading.value = false
    return
  }
  try {
    const note = await readNote(notePath.value)
    noteState.value = note
    draftContent.value = note.content
    statusLabel.value = 'Ready to edit'
  } catch (nextError: any) {
    noteState.value = null
    loadError.value = nextError as Or3AppError
  } finally {
    loading.value = false
  }
}

async function saveNoteDocument(reason: 'manual' | 'autosave') {
  if (!noteState.value || saving.value || unsupportedMessage.value) return
  saving.value = true
  saveError.value = null
  try {
    const response = await saveNote(noteState.value.path, draftContent.value, noteState.value.revision, false)
    noteState.value = {
      ...noteState.value,
      content: draftContent.value,
      revision: response.revision,
      modifiedAt: response.modified_at || new Date().toISOString(),
    }
    statusLabel.value = reason === 'autosave' ? 'Autosaved just now' : 'Saved just now'
    if (reason === 'manual') {
      toast.add({ title: 'Note saved', description: `${noteState.value.title} is up to date.` })
    }
  } catch (nextError: any) {
    saveError.value = nextError as Or3AppError
    if (saveError.value.code !== 'file_conflict' && reason === 'manual') {
      toast.add({ title: 'Could not save note', description: saveError.value.message, color: 'error' })
    }
  } finally {
    saving.value = false
  }
}

async function saveNoteCopy() {
  if (!noteState.value || saving.value) return
  saving.value = true
  try {
    const copyPath = buildCopyPath(noteState.value.path)
    const response = await saveNote(copyPath, draftContent.value, undefined, true)
    toast.add({ title: 'Note copy saved', description: `Saved a new note at ${response.path}.` })
    await navigateTo({ path: '/notes/edit', query: { path: response.path } })
  } catch (nextError: any) {
    const typedError = nextError as Or3AppError
    saveError.value = typedError
    toast.add({ title: 'Could not save note copy', description: typedError.message, color: 'error' })
  } finally {
    saving.value = false
  }
}

async function reloadNote() {
  await loadNoteDocument()
}

onMounted(async () => {
  await loadNoteDocument()
})
</script>
