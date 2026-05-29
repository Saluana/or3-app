<template>
    <div class="cimp">
        <button
            type="button"
            class="cimp__trigger"
            :aria-expanded="open"
            @click="toggleOpen"
        >
            <span class="cimp__trigger-copy">
                <span class="cimp__trigger-label">{{ triggerLabel }}</span>
                <small class="cimp__trigger-sub">{{ triggerSub }}</small>
            </span>
            <Icon
                name="i-pixelarticons-chevron-down"
                class="size-4 shrink-0 transition-transform"
                :class="open ? 'rotate-180' : ''"
            />
        </button>

        <div v-if="open" class="cimp__panel">
            <div class="cimp__search">
                <Icon
                    name="i-pixelarticons-search"
                    class="size-4 shrink-0 text-(--or3-text-muted)"
                />
                <input
                    v-model="query"
                    type="text"
                    class="cimp__search-input"
                    placeholder="Search or paste a model ID"
                    @keydown.enter.prevent="commitManual"
                />
                <button
                    type="button"
                    class="cimp__icon-btn"
                    :disabled="loading"
                    aria-label="Refresh model list"
                    @click="load(true)"
                >
                    <Icon
                        name="i-pixelarticons-reload"
                        class="size-4"
                        :class="loading ? 'animate-spin' : ''"
                    />
                </button>
            </div>

            <div v-if="favoriteModels.length" class="cimp__favorites">
                <button
                    v-for="fav in favoriteModels"
                    :key="fav.model"
                    type="button"
                    class="cimp__chip"
                    :class="{ 'is-active': modelValue === fav.model }"
                    @click="choose(fav.model)"
                >
                    <Icon
                        name="i-pixelarticons-heart"
                        class="size-3 text-rose-600"
                    />
                    <span class="truncate">{{ fav.label || fav.model }}</span>
                </button>
            </div>

            <div class="cimp__list">
                <button
                    type="button"
                    class="cimp__option"
                    :class="{ 'is-active': !modelValue }"
                    @click="choose('')"
                >
                    <span class="cimp__option-copy">
                        <span class="cimp__option-name">
                            Use default chat model
                        </span>
                        <small class="cimp__option-id">
                            {{ defaultChatModel || 'Provider default' }}
                        </small>
                    </span>
                    <Icon
                        v-if="!modelValue"
                        name="i-pixelarticons-check"
                        class="size-4 shrink-0 text-(--or3-green-dark)"
                    />
                </button>

                <button
                    v-for="model in filteredModels"
                    :key="model.id"
                    type="button"
                    class="cimp__option"
                    :class="{ 'is-active': modelValue === model.id }"
                    @click="choose(model.id)"
                >
                    <span class="cimp__option-copy">
                        <span class="cimp__option-name">
                            {{ model.name || model.id }}
                        </span>
                        <small class="cimp__option-id">
                            {{ model.id
                            }}<template v-if="model.contextLength">
                                · {{ model.contextLength.toLocaleString() }}
                                ctx</template
                            >
                        </small>
                    </span>
                    <span class="cimp__option-actions">
                        <Icon
                            v-if="modelValue === model.id"
                            name="i-pixelarticons-check"
                            class="size-4 shrink-0 text-(--or3-green-dark)"
                        />
                        <span
                            class="cimp__fav-toggle"
                            role="button"
                            tabindex="0"
                            :title="
                                favoriteSet.has(model.id)
                                    ? 'Remove from favorites'
                                    : 'Add to favorites'
                            "
                            @click.stop="toggleFavorite(model)"
                            @keydown.enter.stop.prevent="toggleFavorite(model)"
                        >
                            <Icon
                                name="i-pixelarticons-heart"
                                class="size-4 transition"
                                :class="
                                    favoriteSet.has(model.id)
                                        ? 'text-rose-600'
                                        : 'text-(--or3-text-muted) opacity-40'
                                "
                            />
                        </span>
                    </span>
                </button>

                <button
                    v-if="manualCandidate"
                    type="button"
                    class="cimp__option"
                    @click="choose(manualCandidate)"
                >
                    <span class="cimp__option-copy">
                        <span class="cimp__option-name"
                            >Use “{{ manualCandidate }}”</span
                        >
                        <small class="cimp__option-id">Custom model ID</small>
                    </span>
                </button>

                <p v-if="statusMessage" class="cimp__status">
                    {{ statusMessage }}
                </p>
            </div>
        </div>
    </div>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import {
    formatModelCatalogStatusMessage,
    useModelCatalogPicker,
} from '~/composables/settings/useModelCatalogPicker';
import { useChatModelRouting } from '~/composables/settings/useChatModelRouting';

const props = defineProps<{
    modelValue: string;
}>();

const emit = defineEmits<{
    'update:modelValue': [value: string];
}>();

const { chatProvider, defaultChatModel, ensureLoaded } = useChatModelRouting();

const picker = useModelCatalogPicker({
    provider: () => chatProvider.value,
    modelKind: 'chat',
    listLimit: 60,
    prepare: ensureLoaded,
});

const {
    query,
    models,
    loading,
    favoriteModels,
    favoriteSet,
    filteredModels,
    manualCandidate,
    load,
    toggleFavorite,
} = picker;

const open = ref(false);

const triggerLabel = computed(() => {
    const id = String(props.modelValue ?? '').trim();
    if (!id) return 'Default chat model';
    const known = models.value.find((item) => item.id === id);
    if (known?.name && known.name !== id) return known.name;
    return id;
});

const triggerSub = computed(() => {
    const id = String(props.modelValue ?? '').trim();
    if (!id) return defaultChatModel.value || 'Uses your configured default';
    return id;
});

const statusMessage = computed(() =>
    formatModelCatalogStatusMessage(picker, query.value),
);

function toggleOpen() {
    open.value = !open.value;
    if (open.value) void load(false);
}

function choose(model: string) {
    emit('update:modelValue', model.trim());
    open.value = false;
    query.value = '';
}

function commitManual() {
    const value = query.value.trim();
    if (!value) return;
    choose(value);
}

watch(chatProvider, () => {
    if (open.value) void load(false);
});
</script>

<style scoped>
.cimp {
    display: grid;
    gap: 0.35rem;
}

.cimp__trigger {
    width: 100%;
    min-width: 0;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 0.65rem;
    border: 1px solid var(--or3-border);
    border-radius: 0.8rem;
    background: var(--or3-surface);
    color: var(--or3-text);
    padding: 0.55rem 0.7rem;
    text-align: left;
    transition:
        border-color 0.15s ease,
        background 0.15s ease;
}

.cimp__trigger:hover {
    border-color: color-mix(
        in srgb,
        var(--or3-green-dark) 45%,
        var(--or3-border)
    );
}

.cimp__trigger-copy {
    min-width: 0;
    display: grid;
    gap: 0.1rem;
}

.cimp__trigger-label {
    font-size: 0.9rem;
    font-weight: 750;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
}

.cimp__trigger-sub {
    color: var(--or3-text-muted);
    font-size: 0.72rem;
    font-weight: 600;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
}

.cimp__panel {
    display: grid;
    gap: 0.45rem;
    border: 1px solid var(--or3-border);
    border-radius: 0.9rem;
    background: color-mix(in srgb, white 94%, var(--or3-surface) 6%);
    padding: 0.5rem;
}

.cimp__search {
    display: flex;
    align-items: center;
    gap: 0.45rem;
    border: 1px solid var(--or3-border);
    border-radius: 0.7rem;
    background: var(--or3-surface);
    padding: 0.4rem 0.55rem;
}

.cimp__search-input {
    flex: 1;
    min-width: 0;
    border: 0;
    background: transparent;
    color: var(--or3-text);
    font-size: 0.85rem;
    font-family:
        ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
}

.cimp__search-input:focus {
    outline: none;
}

.cimp__icon-btn {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    color: var(--or3-text-muted);
    border-radius: 0.5rem;
    padding: 0.1rem;
}

.cimp__icon-btn:hover:not(:disabled) {
    color: var(--or3-text);
}

.cimp__icon-btn:disabled {
    opacity: 0.6;
}

.cimp__favorites {
    display: flex;
    flex-wrap: wrap;
    gap: 0.3rem;
}

.cimp__chip {
    display: inline-flex;
    align-items: center;
    gap: 0.25rem;
    max-width: 100%;
    border: 1px solid var(--or3-border);
    border-radius: 999px;
    background: var(--or3-surface);
    color: var(--or3-text);
    font-size: 0.72rem;
    font-weight: 700;
    padding: 0.22rem 0.55rem;
    font-family:
        ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
}

.cimp__chip.is-active {
    border-color: var(--or3-green);
    background: color-mix(in srgb, var(--or3-green-soft) 55%, white 45%);
    color: var(--or3-green-dark);
}

.cimp__list {
    display: grid;
    gap: 0.1rem;
    max-height: 14rem;
    overflow-y: auto;
}

.cimp__option {
    width: 100%;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 0.5rem;
    border: 0;
    border-radius: 0.65rem;
    background: transparent;
    color: var(--or3-text);
    padding: 0.45rem 0.5rem;
    text-align: left;
}

.cimp__option:hover,
.cimp__option.is-active {
    background: color-mix(in srgb, var(--or3-green-soft) 32%, white 68%);
}

.cimp__option-copy {
    min-width: 0;
    display: grid;
    gap: 0.05rem;
}

.cimp__option-name {
    font-size: 0.84rem;
    font-weight: 750;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
}

.cimp__option-id {
    color: var(--or3-text-muted);
    font-size: 0.7rem;
    font-weight: 600;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    font-family:
        ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
}

.cimp__option-actions {
    display: inline-flex;
    align-items: center;
    gap: 0.3rem;
    flex-shrink: 0;
}

.cimp__fav-toggle {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    padding: 0.15rem;
    border-radius: 999px;
}

.cimp__fav-toggle:hover {
    background: color-mix(in srgb, var(--or3-border) 40%, transparent);
}

.cimp__status {
    margin: 0.25rem 0.35rem;
    color: var(--or3-text-muted);
    font-size: 0.72rem;
    line-height: 1.3;
}
</style>
