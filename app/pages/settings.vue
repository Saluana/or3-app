<template>
  <NuxtPage v-if="showChildRoute" />

  <AppShell v-else>
    <AppHeader subtitle="SETTINGS" />

    <div class="space-y-4">
      <!-- Search -->
      <div class="relative">
        <Icon name="i-lucide-search" class="absolute left-4 top-1/2 size-4 -translate-y-1/2 text-(--or3-text-muted)" />
        <input
          v-model="searchTerm"
          type="search"
          placeholder="Search settings..."
          class="or3-focus-ring h-12 w-full rounded-2xl border border-(--or3-border) bg-(--or3-surface) pl-11 pr-16 text-sm text-(--or3-text) placeholder:text-(--or3-text-muted)"
          aria-label="Search settings"
        />
        <span class="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 rounded-md border border-(--or3-border) bg-white px-1.5 py-0.5 font-mono text-[11px] text-(--or3-text-muted)">⌘K</span>
      </div>

      <SurfaceCard class-name="space-y-3">
        <p class="or3-command text-[11px] uppercase tracking-[0.2em] text-(--or3-green-dark)">Settings groups</p>
        <div class="grid gap-3 sm:grid-cols-2">
          <button
            v-for="group in groups"
            :key="group.key"
            type="button"
            class="or3-focus-ring flex items-start gap-3 rounded-2xl border p-4 text-left transition"
            :class="activeFilter === group.key
              ? 'border-(--or3-green) bg-(--or3-green-soft)'
              : 'border-(--or3-border) bg-white/70 hover:bg-(--or3-green-soft)'"
            @click="activeFilter = group.key"
          >
            <RetroIcon :name="group.icon" size="sm" />
            <div class="min-w-0 flex-1">
              <p class="font-mono text-sm font-semibold text-(--or3-text)">{{ group.label }}</p>
              <p class="mt-1 text-xs leading-5 text-(--or3-text-muted)">{{ group.description }}</p>
            </div>
          </button>
        </div>
      </SurfaceCard>

      <SurfaceCard class-name="space-y-3">
        <p class="or3-command text-[11px] uppercase tracking-[0.2em] text-(--or3-green-dark)">Popular destinations</p>
        <div class="grid gap-3 sm:grid-cols-2">
          <NuxtLink
            v-for="link in destinationLinks"
            :key="link.to"
            :to="link.to"
            class="rounded-2xl border border-(--or3-border) bg-white/70 p-4 transition hover:bg-(--or3-green-soft)"
          >
            <div class="flex items-start gap-3">
              <RetroIcon :name="link.icon" size="sm" />
              <div class="min-w-0 flex-1">
                <p class="font-mono text-sm font-semibold text-(--or3-text)">{{ link.label }}</p>
                <p class="mt-1 text-xs leading-5 text-(--or3-text-muted)">{{ link.description }}</p>
              </div>
            </div>
          </NuxtLink>
        </div>
      </SurfaceCard>

      <!-- Filter chips -->
      <div class="-mx-4 overflow-x-auto px-4 pb-1">
        <div class="flex w-max items-center gap-2">
          <button
            v-for="filter in filters"
            :key="filter.key"
            type="button"
            class="or3-focus-ring rounded-full border px-4 py-2 font-mono text-xs font-semibold uppercase tracking-wide transition"
            :class="activeFilter === filter.key
              ? 'border-(--or3-green) bg-(--or3-green-soft) text-(--or3-green-dark)'
              : 'border-(--or3-border) bg-(--or3-surface) text-(--or3-text)'"
            @click="activeFilter = filter.key"
          >
            {{ filter.label }}
          </button>
        </div>
      </div>

      <!-- Connection summary card -->
      <SurfaceCard class-name="space-y-3">
        <div class="flex items-start gap-3">
          <BrandMark size="md" />
          <div class="min-w-0 flex-1">
            <div class="flex flex-wrap items-center gap-2">
              <p class="font-mono text-base font-semibold text-(--or3-text)">
                {{ activeHost?.token ? `Connected to ${activeHost.name || 'My Computer'}` : 'No computer paired' }}
              </p>
              <StatusPill
                v-if="activeHost?.token"
                label="Connected"
                tone="green"
                pulse
              />
            </div>
            <p class="mt-1 text-sm leading-6 text-(--or3-text-muted)">
              {{ activeHost?.token ? 'Your or3-intern app is connected and ready.' : 'Pair this app to your computer to get started.' }}
            </p>
          </div>
        </div>
        <div class="flex items-center gap-2">
          <code
            v-if="activeHost?.baseUrl"
            class="min-w-0 flex-1 truncate rounded-xl border border-(--or3-border) bg-white/70 px-3 py-2 font-mono text-xs text-(--or3-text)"
          >{{ activeHost.baseUrl }}</code>
          <UButton
            label="Pair new computer"
            icon="i-lucide-link"
            color="primary"
            variant="solid"
            size="sm"
            class="shrink-0 rounded-full"
            to="/settings/pair"
          />
        </div>
      </SurfaceCard>

      <!-- Quick Settings grid -->
      <SurfaceCard v-if="quickSections.length" class-name="space-y-3">
        <p class="or3-command text-[11px] uppercase tracking-[0.2em] text-(--or3-green-dark)">{{ activeFilterLabel }} highlights</p>
        <div class="grid grid-cols-2 gap-3 sm:grid-cols-3">
          <button
            v-for="section in quickSections"
            :key="section.key"
            type="button"
            class="or3-focus-ring group flex flex-col gap-2 rounded-2xl border border-(--or3-border) bg-white/70 p-3 text-left transition hover:bg-(--or3-green-soft)"
            @click="openSection(section.key)"
          >
            <div class="flex items-start justify-between">
              <RetroIcon :name="iconFor(section.key)" size="sm" />
              <Icon name="i-lucide-chevron-right" class="size-4 text-(--or3-text-muted)" />
            </div>
            <div class="min-w-0">
              <p class="font-mono text-sm font-semibold text-(--or3-text)">{{ section.label }}</p>
              <p class="mt-0.5 line-clamp-2 text-xs leading-snug text-(--or3-text-muted)">{{ section.description }}</p>
            </div>
          </button>
        </div>
      </SurfaceCard>

      <!-- All Settings list -->
      <SurfaceCard v-if="listSections.length" class-name="space-y-3">
        <p class="or3-command text-[11px] uppercase tracking-[0.2em] text-(--or3-green-dark)">All settings</p>
        <div class="overflow-hidden rounded-2xl border border-(--or3-border) bg-white/70">
          <button
            v-for="(section, index) in listSections"
            :key="section.key"
            type="button"
            class="or3-focus-ring flex w-full items-center gap-3 px-4 py-3 text-left transition hover:bg-(--or3-green-soft)"
            :class="index < listSections.length - 1 ? 'border-b border-(--or3-border)' : ''"
            @click="openSection(section.key)"
          >
            <RetroIcon :name="iconFor(section.key)" size="sm" />
            <div class="min-w-0 flex-1">
              <p class="font-mono text-sm font-semibold text-(--or3-text)">{{ section.label }}</p>
              <p class="mt-0.5 truncate text-xs text-(--or3-text-muted)">{{ section.description }}</p>
            </div>
            <Icon name="i-lucide-chevron-right" class="size-5 shrink-0 text-(--or3-text-muted)" />
          </button>
        </div>
      </SurfaceCard>

      <!-- Empty state -->
      <SurfaceCard
        v-if="!quickSections.length && !listSections.length"
        class-name="text-center text-sm text-(--or3-text-muted) py-6"
      >
        <p v-if="searchTerm.trim()">No settings match "{{ searchTerm }}".</p>
        <p v-else>No settings available for this filter.</p>
      </SurfaceCard>

      <NuxtLink
        to="/settings/service"
        class="or3-focus-ring flex w-full items-start gap-3 rounded-2xl border border-amber-200 bg-amber-50/70 p-4 text-left transition hover:bg-amber-100/80"
      >
        <Icon name="i-lucide-triangle-alert" class="mt-0.5 size-5 shrink-0 text-(--or3-amber)" />
        <div class="min-w-0 flex-1">
          <p class="font-mono text-sm font-semibold text-amber-900">Advanced editor</p>
          <p class="mt-0.5 text-xs leading-5 text-amber-800/80">
            The classic section editor is still here under Advanced when you need direct access to low-level host settings.
          </p>
        </div>
        <Icon name="i-lucide-chevron-right" class="mt-1 size-5 shrink-0 text-amber-700/70" />
      </NuxtLink>

      <p v-if="configureError" class="text-sm text-(--or3-danger)">{{ configureError }}</p>

      <p class="or3-command pb-3 text-center text-xs">or3-app v1.0.0</p>
    </div>
  </AppShell>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useConfigure } from '~/composables/useConfigure'
import { useActiveHost } from '~/composables/useActiveHost'

const route = useRoute()
const router = useRouter()
const searchTerm = ref('')

type FilterKey = 'connection' | 'security' | 'safety' | 'agent-behavior' | 'knowledge' | 'advanced'
const activeFilter = ref<FilterKey>('connection')

const { sections, configureError, loadSections } = useConfigure()
const { activeHost } = useActiveHost()

const filters: Array<{ key: FilterKey; label: string }> = [
  { key: 'connection', label: 'Connection' },
  { key: 'security', label: 'Security' },
  { key: 'safety', label: 'Safety' },
  { key: 'agent-behavior', label: 'Agent behavior' },
  { key: 'knowledge', label: 'Knowledge' },
  { key: 'advanced', label: 'Advanced' },
]

const groups = [
	{ key: 'connection', label: 'Connection', description: 'Pair devices, review the current computer, and jump back into device trust.', icon: 'i-lucide-link' },
	{ key: 'security', label: 'Security', description: 'Manage passkeys, signed-in sessions, and owner verification state.', icon: 'i-lucide-shield-check' },
	{ key: 'safety', label: 'Safety', description: 'Control hardening, session posture, and host protection behavior.', icon: 'i-lucide-shield' },
	{ key: 'agent-behavior', label: 'Agent Behavior', description: 'Tune providers, runtime behavior, tools, skills, and automation.', icon: 'i-lucide-bot' },
	{ key: 'knowledge', label: 'Knowledge', description: 'Adjust workspace, storage, indexing, and context-related settings.', icon: 'i-lucide-book-open' },
	{ key: 'advanced', label: 'Advanced', description: 'Open the low-level section editor when you need direct host controls.', icon: 'i-lucide-settings-2' },
] satisfies Array<{ key: FilterKey; label: string; description: string; icon: string }>

const destinationLinks = [
	{ to: '/settings/pair', label: 'Connection & pairing', description: 'Enroll this device and review trusted phones or tablets.', icon: 'i-lucide-smartphone' },
	{ to: '/settings/security', label: 'Security dashboard', description: 'See passkey status, session policy, and recovery readiness at a glance.', icon: 'i-lucide-shield-check' },
	{ to: '/settings/passkeys', label: 'Passkeys', description: 'Register, rename, and remove passkeys from one dedicated screen.', icon: 'i-lucide-key-round' },
	{ to: '/settings/service', label: 'Advanced editor', description: 'Keep the current section-based editor available for detailed service tuning.', icon: 'i-lucide-sliders-horizontal' },
]

// Sections promoted to the "Quick settings" grid (shown only on Essentials).
const QUICK_KEYS: Record<FilterKey, string[]> = {
  connection: ['workspace', 'storage', 'service'],
  security: ['security', 'session', 'service'],
  safety: ['security', 'hardening', 'session'],
  'agent-behavior': ['provider', 'runtime', 'skills', 'automation'],
  knowledge: ['workspace', 'storage', 'docindex', 'context'],
  advanced: ['service', 'hardening', 'tools'],
}

// Filter membership for chips. `null` means all sections.
const FILTER_MAP: Record<FilterKey, string[] | null> = {
  connection: ['workspace', 'storage', 'service', 'session'],
  security: ['security', 'session', 'service'],
  safety: ['security', 'hardening', 'session', 'service'],
  'agent-behavior': ['provider', 'runtime', 'context', 'skills', 'docindex', 'tools', 'automation', 'channels'],
  knowledge: ['workspace', 'storage', 'docindex', 'context'],
  advanced: ['hardening', 'context', 'docindex', 'tools', 'service'],
}

// Retro-style icons for each known section key.
const ICON_MAP: Record<string, string> = {
  provider: 'i-lucide-cpu',
  workspace: 'i-lucide-folder',
  storage: 'i-lucide-database',
  security: 'i-lucide-shield',
  channels: 'i-lucide-message-square',
  automation: 'i-lucide-zap',
  runtime: 'i-lucide-activity',
  tools: 'i-lucide-wrench',
  docindex: 'i-lucide-book-open',
  skills: 'i-lucide-star',
  session: 'i-lucide-users',
  service: 'i-lucide-monitor',
  context: 'i-lucide-layers',
  hardening: 'i-lucide-lock',
}

function iconFor(key: string) {
  return ICON_MAP[key] ?? 'i-lucide-settings-2'
}

function matchesSearch(text: string | undefined | null) {
  const query = searchTerm.value.trim().toLowerCase()
  if (!query) return true
  return String(text ?? '').toLowerCase().includes(query)
}

const filteredSections = computed(() => {
  const allow = FILTER_MAP[activeFilter.value]
  return sections.value.filter((section) => {
    if (allow && !allow.includes(section.key)) return false
    return [section.label, section.description, section.status].some(matchesSearch)
  })
})

const quickSections = computed(() => {
  if (searchTerm.value.trim()) return []
  return filteredSections.value.filter((section) => QUICK_KEYS[activeFilter.value]?.includes(section.key))
})

const activeFilterLabel = computed(() => filters.find((filter) => filter.key === activeFilter.value)?.label ?? 'Selected')

const listSections = computed(() => {
  const quickKeys = new Set(quickSections.value.map((section) => section.key))
  return filteredSections.value.filter((section) => !quickKeys.has(section.key))
})

const showChildRoute = computed(() => route.path !== '/settings')

function openSection(sectionKey: string) {
  void router.push(`/settings/${encodeURIComponent(sectionKey)}`)
}

onMounted(async () => {
  await loadSections()
})
</script>
