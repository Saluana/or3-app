<template>
  <DesktopSecondarySidebar
    v-model:search-value="search"
    search-placeholder="Search prompts..."
    :footer-text="footerText"
    :on-refresh="refresh"
    scroll-key="prompts"
  >
    <template #filters>
      <div class="flex gap-2">
        <UButton
          label="New prompt"
          icon="i-pixelarticons-plus"
          color="primary"
          size="sm"
          block
          :loading="creating"
          :disabled="!libraryReady"
          @click="createNewPrompt"
        />
      </div>
      <DangerCallout v-if="error" tone="caution" title="Prompt library needs attention">
        {{ error }}
      </DangerCallout>
    </template>

    <div v-if="loading" class="space-y-2 px-2 py-3">
      <div v-for="item in 5" :key="item" class="h-16 animate-pulse rounded-2xl bg-(--or3-surface-soft)" />
    </div>
    <div v-else-if="!prompts.length" class="px-3 py-6 text-center text-sm text-(--or3-text-muted)">
      No prompts yet.
    </div>
    <NuxtLink
      v-for="prompt in prompts"
      v-else
      :key="prompt.path"
      :to="promptEditRoute(prompt.path)"
      class="or3-desktop-list-item"
      :class="{ 'is-active': route.query.path === prompt.path }"
    >
      <span class="or3-desktop-list-item__title-row">
        <span class="or3-desktop-list-item__title">
          <span class="or3-desktop-list-item__icon">
            <Icon :name="prompt.isDefault ? 'i-pixelarticons-star' : 'i-pixelarticons-file-text'" class="size-4" />
          </span>
          {{ prompt.title }}
        </span>
        <span v-if="prompt.favorite" class="or3-desktop-list-item__meta">fav</span>
      </span>
      <p class="or3-desktop-list-item__preview">{{ prompt.preview }}</p>
    </NuxtLink>
  </DesktopSecondarySidebar>
</template>

<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { navigateTo, useRoute } from '#app'
import { useToast } from '@nuxt/ui/composables'
import { usePromptFiles, type PromptFileSummary } from '~/composables/usePromptFiles'

const route = useRoute()
const toast = useToast()
const { listPromptFiles, createPrompt } = usePromptFiles()

const loading = ref(true)
const creating = ref(false)
const search = ref('')
const prompts = ref<PromptFileSummary[]>([])
const error = ref<string | null>(null)

const libraryReady = computed(() => !error.value)
const footerText = computed(() => `${prompts.value.length} prompt${prompts.value.length === 1 ? '' : 's'}`)

function promptEditRoute(path: string) {
  return { path: '/prompts/edit', query: { path } }
}

async function refresh() {
  loading.value = true
  error.value = null
  try {
    prompts.value = await listPromptFiles(search.value)
  } catch (nextError: any) {
    prompts.value = []
    error.value = nextError?.message || 'Could not load prompts.'
  } finally {
    loading.value = false
  }
}

async function createNewPrompt() {
  if (!libraryReady.value) {
    toast.add({ title: 'Prompt library unavailable', description: error.value || 'Connect to your computer and try again.', color: 'warning' })
    return
  }
  creating.value = true
  try {
    const path = await createPrompt()
    await navigateTo(promptEditRoute(path))
    await refresh()
  } catch (nextError: any) {
    toast.add({ title: 'Could not create prompt', description: nextError?.message || 'Please try again.', color: 'error' })
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
