<template>
  <AppShell>
    <AppHeader subtitle="PROMPTS" />
    <div class="space-y-4">
      <SurfaceCard class-name="space-y-4">
        <div class="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <div class="flex items-center gap-2">
              <RetroIcon name="i-pixelarticons-notebook" />
              <p class="font-mono text-base font-semibold text-(--or3-text)">Prompt library</p>
            </div>
            <p class="mt-2 text-sm leading-6 text-(--or3-text-muted)">
              Prompts live as Markdown files in <span class="font-mono">.prompts</span> inside your workspace so they stay easy to review, sync, and edit.
            </p>
          </div>

          <div class="flex flex-wrap gap-2">
            <UButton label="New prompt" icon="i-pixelarticons-plus" color="primary" :loading="creating" @click="handleCreatePrompt" />
            <UButton label="Refresh" icon="i-pixelarticons-reload" color="neutral" variant="soft" :loading="loading" @click="refresh" />
          </div>
        </div>

        <UFormField label="Search prompts" name="prompt-search" description="Search by title, preview, filename, or path.">
          <UInput v-model="search" placeholder="Find a prompt..." />
        </UFormField>

        <DangerCallout v-if="error" tone="caution" title="Prompt library needs attention">
          {{ error }}
        </DangerCallout>

        <div v-if="loading" class="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          <div v-for="item in 6" :key="item" class="h-44 animate-pulse rounded-3xl bg-(--or3-surface-soft)" />
        </div>

        <div v-else-if="filteredPrompts.length" class="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          <SurfaceCard
            v-for="prompt in filteredPrompts"
            :key="prompt.path"
            interactive
            class-name="space-y-3"
            @click="openPrompt(prompt.path)"
          >
            <div class="flex items-start justify-between gap-3">
              <div class="min-w-0">
                <div class="flex items-center gap-2">
                  <RetroIcon :name="prompt.isDefault ? 'i-pixelarticons-star' : 'i-pixelarticons-file-text'" />
                  <p class="truncate font-mono text-sm font-semibold text-(--or3-text)">{{ prompt.title }}</p>
                </div>
                <p class="mt-1 truncate text-xs text-(--or3-text-muted)">{{ prompt.name }}</p>
              </div>
              <div class="flex shrink-0 gap-1">
                <UButton
                  :icon="prompt.favorite ? 'i-pixelarticons-heart' : 'i-pixelarticons-heart-outline'"
                  color="neutral"
                  variant="ghost"
                  size="sm"
                  @click.stop="toggleFavoritePrompt(prompt.path)"
                />
                <UButton
                  :icon="prompt.isDefault ? 'i-pixelarticons-star' : 'i-pixelarticons-star-outline'"
                  color="neutral"
                  variant="ghost"
                  size="sm"
                  @click.stop="toggleDefaultPrompt(prompt.path, prompt.isDefault)"
                />
              </div>
            </div>

            <p class="line-clamp-4 min-h-24 text-sm leading-6 text-(--or3-text-muted)">{{ prompt.preview }}</p>

            <div class="rounded-2xl border border-(--or3-border) bg-white/70 px-3 py-2 text-xs text-(--or3-text-muted)">
              <p class="truncate">{{ prompt.path }}</p>
              <p class="mt-1">{{ formatDate(prompt.updatedAt) }}</p>
            </div>

            <div class="flex flex-wrap gap-2">
              <UButton label="Edit" icon="i-pixelarticons-edit" color="primary" size="sm" @click.stop="openPrompt(prompt.path)" />
              <UButton label="Use in Chat" icon="i-pixelarticons-message-text" color="neutral" variant="soft" size="sm" @click.stop="usePrompt(prompt.path)" />
            </div>
          </SurfaceCard>
        </div>

        <div v-else class="rounded-3xl border border-dashed border-(--or3-border) bg-white/60 px-5 py-10 text-center">
          <p class="font-mono text-sm font-semibold text-(--or3-text)">No prompts yet</p>
          <p class="mt-2 text-sm leading-6 text-(--or3-text-muted)">
            Start a reusable prompt library for your workspace. Each prompt is just a Markdown file you can edit anytime.
          </p>
          <div class="mt-4 flex justify-center gap-2">
            <UButton label="Create first prompt" icon="i-pixelarticons-plus" color="primary" @click="handleCreatePrompt" />
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
import { usePromptFiles, type PromptFileSummary } from '~/composables/usePromptFiles'

const toast = useToast()
const {
  listPromptFiles,
  createPrompt,
  readPrompt,
  toggleFavorite,
  setDefaultPrompt,
  usePromptInChat,
} = usePromptFiles()

const loading = ref(true)
const creating = ref(false)
const search = ref('')
const prompts = ref<PromptFileSummary[]>([])
const error = ref<string | null>(null)

const filteredPrompts = computed(() => {
  const query = search.value.trim().toLowerCase()
  if (!query) return prompts.value
  return prompts.value.filter((prompt) => [prompt.title, prompt.preview, prompt.name, prompt.path].some((value) => value.toLowerCase().includes(query)))
})

function promptEditRoute(path: string) {
  return {
    path: '/prompts/edit',
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
    prompts.value = await listPromptFiles(search.value)
  } catch (nextError: any) {
    error.value = nextError?.message || 'Could not load prompts.'
  } finally {
    loading.value = false
  }
}

async function handleCreatePrompt() {
  creating.value = true
  try {
    const path = await createPrompt()
    await navigateTo(promptEditRoute(path))
  } catch (nextError: any) {
    toast.add({ title: 'Could not create prompt', description: nextError?.message || 'Please try again.', color: 'error' })
  } finally {
    creating.value = false
  }
}

async function openPrompt(path: string) {
  await navigateTo(promptEditRoute(path))
}

async function usePrompt(path: string) {
  try {
    const prompt = await readPrompt(path)
    await usePromptInChat(prompt.content)
    toast.add({ title: 'Prompt ready in chat', description: `${prompt.title} was copied into the current draft.` })
  } catch (nextError: any) {
    toast.add({ title: 'Could not open prompt', description: nextError?.message || 'Please try again.', color: 'error' })
  }
}

function toggleFavoritePrompt(path: string) {
  toggleFavorite(path)
  void refresh()
}

function toggleDefaultPrompt(path: string, isDefault: boolean) {
  setDefaultPrompt(isDefault ? null : path)
  void refresh()
}

watch(search, () => {
  void refresh()
})

onMounted(async () => {
  await refresh()
})
</script>