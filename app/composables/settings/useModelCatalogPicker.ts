import { computed, ref, watch, type MaybeRefOrGetter, toValue } from 'vue';
import type { ModelCatalogItem } from '~/composables/settings/useProviderSettings';
import { useProviderSettings } from '~/composables/settings/useProviderSettings';
import { modelCatalogFriendlyError } from '~/composables/settings/modelCatalogErrors';

export function useModelCatalogPicker(options: {
    provider: MaybeRefOrGetter<string>;
    modelKind?: MaybeRefOrGetter<'chat' | 'embeddings'>;
    listLimit?: number;
    /** Called before loading models (e.g. ensure routing/providers are loaded). */
    prepare?: () => Promise<void>;
}) {
    const settings = useProviderSettings();
    const query = ref('');
    const models = ref<ModelCatalogItem[]>([]);
    const loading = ref(false);
    const error = ref('');
    const hasLoaded = ref(false);

    const provider = computed(() => String(toValue(options.provider) ?? '').trim());
    const modelKind = computed(
        () => toValue(options.modelKind) ?? ('chat' as const),
    );
    const listLimit = options.listLimit ?? 80;

    const providerStatus = computed(() =>
        settings.providerStatus.value?.providers.find(
            (item) => item.key === provider.value,
        ),
    );
    const favoriteModels = computed(
        () => providerStatus.value?.favorites ?? [],
    );
    const favoriteSet = computed(
        () => new Set(favoriteModels.value.map((item) => item.model)),
    );

    const filteredModels = computed(() => {
        const q = query.value.trim().toLowerCase();
        const favs = favoriteSet.value;
        return [...models.value]
            .sort(
                (a, b) =>
                    Number(favs.has(b.id)) - Number(favs.has(a.id)) ||
                    a.id.localeCompare(b.id),
            )
            .filter((model) => {
                if (!q) return true;
                return (
                    model.id.toLowerCase().includes(q) ||
                    (model.name ?? '').toLowerCase().includes(q)
                );
            })
            .slice(0, listLimit);
    });

    const manualCandidate = computed(() => {
        const value = query.value.trim();
        if (!value) return '';
        if (models.value.some((model) => model.id === value)) return '';
        return value;
    });

    async function load(refresh = false) {
        const current = provider.value;
        if (!current) {
            models.value = [];
            return;
        }
        loading.value = true;
        error.value = '';
        try {
            await options.prepare?.();
            if (!settings.providerStatus.value) {
                await settings.loadProviders();
            }
            models.value = await settings.loadModels(current, modelKind.value, {
                refresh,
                user: current === 'openrouter',
            });
            hasLoaded.value = true;
        } catch (err: unknown) {
            error.value = modelCatalogFriendlyError(err);
            models.value = [];
        } finally {
            loading.value = false;
        }
    }

    async function toggleFavorite(model: ModelCatalogItem) {
        const current = provider.value;
        if (!current) return;
        try {
            await settings.setFavorite(
                current,
                model.id,
                !favoriteSet.value.has(model.id),
                model.name,
            );
        } catch (err: unknown) {
            error.value = modelCatalogFriendlyError(err);
        }
    }

    async function toggleCurrentFavorite(modelId: string) {
        const current = provider.value;
        const model = String(modelId ?? '').trim();
        if (!current || !model) return;
        try {
            await settings.setFavorite(
                current,
                model,
                !favoriteSet.value.has(model),
            );
        } catch (err: unknown) {
            error.value = modelCatalogFriendlyError(err);
        }
    }

    watch(provider, () => {
        hasLoaded.value = false;
        models.value = [];
    });

    return {
        settings,
        query,
        models,
        loading,
        error,
        hasLoaded,
        provider,
        providerStatus,
        favoriteModels,
        favoriteSet,
        filteredModels,
        manualCandidate,
        load,
        toggleFavorite,
        toggleCurrentFavorite,
    };
}

export function formatModelCatalogStatusMessage(
    picker: Pick<
        ReturnType<typeof useModelCatalogPicker>,
        | 'loading'
        | 'error'
        | 'provider'
        | 'filteredModels'
        | 'manualCandidate'
        | 'models'
    >,
    query: string,
    options?: { missingProviderHint?: string },
): string {
    if (picker.loading.value) return 'Loading models…';
    if (!picker.provider.value) {
        return (
            options?.missingProviderHint ??
            'No chat provider configured yet. Set one in Advanced Settings → Models.'
        );
    }
    if (picker.error.value) return picker.error.value;
    if (!picker.filteredModels.value.length && !picker.manualCandidate.value) {
        return picker.models.value.length
            ? `Nothing matches “${query}”.`
            : 'No cached models. Refresh, or type a model ID to use it anyway.';
    }
    return '';
}
