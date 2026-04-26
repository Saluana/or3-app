import { computed, ref } from 'vue'
import type { RecentJobSummary } from '~/types/app-state'
import type { JobSnapshot, SubagentRequest, SubagentResponse } from '~/types/or3-api'
import { useLocalCache } from './useLocalCache'
import { useOr3Api } from './useOr3Api'

const loadingJobs = ref(false)

function summaryToSnapshot(summary: RecentJobSummary): JobSnapshot {
  return {
    job_id: summary.job_id,
    kind: summary.kind,
    status: summary.status,
    created_at: summary.updated_at,
    updated_at: summary.updated_at,
    final_text: summary.final_text,
    error: summary.error,
  }
}

function activeHostId(cache: ReturnType<typeof useLocalCache>) {
  return cache.state.value.activeHostId ?? 'local'
}

function hostJobSummaries(cache: ReturnType<typeof useLocalCache>) {
  const hostId = activeHostId(cache)
  cache.state.value.recentJobs[hostId] ??= []
  return cache.state.value.recentJobs[hostId]
}

function snapshotToSummary(job: JobSnapshot): RecentJobSummary {
  return {
    job_id: job.job_id,
    kind: job.kind,
    status: job.status,
    title: job.kind,
    updated_at: job.updated_at,
    final_text: job.final_text,
    error: job.error,
  }
}

function upsertHostJob(cache: ReturnType<typeof useLocalCache>, snapshot: JobSnapshot) {
  const jobs = hostJobSummaries(cache)
  const index = jobs.findIndex((job) => job.job_id === snapshot.job_id)
  const summary = snapshotToSummary(snapshot)
  if (index >= 0) jobs.splice(index, 1, summary)
  else jobs.unshift(summary)
  cache.persist()
}

export function useJobs() {
  const api = useOr3Api()
  const cache = useLocalCache()
  const recentJobs = computed(() => hostJobSummaries(cache).map(summaryToSnapshot))

  async function queueJob(request: SubagentRequest) {
    const response = await api.request<SubagentResponse>('/internal/v1/subagents', { body: request })
    const snapshot: JobSnapshot = {
      job_id: response.job_id,
      kind: 'subagent',
      status: response.status,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }
    upsertHostJob(cache, snapshot)
    return response
  }

  async function fetchJob(jobId: string) {
    loadingJobs.value = true
    try {
      const snapshot = await api.request<JobSnapshot>(`/internal/v1/jobs/${encodeURIComponent(jobId)}`)
      upsertHostJob(cache, snapshot)
      return snapshot
    } finally {
      loadingJobs.value = false
    }
  }

  async function abortJob(jobId: string) {
    return await api.request<JobSnapshot>(`/internal/v1/jobs/${encodeURIComponent(jobId)}/abort`, { method: 'POST' })
  }

  return { jobs: recentJobs, loadingJobs, queueJob, fetchJob, abortJob }
}
