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
                class="rounded-xl border border-(--or3-border) bg-white/65 p-3"
            >
                <div class="flex items-start justify-between gap-3">
                    <div class="min-w-0">
                        <p class="font-mono text-sm font-semibold text-(--or3-text)">
                            {{ provider.label || provider.key }}
                            <span class="ml-1 font-mono text-[10px] uppercase tracking-wide text-(--or3-text-muted)">
                                {{ provider.key }}
                            </span>
                        </p>
                        <p class="mt-1 truncate text-xs text-(--or3-text-muted)">
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
                <div class="mt-3 flex flex-wrap justify-end gap-2">
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
                    class="mt-2 text-xs leading-5"
                    :class="testResults[provider.key]?.ok ? 'text-emerald-700' : 'text-rose-700'"
                >
                    {{ testResults[provider.key]?.message }}
                </p>
            </div>
        </div>

        <div
            v-if="editing"
            class="space-y-3 rounded-xl border border-dashed border-(--or3-border) bg-white/70 p-3"
        >
            <p class="font-mono text-xs font-semibold uppercase tracking-wide text-(--or3-text-muted)">
                {{ editingExistingKey ? `Edit ${editingExistingKey}` : 'Add custom provider' }}
            </p>
            <div class="grid gap-3 sm:grid-cols-2">
                <UFormField label="Name">
                    <UInput v-model="form.label" placeholder="e.g. Local Ollama" />
                </UFormField>
                <UFormField label="Short key" :hint="editingExistingKey ? 'Locked' : 'Letters and numbers only'">
                    <UInput
                        v-model="form.key"
                        placeholder="ollama-local"
                        :disabled="Boolean(editingExistingKey)"
                    />
                </UFormField>
                <UFormField label="API base URL" class="sm:col-span-2">
                    <UInput v-model="form.apiBase" placeholder="https://api.example.com/v1" />
                </UFormField>
                <UFormField
                    label="API key"
                    class="sm:col-span-2"
                    :hint="editingExistingKey ? 'Leave blank to keep the saved key' : ''"
                >
                    <UInput v-model="form.apiKey" type="password" placeholder="sk-…" />
                </UFormField>
                <UFormField label="Default chat model">
                    <UInput v-model="form.defaultChatModel" placeholder="e.g. gpt-4o-mini" />
                </UFormField>
                <UFormField label="Default embedding model">
                    <UInput v-model="form.defaultEmbedModel" placeholder="e.g. text-embedding-3-small" />
                </UFormField>
            </div>
            <p v-if="error" class="text-xs leading-5 text-rose-700">{{ error }}</p>
            <div class="flex flex-wrap items-center justify-between gap-2">
                <UButton
                    v-if="editingExistingKey"
                    size="xs"
                    variant="ghost"
                    color="error"
                    label="Clear saved API key"
                    @click="clearApiKey"
                />
                <span v-else />
                <div class="flex gap-2">
                    <UButton size="sm" variant="ghost" label="Cancel" @click="cancel" />
                    <UButton
                        size="sm"
                        color="primary"
                        :loading="saving"
                        label="Save provider"
                        @click="save"
                    />
                </div>
            </div>
        </div>

        <p v-if="providerError" class="text-xs leading-5 text-rose-700">
            {{ providerError }}
        </p>
    </div>
</template>

<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue'
import type { ProviderProfileStatus } from '~/composables/settings/useProviderSettings'
import { useProviderSettings } from '~/composables/settings/useProviderSettings'

const settings = useProviderSettings()
const editing = ref(false)
const editingExistingKey = ref('')
const saving = ref(false)
const error = ref('')
const testingKey = ref<string>('')
const testResults = ref<Record<string, { ok: boolean; message: string }>>({})

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
    editing.value = true
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
}

function edit(provider: ProviderProfileStatus) {
    editing.value = true
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
}

function cancel() {
    editing.value = false
    error.value = ''
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
        cancel()
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
    if (typeof window !== 'undefined' && !window.confirm(`Delete provider "${key}"? Roles using it will need to be reassigned.`)) {
        return
    }
    saving.value = true
    try {
        await settings.deleteProvider(key)
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
