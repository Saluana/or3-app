<template>
    <div class="space-y-3">
        <div class="flex items-center justify-between gap-2">
            <p class="text-xs leading-5 text-(--or3-text-muted)">
                OpenAI-compatible providers can be used for any model role.
                <span v-if="providerLoading" class="text-(--or3-green-dark)">Loading…</span>
            </p>
            <UButton
                size="sm"
                color="primary"
                variant="soft"
                icon="i-pixelarticons-plus"
                label="Add custom"
                @click="startAdd"
            />
        </div>

        <div class="grid gap-2">
            <div
                v-for="provider in providers"
                :key="provider.key"
                class="group rounded-xl border border-(--or3-border) bg-white/65 p-3 transition hover:border-(--or3-border)/80 hover:bg-white/80"
            >
                <div class="flex items-start justify-between gap-3">
                    <div class="min-w-0">
                        <p class="font-mono text-sm font-semibold text-(--or3-text)">
                            {{ provider.label || provider.key }}
                            <span class="ml-1 font-mono text-[10px] uppercase tracking-wide text-(--or3-text-muted)">
                                {{ provider.key }}
                            </span>
                        </p>
                        <p class="mt-0.5 truncate text-xs text-(--or3-text-muted)">
                            {{ provider.apiBase || 'No API base set' }}
                        </p>
                    </div>
                    <span
                        class="shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide"
                        :class="provider.apiKeyConfigured ? 'border-green-200 bg-green-50 text-green-800' : 'border-amber-200 bg-amber-50 text-amber-800'"
                    >
                        {{ provider.apiKeyConfigured ? 'key set' : 'missing key' }}
                    </span>
                </div>

                <div class="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-(--or3-text-muted)">
                    <span v-if="provider.defaultChatModel">chat: {{ provider.defaultChatModel }}</span>
                    <span v-if="provider.defaultEmbedModel">embeddings: {{ provider.defaultEmbedModel }}</span>
                    <span>{{ provider.favorites?.length ?? 0 }} favorite{{ (provider.favorites?.length ?? 0) === 1 ? '' : 's' }}</span>
                </div>

                <div class="mt-3 flex flex-wrap items-center justify-end gap-1.5">
                    <UButton
                        size="xs"
                        variant="ghost"
                        :loading="testingKey === provider.key"
                        :disabled="!provider.apiKeyConfigured"
                        label="Test"
                        @click="testProvider(provider.key)"
                    />
                    <UButton size="xs" variant="outline" label="Edit" @click="edit(provider)" />
                    <UButton
                        v-if="isCustom(provider.key)"
                        size="xs"
                        color="error"
                        variant="ghost"
                        label="Delete"
                        @click="remove(provider.key)"
                    />
                </div>

                <p
                    v-if="testResults[provider.key]"
                    class="mt-2 break-all text-xs leading-5"
                    :class="testResults[provider.key]?.ok ? 'text-emerald-700' : 'text-rose-700'"
                >
                    {{ testResults[provider.key]?.message }}
                </p>
            </div>
        </div>

        <p v-if="providerError" class="break-all text-xs leading-5 text-rose-700">
            {{ providerError }}
        </p>

        <USlideover
            :open="slideoverOpen"
            :side="slideoverSide"
            :ui="{ content: contentClass }"
            @update:open="(value: boolean) => closeSlideover(value)"
        >
            <template #content>
                <div ref="sheetRef" class="or3-task-sheet" :class="slideoverSide === 'bottom' ? 'is-bottom' : 'is-side'">
                    <div
                        v-if="slideoverSide === 'bottom'"
                        ref="handleRef"
                        class="or3-task-handle"
                        aria-label="Drag down to close"
                        role="button"
                        tabindex="0"
                    >
                        <span />
                    </div>

                    <header class="or3-task-head">
                        <div class="or3-task-head__main">
                            <span class="or3-task-head__icon">
                                <Icon :name="editingExistingKey ? 'i-pixelarticons-edit' : 'i-pixelarticons-plus'" class="size-5" />
                            </span>
                            <div class="or3-task-head__text">
                                <p class="or3-label or3-task-head__eyebrow">
                                    {{ editingExistingKey ? 'EDIT PROVIDER' : 'NEW PROVIDER' }}
                                </p>
                                <h2 class="or3-task-head__title">
                                    {{ editingExistingKey ? `Update ${editingExistingKey}` : 'Add custom provider' }}
                                </h2>
                                <p class="or3-task-head__subtitle">
                                    {{ editingExistingKey ? 'Update connection details and default models.' : 'Connect a new OpenAI-compatible provider to use for any model role.' }}
                                </p>
                            </div>
                        </div>
                        <UButton
                            color="neutral"
                            variant="ghost"
                            icon="i-pixelarticons-close"
                            size="sm"
                            square
                            aria-label="Close"
                            class="or3-task-head__close"
                            @click="closeSlideover(false)"
                        />
                    </header>

                    <div class="or3-task-body">
                        <div class="or3-task-form">
                            <label class="or3-task-field sm:col-span-2">
                                <span>Name</span>
                                <input v-model="form.label" class="or3-task-input" placeholder="e.g. Local Ollama" />
                            </label>

                            <label class="or3-task-field">
                                <span>Short key</span>
                                <input
                                    v-model="form.key"
                                    class="or3-task-input font-mono"
                                    placeholder="ollama-local"
                                    :disabled="Boolean(editingExistingKey)"
                                />
                            </label>

                            <label class="or3-task-field">
                                <span>API base URL</span>
                                <input v-model="form.apiBase" class="or3-task-input" placeholder="https://api.example.com/v1" />
                            </label>

                            <label class="or3-task-field sm:col-span-2">
                                <span>API key {{ editingExistingKey ? '(leave blank to keep saved)' : '' }}</span>
                                <input v-model="form.apiKey" class="or3-task-input" type="password" placeholder="sk-…" />
                            </label>

                            <div v-if="editingExistingKey" class="sm:col-span-2">
                                <button
                                    type="button"
                                    class="text-xs font-medium text-rose-600 transition hover:text-rose-800 hover:underline"
                                    @click="clearApiKey"
                                >
                                    Clear saved API key
                                </button>
                            </div>

                            <label class="or3-task-field">
                                <span>Default chat model</span>
                                <input v-model="form.defaultChatModel" class="or3-task-input" placeholder="e.g. gpt-4o-mini" />
                            </label>

                            <label class="or3-task-field">
                                <span>Default embedding model</span>
                                <input v-model="form.defaultEmbedModel" class="or3-task-input" placeholder="e.g. text-embedding-3-small" />
                            </label>
                        </div>

                        <div v-if="error" class="or3-task-error">
                            <Icon name="i-pixelarticons-alert" class="size-4" />
                            <span>{{ error }}</span>
                        </div>
                    </div>

                    <footer class="or3-task-foot">
                        <p class="or3-task-foot__hint">
                            <Icon name="pixelarticons:lock" class="size-3.5" />
                            Provider keys are stored securely and never exposed after saving.
                        </p>
                        <div class="or3-task-foot__actions">
                            <UButton color="neutral" variant="ghost" size="lg" @click="closeSlideover(false)">Cancel</UButton>
                            <UButton
                                color="primary"
                                variant="solid"
                                size="lg"
                                icon="i-pixelarticons-check"
                                class="or3-task-foot__cta"
                                :loading="saving"
                                @click="save"
                            >
                                {{ editingExistingKey ? 'Save changes' : 'Add provider' }}
                            </UButton>
                        </div>
                    </footer>
                </div>
            </template>
        </USlideover>
        <DestructiveActionConfirmModal
            v-model:open="deleteConfirmOpen"
            title="Delete this provider?"
            :item-name="deleteTargetKey || 'This provider'"
            consequence="Roles using this provider will need to be reassigned before they can work again."
            undo-availability="There is no undo. You can add the provider again later."
            confirm-label="Delete provider"
            :loading="saving"
            :error="error"
            @confirm="confirmRemove"
        />
    </div>
</template>

<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue'
import type { ProviderProfileStatus } from '~/composables/settings/useProviderSettings'
import { useProviderSettings } from '~/composables/settings/useProviderSettings'
import { useIsDesktop } from '~/composables/useViewport'
import { useSheetSwipeDismiss } from '~/composables/useSheetSwipeDismiss'

const settings = useProviderSettings()
const isDesktop = useIsDesktop()

const slideoverOpen = ref(false)
const editingExistingKey = ref('')
const saving = ref(false)
const error = ref('')
const testingKey = ref<string>('')
const testResults = ref<Record<string, { ok: boolean; message: string }>>({})
const deleteConfirmOpen = ref(false)
const deleteTargetKey = ref('')

const slideoverSide = computed<'bottom' | 'right'>(() => (isDesktop.value ? 'right' : 'bottom'))
const contentClass = computed(() =>
    slideoverSide.value === 'bottom'
        ? 'or3-fb-sheet-shell or3-fb-sheet-shell--bottom h-[92dvh] rounded-t-3xl'
        : 'or3-fb-sheet-shell or3-fb-sheet-shell--side sm:max-w-xl',
)

const sheetRef = ref<HTMLElement | null>(null)
const handleRef = ref<HTMLElement | null>(null)
const swipeEnabled = computed(() => slideoverOpen.value && slideoverSide.value === 'bottom')
useSheetSwipeDismiss({
    handle: handleRef,
    sheet: sheetRef,
    enabled: swipeEnabled,
    onDismiss: () => closeSlideover(false),
})

const form = reactive({
    key: '',
    label: '',
    apiBase: '',
    apiKey: '',
    defaultChatModel: '',
    defaultEmbedModel: '',
})

const providers = computed(() => settings.providerStatus.value?.providers ?? [])
const providerError = computed(() => settings.providerError.value)
const providerLoading = computed(() => settings.providerLoading.value)

function isCustom(key: string) {
    return key !== 'openai' && key !== 'openrouter'
}

function normalizeKey(value: string) {
    return value
        .toLowerCase()
        .trim()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '')
}

function startAdd() {
    editingExistingKey.value = ''
    error.value = ''
    Object.assign(form, {
        key: '',
        label: '',
        apiBase: '',
        apiKey: '',
        defaultChatModel: '',
        defaultEmbedModel: '',
    })
    slideoverOpen.value = true
}

function edit(provider: ProviderProfileStatus) {
    editingExistingKey.value = provider.key
    error.value = ''
    Object.assign(form, {
        key: provider.key,
        label: provider.label ?? provider.key,
        apiBase: provider.apiBase ?? '',
        apiKey: '',
        defaultChatModel: provider.defaultChatModel ?? '',
        defaultEmbedModel: provider.defaultEmbedModel ?? '',
    })
    slideoverOpen.value = true
}

function closeSlideover(value: boolean) {
    slideoverOpen.value = value
    if (!value) error.value = ''
}

async function save() {
    error.value = ''
    if (!form.label.trim() && !form.key.trim()) {
        error.value = 'Name is required.'
        return
    }
    if (!form.apiBase.trim()) {
        error.value = 'API base URL is required.'
        return
    }
    const resolvedKey = editingExistingKey.value || normalizeKey(form.key || form.label)
    if (!resolvedKey) {
        error.value = 'Could not derive a short key. Type one explicitly.'
        return
    }
    saving.value = true
    try {
        await settings.saveProvider({
            ...form,
            key: resolvedKey,
        })
        closeSlideover(false)
    } catch (err: any) {
        error.value = err?.message ?? 'Unable to save provider.'
    } finally {
        saving.value = false
    }
}

async function clearApiKey() {
    if (!editingExistingKey.value) return
    saving.value = true
    error.value = ''
    try {
        await settings.saveProvider({
            key: editingExistingKey.value,
            label: form.label,
            apiBase: form.apiBase,
            defaultChatModel: form.defaultChatModel,
            defaultEmbedModel: form.defaultEmbedModel,
            clearApiKey: true,
        })
        form.apiKey = ''
    } catch (err: any) {
        error.value = err?.message ?? 'Unable to clear API key.'
    } finally {
        saving.value = false
    }
}

async function remove(key: string) {
    deleteTargetKey.value = key
    error.value = ''
    deleteConfirmOpen.value = true
}

async function confirmRemove() {
    const key = deleteTargetKey.value
    if (!key) return
    saving.value = true
    try {
        await settings.deleteProvider(key)
        deleteConfirmOpen.value = false
        deleteTargetKey.value = ''
    } catch (err: any) {
        error.value = err?.message ?? 'Unable to delete provider.'
    } finally {
        saving.value = false
    }
}

async function testProvider(key: string) {
    testingKey.value = key
    try {
        const result = await settings.testProvider({ provider: key, role: 'chat' })
        testResults.value = {
            ...testResults.value,
            [key]: result.ok
                ? { ok: true, message: 'Provider responded successfully.' }
                : { ok: false, message: result.error ?? 'Provider returned an error.' },
        }
    } catch (err: any) {
        testResults.value = {
            ...testResults.value,
            [key]: { ok: false, message: err?.message ?? 'Test failed.' },
        }
    } finally {
        testingKey.value = ''
    }
}

onMounted(() => {
    settings.loadProviders().catch(() => {})
})
</script>

<style scoped>
/* ── Sheet shell ────────────────────────────────────────────────── */
.or3-task-sheet {
    display: flex;
    flex-direction: column;
    height: 100%;
    min-height: 0;
}

/* ── Drag handle (mobile) ───────────────────────────────────────── */
.or3-task-handle {
    display: flex;
    align-items: center;
    justify-content: center;
    height: 1.6rem;
    padding: 0.55rem 0 0.4rem;
    cursor: grab;
    touch-action: none;
    user-select: none;
    flex-shrink: 0;
}
.or3-task-handle:active { cursor: grabbing; }
.or3-task-handle span {
    display: block;
    width: 2.6rem;
    height: 5px;
    border-radius: 999px;
    background: color-mix(in srgb, var(--or3-text-muted) 45%, transparent);
    transition: background 140ms ease, width 140ms ease;
}
.or3-task-handle:hover span {
    background: color-mix(in srgb, var(--or3-text-muted) 65%, transparent);
    width: 3rem;
}

/* ── Header ─────────────────────────────────────────────────────── */
.or3-task-head {
    display: flex;
    align-items: flex-start;
    gap: 0.85rem;
    padding: 0.5rem 1.35rem 1rem;
    border-bottom: 1px solid var(--or3-border);
    background: var(--or3-surface);
    flex-shrink: 0;
}
.or3-task-head__main {
    display: flex;
    align-items: flex-start;
    gap: 0.85rem;
    min-width: 0;
    flex: 1 1 auto;
}
.or3-task-head__icon {
    display: grid;
    place-items: center;
    width: 2.85rem;
    height: 2.85rem;
    flex-shrink: 0;
    border-radius: 1rem;
    background: var(--or3-green-soft);
    color: var(--or3-green-dark);
    border: 1px solid color-mix(in srgb, var(--or3-green) 22%, transparent);
    box-shadow: inset 0 0 0 1px rgb(255 255 255 / 0.6);
}
.or3-task-head__text {
    min-width: 0;
    flex: 1 1 auto;
}
.or3-task-head__eyebrow {
    font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
    font-size: 10px;
    font-weight: 700;
    letter-spacing: 0.2em;
    text-transform: uppercase;
    color: var(--or3-green-dark);
}
.or3-task-head__title {
    margin-top: 0.25rem;
    font-family: Georgia, 'Iowan Old Style', 'Times New Roman', serif;
    font-size: 1.35rem;
    font-weight: 700;
    letter-spacing: -0.02em;
    color: var(--or3-text);
    line-height: 1.15;
}
.or3-task-head__subtitle {
    margin-top: 0.35rem;
    font-size: 0.82rem;
    line-height: 1.5;
    color: var(--or3-text-muted);
    max-width: 44ch;
}
.or3-task-head__close {
    flex-shrink: 0;
}

/* ── Body (scrollable) ──────────────────────────────────────────── */
.or3-task-body {
    flex: 1 1 auto;
    min-height: 0;
    overflow-y: auto;
    padding: 1.1rem 1.35rem 0.5rem;
    display: flex;
    flex-direction: column;
    gap: 1rem;
}

/* ── Form grid ──────────────────────────────────────────────────── */
.or3-task-form {
    display: grid;
    gap: 0.85rem;
}
@media (min-width: 640px) {
    .or3-task-form {
        grid-template-columns: repeat(2, minmax(0, 1fr));
        gap: 0.85rem 1rem;
    }
    .or3-task-form .sm\:col-span-2 {
        grid-column: span 2 / span 2;
    }
}

.or3-task-field {
    display: grid;
    gap: 0.45rem;
    font-size: 0.8rem;
    font-weight: 600;
    color: var(--or3-text);
    letter-spacing: -0.005em;
}

.or3-task-input {
    width: 100%;
    border-radius: var(--or3-radius-control);
    border: 1px solid var(--or3-border);
    background: rgb(255 255 255 / 0.85);
    padding: 0.7rem 0.85rem;
    font-family: inherit;
    font-size: 0.92rem;
    font-weight: 500;
    color: var(--or3-text);
    outline: none;
    transition: border-color 140ms ease, box-shadow 140ms ease, background 140ms ease;
    appearance: none;
}

.or3-task-input::placeholder {
    color: color-mix(in srgb, var(--or3-text-muted) 75%, transparent);
}

.or3-task-input:hover {
    border-color: color-mix(in srgb, var(--or3-green) 25%, var(--or3-border) 75%);
}

.or3-task-input:focus {
    border-color: var(--or3-green);
    background: white;
    box-shadow: 0 0 0 3px color-mix(in srgb, var(--or3-green-soft) 80%, transparent);
}

.or3-task-input:disabled {
    opacity: 0.55;
    cursor: not-allowed;
}

/* ── Error ──────────────────────────────────────────────────────── */
.or3-task-error {
    display: flex;
    align-items: flex-start;
    gap: 0.5rem;
    border-radius: var(--or3-radius-control);
    border: 1px solid rgb(254 202 202);
    background: rgb(254 242 242 / 0.9);
    padding: 0.75rem 0.9rem;
    font-size: 0.82rem;
    color: rgb(153 27 27);
}

/* ── Footer ─────────────────────────────────────────────────────── */
.or3-task-foot {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 0.75rem;
    flex-wrap: wrap;
    padding: 0.85rem 1.35rem calc(env(safe-area-inset-bottom, 0px) + 1rem);
    border-top: 1px solid var(--or3-border);
    background: linear-gradient(180deg, color-mix(in srgb, var(--or3-surface) 88%, white 12%) 0%, var(--or3-surface) 100%);
    flex-shrink: 0;
}
.or3-task-foot__hint {
    display: inline-flex;
    align-items: center;
    gap: 0.4rem;
    font-size: 0.74rem;
    line-height: 1.5;
    color: var(--or3-text-muted);
    flex: 1 1 16ch;
    min-width: 12ch;
}
.or3-task-foot__actions {
    display: flex;
    gap: 0.5rem;
    justify-content: flex-end;
    flex-shrink: 0;
    width: 100%;
}
.or3-task-foot__cta {
    box-shadow: 0 6px 18px color-mix(in srgb, var(--or3-green) 30%, transparent);
}
</style>
