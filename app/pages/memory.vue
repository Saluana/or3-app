<template>
  <AppShell>
    <AppHeader subtitle="MEMORY" />

    <div class="space-y-4">
      <SurfaceCard class-name="space-y-4">
        <SectionHeader title="Embeddings" subtitle="Memory and docs status" />
        <p class="text-sm text-(--or3-text-muted)">Track the current embedding fingerprint and trigger a rebuild when your host content changes.</p>
        <div class="grid gap-3 md:grid-cols-2">
          <div class="rounded-2xl border border-(--or3-border) bg-white/70 p-4">
            <p class="or3-label text-xs font-semibold">Current status</p>
            <pre class="mt-2 whitespace-pre-wrap text-sm text-(--or3-text-muted)">{{ formatObject(embeddingsStatus) }}</pre>
          </div>
          <div class="space-y-2">
            <UButton label="Refresh" icon="i-lucide-refresh-cw" color="neutral" variant="soft" class="or3-touch-target" :loading="memoryLoading" @click="handleRefreshEmbeddings" />
            <UButton label="Rebuild memory" icon="i-lucide-database-zap" color="primary" class="or3-touch-target" :loading="memoryLoading" @click="handleRebuild('memory')" />
            <UButton label="Rebuild docs" icon="i-lucide-file-stack" color="neutral" variant="soft" class="or3-touch-target" :loading="memoryLoading" @click="handleRebuild('docs')" />
          </div>
        </div>
      </SurfaceCard>

      <SurfaceCard class-name="space-y-4">
        <SectionHeader title="Trust" subtitle="Audit chain" />
        <p class="text-sm text-(--or3-text-muted)">Verify the host audit chain and check strict-mode posture before trusting sensitive changes.</p>
        <div class="grid gap-3 md:grid-cols-2">
          <div class="rounded-2xl border border-(--or3-border) bg-white/70 p-4">
            <p class="or3-label text-xs font-semibold">Audit status</p>
            <pre class="mt-2 whitespace-pre-wrap text-sm text-(--or3-text-muted)">{{ formatObject(auditStatus) }}</pre>
          </div>
          <div class="space-y-2">
            <UButton label="Refresh audit" icon="i-lucide-shield" color="neutral" variant="soft" class="or3-touch-target" :loading="memoryLoading" @click="handleRefreshAudit" />
            <UButton label="Verify audit chain" icon="i-lucide-badge-check" color="primary" class="or3-touch-target" :loading="memoryLoading" @click="handleVerifyAudit" />
          </div>
        </div>
      </SurfaceCard>

      <SurfaceCard class-name="space-y-4">
        <SectionHeader title="Scope tools" subtitle="Session context" />
        <div class="grid gap-3 md:grid-cols-2">
          <UInput v-model="sessionKey" placeholder="session_key" />
          <UInput v-model="scopeKey" placeholder="scope_key" />
        </div>
        <div class="flex flex-wrap gap-2">
          <UButton label="Resolve session scope" color="neutral" variant="soft" class="or3-touch-target" :loading="memoryLoading" @click="resolveScope(sessionKey)" />
          <UButton label="Link scope" color="primary" class="or3-touch-target" :loading="memoryLoading" @click="linkScope(sessionKey, scopeKey)" />
          <UButton label="List scope sessions" color="neutral" variant="soft" class="or3-touch-target" :loading="memoryLoading" @click="listScopeSessions(scopeKey)" />
        </div>
        <pre class="rounded-2xl border border-(--or3-border) bg-white/70 p-4 text-sm text-(--or3-text-muted)">{{ formatObject(scopeResult) }}</pre>
      </SurfaceCard>

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
