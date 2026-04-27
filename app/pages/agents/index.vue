<template>
  <AppShell>
    <AppHeader subtitle="AGENTS" />

    <div class="space-y-6">
      <AgentCommandCenter @submit="createJob" />

      <!-- Active jobs -->
      <section>
        <SectionHeader title="Active jobs">
          <template #action>
            <NuxtLink
              v-if="active.length"
              to="/agents"
              class="or3-focus-ring flex items-center gap-1 font-mono text-xs font-semibold text-(--or3-green-dark)"
            >
              View all
              <Icon name="i-lucide-chevron-right" class="size-3.5" />
            </NuxtLink>
            <StatusPill
              v-else
              label="all clear"
              tone="green"
            />
          </template>
        </SectionHeader>

        <div v-if="active.length" class="space-y-2.5">
          <AgentActiveJobRow
            v-for="job in active"
            :key="job.job_id"
            :job="job"
            @open="continueInChat"
          />
        </div>
        <EmptyState
          v-else
          icon="i-lucide-bot"
          title="Nothing running yet"
          description="Hand off a task above and it'll appear here. You can keep using the app while or3-intern works."
        />
      </section>

      <!-- Queue & history -->
      <section>
        <SectionHeader title="Queue & history">
          <template #action>
            <NuxtLink
              to="/agents"
              class="or3-focus-ring flex items-center gap-1 font-mono text-xs font-semibold text-(--or3-green-dark)"
            >
              View all
              <Icon name="i-lucide-chevron-right" class="size-3.5" />
            </NuxtLink>
          </template>
        </SectionHeader>

        <AgentQueueHistory :pending="pending" :completed="completed" />
      </section>
    </div>
  </AppShell>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import type { JobSnapshot } from '~/types/or3-api'
import type { AgentTaskPayload } from '~/components/agents/AgentCommandCenter.vue'
import { programmaticSend } from '~/composables/useChatInputBridge'

const router = useRouter()
const { activeSession, ensureSession } = useChatSessions()
const { jobs, queueJob } = useJobs()

const active = computed(() => jobs.value.filter((j) => j.status === 'running'))
const pending = computed(() => jobs.value.filter((j) => j.status === 'queued'))
const completed = computed(() => jobs.value.filter((j) => j.status === 'completed'))

async function createJob(payload: AgentTaskPayload) {
  const session = activeSession.value ?? ensureSession()
  await queueJob({
    parent_session_key: session.sessionKey,
    task: payload.task,
    timeout_seconds:
      payload.priority === 'high' ? 1800 : payload.priority === 'low' ? 600 : 900,
    meta: {
      category: payload.category,
      priority: payload.priority,
      notify: payload.notify,
      auto_approve_safe: payload.autoApprove,
    },
  }).catch(() => {})
}

async function continueInChat(job: JobSnapshot) {
  if (!job.final_text) return
  await router.push('/')
  await nextTick()
  void programmaticSend('main', `Pick up where this task left off:\n\n${job.final_text}`)
}
</script>
