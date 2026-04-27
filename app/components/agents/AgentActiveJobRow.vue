<template>
  <button
    type="button"
    class="or3-pressable or3-focus-ring flex w-full items-center gap-3 rounded-2xl border border-(--or3-border) bg-(--or3-surface) p-3 text-left"
    @click="$emit('open', job)"
  >
    <span class="grid size-11 shrink-0 place-items-center rounded-xl bg-(--or3-surface-soft) text-(--or3-text)">
      <Icon :name="iconName" class="size-5" />
    </span>

    <div class="min-w-0 flex-1">
      <p class="truncate font-mono text-sm font-semibold text-(--or3-text)">{{ title }}</p>
      <p class="mt-0.5 truncate text-xs text-(--or3-text-muted)">{{ description }}</p>

      <div class="mt-2 flex items-center gap-2">
        <div class="relative h-1.5 flex-1 overflow-hidden rounded-full bg-stone-200/80">
          <div
            class="absolute inset-y-0 left-0 rounded-full transition-all duration-700"
            :class="progressTone"
            :style="{ width: `${progress}%` }"
          />
        </div>
        <span class="font-mono text-[11px] tabular-nums text-(--or3-text-muted)">{{ progress }}%</span>
      </div>

      <p class="mt-1.5 flex items-center gap-1.5 text-[11px] text-(--or3-text-muted)">
        <span :class="['size-1.5 rounded-full', dotTone, isLive ? 'or3-live-dot' : '']" />
        <span class="capitalize">{{ statusVerb }}</span>
      </p>
    </div>

    <div class="shrink-0 text-right">
      <p class="font-mono text-sm font-semibold text-(--or3-text)">{{ elapsed }}</p>
      <p class="text-[11px] text-(--or3-text-muted)">elapsed</p>
    </div>
  </button>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import type { JobSnapshot } from '~/types/or3-api'

const props = defineProps<{ job: JobSnapshot }>()
defineEmits<{ open: [job: JobSnapshot] }>()

const now = ref(Date.now())
let timer: ReturnType<typeof setInterval> | null = null

onMounted(() => {
  timer = setInterval(() => (now.value = Date.now()), 30_000)
})
onBeforeUnmount(() => {
  if (timer) clearInterval(timer)
})

function categoryFromKind(kind?: string): 'research' | 'monitor' | 'draft' | 'organize' | 'general' {
  const k = (kind ?? '').toLowerCase()
  if (k.includes('research') || k.includes('search')) return 'research'
  if (k.includes('monitor') || k.includes('watch') || k.includes('mention')) return 'monitor'
  if (k.includes('draft') || k.includes('write') || k.includes('email')) return 'draft'
  if (k.includes('organize') || k.includes('summarize') || k.includes('notes')) return 'organize'
  return 'general'
}

const category = computed(() => categoryFromKind(props.job.kind))

const iconName = computed(() => {
  switch (category.value) {
    case 'research': return 'i-lucide-file-text'
    case 'monitor': return 'i-lucide-line-chart'
    case 'draft': return 'i-lucide-pen-line'
    case 'organize': return 'i-lucide-folder'
    default: return 'i-lucide-bot'
  }
})

const title = computed(() => {
  const kind = props.job.kind
  if (!kind || kind === 'agent' || kind === 'subagent') return 'Agent task'
  return kind.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
})

const description = computed(() => {
  if (props.job.final_text) return props.job.final_text.slice(0, 120)
  switch (category.value) {
    case 'research': return 'Researching topic and trends'
    case 'monitor': return 'Tracking signals in the background'
    case 'draft': return 'Writing draft based on inputs'
    case 'organize': return 'Organizing and summarizing'
    default: return 'Working on your request'
  }
})

const statusVerb = computed(() => {
  if (props.job.status === 'queued') return 'Queued'
  if (props.job.status === 'failed') return 'Failed'
  if (props.job.status === 'completed') return 'Complete'
  switch (category.value) {
    case 'research': return 'Researching'
    case 'monitor': return 'Monitoring'
    case 'draft': return 'Drafting'
    case 'organize': return 'Organizing'
    default: return 'Working'
  }
})

const isLive = computed(() => props.job.status === 'running' || props.job.status === 'queued')

const elapsedMs = computed(() => {
  const created = props.job.created_at ? new Date(props.job.created_at).getTime() : now.value
  const end = props.job.status === 'running' || props.job.status === 'queued'
    ? now.value
    : new Date(props.job.updated_at ?? props.job.created_at ?? now.value).getTime()
  return Math.max(0, end - created)
})

const elapsed = computed(() => {
  const ms = elapsedMs.value
  const min = Math.floor(ms / 60_000)
  if (min < 1) return `${Math.max(1, Math.floor(ms / 1000))}s`
  if (min < 60) return `${min}m`
  const h = Math.floor(min / 60)
  return `${h}h ${min % 60}m`
})

const progress = computed(() => {
  if (props.job.status === 'completed') return 100
  if (props.job.status === 'failed' || props.job.status === 'aborted') return 0
  if (props.job.status === 'queued') return 5
  // Estimate: assume 15 min budget for active jobs
  const budgetMs = 15 * 60_000
  const pct = Math.round((elapsedMs.value / budgetMs) * 100)
  return Math.max(8, Math.min(95, pct))
})

const progressTone = computed(() =>
  props.job.status === 'failed' ? 'bg-(--or3-danger)' : 'bg-(--or3-green)'
)

const dotTone = computed(() => {
  if (props.job.status === 'failed') return 'bg-(--or3-danger)'
  if (props.job.status === 'queued') return 'bg-(--or3-amber)'
  return 'bg-(--or3-green)'
})
</script>
