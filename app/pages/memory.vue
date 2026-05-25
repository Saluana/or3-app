<template>
  <AppShell
    desktop-title="Memory"
    desktop-subtitle="What or3-intern remembers and how to keep it healthy."
  >
    <template #sidebar>
      <MemorySidebar />
    </template>
    <AppHeader subtitle="KNOWLEDGE" />

    <div class="space-y-4">
      <SurfaceCard class-name="space-y-4">
        <div class="flex items-start gap-3">
          <RetroIcon name="i-pixelarticons-lightbulb-on" />
          <div>
            <p class="font-mono text-base font-semibold text-(--or3-text)">What or3-intern remembers</p>
            <p class="mt-1 text-sm leading-6 text-(--or3-text-muted)">
              Re-scan your saved notes and documents whenever you've added or changed a lot of content.
            </p>
          </div>
        </div>

        <DangerCallout tone="caution" title="Re-scanning takes a while">
          A full re-scan can use a lot of your computer for a few minutes. Don't start one if you're in the middle of something.
        </DangerCallout>

        <div class="flex flex-wrap gap-2">
          <UButton label="Check status" icon="i-pixelarticons-reload" color="neutral" variant="soft" class="or3-touch-target" :loading="statusLoading" @click="handleRefreshEmbeddings" />
          <UButton label="Re-scan notes" icon="i-pixelarticons-database" color="primary" class="or3-touch-target" :loading="rebuildLoading" @click="handleRebuild('memory')" />
          <UButton label="Re-scan documents" icon="i-pixelarticons-files" color="neutral" variant="soft" class="or3-touch-target" :loading="rebuildLoading" @click="handleRebuild('docs')" />
        </div>

        <p v-if="lastRebuildResult" class="text-sm text-(--or3-text-muted)">
          Last re-scan: {{ formatRebuildSummary(lastRebuildResult) }}
        </p>

        <details class="rounded-2xl border border-(--or3-border) bg-white/70 p-3">
          <summary class="cursor-pointer select-none text-xs font-semibold uppercase tracking-wide text-(--or3-text-muted)">Show technical details</summary>
          <pre class="mt-2 max-h-64 overflow-auto whitespace-pre-wrap text-xs text-(--or3-text-muted)">{{ formatObject(embeddingsStatus) }}</pre>
        </details>
      </SurfaceCard>

      <SurfaceCard class-name="space-y-4">
        <div class="flex items-start gap-3">
          <RetroIcon name="i-pixelarticons-shield" />
          <div>
            <p class="font-mono text-base font-semibold text-(--or3-text)">Trust check</p>
            <p class="mt-1 text-sm leading-6 text-(--or3-text-muted)">
              Make sure or3-intern's activity log hasn't been tampered with.
            </p>
          </div>
        </div>
        <div class="flex flex-wrap gap-2">
          <UButton label="Refresh" icon="i-pixelarticons-shield" color="neutral" variant="soft" class="or3-touch-target" :loading="auditLoading" @click="handleRefreshAudit" />
          <UButton label="Verify activity log" icon="i-pixelarticons-check-double" color="primary" class="or3-touch-target" :loading="auditLoading" @click="handleVerifyAudit" />
        </div>
        <details class="rounded-2xl border border-(--or3-border) bg-white/70 p-3">
          <summary class="cursor-pointer select-none text-xs font-semibold uppercase tracking-wide text-(--or3-text-muted)">Show technical details</summary>
          <pre class="mt-2 max-h-64 overflow-auto whitespace-pre-wrap text-xs text-(--or3-text-muted)">{{ formatObject(auditStatus) }}</pre>
        </details>
      </SurfaceCard>

      <details class="rounded-3xl border border-(--or3-border) bg-(--or3-surface) p-4 shadow-(--or3-shadow-soft)">
        <summary class="flex cursor-pointer items-center gap-2 select-none">
          <RetroIcon name="i-pixelarticons-tool-case" size="sm" />
          <span class="font-mono text-sm font-semibold">Advanced: memory identity tools</span>
          <span class="or3-command ml-auto text-[11px]">developer</span>
        </summary>
        <div class="mt-4 space-y-4">
          <DangerCallout tone="caution" title="Developer tools">
            These are for debugging how conversations share memory. If you only want OR3 to remember notes and documents, you don't need this section.
          </DangerCallout>
          <div class="grid gap-3 md:grid-cols-2">
            <UInput v-model="sessionKey" placeholder="session_key" />
            <UInput v-model="scopeKey" placeholder="scope_key" />
          </div>
          <div class="flex flex-wrap gap-2">
            <UButton label="Resolve session scope" color="neutral" variant="soft" :loading="scopeLoading" @click="handleResolveScope" />
            <UButton label="Link scope" color="primary" :loading="scopeLoading" @click="handleLinkScope" />
            <UButton label="List scope sessions" color="neutral" variant="soft" :loading="scopeLoading" @click="listScopeSessions(scopeKey)" />
          </div>
          <p v-if="scopeError" class="text-sm text-rose-600">{{ scopeError }}</p>
          <pre class="max-h-64 overflow-auto rounded-2xl border border-(--or3-border) bg-white/70 p-3 text-xs text-(--or3-text-muted)">{{ formatObject(scopeResult) }}</pre>
        </div>
      </details>

      <p v-if="memoryError" class="text-sm text-rose-600">{{ memoryError }}</p>
    </div>
  </AppShell>
</template>

<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { useMemoryTrust } from '~/composables/useMemoryTrust'

const sessionKey = ref('')
const scopeKey = ref('')
const {
  embeddingsStatus,
  lastRebuildResult,
  auditStatus,
  scopeResult,
  statusLoading,
  auditLoading,
  rebuildLoading,
  scopeLoading,
  memoryError,
  scopeError,
  loadEmbeddingsStatus,
  rebuildEmbeddings,
  loadAuditStatus,
  verifyAudit,
  linkScope,
  resolveScope,
  listScopeSessions,
} = useMemoryTrust()

function formatObject(value: unknown) {
  return JSON.stringify(value ?? { status: 'unavailable' }, null, 2)
}

function formatRebuildSummary(result: Record<string, unknown>) {
  const notes = Number(result.memoryNotesRebuilt ?? 0)
  const docs = result.docsRebuilt === true
  const target = String(result.target ?? 'memory')
  if (target === 'docs') return docs ? 'Document index refreshed.' : 'Document re-scan finished with no changes.'
  if (target === 'all') return `Rebuilt ${notes} notes${docs ? ' and refreshed documents' : ''}.`
  return notes > 0 ? `Rebuilt ${notes} memory notes.` : 'Memory re-scan finished with no note changes.'
}

async function handleRefreshEmbeddings() {
  await loadEmbeddingsStatus()
}

async function handleRebuild(target: 'memory' | 'docs') {
  await rebuildEmbeddings(target)
}

async function handleRefreshAudit() {
  await loadAuditStatus()
}

async function handleVerifyAudit() {
  await verifyAudit()
}

async function handleResolveScope() {
  await resolveScope(sessionKey.value)
}

async function handleLinkScope() {
  const key = sessionKey.value.trim()
  const scope = scopeKey.value.trim()
  if (!key || !scope) {
    scopeError.value = 'Enter both session_key and scope_key before linking.'
    return
  }
  const confirmed = window.confirm(
    `Link session "${key}" to scope "${scope}"? Linked sessions share memory and history.`,
  )
  if (!confirmed) return
  await linkScope(key, scope, { reason: 'memory-page-link' })
}

onMounted(async () => {
  await Promise.allSettled([loadEmbeddingsStatus(), loadAuditStatus()])
})
</script>
