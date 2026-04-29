<template>
  <SurfaceCard class-name="space-y-5" padded>
    <!-- Header row with mascot -->
    <div class="flex items-start justify-between gap-3">
      <div class="min-w-0 flex-1">
        <p class="or3-label text-xs font-semibold tracking-[0.18em] text-(--or3-green)">COMMAND CENTER</p>
        <h2 class="mt-1 font-mono text-2xl font-semibold leading-tight text-(--or3-text)">Delegate work</h2>
        <p class="mt-2 text-sm leading-6 text-(--or3-text-muted)">
          Give or3-intern a task and it will search, summarize, monitor, or prepare drafts in the background.
        </p>
      </div>
      <RetroComputerMascot :size="84" sparkle class="-mt-1 shrink-0" />
    </div>

    <!-- Task input -->
    <UForm :state="formState" class="space-y-3" @submit.prevent="submit">
      <div class="relative">
        <UTextarea
          v-model="formState.task"
          :rows="3"
          class="w-full"
          :ui="{ base: 'rounded-2xl border border-(--or3-border) bg-(--or3-surface) pr-14 text-sm leading-6 placeholder:text-(--or3-text-muted)/70' }"
          placeholder="What should or3-intern do?"
          aria-label="Task for or3-intern"
        />
        <button
          type="submit"
          class="or3-focus-ring absolute bottom-2.5 right-2.5 grid size-10 place-items-center rounded-full bg-(--or3-green-soft) text-(--or3-green-dark) shadow-sm transition hover:bg-(--or3-green)/20 disabled:cursor-not-allowed disabled:opacity-50"
          :disabled="!formState.task.trim()"
          aria-label="Send task to or3-intern"
        >
          <Icon name="i-pixelarticons-send" class="size-4 -translate-x-px translate-y-px" />
        </button>
      </div>

      <!-- Category chips -->
      <div class="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1">
        <button
          v-for="cat in categories"
          :key="cat.id"
          type="button"
          :class="[
            'inline-flex shrink-0 items-center gap-2 rounded-2xl border px-3.5 py-2 text-sm font-medium transition',
            'or3-focus-ring or3-touch-target',
            formState.category === cat.id
              ? 'border-(--or3-green)/40 bg-(--or3-green-soft) text-(--or3-green-dark)'
              : 'border-(--or3-border) bg-(--or3-surface) text-(--or3-text) hover:border-(--or3-green)/30',
          ]"
          @click="selectCategory(cat.id)"
        >
          <Icon :name="cat.icon" class="size-4" />
          <span>{{ cat.label }}</span>
        </button>
      </div>

      <!-- Settings row -->
      <div class="grid grid-cols-3 divide-x divide-(--or3-border) overflow-hidden rounded-2xl border border-(--or3-border) bg-(--or3-surface)/60">
        <!-- Priority -->
        <UDropdownMenu :items="priorityMenuItems" :content="{ align: 'start', sideOffset: 6 }">
          <button
            type="button"
            class="or3-focus-ring flex h-full w-full flex-col items-start gap-1.5 px-3 py-2.5 text-left transition hover:bg-(--or3-green-soft)/40"
            aria-label="Set task priority"
          >
            <span class="flex w-full items-center gap-1.5 text-[12px] font-medium text-(--or3-text-muted)">
              <Icon name="i-pixelarticons-flag" class="size-3.5 shrink-0" />
              <span class="truncate">Priority</span>
            </span>
            <span class="flex w-full items-center justify-between gap-1">
              <span class="truncate text-sm text-(--or3-text)">{{ priorityLabel(formState.priority) }}</span>
              <Icon name="i-pixelarticons-chevron-down" class="size-3.5 shrink-0 text-(--or3-text-muted)" />
            </span>
          </button>
        </UDropdownMenu>

        <!-- Notify -->
        <UDropdownMenu :items="notifyMenuItems" :content="{ align: 'start', sideOffset: 6 }">
          <button
            type="button"
            class="or3-focus-ring flex h-full w-full flex-col items-start gap-1.5 px-3 py-2.5 text-left transition hover:bg-(--or3-green-soft)/40"
            aria-label="Set notification preference"
          >
            <span class="flex w-full items-center gap-1.5 text-[12px] font-medium text-(--or3-text-muted)">
              <Icon name="i-pixelarticons-bell" class="size-3.5 shrink-0" />
              <span class="truncate">Notify me</span>
            </span>
            <span class="flex w-full items-center justify-between gap-1">
              <span class="truncate text-sm text-(--or3-text)">{{ notifyLabel(formState.notify) }}</span>
              <Icon name="i-pixelarticons-chevron-down" class="size-3.5 shrink-0 text-(--or3-text-muted)" />
            </span>
          </button>
        </UDropdownMenu>

        <!-- Auto-approve -->
        <button
          type="button"
          class="or3-focus-ring flex h-full w-full flex-col items-start gap-1.5 px-3 py-2.5 text-left transition hover:bg-(--or3-green-soft)/40"
          @click="formState.autoApprove = !formState.autoApprove"
          :aria-pressed="formState.autoApprove"
          aria-label="Toggle auto-approve safe actions"
        >
          <span class="flex w-full items-center gap-1.5 text-[12px] font-medium text-(--or3-text-muted)">
            <Icon name="i-pixelarticons-shield" class="size-3.5 shrink-0" />
            <span class="truncate">Auto-approve</span>
          </span>
          <span class="flex w-full items-center justify-between gap-2">
            <span class="truncate text-sm text-(--or3-text)">Safe actions</span>
            <span
              :class="[
                'relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition',
                formState.autoApprove ? 'bg-(--or3-green)' : 'bg-stone-300',
              ]"
            >
              <span
                :class="[
                  'inline-block size-4 translate-x-0.5 rounded-full bg-white shadow transition',
                  formState.autoApprove && 'translate-x-4.5',
                ]"
              />
            </span>
          </span>
        </button>
      </div>
    </UForm>
  </SurfaceCard>
</template>

<script setup lang="ts">
import { computed, reactive } from 'vue'

export interface AgentTaskPayload {
  task: string
  category: AgentCategory
  priority: AgentPriority
  notify: AgentNotify
  autoApprove: boolean
}

export type AgentCategory = 'research' | 'monitor' | 'draft' | 'organize' | 'general'
export type AgentPriority = 'low' | 'balanced' | 'high'
export type AgentNotify = 'always' | 'complete' | 'never'

const emit = defineEmits<{ submit: [payload: AgentTaskPayload] }>()

const formState = reactive({
  task: '',
  category: 'general' as AgentCategory,
  priority: 'balanced' as AgentPriority,
  notify: 'complete' as AgentNotify,
  autoApprove: true,
})

const categories: Array<{ id: AgentCategory; label: string; icon: string; template: string }> = [
  { id: 'research', label: 'Research', icon: 'i-pixelarticons-search', template: 'Research the latest on ' },
  { id: 'monitor', label: 'Monitor', icon: 'i-pixelarticons-analytics', template: 'Monitor and alert me about ' },
  { id: 'draft', label: 'Draft', icon: 'i-pixelarticons-edit', template: 'Draft a ' },
  { id: 'organize', label: 'Organize', icon: 'i-pixelarticons-folder', template: 'Organize and summarize ' },
]

const priorityItems: Array<{ label: string; value: AgentPriority }> = [
  { label: 'Low', value: 'low' },
  { label: 'Balanced', value: 'balanced' },
  { label: 'High', value: 'high' },
]

const notifyItems: Array<{ label: string; value: AgentNotify }> = [
  { label: 'Always', value: 'always' },
  { label: 'When complete', value: 'complete' },
  { label: 'Never', value: 'never' },
]

const priorityMenuItems = computed(() =>
  priorityItems.map((item) => ({
    label: item.label,
    icon: formState.priority === item.value ? 'i-pixelarticons-check' : undefined,
    onSelect: () => {
      formState.priority = item.value
    },
  }))
)

const notifyMenuItems = computed(() =>
  notifyItems.map((item) => ({
    label: item.label,
    icon: formState.notify === item.value ? 'i-pixelarticons-check' : undefined,
    onSelect: () => {
      formState.notify = item.value
    },
  }))
)

function priorityLabel(value: AgentPriority) {
  return priorityItems.find((p) => p.value === value)?.label ?? 'Balanced'
}
function notifyLabel(value: AgentNotify) {
  return notifyItems.find((p) => p.value === value)?.label ?? 'When complete'
}

function selectCategory(id: AgentCategory) {
  formState.category = formState.category === id ? 'general' : id
  if (formState.category !== 'general' && !formState.task.trim()) {
    const tpl = categories.find((c) => c.id === id)?.template ?? ''
    formState.task = tpl
  }
}

function submit() {
  const value = formState.task.trim()
  if (!value) return
  emit('submit', {
    task: value,
    category: formState.category,
    priority: formState.priority,
    notify: formState.notify,
    autoApprove: formState.autoApprove,
  })
  formState.task = ''
  formState.category = 'general'
}
</script>
