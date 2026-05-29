<template>
    <div class="space-y-2">
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
                    <span
                        v-else
                        class="truncate text-xs italic text-(--or3-text-muted)"
                    >
                        {{ emptyLabel }}
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
                        {{ missingProviderMessage }}
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
                                :class="
                                    modelValue === fav.model
                                        ? 'border-(--or3-green) bg-(--or3-green-soft) text-(--or3-text)'
                                        : 'border-(--or3-border) bg-white/75 text-(--or3-text) hover:border-(--or3-green)'
                                "
                                @click="choose(fav.model)"
                            >
                                <Icon
                                    name="i-pixelarticons-heart"
                                    class="size-3 text-rose-600"
                                />
                                {{ fav.label || fav.model }}
                            </button>
                        </div>

                        <div
                            class="max-h-64 overflow-y-auto rounded-lg border border-(--or3-border) bg-white/65"
                        >
                            <div
                                v-for="model in filteredModels"
                                :key="model.id"
                                class="flex items-start justify-between gap-2 border-b border-(--or3-border) px-3 py-1.5 last:border-b-0 transition"
                                :class="
                                    modelValue === model.id
                                        ? 'bg-(--or3-green-soft)'
                                        : 'hover:bg-(--or3-green-soft)/60 cursor-pointer'
                                "
                                role="button"
                                tabindex="0"
                                @click="choose(model.id)"
                                @keydown.enter.prevent="choose(model.id)"
                            >
                                <span class="min-w-0 flex-1">
                                    <span
                                        class="flex items-center gap-1 truncate font-mono text-xs font-semibold text-(--or3-text)"
                                    >
                                        <Icon
                                            v-if="modelValue === model.id"
                                            name="i-pixelarticons-check"
                                            class="size-3 text-(--or3-green-dark)"
                                        />
                                        {{ model.name || model.id }}
                                    </span>
                                    <span
                                        class="block truncate text-[10px] text-(--or3-text-muted)"
                                    >
                                        {{ model.id
                                        }}<template v-if="model.contextLength">
                                            ·
                                            {{
                                                model.contextLength.toLocaleString()
                                            }}
                                            ctx</template
                                        >
                                    </span>
                                </span>
                                <button
                                    type="button"
                                    class="shrink-0 rounded-full px-1 py-0.5"
                                    :title="
                                        favoriteSet.has(model.id)
                                            ? 'Remove from favorites'
                                            : 'Add to favorites'
                                    "
                                    @click.stop="toggleFavorite(model)"
                                >
                                    <Icon
                                        name="i-pixelarticons-heart"
                                        class="size-3.5 transition"
                                        :class="
                                            favoriteSet.has(model.id)
                                                ? 'text-rose-600'
                                                : 'text-(--or3-text-muted) opacity-50 hover:opacity-100'
                                        "
                                    />
                                </button>
                            </div>
                            <p
                                v-if="!filteredModels.length"
                                class="px-3 py-2 text-[11px] leading-5 text-(--or3-text-muted)"
                            >
                                <template v-if="loading">Loading models…</template>
                                <template v-else-if="error">{{ error }}</template>
                                <template v-else-if="models.length === 0">
                                    No cached models. Try refresh, or press Enter on a
                                    typed ID to use it anyway.
                                </template>
                                <template v-else>
                                    Nothing matches "{{ query }}". Press Enter to use
                                    it as a model ID anyway.
                                </template>
                            </p>
                        </div>

                        <div class="flex items-center justify-between gap-2 pt-1">
                            <UButton
                                size="xs"
                                variant="ghost"
                                :icon="'i-pixelarticons-heart'"
                                :color="isFavorite ? 'error' : 'neutral'"
                                :disabled="!modelValue"
                                :label="
                                    isFavorite ? 'Remove favorite' : 'Favorite current'
                                "
                                @click="toggleCurrentFavorite"
                            />
                            <UButton
                                v-if="allowInherit"
                                size="xs"
                                variant="ghost"
                                color="neutral"
                                label="Reuse default"
                                @click="choose('')"
                            />
                            <p
                                v-if="error && filteredModels.length"
                                class="truncate text-[11px] text-rose-700"
                            >
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
import { computed, nextTick } from 'vue';
import { useModelCatalogPicker } from '~/composables/settings/useModelCatalogPicker';

const props = withDefaults(
    defineProps<{
        provider: string;
        modelValue: string;
        modelKind?: 'chat' | 'embeddings';
        emptyLabel?: string;
        missingProviderMessage?: string;
        allowInherit?: boolean;
    }>(),
    {
        modelKind: 'chat',
        emptyLabel: 'No model selected',
        missingProviderMessage: 'Pick a provider first.',
        allowInherit: false,
    },
);

const emit = defineEmits<{
    'update:modelValue': [value: string];
}>();

const picker = useModelCatalogPicker({
    provider: () => props.provider,
    modelKind: () => props.modelKind,
    listLimit: 80,
});

const {
    query,
    models,
    loading,
    error,
    hasLoaded,
    favoriteModels,
    favoriteSet,
    filteredModels,
    load,
    toggleFavorite,
    toggleCurrentFavorite: applyCurrentFavorite,
} = picker;

const isTouchDevice = computed(() => {
    if (!import.meta.client) return false;
    return 'ontouchstart' in window || navigator.maxTouchPoints > 0;
});

const isFavorite = computed(() =>
    favoriteSet.value.has(String(props.modelValue ?? '').trim()),
);

const currentLabel = computed(() => {
    const id = String(props.modelValue ?? '').trim();
    if (!id) return '';
    const fav = favoriteModels.value.find((item) => item.model === id);
    if (fav?.label) return `${fav.label} · ${id}`;
    const known = models.value.find((item) => item.id === id);
    if (known?.name && known.name !== id) return `${known.name} · ${id}`;
    return id;
});

function choose(model: string) {
    emit('update:modelValue', model);
}

function commitManual() {
    const value = query.value.trim();
    if (!value) return;
    choose(value);
    query.value = '';
}

function onOpenChange(open: boolean) {
    if (open && !hasLoaded.value) load(false);
    if (open && isTouchDevice.value) {
        nextTick(() => {
            setTimeout(() => {
                const active = document.activeElement as HTMLElement | null;
                if (active && active.tagName.toLowerCase() === 'input') {
                    active.blur();
                }
            }, 50);
        });
    }
}

function toggleCurrentFavorite() {
    void applyCurrentFavorite(String(props.modelValue ?? '').trim());
}
</script>
