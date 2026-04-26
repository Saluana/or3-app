<template>
  <AppShell>
    <AppHeader subtitle="AGENTS" />

    <div class="space-y-5">
      <AgentTaskForm @submit="createJob" />

      <section>
        <SectionHeader title="What or3-intern is working on">
          <template #action>
            <StatusPill
              :label="jobs.length ? `${jobs.length} active` : 'all clear'"
              :tone="jobs.length ? 'amber' : 'green'"
              :pulse="Boolean(jobs.length)"
            />
          </template>
        </SectionHeader>
        <div class="space-y-3">
          <AgentJobCard v-for="job in jobs" :key="job.job_id" :job="job" @continue="continueInChat" />
          <EmptyState
            v-if="!jobs.length"
            icon="i-lucide-bot"
            title="Nothing running yet"
            description="Hand off a task above and it'll appear here. You can keep using the app while or3-intern works."
          />
        </div>
      </section>
    </div>
  </AppShell>
</template>

<script setup lang="ts">
import type { JobSnapshot } from '~/types/or3-api'
import { programmaticSend } from '~/composables/useChatInputBridge'

const router = useRouter()
const { activeSession, ensureSession } = useChatSessions()
const { jobs, queueJob } = useJobs()

async function createJob(task: string) {
  const session = activeSession.value ?? ensureSession()
  await queueJob({ parent_session_key: session.sessionKey, task, timeout_seconds: 900 }).catch(() => {})
}

async function continueInChat(job: JobSnapshot) {
  await router.push('/')
  await nextTick()
  void programmaticSend('main', `Pick up where this task left off:\n\n${job.final_text ?? ''}`)
}
</script>
