<template>
  <AppShell>
    <div class="or3-terminal-page">
      <!-- Sticky compact top bar -->
      <div class="or3-terminal-page__bar">
        <NuxtLink
          to="/computer"
          class="or3-terminal-page__back or3-focus-ring"
          aria-label="Back to computer"
        >
          <Icon name="i-pixelarticons-arrow-left" class="size-4" />
        </NuxtLink>

        <div class="or3-terminal-page__crumbs">
          <span class="or3-terminal-page__crumb-icon" aria-hidden="true">
            <Icon name="i-pixelarticons-terminal" class="size-5 text-(--or3-text)" />
          </span>
          <div class="or3-terminal-page__crumbs-text">
            <p class="or3-terminal-page__title">{{ headlineTitle }}</p>
            <p class="or3-terminal-page__sub">{{ headlineSub }}</p>
          </div>
        </div>

        <div class="or3-terminal-page__bar-actions">
          <span
            v-if="session"
            class="or3-terminal-page__pill"
            :data-tone="statusTone"
            :title="`Status: ${statusLabel}`"
          >
            <span class="or3-terminal-page__pill-dot" :class="{ 'is-pulsing': session.status === 'running' }" />
            <span class="or3-terminal-page__pill-label">{{ statusLabel }}</span>
          </span>

          <UDropdownMenu :items="menuItems" :content="{ align: 'end', sideOffset: 10 }">
            <button
              type="button"
              class="or3-terminal-page__menu-btn or3-focus-ring"
              aria-label="Terminal options"
            >
              <Icon name="i-pixelarticons-more-vertical" class="size-4" />
            </button>
          </UDropdownMenu>
        </div>
      </div>

      <!-- Banners (only when relevant; kept tiny) -->
      <div v-if="bannerMessage" class="or3-terminal-page__banner" :data-tone="bannerTone" role="status">
        <Icon :name="bannerIcon" class="size-4 shrink-0" />
        <p class="or3-terminal-page__banner-copy">{{ bannerMessage }}</p>
        <UButton
          v-if="showReconnectAction"
          label="Reconnect"
          icon="i-pixelarticons-reload"
          size="xs"
          color="neutral"
          variant="soft"
          @click="handleReconnect"
        />
      </div>

      <!-- Terminal stage fills remaining space -->
      <TerminalSurface
        ref="surfaceRef"
        class="or3-terminal-page__stage"
        :session="session"
        :chunks="terminalChunks"
        :busy="starting"
        :streaming="terminalStreaming"
        :error="terminalError"
        :interactive="isInteractive"
        :font-size="fontSize"
        :font-size-min="fontSizeMin"
        :font-size-max="fontSizeMax"
        @send="handleKeys"
        @resize="handleResize"
        @close="handleClose"
        @zoom="handleZoom"
      >
        <template v-if="!session" #screen-overlay>
          <div class="or3-terminal-page__setup">
            <div class="or3-terminal-page__setup-card">
              <div class="or3-terminal-page__setup-head">
                <RetroIcon name="i-pixelarticons-terminal" class="text-(--or3-green)" />
                <div>
                  <p class="or3-terminal-page__setup-title">Open a shell</p>
                  <p class="or3-terminal-page__setup-sub">Real PTY on your computer — vim, htop, less all work.</p>
                </div>
              </div>

              <div class="or3-terminal-page__setup-grid">
                <UFormField label="Area" name="root">
                  <USelectMenu
                    v-model="selectedRootId"
                    value-key="id"
                    :items="roots"
                    :disabled="starting"
                    placeholder="Pick an area"
                    size="sm"
                  >
                    <template #default>
                      <span>{{ selectedRootLabel }}</span>
                    </template>
                  </USelectMenu>
                </UFormField>

                <UFormField label="Folder" name="path">
                  <UInput v-model="selectedPath" placeholder="." :disabled="starting" size="sm" />
                </UFormField>
              </div>

              <div class="or3-terminal-page__setup-actions">
                <UButton
                  label="Open terminal"
                  icon="i-pixelarticons-play"
                  color="primary"
                  size="sm"
                  block
                  :loading="starting"
                  :disabled="!selectedRootId"
                  @click="handleStart"
                />
              </div>

              <div v-if="activeSessions.length" class="or3-terminal-page__resume">
                <div class="or3-terminal-page__resume-head">
                  <p class="or3-terminal-page__resume-title">Resume active session</p>
                  <span class="or3-terminal-page__resume-count">{{ activeSessions.length }}</span>
                </div>
                <div class="or3-terminal-page__resume-list">
                  <button
                    v-for="item in activeSessions"
                    :key="item.session_id"
                    type="button"
                    class="or3-terminal-page__resume-item"
                    @click="handleResume(item.session_id)"
                  >
                    <span class="or3-terminal-page__resume-shell">{{ item.shell }}</span>
                    <span class="or3-terminal-page__resume-path">{{ item.cwd }}</span>
                  </button>
                </div>
              </div>

              <p v-if="fileError" class="or3-terminal-page__setup-error">{{ fileError }}</p>
            </div>
          </div>
        </template>
      </TerminalSurface>
    </div>
  </AppShell>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useRoute, useRouter } from '#app'
import { useComputerFiles } from '~/composables/useComputerFiles'
import { useTerminalPrefs } from '~/composables/useTerminalPrefs'
import { useTerminalSession } from '~/composables/useTerminalSession'
import TerminalSurface from '~/components/computer/terminal/TerminalSurface.vue'

const route = useRoute()
const router = useRouter()

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
  activeSessions,
  terminalChunks,
  terminalError,
  terminalBusy,
  terminalStreaming,
  terminalUnavailable,
  pendingApprovalId,
  isInteractive,
  start,
  listSessions,
  attachExistingSession,
  sendKeys,
  resize,
  close,
  reset,
  restoreSession,
  reconnect,
} = useTerminalSession()

const { fontSize, fontSizeMin, fontSizeMax, bumpFontSize } = useTerminalPrefs()

const selectedRootId = ref('')
const selectedPath = ref('.')
const surfaceRef = ref<{ focus: () => void; fit: () => void } | null>(null)

const explicitRouteRoot = computed(() => typeof route.query.root === 'string' ? route.query.root : '')
const explicitRoutePath = computed(() => typeof route.query.path === 'string' ? route.query.path : '')
const wantsFreshLaunch = computed(() => route.query.fresh === '1')

const starting = computed(() => terminalBusy.value)
const selectedRootLabel = computed(
  () => roots.value.find((root) => root.id === selectedRootId.value)?.label ?? 'Select an area',
)

const statusLabel = computed(() => session.value?.status ?? 'idle')
const statusTone = computed(() => {
  switch (session.value?.status) {
    case 'running':
      return 'running'
    case 'failed':
      return 'danger'
    case 'closed':
    case 'expired':
      return 'amber'
    default:
      return 'neutral'
  }
})

const headlineTitle = computed(() => {
  if (session.value) return session.value.shell || 'shell'
  return 'or3-intern terminal'
})

const headlineSub = computed(() => {
  if (session.value) {
    const dims = `${session.value.rows}×${session.value.cols}`
    return `${session.value.cwd} · ${dims}`
  }
  return "Pick an area below to start a guarded shell."
})

const bannerTone = computed(() => {
  if (session.value?.status === 'failed') return 'danger'
  if (session.value && session.value.status !== 'running') return 'amber'
  if (terminalUnavailable.value) return 'amber'
  if (pendingApprovalId.value) return 'info'
  return null
})
const showReconnectAction = computed(() => Boolean(session.value && session.value.status !== 'running'))
const bannerMessage = computed(() => {
  if (session.value?.status === 'failed') return 'This shell stopped unexpectedly. Reconnect to start a fresh session.'
  if (session.value && session.value.status !== 'running') return `This session is ${session.value.status}. Reconnect to open a new shell.`
  if (terminalUnavailable.value) return 'Terminal is off — enable guarded shell access in or3-intern preferences.'
  if (pendingApprovalId.value) return `Waiting on approval #${pendingApprovalId.value}. Open the Approvals screen to allow this terminal.`
  return ''
})
const bannerIcon = computed(() => {
  if (showReconnectAction.value) return 'i-pixelarticons-reload'
  return bannerTone.value === 'amber' ? 'i-pixelarticons-alert' : 'i-pixelarticons-shield'
})

const menuItems = computed(() => {
  const items: any[] = []
  if (showReconnectAction.value) {
    items.push({
      label: 'Reconnect session',
      icon: 'i-pixelarticons-reload',
      onSelect: () => handleReconnect(),
    })
  }
  if (session.value) {
    items.push({
      label: 'Close session',
      icon: 'i-pixelarticons-close',
      onSelect: () => handleClose(),
    })
  }
  items.push({
    label: 'Refresh areas',
    icon: 'i-pixelarticons-reload',
    onSelect: () => refreshRoots(),
  })
  items.push({
    label: 'See pending approvals',
    icon: 'i-pixelarticons-shield',
    to: '/approvals',
  })
  return [items]
})

function logTerminalActionError(action: string, error: unknown) {
  console.error(`[terminal] ${action} failed`, error)
}

async function refreshRoots() {
  await loadRoots()
  selectedRootId.value = explicitRouteRoot.value || currentRootId.value
  selectedPath.value = explicitRoutePath.value || currentPath.value
}

function matchingActiveSession(rootId: string, path: string) {
  return activeSessions.value.find((item) => item.root_id === rootId && (item.path || '.') === path)
}

async function clearFreshLaunchFlag() {
  if (!wantsFreshLaunch.value) return
  const nextQuery = { ...route.query }
  delete nextQuery.fresh
  await router.replace({ path: route.path, query: nextQuery })
}

async function launchFromRouteTarget() {
  const rootId = explicitRouteRoot.value || selectedRootId.value
  const path = explicitRoutePath.value || selectedPath.value || '.'
  if (!rootId) return null

  selectedRootId.value = rootId
  selectedPath.value = path
  reset()

  const existing = matchingActiveSession(rootId, path)
  if (existing?.session_id) {
    const resumed = await attachExistingSession(existing.session_id).catch((error) => {
      logTerminalActionError('resume target session', error)
      return null
    })
    await clearFreshLaunchFlag()
    return resumed
  }

  await start({
    root_id: rootId,
    path,
    rows: 28,
    cols: 100,
  }).catch((error) => logTerminalActionError('start target session', error))
  await clearFreshLaunchFlag()
  return session.value
}

async function handleStart() {
  await start({
    root_id: selectedRootId.value,
    path: selectedPath.value,
    rows: 28,
    cols: 100,
  }).catch((error) => logTerminalActionError('start', error))
}

async function handleResume(sessionId: string) {
  const resumed = await attachExistingSession(sessionId).catch((error) => {
    logTerminalActionError('resume', error)
    return null
  })
  if (!resumed) return
  selectedRootId.value = resumed.root_id || selectedRootId.value
  selectedPath.value = resumed.path || selectedPath.value
}

async function handleReconnect() {
  await reconnect().catch((error) => logTerminalActionError('reconnect', error))
}

async function handleKeys(bytes: string) {
  await sendKeys(bytes).catch((error) => logTerminalActionError('send', error))
}

async function handleResize(rows: number, cols: number) {
  await resize(rows, cols).catch((error) => logTerminalActionError('resize', error))
}

async function handleClose() {
  await close().catch((error) => logTerminalActionError('close', error))
}

function handleZoom(delta: number) {
  bumpFontSize(delta)
}

// Loading indicator hooks (avoid TS complaining about unused symbol)
void loadingFiles

onMounted(async () => {
  await refreshRoots()
  await listSessions().catch((error) => logTerminalActionError('list sessions', error))
  if (wantsFreshLaunch.value) {
    await launchFromRouteTarget()
    return
  }
  const restored = await restoreSession().catch((error) => {
    logTerminalActionError('restore session', error)
    return null
  })
  if (restored) {
    selectedRootId.value = restored.root_id || selectedRootId.value
    selectedPath.value = restored.path || selectedPath.value
  }
})
</script>

<style scoped>
.or3-terminal-page {
  display: flex;
  flex-direction: column;
  flex: 1 1 auto;
  min-height: 0;
  /* Reserve roughly the bottom-nav inset so the terminal fills the rest. */
  height: calc(100dvh - var(--or3-safe-top) - var(--or3-safe-bottom) - 6.5rem);
  gap: 8px;
}

.or3-terminal-page__bar {
  position: sticky;
  top: calc(var(--or3-safe-top) + 0.25rem);
  z-index: 20;
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 6px;
  border-radius: 1.1rem;
  border: 1px solid var(--or3-border);
  background: color-mix(in srgb, var(--or3-surface) 92%, white 8%);
  backdrop-filter: blur(10px);
  box-shadow: 0 1px 0 rgba(255, 255, 255, 0.65) inset, 0 6px 16px rgba(42, 35, 25, 0.04);
}

.or3-terminal-page__back {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 38px;
  height: 38px;
  flex-shrink: 0;
  padding: 0;
  border-radius: 0.9rem;
  color: var(--or3-text);
  background: transparent;
  border: 1px solid transparent;
  transition: background 140ms ease, border-color 140ms ease;
}

.or3-terminal-page__back:hover {
  background: color-mix(in srgb, var(--or3-green-soft) 60%, transparent);
  border-color: color-mix(in srgb, var(--or3-green) 24%, transparent);
}

.or3-terminal-page__crumb-icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 40px;
  height: 40px;
  flex-shrink: 0;
  border-radius: 1rem;
  border: 1px solid var(--or3-border);
  background: color-mix(in srgb, var(--or3-surface) 94%, white 6%);
}

.or3-terminal-page__crumbs {
  display: flex;
  align-items: center;
  gap: 10px;
  flex: 1 1 auto;
  min-width: 0;
}

.or3-terminal-page__crumbs-text {
  min-width: 0;
  display: flex;
  flex-direction: column;
  line-height: 1.15;
}

.or3-terminal-page__title {
  margin: 0;
  font-family: 'JetBrains Mono', 'IBM Plex Mono', ui-monospace, monospace;
  font-size: 13px;
  font-weight: 600;
  color: var(--or3-text);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.or3-terminal-page__sub {
  margin: 0;
  font-size: 11px;
  color: var(--or3-text-muted);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.or3-terminal-page__bar-actions {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  flex-shrink: 0;
}

.or3-terminal-page__pill {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 4px 10px;
  border-radius: 999px;
  background: var(--or3-green-soft);
  border: 1px solid color-mix(in srgb, var(--or3-green) 28%, transparent);
  color: var(--or3-green-dark);
  font-size: 11px;
  font-weight: 600;
  letter-spacing: 0.02em;
  text-transform: lowercase;
  max-width: 110px;
}

.or3-terminal-page__pill-label {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.or3-terminal-page__pill[data-tone="danger"] {
  background: color-mix(in srgb, var(--or3-danger) 12%, var(--or3-surface) 88%);
  border-color: color-mix(in srgb, var(--or3-danger) 30%, transparent);
  color: var(--or3-danger);
}

.or3-terminal-page__pill[data-tone="amber"] {
  background: color-mix(in srgb, var(--or3-amber) 14%, var(--or3-surface) 86%);
  border-color: color-mix(in srgb, var(--or3-amber) 30%, transparent);
  color: var(--or3-amber);
}

.or3-terminal-page__pill[data-tone="neutral"] {
  background: var(--or3-surface);
  border-color: var(--or3-border);
  color: var(--or3-text-muted);
}

.or3-terminal-page__pill-dot {
  width: 6px;
  height: 6px;
  border-radius: 999px;
  background: currentColor;
}

.or3-terminal-page__pill-dot.is-pulsing {
  animation: or3-terminal-pulse 1.6s ease-in-out infinite;
}

@keyframes or3-terminal-pulse {
  0%, 100% { opacity: 0.5; transform: scale(0.85); }
  50% { opacity: 1; transform: scale(1); }
}

.or3-terminal-page__menu-btn {
  width: 36px;
  height: 36px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border-radius: 0.85rem;
  background: transparent;
  border: 1px solid transparent;
  color: var(--or3-text);
  transition: background 140ms ease, border-color 140ms ease;
}

.or3-terminal-page__menu-btn:hover {
  background: color-mix(in srgb, var(--or3-green-soft) 60%, transparent);
  border-color: color-mix(in srgb, var(--or3-green) 24%, transparent);
}

.or3-terminal-page__banner {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 12px;
  border-radius: 0.9rem;
  font-size: 12.5px;
  border: 1px solid;
}

.or3-terminal-page__banner-copy {
  flex: 1 1 auto;
  min-width: 0;
}

.or3-terminal-page__banner[data-tone="danger"] {
  background: color-mix(in srgb, var(--or3-danger) 10%, var(--or3-surface) 90%);
  border-color: color-mix(in srgb, var(--or3-danger) 35%, transparent);
  color: var(--or3-danger);
}

.or3-terminal-page__banner[data-tone="amber"] {
  background: color-mix(in srgb, var(--or3-amber) 10%, var(--or3-surface) 90%);
  border-color: color-mix(in srgb, var(--or3-amber) 35%, transparent);
  color: color-mix(in srgb, var(--or3-amber) 80%, var(--or3-text) 20%);
}

.or3-terminal-page__banner[data-tone="info"] {
  background: color-mix(in srgb, var(--or3-green) 8%, var(--or3-surface) 92%);
  border-color: color-mix(in srgb, var(--or3-green) 28%, transparent);
  color: var(--or3-text);
}

.or3-terminal-page__stage {
  display: flex;
  flex: 1 1 auto;
  min-height: 0;
}

@media (max-width: 420px) {
  .or3-terminal-page__pill {
    padding-inline: 8px;
    max-width: 86px;
  }

  .or3-terminal-page__sub {
    font-size: 10.5px;
  }
}

/* Empty-state setup overlay sits inside the terminal screen */
.or3-terminal-page__setup {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 16px;
  pointer-events: none;
}

.or3-terminal-page__setup-card {
  pointer-events: auto;
  width: 100%;
  max-width: 360px;
  display: flex;
  flex-direction: column;
  gap: 12px;
  padding: 14px;
  background: color-mix(in srgb, var(--or3-surface) 96%, transparent);
  border: 1px solid var(--or3-border);
  border-radius: var(--or3-radius-card);
  box-shadow: 0 16px 32px rgba(22, 26, 20, 0.18);
  backdrop-filter: blur(8px);
}

.or3-terminal-page__setup-head {
  display: flex;
  align-items: flex-start;
  gap: 10px;
}

.or3-terminal-page__setup-title {
  margin: 0;
  font-size: 14px;
  font-weight: 600;
  color: var(--or3-text);
  font-family: 'JetBrains Mono', 'IBM Plex Mono', ui-monospace, monospace;
}

.or3-terminal-page__setup-sub {
  margin: 2px 0 0;
  font-size: 12px;
  color: var(--or3-text-muted);
  line-height: 1.35;
}

.or3-terminal-page__setup-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 8px;
}

.or3-terminal-page__setup-actions {
  display: flex;
}

.or3-terminal-page__setup-error {
  margin: 0;
  font-size: 12px;
  color: var(--or3-danger);
}

.or3-terminal-page__resume {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding-top: 2px;
}

.or3-terminal-page__resume-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}

.or3-terminal-page__resume-title {
  margin: 0;
  font-size: 12px;
  font-weight: 600;
  color: var(--or3-text);
}

.or3-terminal-page__resume-count {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 22px;
  height: 22px;
  padding: 0 6px;
  border-radius: 999px;
  background: var(--or3-green-soft);
  color: var(--or3-green-dark);
  font-size: 11px;
  font-weight: 700;
}

.or3-terminal-page__resume-list {
  display: flex;
  flex-direction: column;
  gap: 6px;
  max-height: 126px;
  overflow-y: auto;
}

.or3-terminal-page__resume-item {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 2px;
  width: 100%;
  padding: 9px 10px;
  border-radius: 12px;
  border: 1px solid var(--or3-border);
  background: color-mix(in srgb, var(--or3-surface) 92%, white 8%);
  text-align: left;
}

.or3-terminal-page__resume-shell {
  font-size: 12px;
  font-weight: 600;
  color: var(--or3-text);
  font-family: 'JetBrains Mono', 'IBM Plex Mono', ui-monospace, monospace;
}

.or3-terminal-page__resume-path {
  width: 100%;
  font-size: 11px;
  color: var(--or3-text-muted);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
</style>
