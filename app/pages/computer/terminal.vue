<template>
  <AppShell>
    <AppHeader subtitle="TERMINAL" />
    <div class="space-y-4">
      <SurfaceCard class-name="space-y-4">
        <div class="grid gap-3 sm:grid-cols-2">
          <UFormField label="Root" name="root">
            <USelectMenu
              v-model="selectedRootId"
              value-key="id"
              :items="roots"
              :disabled="starting"
              placeholder="Select a root"
            >
              <template #default>
                <span>{{ selectedRootLabel }}</span>
              </template>
            </USelectMenu>
          </UFormField>

          <UFormField label="Folder" name="path">
            <UInput v-model="selectedPath" placeholder="." :disabled="starting" />
          </UFormField>
        </div>

        <div class="flex flex-wrap gap-2">
          <UButton
            label="Start session"
            icon="i-lucide-play"
            color="primary"
            class="or3-touch-target"
            :loading="starting"
            :disabled="!selectedRootId"
            @click="handleStart"
          />
          <UButton
            label="Refresh roots"
            icon="i-lucide-refresh-cw"
            color="neutral"
            variant="soft"
            class="or3-touch-target"
            :loading="loadingFiles"
            @click="refreshRoots"
          />
          <UButton label="Review approvals" icon="i-lucide-shield-check" to="/approvals" color="neutral" variant="ghost" class="or3-touch-target" />
        </div>

        <p v-if="terminalUnavailable" class="text-sm text-amber-700">
          Terminal mode is disabled on this host. Enable guarded privileged shell access in or3-intern before using this screen.
        </p>
        <p v-else-if="pendingApprovalId" class="text-sm text-amber-700">
          Session creation is waiting on approval request #{{ pendingApprovalId }}.
        </p>
        <p v-if="fileError" class="text-sm text-(--or3-text-muted)">{{ fileError }}</p>
      </SurfaceCard>

      <TerminalPanel
        :session="session"
        :transcript="transcript"
        :busy="starting"
        :streaming="terminalStreaming"
        :error="terminalError"
        @send="handleSend"
        @close="handleClose"
      />
    </div>
  </AppShell>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useRoute } from '#app'
import { useComputerFiles } from '~/composables/useComputerFiles'
import { useTerminalSession } from '~/composables/useTerminalSession'

const route = useRoute()

const {
  roots,
  currentRootId,
  currentPath,
  loadingFiles,
  fileError,
  loadRoots,
} = useComputerFiles()

const {
  session,
  transcript,
  terminalError,
  terminalBusy,
  terminalStreaming,
  terminalUnavailable,
  pendingApprovalId,
  start,
  sendInput,
  close,
} = useTerminalSession()

const selectedRootId = ref('')
const selectedPath = ref('.')

const starting = computed(() => terminalBusy.value)
const selectedRootLabel = computed(() => roots.value.find((root) => root.id === selectedRootId.value)?.label ?? 'Select a root')

async function refreshRoots() {
  await loadRoots()
  selectedRootId.value = typeof route.query.root === 'string' ? route.query.root : currentRootId.value
  selectedPath.value = typeof route.query.path === 'string' ? route.query.path : currentPath.value
}

async function handleStart() {
  await start({
    root_id: selectedRootId.value,
    path: selectedPath.value,
    rows: 28,
    cols: 100,
  })
}

async function handleSend(value: string) {
  await sendInput(value)
}

async function handleClose() {
  await close()
}

onMounted(async () => {
  await refreshRoots()
})
</script>
