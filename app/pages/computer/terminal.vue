<template>
  <AppShell>
    <AppHeader subtitle="TERMINAL" />
    <div class="space-y-4">
      <SurfaceCard class-name="space-y-4">
        <div class="flex items-start gap-3">
          <RetroIcon name="i-pixelarticons-terminal" />
          <div>
            <p class="font-mono text-base font-semibold text-(--or3-text)">Run commands on your computer</p>
            <p class="mt-1 text-sm leading-6 text-(--or3-text-muted)">
              A real shell with full TUI support — vim, htop, less and friends all work.
            </p>
          </div>
        </div>

        <DangerCallout tone="danger" title="This is your real computer">
          Anything you type runs on your actual computer. Don't paste commands you don't understand. or3-intern won't undo mistakes for you.
        </DangerCallout>

        <div class="grid gap-3 sm:grid-cols-2">
          <UFormField
            label="Which area of your computer"
            name="root"
            description="or3-intern only allows terminals inside areas you've approved."
          >
            <USelectMenu
              v-model="selectedRootId"
              value-key="id"
              :items="roots"
              :disabled="starting"
              placeholder="Pick an area"
            >
              <template #default>
                <span>{{ selectedRootLabel }}</span>
              </template>
            </USelectMenu>
          </UFormField>

          <UFormField
            label="Folder to start in"
            name="path"
            description="Use a dot to start at the top of the area."
          >
            <UInput v-model="selectedPath" placeholder="." :disabled="starting" />
          </UFormField>
        </div>

        <div class="flex flex-wrap gap-2">
          <UButton
            label="Open terminal"
            icon="i-pixelarticons-play"
            color="primary"
            class="or3-touch-target"
            :loading="starting"
            :disabled="!selectedRootId"
            @click="handleStart"
          />
          <UButton
            label="Refresh areas"
            icon="i-pixelarticons-reload"
            color="neutral"
            variant="soft"
            class="or3-touch-target"
            :loading="loadingFiles"
            @click="refreshRoots"
          />
          <UButton label="See pending approvals" icon="i-pixelarticons-shield" to="/approvals" color="neutral" variant="ghost" class="or3-touch-target" />
        </div>

        <DangerCallout v-if="terminalUnavailable" tone="caution" title="Terminal is turned off">
          The terminal feature isn't enabled on this computer. Turn on guarded shell access in or3-intern preferences first.
        </DangerCallout>
        <DangerCallout v-else-if="pendingApprovalId" tone="info" title="Waiting for your okay">
          or3-intern is waiting for you to approve request #{{ pendingApprovalId }} on the Approvals screen.
        </DangerCallout>
        <p v-if="fileError" class="text-sm text-(--or3-text-muted)">{{ fileError }}</p>
      </SurfaceCard>

      <TerminalSurface
        :session="session"
        :chunks="terminalChunks"
        :busy="starting"
        :streaming="terminalStreaming"
        :error="terminalError"
        :font-size="fontSize"
        :font-size-min="fontSizeMin"
        :font-size-max="fontSizeMax"
        @send="handleKeys"
        @resize="handleResize"
        @close="handleClose"
        @zoom="handleZoom"
      />
    </div>
  </AppShell>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useRoute } from '#app'
import { useComputerFiles } from '~/composables/useComputerFiles'
import { useTerminalPrefs } from '~/composables/useTerminalPrefs'
import { useTerminalSession } from '~/composables/useTerminalSession'
import TerminalSurface from '~/components/computer/terminal/TerminalSurface.vue'

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
  terminalChunks,
  terminalError,
  terminalBusy,
  terminalStreaming,
  terminalUnavailable,
  pendingApprovalId,
  start,
  sendKeys,
  resize,
  close,
} = useTerminalSession()

const { fontSize, fontSizeMin, fontSizeMax, bumpFontSize } = useTerminalPrefs()

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
  }).catch(() => {})
}

async function handleKeys(bytes: string) {
  await sendKeys(bytes).catch(() => {})
}

async function handleResize(rows: number, cols: number) {
  await resize(rows, cols).catch(() => {})
}

async function handleClose() {
  await close().catch(() => {})
}

function handleZoom(delta: number) {
  bumpFontSize(delta)
}

onMounted(async () => {
  await refreshRoots()
})
</script>
