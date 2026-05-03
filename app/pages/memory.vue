<template>
  <AppShell>
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
          <UButton label="Check status" icon="i-pixelarticons-reload" color="neutral" variant="soft" class="or3-touch-target" :loading="memoryLoading" @click="handleRefreshEmbeddings" />
          <UButton label="Re-scan notes" icon="i-pixelarticons-database" color="primary" class="or3-touch-target" :loading="memoryLoading" @click="handleRebuild('memory')" />
          <UButton label="Re-scan documents" icon="i-pixelarticons-files" color="neutral" variant="soft" class="or3-touch-target" :loading="memoryLoading" @click="handleRebuild('docs')" />
        </div>

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
          <UButton label="Refresh" icon="i-pixelarticons-shield" color="neutral" variant="soft" class="or3-touch-target" :loading="memoryLoading" @click="handleRefreshAudit" />
          <UButton label="Verify activity log" icon="i-pixelarticons-check-double" color="primary" class="or3-touch-target" :loading="memoryLoading" @click="handleVerifyAudit" />
        </div>
        <details class="rounded-2xl border border-(--or3-border) bg-white/70 p-3">
          <summary class="cursor-pointer select-none text-xs font-semibold uppercase tracking-wide text-(--or3-text-muted)">Show technical details</summary>
          <pre class="mt-2 max-h-64 overflow-auto whitespace-pre-wrap text-xs text-(--or3-text-muted)">{{ formatObject(auditStatus) }}</pre>
        </details>
      </SurfaceCard>

      <details class="rounded-3xl border border-(--or3-border) bg-(--or3-surface) p-4 shadow-(--or3-shadow-soft)">
        <summary class="flex cursor-pointer items-center gap-2 select-none">
          <RetroIcon name="i-pixelarticons-tool-case" size="sm" />
          <span class="font-mono text-sm font-semibold">Advanced: scope tools</span>
          <span class="or3-command ml-auto text-[11px]">developer</span>
        </summary>
        <div class="mt-4 space-y-4">
          <DangerCallout tone="caution" title="Developer tools">
            These are for connecting chat sessions to memory scopes. If that sentence didn't make sense, you don't need this section.
          </DangerCallout>
          <div class="grid gap-3 md:grid-cols-2">
            <UInput v-model="sessionKey" placeholder="session_key" />
            <UInput v-model="scopeKey" placeholder="scope_key" />
          </div>
          <div class="flex flex-wrap gap-2">
            <UButton label="Resolve session scope" color="neutral" variant="soft" :loading="memoryLoading" @click="resolveScope(sessionKey)" />
            <UButton label="Link scope" color="primary" :loading="memoryLoading" @click="linkScope(sessionKey, scopeKey)" />
            <UButton label="List scope sessions" color="neutral" variant="soft" :loading="memoryLoading" @click="listScopeSessions(scopeKey)" />
          </div>
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
  auditStatus,
  scopeResult,
  memoryLoading,
  memoryError,
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

onMounted(async () => {
  await Promise.allSettled([loadEmbeddingsStatus(), loadAuditStatus()])
})
</script>
