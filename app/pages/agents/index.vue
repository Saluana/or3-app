<template>
  <AppShell>
    <AppHeader subtitle="AGENTS" />

    <div class="space-y-5">
      <AgentTaskForm @submit="createJob" />

      <section>
        <SectionHeader title="Recent Agent Jobs">
          <template #action>
            <StatusPill :label="jobs.length ? `${jobs.length} jobs` : 'ready'" tone="green" />
          </template>
        </SectionHeader>
        <div class="space-y-3">
          <AgentJobCard v-for="job in jobs" :key="job.job_id" :job="job" @continue="continueInChat" />
          <SurfaceCard v-if="!jobs.length" class-name="text-center text-sm leading-6 text-(--or3-text-muted)">
            Queue an agent task and it will appear here with live status.
          </SurfaceCard>
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
  await queueJob({ parent_session_key: session.sessionKey, task, timeout_seconds: 900 })
}

async function continueInChat(job: JobSnapshot) {
  await router.push('/')
  await nextTick()
  void programmaticSend('main', `Continue from this agent result:\n\n${job.final_text ?? ''}`)
}
</script>
