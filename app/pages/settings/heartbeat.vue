<template>
  <AppShell
    desktop-title="Heartbeat"
    desktop-subtitle="Simple automatic check-ins for your computer."
  >
    <template #sidebar>
      <SettingsSidebar />
    </template>
    <AppHeader subtitle="SETTINGS · HEARTBEAT" />

    <div class="space-y-4 pb-16">
      <SurfaceCard padded class-name="or3-heartbeat-hero">
        <div class="or3-heartbeat-hero__copy">
          <button
            type="button"
            class="or3-heartbeat-back"
            @click="goBack"
          >
            <Icon name="i-pixelarticons-chevron-left" class="size-4" />
            Automations
          </button>

          <div class="flex items-start gap-3">
            <span class="or3-heartbeat-hero__icon">
              <Icon name="tabler:activity-heartbeat" class="size-6" />
            </span>
            <div class="min-w-0 flex-1">
              <div class="flex flex-wrap items-center gap-2">
                <h1 class="or3-heartbeat-hero__title">Automatic check-ins</h1>
                <StatusPill
                  :label="heartbeatEnabled ? 'on' : 'off'"
                  :tone="heartbeatEnabled ? 'green' : 'neutral'"
                />
              </div>
              <p class="or3-heartbeat-hero__subtitle">
                Let OR3 quietly review a standing checklist on its own. You turn it on, choose how often it runs, and write the checklist in plain language.
              </p>
            </div>
          </div>

          <div class="or3-heartbeat-hero__notes">
            <div class="or3-heartbeat-note">
              <Icon name="i-pixelarticons-check" class="size-4" />
              <span>Best for recurring background review.</span>
            </div>
            <div class="or3-heartbeat-note">
              <Icon name="i-pixelarticons-edit" class="size-4" />
              <span>Edit the checklist with the markdown editor you already use elsewhere in OR3.</span>
            </div>
            <div class="or3-heartbeat-note">
              <Icon name="i-pixelarticons-info-box" class="size-4" />
              <span>If you need timed reminders or delivery targets, use scheduled tasks instead.</span>
            </div>
          </div>

          <div class="or3-heartbeat-hero__actions">
            <UButton
              to="/scheduled"
              color="neutral"
              variant="outline"
              icon="i-pixelarticons-clock"
            >
              Scheduled tasks
            </UButton>
          </div>
        </div>
      </SurfaceCard>

      <SurfaceCard class-name="space-y-4" padded>
        <div class="flex items-start gap-3">
          <span class="or3-heartbeat-section-icon">
            <Icon name="i-pixelarticons-zap" class="size-5" />
          </span>
          <div class="min-w-0 flex-1">
            <p class="font-mono text-base font-semibold text-(--or3-text)">
              Heartbeat settings
            </p>
            <p class="mt-1 text-sm leading-6 text-(--or3-text-muted)">
              Keep this simple: turn it on, pick a pace, and OR3 will reread your heartbeat note every time it checks in.
            </p>
          </div>
        </div>

        <div class="grid gap-3 lg:grid-cols-[minmax(0,1fr)_minmax(0,0.9fr)]">
          <label class="or3-heartbeat-field">
            <span>Turn on automatic check-ins</span>
            <div class="or3-heartbeat-switch-row">
              <div>
                <p class="or3-heartbeat-field__value">
                  {{ heartbeatEnabled ? 'Heartbeat is on' : 'Heartbeat is off' }}
                </p>
                <p class="or3-heartbeat-field__hint">
                  {{ heartbeatEnabled ? 'OR3 can review your heartbeat note in the background.' : 'OR3 will not run heartbeat check-ins until you turn this on.' }}
                </p>
              </div>
              <USwitch
                :model-value="heartbeatEnabled"
                color="primary"
                @update:model-value="setHeartbeatEnabled"
              />
            </div>
          </label>

          <label class="or3-heartbeat-field">
            <span>How often should OR3 check in?</span>
            <USelectMenu
              v-model="selectedFrequency"
              :items="frequencyOptions"
              value-key="value"
              size="lg"
              class="or3-heartbeat-select"
            />
            <p class="or3-heartbeat-field__hint">
              {{ frequencyDescription }}
            </p>
            <div v-if="selectedFrequency === 'custom'" class="grid gap-2 sm:grid-cols-[minmax(0,1fr)_auto]">
              <UInput
                v-model.number="customMinutes"
                type="number"
                min="1"
                size="lg"
                placeholder="30"
              />
              <span class="or3-heartbeat-unit">minutes</span>
            </div>
          </label>
        </div>

        <DangerCallout
          v-if="settingsError"
          tone="caution"
          title="Heartbeat settings need attention"
        >
          {{ settingsError }}
        </DangerCallout>

        <div class="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-(--or3-border) bg-white/70 px-4 py-3">
          <p class="text-sm leading-6 text-(--or3-text-muted)">
            {{ settingsSummary }}
          </p>
          <UButton
            color="primary"
            icon="i-pixelarticons-save"
            :loading="savingSettings"
            @click="saveHeartbeatSettings"
          >
            Save heartbeat settings
          </UButton>
        </div>
      </SurfaceCard>

      <SurfaceCard class-name="space-y-4" padded>
        <div class="flex flex-wrap items-start justify-between gap-3">
          <div class="min-w-0 flex-1">
            <div class="flex items-center gap-2">
              <span class="or3-heartbeat-section-icon">
                <Icon name="i-pixelarticons-file-text" class="size-5" />
              </span>
              <p class="font-mono text-base font-semibold text-(--or3-text)">
                Heartbeat note
              </p>
            </div>
            <p class="mt-2 text-sm leading-6 text-(--or3-text-muted)">
              This is the standing note OR3 rereads on each check-in. You do not need markdown training — a plain checklist works great.
            </p>
          </div>
          <StatusPill
            :label="fileExists ? 'saved file' : 'new file'"
            :tone="fileExists ? 'green' : 'amber'"
          />
        </div>

        <div v-if="isDesktop" class="grid gap-3 lg:grid-cols-3">
          <div class="or3-heartbeat-tip-card">
            <p class="or3-heartbeat-tip-card__title">Write simple instructions</p>
            <p class="or3-heartbeat-tip-card__text">
              Use short bullet points like a checklist for what OR3 should review regularly.
            </p>
          </div>
          <div class="or3-heartbeat-tip-card">
            <p class="or3-heartbeat-tip-card__title">Keep it focused</p>
            <p class="or3-heartbeat-tip-card__text">
              Use heartbeat for ongoing review. Use scheduled tasks when you need exact times or message delivery.
            </p>
          </div>
          <div class="or3-heartbeat-tip-card">
            <p class="or3-heartbeat-tip-card__title">Safe to edit anytime</p>
            <p class="or3-heartbeat-tip-card__text">
              OR3 rereads this file every run, so your changes apply automatically.
            </p>
          </div>
        </div>

        <div v-else class="or3-heartbeat-mobile-summary">
          <div class="or3-heartbeat-mobile-summary__icon">
            <Icon name="i-pixelarticons-lightbulb-on" class="size-5" />
          </div>
          <div class="min-w-0 flex-1">
            <p class="or3-heartbeat-mobile-summary__title">Quick tip</p>
            <p class="or3-heartbeat-mobile-summary__text">
              Keep this note short and practical. A few checklist bullets are enough, and your edits apply automatically on the next check-in.
            </p>
          </div>
        </div>

        <SurfaceCard
          v-if="loadingFile"
          class-name="space-y-3"
        >
          <div class="h-8 w-44 animate-pulse rounded-xl bg-(--or3-surface-soft)" />
          <div class="h-72 animate-pulse rounded-3xl bg-(--or3-surface-soft)" />
        </SurfaceCard>

        <DangerCallout
          v-else-if="fileError && !heartbeatDocument"
          tone="caution"
          title="Could not load the heartbeat note"
        >
          {{ fileError }}
        </DangerCallout>

        <MarkdownEditor
          v-else-if="heartbeatDocument"
          class="or3-heartbeat-editor-shell"
          v-model="draftContent"
          :title="'Heartbeat note'"
          :path="heartbeatDocument.path"
          :status-label="editorStatusLabel"
          :metadata-label="editorMetadataLabel"
          :saving="savingFile"
          :read-only="!heartbeatDocument.writable"
          :unsupported-message="editorUnsupportedMessage"
          :conflict-message="editorConflictMessage"
          :autosave="true"
          :initial-mode="'read'"
          :show-back="false"
          @save="saveHeartbeatNote"
          @reload="reloadHeartbeatNote"
          @dismiss-conflict="dismissConflict"
          @dirty-change="editorDirty = $event"
        >
          <template v-if="isDesktop" #topbar-extra>
            <div class="or3-heartbeat-topbar-actions">
              <UButton
                size="xs"
                color="neutral"
                variant="soft"
                icon="i-pixelarticons-reload"
                :disabled="savingFile"
                @click="reloadHeartbeatNote"
              >
                Reload
              </UButton>
              <UButton
                size="xs"
                color="neutral"
                variant="soft"
                icon="i-pixelarticons-magic-wand"
                :disabled="savingFile"
                @click="useStarterTemplate"
              >
                Starter template
              </UButton>
            </div>
          </template>
        </MarkdownEditor>

        <div v-if="heartbeatDocument && !isDesktop" class="or3-heartbeat-mobile-actions">
          <UButton
            size="sm"
            color="neutral"
            variant="soft"
            icon="i-pixelarticons-reload"
            :disabled="savingFile"
            class="or3-heartbeat-mobile-actions__button"
            @click="reloadHeartbeatNote"
          >
            Reload
          </UButton>
          <UButton
            size="sm"
            color="neutral"
            variant="soft"
            icon="i-pixelarticons-magic-wand"
            :disabled="savingFile"
            class="or3-heartbeat-mobile-actions__button"
            @click="useStarterTemplate"
          >
            Starter template
          </UButton>
        </div>
      </SurfaceCard>
    </div>
  </AppShell>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useToast } from '@nuxt/ui/composables'
import type { Or3AppError } from '~/types/app-state'
import type { ConfigureField } from '~/types/or3-api'
import MarkdownEditor from '~/components/computer/MarkdownEditor.vue'
import { useIsDesktop } from '~/composables/useViewport'
import {
  HEARTBEAT_STARTER_TEMPLATE,
  type HeartbeatDocument,
  useHeartbeatFile,
} from '~/composables/useHeartbeatFile'
import { useConfigure } from '~/composables/useConfigure'

const router = useRouter()
const toast = useToast()
const isDesktop = useIsDesktop()
const { fields, loadFields, applyChanges } = useConfigure()
const { loadHeartbeatFile, saveHeartbeatFile } = useHeartbeatFile()

const loadingSettings = ref(true)
const savingSettings = ref(false)
const settingsError = ref<string | null>(null)
const heartbeatEnabled = ref(false)
const heartbeatIntervalSeconds = ref(1800)

const loadingFile = ref(true)
const savingFile = ref(false)
const heartbeatDocument = ref<HeartbeatDocument | null>(null)
const draftContent = ref('')
const fileError = ref<string | null>(null)
const fileSaveError = ref<Or3AppError | null>(null)
const editorDirty = ref(false)

const frequencyOptions = [
  { label: 'Every 15 minutes', value: '900' },
  { label: 'Every 30 minutes', value: '1800' },
  { label: 'Every hour', value: '3600' },
  { label: 'Every 4 hours', value: '14400' },
  { label: 'Once a day', value: '86400' },
  { label: 'Custom', value: 'custom' },
]

const customMinutes = ref(30)

const selectedFrequency = computed({
  get: () => {
    const current = String(heartbeatIntervalSeconds.value || 1800)
    return frequencyOptions.some((option) => option.value === current)
      ? current
      : 'custom'
  },
  set: (value: string) => {
    if (value === 'custom') {
      customMinutes.value = Math.max(1, Math.round((heartbeatIntervalSeconds.value || 1800) / 60))
      return
    }
    heartbeatIntervalSeconds.value = Number(value)
  },
})

const fileExists = computed(() => heartbeatDocument.value?.exists ?? false)
const editorUnsupportedMessage = computed(() => {
  if (fileSaveError.value?.code === 'file_unsupported') return fileSaveError.value.message
  return null
})
const editorConflictMessage = computed(() => fileSaveError.value?.code === 'file_conflict' ? fileSaveError.value.message : null)
const editorStatusLabel = computed(() => {
  if (!heartbeatDocument.value) return ''
  if (!heartbeatDocument.value.exists) return 'Ready to create'
  return editorDirty.value ? 'Saving automatically' : 'Saved to your workspace'
})
const editorMetadataLabel = computed(() => {
  if (!heartbeatDocument.value?.modifiedAt) return 'Workspace heartbeat file'
  return `Updated ${new Date(heartbeatDocument.value.modifiedAt).toLocaleString()}`
})

const settingsSummary = computed(() => {
  const frequency = formatFrequency(heartbeatIntervalSeconds.value)
  if (!heartbeatEnabled.value) {
    return 'Heartbeat is turned off. OR3 will ignore the heartbeat note until you enable it.'
  }
  return `Heartbeat is on and will check in ${frequency}. OR3 rereads your heartbeat note every time it runs.`
})

const frequencyDescription = computed(() => {
  if (selectedFrequency.value === 'custom') {
    return 'Choose a custom number of minutes if the presets do not fit your routine.'
  }
  return 'Pick a pace that feels helpful without being noisy or expensive.'
})

function goBack() {
  router.push('/settings/section/automation')
}

function findAutomationField(fieldKey: string) {
  return fields.value.find((field: ConfigureField) => field.key === fieldKey)
}

function readBoolean(fieldKey: string, fallback = false) {
  const raw = findAutomationField(fieldKey)?.value
  if (typeof raw === 'boolean') return raw
  if (typeof raw === 'string') {
    const normalized = raw.trim().toLowerCase()
    return ['true', '1', 'on', 'yes'].includes(normalized)
  }
  if (typeof raw === 'number') return raw !== 0
  return fallback
}

function readNumber(fieldKey: string, fallback: number) {
  const raw = findAutomationField(fieldKey)?.value
  const next = Number(raw)
  return Number.isFinite(next) && next > 0 ? next : fallback
}

function syncSettingsFromFields() {
  heartbeatEnabled.value = readBoolean('automation_heartbeat_enabled', false)
  heartbeatIntervalSeconds.value = readNumber('automation_heartbeat_interval', 1800)
  if (selectedFrequency.value === 'custom') {
    customMinutes.value = Math.max(1, Math.round(heartbeatIntervalSeconds.value / 60))
  }
}

async function loadHeartbeatSettings() {
  loadingSettings.value = true
  settingsError.value = null
  try {
    await loadFields('automation')
    syncSettingsFromFields()
  } catch (error: any) {
    settingsError.value = error?.message ?? 'Unable to load heartbeat settings.'
  } finally {
    loadingSettings.value = false
  }
}

async function loadHeartbeatNote() {
  loadingFile.value = true
  fileError.value = null
  fileSaveError.value = null
  try {
    const document = await loadHeartbeatFile()
    heartbeatDocument.value = document
    draftContent.value = document.content
    editorDirty.value = false
  } catch (error: any) {
    heartbeatDocument.value = null
    fileError.value = error?.message ?? 'Unable to open the heartbeat note.'
  } finally {
    loadingFile.value = false
  }
}

function setHeartbeatEnabled(value: boolean) {
  heartbeatEnabled.value = value
}

function effectiveHeartbeatIntervalSeconds() {
  if (selectedFrequency.value !== 'custom') {
    return Math.max(60, heartbeatIntervalSeconds.value)
  }
  return Math.max(60, Number(customMinutes.value || 30) * 60)
}

async function saveHeartbeatSettings() {
  savingSettings.value = true
  settingsError.value = null
  try {
    heartbeatIntervalSeconds.value = effectiveHeartbeatIntervalSeconds()
    await applyChanges([
      {
        section: 'automation',
        field: 'automation_heartbeat_enabled',
        op: 'set',
        value: heartbeatEnabled.value,
      },
      {
        section: 'automation',
        field: 'automation_heartbeat_interval',
        op: 'set',
        value: heartbeatIntervalSeconds.value,
      },
    ])
    await loadHeartbeatSettings()
    toast.add({
      title: 'Heartbeat updated',
      description: heartbeatEnabled.value
        ? `OR3 will now check in ${formatFrequency(heartbeatIntervalSeconds.value)}.`
        : 'Heartbeat check-ins are turned off.',
      color: 'success',
    })
  } catch (error: any) {
    settingsError.value = error?.message ?? 'Unable to save heartbeat settings.'
    toast.add({
      title: 'Could not save heartbeat settings',
      description: settingsError.value || undefined,
      color: 'error',
    })
  } finally {
    savingSettings.value = false
  }
}

async function saveHeartbeatNote(reason: 'manual' | 'autosave') {
  if (!heartbeatDocument.value || savingFile.value) return
  savingFile.value = true
  fileSaveError.value = null
  try {
    heartbeatDocument.value = await saveHeartbeatFile(
      heartbeatDocument.value,
      draftContent.value,
    )
    editorDirty.value = false
    if (reason === 'manual') {
      toast.add({
        title: 'Heartbeat note saved',
        description: 'Your automatic check-in instructions are up to date.',
        color: 'success',
      })
    }
  } catch (error: any) {
    fileSaveError.value = error as Or3AppError
    if (reason === 'manual') {
      toast.add({
        title: 'Could not save the heartbeat note',
        description: fileSaveError.value.message,
        color: 'error',
      })
    }
  } finally {
    savingFile.value = false
  }
}

async function reloadHeartbeatNote() {
  await loadHeartbeatNote()
  if (heartbeatDocument.value) {
    toast.add({
      title: 'Heartbeat note reloaded',
      description: 'You are looking at the latest workspace version.',
    })
  }
}

function useStarterTemplate() {
  draftContent.value = HEARTBEAT_STARTER_TEMPLATE
}

function dismissConflict() {
  if (fileSaveError.value?.code === 'file_conflict') {
    fileSaveError.value = null
  }
}

function formatFrequency(seconds: number) {
  if (seconds % 86400 === 0) {
    const days = seconds / 86400
    return days === 1 ? 'once a day' : `every ${days} days`
  }
  if (seconds % 3600 === 0) {
    const hours = seconds / 3600
    return hours === 1 ? 'every hour' : `every ${hours} hours`
  }
  const minutes = Math.max(1, Math.round(seconds / 60))
  return minutes === 1 ? 'every minute' : `every ${minutes} minutes`
}

onMounted(async () => {
  await Promise.all([loadHeartbeatSettings(), loadHeartbeatNote()])
})
</script>

<style scoped>
.or3-heartbeat-hero {
  background:
    radial-gradient(circle at top right, color-mix(in srgb, var(--or3-green-soft) 65%, transparent) 0%, transparent 42%),
    linear-gradient(180deg, color-mix(in srgb, var(--or3-surface) 88%, white 12%) 0%, var(--or3-surface) 100%);
}

.or3-heartbeat-hero__copy {
  display: grid;
  gap: 1rem;
}

.or3-heartbeat-back {
  display: inline-flex;
  width: fit-content;
  align-items: center;
  gap: 0.35rem;
  border-radius: 999px;
  padding: 0.35rem 0.7rem;
  color: var(--or3-green-dark);
  transition: background 140ms ease;
}

.or3-heartbeat-back:hover {
  background: var(--or3-green-soft);
}

.or3-heartbeat-hero__icon,
.or3-heartbeat-section-icon {
  display: grid;
  place-items: center;
  width: 2.75rem;
  height: 2.75rem;
  flex-shrink: 0;
  border-radius: 1rem;
  background: var(--or3-green-soft);
  color: var(--or3-green-dark);
  border: 1px solid color-mix(in srgb, var(--or3-green) 24%, transparent);
}

.or3-heartbeat-hero__title {
  font-family: Georgia, 'Iowan Old Style', 'Times New Roman', serif;
  font-size: 1.65rem;
  line-height: 1.1;
  letter-spacing: -0.03em;
  color: var(--or3-text);
}

.or3-heartbeat-hero__subtitle {
  margin-top: 0.55rem;
  max-width: 62ch;
  font-size: 0.95rem;
  line-height: 1.7;
  color: var(--or3-text-muted);
}

.or3-heartbeat-hero__notes {
  display: grid;
  gap: 0.7rem;
}

.or3-heartbeat-note {
  display: flex;
  align-items: flex-start;
  gap: 0.6rem;
  border-radius: 1rem;
  border: 1px solid var(--or3-border);
  background: rgb(255 255 255 / 0.74);
  padding: 0.8rem 0.95rem;
  font-size: 0.84rem;
  line-height: 1.55;
  color: var(--or3-text);
}

.or3-heartbeat-hero__actions {
  display: flex;
  flex-wrap: wrap;
  gap: 0.75rem;
}

.or3-heartbeat-field {
  display: grid;
  gap: 0.65rem;
  border-radius: 1.25rem;
  border: 1px solid var(--or3-border);
  background: rgb(255 255 255 / 0.72);
  padding: 1rem;
}

.or3-heartbeat-field > span {
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
  font-size: 0.74rem;
  font-weight: 700;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  color: var(--or3-green-dark);
}

.or3-heartbeat-switch-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
}

.or3-heartbeat-field__value {
  font-size: 0.98rem;
  font-weight: 600;
  color: var(--or3-text);
}

.or3-heartbeat-field__hint {
  margin-top: 0.2rem;
  font-size: 0.82rem;
  line-height: 1.55;
  color: var(--or3-text-muted);
}

.or3-heartbeat-select {
  width: 100%;
}

.or3-heartbeat-select :deep(button) {
  min-height: 2.9rem;
  border-radius: 1rem;
}

.or3-heartbeat-unit {
  align-self: center;
  font-size: 0.9rem;
  color: var(--or3-text-muted);
}

.or3-heartbeat-tip-card {
  border-radius: 1.1rem;
  border: 1px solid var(--or3-border);
  background: color-mix(in srgb, var(--or3-surface-soft) 78%, white 22%);
  padding: 0.95rem;
}

.or3-heartbeat-tip-card__title {
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
  font-size: 0.75rem;
  font-weight: 700;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  color: var(--or3-green-dark);
}

.or3-heartbeat-tip-card__text {
  margin-top: 0.5rem;
  font-size: 0.84rem;
  line-height: 1.6;
  color: var(--or3-text-muted);
}

.or3-heartbeat-mobile-summary {
  display: flex;
  align-items: flex-start;
  gap: 0.8rem;
  border-radius: 1.1rem;
  border: 1px solid var(--or3-border);
  background: color-mix(in srgb, var(--or3-surface-soft) 78%, white 22%);
  padding: 0.95rem;
}

.or3-heartbeat-mobile-summary__icon {
  display: grid;
  place-items: center;
  width: 2.35rem;
  height: 2.35rem;
  flex-shrink: 0;
  border-radius: 0.9rem;
  background: var(--or3-green-soft);
  color: var(--or3-green-dark);
}

.or3-heartbeat-mobile-summary__title {
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
  font-size: 0.72rem;
  font-weight: 700;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  color: var(--or3-green-dark);
}

.or3-heartbeat-mobile-summary__text {
  margin-top: 0.35rem;
  font-size: 0.84rem;
  line-height: 1.55;
  color: var(--or3-text-muted);
}

.or3-heartbeat-topbar-actions {
  display: inline-flex;
  align-items: center;
  gap: 0.4rem;
}

.or3-heartbeat-mobile-actions {
  display: grid;
  gap: 0.65rem;
}

.or3-heartbeat-mobile-actions__button {
  width: 100%;
  justify-content: center;
}

@media (max-width: 767px) {
  .or3-heartbeat-switch-row {
    align-items: flex-start;
  }

  .or3-heartbeat-editor-shell :deep(.or3-md-editor) {
    gap: 0.55rem;
  }

  .or3-heartbeat-editor-shell :deep(.or3-md-topbar) {
    top: calc(var(--or3-safe-top) + 0.15rem);
    border-radius: 1rem;
  }

  .or3-heartbeat-editor-shell :deep(.or3-md-topbar-row) {
    gap: 0.35rem;
    padding: 0.4rem 0.45rem;
  }

  .or3-heartbeat-editor-shell :deep(.or3-md-mode-btn) {
    padding-inline: 0.58rem;
  }

  .or3-heartbeat-editor-shell :deep(.or3-md-canvas) {
    min-height: auto;
    padding-top: 0.35rem;
  }

  .or3-heartbeat-editor-shell :deep(.or3-markdown-editor .ProseMirror) {
    min-height: 44vh;
    padding-inline: 0.15rem;
    padding-bottom: 1.35rem;
  }

  .or3-heartbeat-editor-shell :deep(.or3-md-toolbar-wrap) {
    max-width: calc(100vw - 1rem);
  }
}
</style>
