<template>
  <AppShell>
    <AppHeader subtitle="NOTES" />
    <div class="space-y-4">
      <SurfaceCard class-name="space-y-4">
        <div class="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <div class="flex items-center gap-2">
              <RetroIcon name="i-pixelarticons-notes" />
              <p class="font-mono text-base font-semibold text-(--or3-text)">Notebook</p>
            </div>
            <p class="mt-2 text-sm leading-6 text-(--or3-text-muted)">
              Notes live as Markdown files in <span class="font-mono">.notes</span> inside your workspace so they stay easy to review, sync, and edit.
            </p>
          </div>

          <div class="flex flex-wrap gap-2">
            <UButton label="New note" icon="i-pixelarticons-plus" color="primary" :loading="creating" @click="handleCreateNote" />
            <UButton label="Refresh" icon="i-pixelarticons-reload" color="neutral" variant="soft" :loading="loading" @click="refresh" />
          </div>
        </div>

        <UFormField label="Search notes" name="note-search" description="Search by title, preview, filename, or path.">
          <UInput v-model="search" placeholder="Find a note..." />
        </UFormField>

        <DangerCallout v-if="error" tone="caution" title="Notebook needs attention">
          {{ error }}
        </DangerCallout>

        <div v-if="loading" class="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          <div v-for="item in 6" :key="item" class="h-44 animate-pulse rounded-3xl bg-(--or3-surface-soft)" />
        </div>

        <div v-else-if="filteredNotes.length" class="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          <SurfaceCard
            v-for="note in filteredNotes"
            :key="note.path"
            interactive
            class-name="space-y-3"
            @click="openNote(note.path)"
          >
            <div class="flex items-start justify-between gap-3">
              <div class="min-w-0">
                <div class="flex items-center gap-2">
                  <RetroIcon :name="note.favorite ? 'i-pixelarticons-heart' : 'i-pixelarticons-file-text'" />
                  <p class="truncate font-mono text-sm font-semibold text-(--or3-text)">{{ note.title }}</p>
                </div>
                <p class="mt-1 truncate text-xs text-(--or3-text-muted)">{{ note.name }}</p>
              </div>
              <div class="flex shrink-0 gap-1">
                <UButton
                  :icon="note.favorite ? 'i-pixelarticons-heart' : 'i-pixelarticons-heart-outline'"
                  color="neutral"
                  variant="ghost"
                  size="sm"
                  @click.stop="toggleFavoriteNote(note.path)"
                />
              </div>
            </div>

            <p class="line-clamp-4 min-h-24 text-sm leading-6 text-(--or3-text-muted)">{{ note.preview }}</p>

            <div class="rounded-2xl border border-(--or3-border) bg-white/70 px-3 py-2 text-xs text-(--or3-text-muted)">
              <p class="truncate">{{ note.path }}</p>
              <p class="mt-1">{{ formatDate(note.updatedAt) }}</p>
            </div>

            <div class="flex flex-wrap gap-2">
              <UButton label="Edit" icon="i-pixelarticons-edit" color="primary" size="sm" @click.stop="openNote(note.path)" />
            </div>
          </SurfaceCard>
        </div>

        <div v-else class="rounded-3xl border border-dashed border-(--or3-border) bg-white/60 px-5 py-10 text-center">
          <p class="font-mono text-sm font-semibold text-(--or3-text)">No notes yet</p>
          <p class="mt-2 text-sm leading-6 text-(--or3-text-muted)">
            Capture quick ideas, meeting notes, or reference material as Markdown files you can revisit anytime.
          </p>
          <div class="mt-4 flex justify-center gap-2">
            <UButton label="Create first note" icon="i-pixelarticons-plus" color="primary" @click="handleCreateNote" />
          </div>
        </div>
      </SurfaceCard>
    </div>
  </AppShell>
</template>

<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { navigateTo } from '#app'
import { useToast } from '@nuxt/ui/composables'
import { useNoteFiles, type NoteFileSummary } from '~/composables/useNoteFiles'

const toast = useToast()
const {
  listNoteFiles,
  createNote,
  toggleFavorite,
} = useNoteFiles()

const loading = ref(true)
const creating = ref(false)
const search = ref('')
const notes = ref<NoteFileSummary[]>([])
const error = ref<string | null>(null)

const filteredNotes = computed(() => {
  const query = search.value.trim().toLowerCase()
  if (!query) return notes.value
  return notes.value.filter((note) => [note.title, note.preview, note.name, note.path].some((value) => value.toLowerCase().includes(query)))
})

function noteEditRoute(path: string) {
  return {
    path: '/notes/edit',
    query: { path },
  }
}

function formatDate(value?: string) {
  if (!value) return 'Updated time unavailable'
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? value : `Updated ${date.toLocaleString()}`
}

async function refresh() {
  loading.value = true
  error.value = null
  try {
    notes.value = await listNoteFiles(search.value)
  } catch (nextError: any) {
    error.value = nextError?.message || 'Could not load notes.'
  } finally {
    loading.value = false
  }
}

async function handleCreateNote() {
  creating.value = true
  try {
    const path = await createNote()
    await navigateTo(noteEditRoute(path))
  } catch (nextError: any) {
    toast.add({ title: 'Could not create note', description: nextError?.message || 'Please try again.', color: 'error' })
  } finally {
    creating.value = false
  }
}

async function openNote(path: string) {
  await navigateTo(noteEditRoute(path))
}

function toggleFavoriteNote(path: string) {
  toggleFavorite(path)
  void refresh()
}

watch(search, () => {
  void refresh()
})

onMounted(async () => {
  await refresh()
})
</script>
