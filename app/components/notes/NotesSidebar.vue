<template>
  <DesktopSecondarySidebar
    v-model:search-value="search"
    search-placeholder="Search notes..."
    :footer-text="footerText"
    :on-refresh="refresh"
    scroll-key="notes"
  >
    <template #filters>
      <div class="flex gap-2">
        <UButton
          label="New note"
          icon="i-pixelarticons-plus"
          color="primary"
          size="sm"
          block
          :loading="creating"
          :disabled="!libraryReady"
          @click="createNewNote"
        />
      </div>
      <DangerCallout v-if="error" tone="caution" title="Notebook needs attention">
        {{ error }}
      </DangerCallout>
    </template>

    <div v-if="loading" class="space-y-2 px-2 py-3">
      <div v-for="item in 5" :key="item" class="h-16 animate-pulse rounded-2xl bg-(--or3-surface-soft)" />
    </div>
    <div v-else-if="!notes.length" class="px-3 py-6 text-center text-sm text-(--or3-text-muted)">
      No notes yet.
    </div>
    <NuxtLink
      v-for="note in notes"
      v-else
      :key="note.path"
      :to="noteEditRoute(note.path)"
      class="or3-desktop-list-item"
      :class="{ 'is-active': route.query.path === note.path }"
    >
      <span class="or3-desktop-list-item__title-row">
        <span class="or3-desktop-list-item__title">
          <span class="or3-desktop-list-item__icon">
            <Icon :name="note.favorite ? 'i-pixelarticons-heart' : 'i-pixelarticons-file-text'" class="size-4" />
          </span>
          {{ note.title }}
        </span>
        <span v-if="note.favorite" class="or3-desktop-list-item__meta">fav</span>
      </span>
      <p class="or3-desktop-list-item__preview">{{ note.preview }}</p>
    </NuxtLink>
  </DesktopSecondarySidebar>
</template>

<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { navigateTo, useRoute } from '#app'
import { useToast } from '@nuxt/ui/composables'
import { useNoteFiles, type NoteFileSummary } from '~/composables/useNoteFiles'

const route = useRoute()
const toast = useToast()
const { listNoteFiles, createNote } = useNoteFiles()

const loading = ref(true)
const creating = ref(false)
const search = ref('')
const notes = ref<NoteFileSummary[]>([])
const error = ref<string | null>(null)

const libraryReady = computed(() => !error.value)
const footerText = computed(() => `${notes.value.length} note${notes.value.length === 1 ? '' : 's'}`)

function noteEditRoute(path: string) {
  return { path: '/notes/edit', query: { path } }
}

async function refresh() {
  loading.value = true
  error.value = null
  try {
    notes.value = await listNoteFiles(search.value)
  } catch (nextError: any) {
    notes.value = []
    error.value = nextError?.message || 'Could not load notes.'
  } finally {
    loading.value = false
  }
}

async function createNewNote() {
  if (!libraryReady.value) {
    toast.add({ title: 'Notebook unavailable', description: error.value || 'Connect to your computer and try again.', color: 'warning' })
    return
  }
  creating.value = true
  try {
    const path = await createNote()
    await navigateTo(noteEditRoute(path))
    await refresh()
  } catch (nextError: any) {
    toast.add({ title: 'Could not create note', description: nextError?.message || 'Please try again.', color: 'error' })
  } finally {
    creating.value = false
  }
}

watch(search, () => {
  void refresh()
})

onMounted(() => {
  void refresh()
})
</script>
