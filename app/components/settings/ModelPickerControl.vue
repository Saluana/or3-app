<template>
    <div class="space-y-2">
        <!--
            Compact trigger: shows the currently chosen model and opens a
            popover for browsing/searching/favoriting. Keeps each role row
            small enough to stack many of them in one settings page.
        -->
        <UPopover
            :content="{ align: 'start', sideOffset: 8 }"
            :ui="{ content: 'w-[min(28rem,calc(100vw-2rem))] p-0' }"
            @update:open="onOpenChange"
        >
            <button
                type="button"
                class="flex w-full items-center justify-between gap-2 rounded-lg border border-(--or3-border) bg-white/70 px-3 py-2 text-left transition hover:border-(--or3-green) focus:border-(--or3-green) focus:outline-none"
            >
                <span class="flex min-w-0 flex-1 items-center gap-2">
                    <Icon
                        v-if="isFavorite"
                        name="i-pixelarticons-heart"
                        class="size-3.5 shrink-0 text-rose-600"
                    />
                    <span
                        v-if="currentLabel"
                        class="truncate font-mono text-xs text-(--or3-text)"
                    >
                        {{ currentLabel }}
                    </span>
                    <span v-else class="truncate text-xs italic text-(--or3-text-muted)">
                        No model selected
                    </span>
                </span>
                <Icon
                    name="i-pixelarticons-chevron-down"
                    class="size-4 shrink-0 text-(--or3-text-muted)"
                />
            </button>

            <template #content>
                <div class="space-y-2 p-3">
                    <p
                        v-if="!provider"
                        class="rounded-lg border border-dashed border-(--or3-border) bg-white/60 px-3 py-2 text-xs leading-5 text-(--or3-text-muted)"
                    >
                        Pick a provider for this role first.
                    </p>
                    <template v-else>
                        <div class="flex gap-2">
                            <UInput
                                v-model="query"
                                class="min-w-0 flex-1"
                                size="sm"
                                placeholder="Search or paste a model ID"
                                icon="i-pixelarticons-search"
                                :ui="{ base: 'font-mono text-xs' }"
                                @keydown.enter="commitManual"
                            />
                            <UButton
                                size="sm"
                                icon="i-pixelarticons-reload"
                                variant="outline"
                                :loading="loading"
                                aria-label="Refresh model list"
                                @click="load(true)"
                            />
                        </div>

                        <div v-if="favoriteModels.length" class="flex flex-wrap gap-1.5">
                            <button
                                v-for="fav in favoriteModels"
                                :key="fav.model"
                                type="button"
                                class="inline-flex items-center gap-1 rounded-full border px-2 py-0.5 font-mono text-[11px] transition"
                                :class="String(currentValue) === fav.model ? 'border-(--or3-green) bg-(--or3-green-soft) text-(--or3-text)' : 'border-(--or3-border) bg-white/75 text-(--or3-text) hover:border-(--or3-green)'"
                                @click="choose(fav.model)"
                            >
                                <Icon name="i-pixelarticons-heart" class="size-3 text-rose-600" />
                                {{ fav.label || fav.model }}
                            </button>
                        </div>

                        <div class="max-h-64 overflow-y-auto rounded-lg border border-(--or3-border) bg-white/65">
                            <div
                                v-for="model in filteredModels"
                                :key="model.id"
                                class="flex items-start justify-between gap-2 border-b border-(--or3-border) px-3 py-1.5 last:border-b-0 transition"
                                :class="String(currentValue) === model.id ? 'bg-(--or3-green-soft)' : 'hover:bg-(--or3-green-soft)/60 cursor-pointer'"
                                role="button"
                                tabindex="0"
                                @click="choose(model.id)"
                                @keydown.enter.prevent="choose(model.id)"
                            >
                                <span class="min-w-0 flex-1">
                                    <span class="flex items-center gap-1 truncate font-mono text-xs font-semibold text-(--or3-text)">
                                        <Icon
                                            v-if="String(currentValue) === model.id"
                                            name="i-pixelarticons-check"
                                            class="size-3 text-(--or3-green-dark)"
                                        />
                                        {{ model.name || model.id }}
                                    </span>
                                    <span class="block truncate text-[10px] text-(--or3-text-muted)">
                                        {{ model.id }}<template v-if="model.contextLength"> · {{ model.contextLength.toLocaleString() }} ctx</template>
                                    </span>
                                </span>
                                <button
                                    type="button"
                                    class="shrink-0 rounded-full px-1 py-0.5"
                                    :title="favoriteSet.has(model.id) ? 'Remove from favorites' : 'Add to favorites'"
                                    @click.stop="toggleFavorite(model)"
                                >
                                    <Icon
                                        name="i-pixelarticons-heart"
                                        class="size-3.5 transition"
                                        :class="favoriteSet.has(model.id) ? 'text-rose-600' : 'text-(--or3-text-muted) opacity-50 hover:opacity-100'"
                                    />
                                </button>
                            </div>
                            <p v-if="!filteredModels.length" class="px-3 py-2 text-[11px] leading-5 text-(--or3-text-muted)">
                                <template v-if="loading">Loading models…</template>
                                <template v-else-if="error">{{ error }}</template>
                                <template v-else-if="models.length === 0">
                                    No cached models. Try refresh, or press Enter on a typed ID to use it anyway.
                                </template>
                                <template v-else>
                                    Nothing matches "{{ query }}". Press Enter to use it as a model ID anyway.
                                </template>
                            </p>
                        </div>

                        <div class="flex items-center justify-between gap-2 pt-1">
                            <UButton
                                size="xs"
                                variant="ghost"
                                :icon="isFavorite ? 'i-pixelarticons-heart' : 'i-pixelarticons-heart'"
                                :color="isFavorite ? 'error' : 'neutral'"
                                :disabled="!currentValue"
                                :label="isFavorite ? 'Remove favorite' : 'Favorite current'"
                                @click="toggleCurrentFavorite"
                            />
                            <p v-if="error && filteredModels.length" class="truncate text-[11px] text-rose-700">
                                {{ error }}
                            </p>
                        </div>
                    </template>
                </div>
            </template>
        </UPopover>
    </div>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import type { SimpleSettingChange, SimpleSettingControl } from '~/settings/simpleSettings'
import type { ModelCatalogItem } from '~/composables/settings/useProviderSettings'
import { useProviderSettings } from '~/composables/settings/useProviderSettings'

const props = defineProps<{
    control: SimpleSettingControl
    currentValue: unknown
    valueIndex: Record<string, unknown>
    pendingChanges: SimpleSettingChange[]
}>()

const emit = defineEmits<{
    change: [change: SimpleSettingChange]
}>()

const settings = useProviderSettings()
const query = ref('')
const models = ref<ModelCatalogItem[]>([])
const loading = ref(false)
const error = ref('')
const hasLoaded = ref(false)

const roleProviderField = computed(() => {
    switch (props.control.modelRole) {
        case 'agents':
            return 'agentsProvider'
        case 'subagents':
            return 'subagentsProvider'
        case 'summarization':
            return 'summarizationProvider'
        case 'contextManager':
            return 'contextProvider'
        case 'embeddings':
            return 'embeddingsProvider'
        default:
            return 'chatProvider'
    }
})

const provider = computed(() => {
    const pending = props.pendingChanges.find(
        (change) => change.section === 'routing' && change.field === roleProviderField.value,
    )
    return String(
        pending?.value
            ?? props.valueIndex[`routing.${roleProviderField.value}`]
            ?? props.valueIndex['provider.kind']
            ?? '',
    ).trim()
})

const providerStatus = computed(() =>
    settings.providerStatus.value?.providers.find((item) => item.key === provider.value),
)
const favoriteModels = computed(() => providerStatus.value?.favorites ?? [])
const favoriteSet = computed(() => new Set(favoriteModels.value.map((item) => item.model)))
const isFavorite = computed(() => favoriteSet.value.has(String(props.currentValue ?? '').trim()))

const currentLabel = computed(() => {
    const id = String(props.currentValue ?? '').trim()
    if (!id) return ''
    const fav = favoriteModels.value.find((item) => item.model === id)
    if (fav?.label) return `${fav.label} · ${id}`
    const known = models.value.find((item) => item.id === id)
    if (known?.name && known.name !== id) return `${known.name} · ${id}`
    return id
})

const filteredModels = computed(() => {
    const q = query.value.trim().toLowerCase()
    const favs = favoriteSet.value
    return [...models.value]
        .sort((a, b) => Number(favs.has(b.id)) - Number(favs.has(a.id)) || a.id.localeCompare(b.id))
        .filter((model) => {
            if (!q) return true
            return model.id.toLowerCase().includes(q) || (model.name ?? '').toLowerCase().includes(q)
        })
        .slice(0, 80)
})

function primaryRef() {
    return props.control.fieldRefs[0]
}

function choose(model: string) {
    const ref = primaryRef()
    if (!ref) return
    emit('change', { section: ref.section, field: ref.field, channel: ref.channel, value: model })
}

function commitManual() {
    const value = query.value.trim()
    if (!value) return
    choose(value)
    query.value = ''
}

function onOpenChange(open: boolean) {
    if (open && !hasLoaded.value) load(false)
}

async function load(refresh = false) {
    const current = provider.value
    if (!current) return
    loading.value = true
    error.value = ''
    try {
        if (!settings.providerStatus.value) {
            await settings.loadProviders()
        }
        models.value = await settings.loadModels(
            current,
            props.control.modelKind === 'embeddings' ? 'embeddings' : 'chat',
            { refresh, user: current === 'openrouter' },
        )
        hasLoaded.value = true
    } catch (err: any) {
        error.value = friendlyError(err)
        models.value = []
    } finally {
        loading.value = false
    }
}

function friendlyError(err: any): string {
    const message = err?.message || err?.error || 'Could not load models for this provider.'
    const text = String(message)
    if (/missing api base|provider missing api/i.test(text)) {
        return 'This provider has no API base URL configured yet.'
    }
    if (/401|unauthor/i.test(text)) {
        return 'Provider rejected the saved API key. Check it in the provider cards.'
    }
    if (/not configured/i.test(text)) {
        return 'Set this provider up first (API key + base URL).'
    }
    return text
}

async function toggleFavorite(model: ModelCatalogItem) {
    if (!provider.value) return
    try {
        await settings.setFavorite(provider.value, model.id, !favoriteSet.value.has(model.id), model.name)
    } catch (err: any) {
        error.value = friendlyError(err)
    }
}

async function toggleCurrentFavorite() {
    const model = String(props.currentValue ?? '').trim()
    if (!provider.value || !model) return
    try {
        await settings.setFavorite(provider.value, model, !favoriteSet.value.has(model))
    } catch (err: any) {
        error.value = friendlyError(err)
    }
}

// Reset cached load flag if the provider changes so re-opening fetches the
// right list, but don't pre-fetch until the popover opens — that's the whole
// point of the lazy trigger.
watch(provider, () => {
    hasLoaded.value = false
    models.value = []
})
</script>
