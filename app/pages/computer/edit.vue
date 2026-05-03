<template>
  <AppShell>
    <AppHeader subtitle="EDITOR" />
    <div class="space-y-4">
      <SurfaceCard v-if="loading" class-name="space-y-3">
        <div class="h-8 w-48 animate-pulse rounded-xl bg-(--or3-surface-soft)" />
        <div class="h-72 animate-pulse rounded-3xl bg-(--or3-surface-soft)" />
      </SurfaceCard>

      <DangerCallout v-else-if="loadError && !documentState" :tone="loadErrorTone" :title="loadErrorTitle">
        {{ loadError.message }}
      </DangerCallout>

      <MarkdownEditor
        v-else-if="documentState"
        v-model="draftContent"
        :title="documentState.name"
        :path="documentState.path"
        :status-label="statusLabel"
        :metadata-label="metadataLabel"
        :saving="saving"
        :read-only="isReadOnly"
        :unsupported-message="unsupportedMessage"
        :conflict-message="conflictMessage"
        back-label="Files"
        @save="saveDocument"
        @save-copy="saveCopy"
        @reload="reloadDocument"
        @dismiss-conflict="dismissConflict"
        @dirty-change="dirty = $event"
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
import type { ComputerTextFileDocument } from '~/composables/useComputerTextFiles'
import { buildComputerFilesReturnRoute, readComputerEditorRoute } from '~/composables/useComputerEditorRoute'
import { useComputerTextFiles } from '~/composables/useComputerTextFiles'

const route = useRoute()
const toast = useToast()
const { readTextFile, writeTextFile } = useComputerTextFiles()

const loading = ref(true)
const saving = ref(false)
const dirty = ref(false)
const draftContent = ref('')
const documentState = ref<ComputerTextFileDocument | null>(null)
const loadError = ref<Or3AppError | null>(null)
const saveError = ref<Or3AppError | null>(null)
const statusLabel = ref('')

const editorRoute = computed(() => readComputerEditorRoute(route))
const isReadOnly = computed(() => Boolean(documentState.value && !documentState.value.writable))
const unsupportedMessage = computed(() => {
  if (loadError.value?.code === 'file_unsupported' || saveError.value?.code === 'file_unsupported') {
    return loadError.value?.message || saveError.value?.message || 'This file type is not supported by the editor yet.'
  }
  if (loadError.value?.code === 'file_too_large') return loadError.value.message
  return null
})
const conflictMessage = computed(() => saveError.value?.code === 'file_conflict' ? saveError.value.message : null)
const metadataLabel = computed(() => {
  if (!documentState.value) return ''
  const updated = documentState.value.modifiedAt ? new Date(documentState.value.modifiedAt).toLocaleString() : 'Unknown update time'
  return `${documentState.value.revision.slice(0, 12)} • ${updated}`
})
const loadErrorTone = computed(() => loadError.value?.code === 'file_read_only' ? 'info' : 'caution')
const loadErrorTitle = computed(() => loadError.value?.code === 'file_read_only' ? 'Read-only file' : 'Editor needs attention')

function buildCopyPath(path: string) {
  const slashIndex = path.lastIndexOf('/')
  const folder = slashIndex >= 0 ? path.slice(0, slashIndex + 1) : ''
  const name = slashIndex >= 0 ? path.slice(slashIndex + 1) : path
  const dotIndex = name.lastIndexOf('.')
  const stem = dotIndex > 0 ? name.slice(0, dotIndex) : name
  const ext = dotIndex > 0 ? name.slice(dotIndex) : ''
  return `${folder}${stem} (copy)${ext}`
}

async function goBack() {
  await navigateTo(buildComputerFilesReturnRoute(editorRoute.value.returnRootId || editorRoute.value.rootId, editorRoute.value.returnPath || '.'))
}

function dismissConflict() {
  if (saveError.value?.code === 'file_conflict') saveError.value = null
}

async function loadDocument() {
  loading.value = true
  loadError.value = null
  saveError.value = null
  statusLabel.value = ''

  const { rootId, path } = editorRoute.value
  if (!rootId || !path) {
    loadError.value = {
      code: 'validation_failed',
      message: 'The editor route is missing the file location.',
    }
    loading.value = false
    return
  }

  try {
    const nextDocument = await readTextFile({ rootId, path })
    documentState.value = nextDocument
    draftContent.value = nextDocument.content
    dirty.value = false
    statusLabel.value = 'Ready to edit'
  } catch (error: any) {
    documentState.value = null
    loadError.value = error as Or3AppError
  } finally {
    loading.value = false
  }
}

async function saveDocument(reason: 'manual' | 'autosave') {
  if (!documentState.value || unsupportedMessage.value || saving.value) return
  if (isReadOnly.value) {
    saveError.value = {
      code: 'file_read_only',
      message: 'This file is read-only, so save a copy instead.',
    }
    return
  }

  saving.value = true
  saveError.value = null
  try {
    const response = await writeTextFile({
      rootId: documentState.value.rootId,
      path: documentState.value.path,
      content: draftContent.value,
      expectedRevision: documentState.value.revision,
      create: false,
    })

    documentState.value = {
      ...documentState.value,
      content: draftContent.value,
      revision: response.revision,
      modifiedAt: response.modified_at || new Date().toISOString(),
    }
    dirty.value = false
    statusLabel.value = reason === 'autosave' ? 'Autosaved just now' : 'Saved just now'
    if (reason === 'manual') {
      toast.add({ title: 'File saved', description: `${documentState.value.name} is up to date.` })
    }
  } catch (error: any) {
    saveError.value = error as Or3AppError
    if (reason === 'manual' && saveError.value.code !== 'file_conflict') {
      toast.add({ title: 'Could not save file', description: saveError.value.message, color: 'error' })
    }
  } finally {
    saving.value = false
  }
}

async function reloadDocument() {
  await loadDocument()
  if (documentState.value) {
    toast.add({ title: 'File reloaded', description: 'The latest disk version is back in the editor.' })
  }
}

async function saveCopy() {
  if (!documentState.value || saving.value) return
  saving.value = true
  try {
    const copyPath = buildCopyPath(documentState.value.path)
    const response = await writeTextFile({
      rootId: documentState.value.rootId,
      path: copyPath,
      content: draftContent.value,
      create: true,
    })
    toast.add({ title: 'Copy saved', description: `Saved a new file at ${response.path}.` })
    await navigateTo({
      path: '/computer/edit',
      query: {
        root: documentState.value.rootId,
        path: response.path,
        returnRoot: editorRoute.value.returnRootId || documentState.value.rootId,
        returnPath: editorRoute.value.returnPath || '.',
      },
    })
  } catch (error: any) {
    const nextError = error as Or3AppError
    saveError.value = nextError
    toast.add({ title: 'Could not save copy', description: nextError.message, color: 'error' })
  } finally {
    saving.value = false
  }
}

onMounted(async () => {
  await loadDocument()
})
</script>