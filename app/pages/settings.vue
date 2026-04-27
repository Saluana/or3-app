<template>
  <AppShell>
    <AppHeader subtitle="SETTINGS" />

    <div class="space-y-4">
      <HostConnectionCard />
      <DeviceManagementCard />

      <SurfaceCard class-name="space-y-4">
        <SectionHeader
          title="Computer preferences"
          subtitle="Choose one area at a time"
        />

        <p class="text-sm leading-6 text-(--or3-text-muted)">
          Settings are split into focused screens so you can change one category without scrolling through everything.
        </p>

        <div class="rounded-2xl border border-(--or3-border) bg-white/70 p-3">
          <label for="settings-search" class="sr-only">Search settings categories</label>
          <UInput
            id="settings-search"
            v-model="searchTerm"
            icon="i-lucide-search"
            placeholder="Search categories"
          />
        </div>

        <DangerCallout tone="caution" title="Advanced area">
          Most people only need a couple categories. If you're unsure what a setting does, leave it as-is.
        </DangerCallout>

        <p v-if="configureError" class="text-sm text-rose-600">{{ configureError }}</p>

        <div class="overflow-hidden rounded-2xl border border-(--or3-border) bg-white/80">
          <NuxtLink
            v-for="section in filteredSections"
            :key="section.key"
            :to="`/settings/${section.key}`"
            class="flex items-center justify-between gap-3 border-b border-(--or3-border) px-4 py-3 text-left transition hover:bg-(--or3-green-soft)"
          >
            <div class="min-w-0">
              <p class="font-mono text-sm font-semibold">{{ section.label }}</p>
              <p class="mt-1 text-xs text-(--or3-text-muted)">{{ section.description }}</p>
              <p v-if="section.status" class="mt-1 text-xs text-(--or3-text-muted)">{{ section.status }}</p>
            </div>
            <Icon name="i-lucide-chevron-right" class="size-5 shrink-0 text-(--or3-text-muted)" />
          </NuxtLink>

          <div
            v-if="!filteredSections.length"
            class="px-4 py-8 text-center text-sm text-(--or3-text-muted)"
          >
            No categories match "{{ searchTerm }}".
          </div>
        </div>
      </SurfaceCard>

      <p class="or3-command pb-3 text-center text-xs">or3-app v1.0.0</p>
    </div>
  </AppShell>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useConfigure } from '~/composables/useConfigure'

const searchTerm = ref('')
const {
  sections,
  configureError,
  loadSections,
} = useConfigure()

const filteredSections = computed(() => {
  const query = searchTerm.value.trim().toLowerCase()
  if (!query) return sections.value
  return sections.value.filter((section) => {
    return [section.label, section.description, section.status]
      .filter(Boolean)
      .some((value) => String(value).toLowerCase().includes(query))
  })
})

onMounted(async () => {
  await loadSections()
})
</script>
