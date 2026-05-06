import { ref } from 'vue'
import { useAuthSession } from '~/composables/useAuthSession'
import { useOr3Api } from '~/composables/useOr3Api'

export interface ProviderFavoriteModel {
    model: string
    label?: string
}

export interface ProviderProfileStatus {
    key: string
    label?: string
    apiBase?: string
    apiKeyConfigured?: boolean
    timeoutSeconds?: number
    enableVision?: boolean
    defaultChatModel?: string
    defaultEmbedModel?: string
    defaultDimensions?: number
    favorites?: ProviderFavoriteModel[]
}

export interface ModelCatalogItem {
    id: string
    name?: string
    description?: string
    provider?: string
    contextLength?: number
    inputModalities?: string[]
    outputModalities?: string[]
    pricing?: Record<string, unknown>
}

export interface ProviderStatusResponse {
    providers: ProviderProfileStatus[]
    roles: Record<string, unknown>
}

const providerStatus = ref<ProviderStatusResponse | null>(null)
const providerLoading = ref(false)
const providerError = ref<string | null>(null)
// Cache models per (provider|kind|user) to avoid re-fetching on every mount.
const modelCache = new Map<string, { fetchedAt: number; items: ModelCatalogItem[] }>()
const MODEL_CACHE_TTL_MS = 1000 * 60 * 30 // 30 minutes - server caches for 24h.

function cacheKey(provider: string, kind: 'chat' | 'embeddings', user: boolean) {
    return `${provider}|${kind}|${user ? '1' : '0'}`
}

export function useProviderSettings() {
    const api = useOr3Api()
    const authSession = useAuthSession()

    async function loadProviders(force = false) {
        if (providerStatus.value && !force) return providerStatus.value
        providerLoading.value = true
        providerError.value = null
        try {
            providerStatus.value = await api.request<ProviderStatusResponse>(
                '/internal/v1/configure/providers',
            )
            return providerStatus.value
        } catch (error: any) {
            providerError.value = error?.message ?? 'Unable to load providers.'
            throw error
        } finally {
            providerLoading.value = false
        }
    }

    async function saveProvider(
        provider: Partial<ProviderProfileStatus> & {
            key?: string
            apiKey?: string
            clearApiKey?: boolean
        },
    ) {
        const result = await authSession.retryWithAuth(
            (onAuthChallenge) =>
                api.request<{ ok: boolean; provider: string }>(
                    '/internal/v1/configure/providers',
                    { method: 'POST', body: provider, onAuthChallenge },
                ),
            'settings-change',
        )
        await loadProviders(true)
        return result
    }

    async function deleteProvider(key: string) {
        const result = await authSession.retryWithAuth(
            (onAuthChallenge) =>
                api.request<{ ok: boolean }>(
                    `/internal/v1/configure/providers/${encodeURIComponent(key)}`,
                    { method: 'DELETE', onAuthChallenge },
                ),
            'settings-change',
        )
        await loadProviders(true)
        return result
    }

    async function loadModels(
        provider: string,
        kind: 'chat' | 'embeddings',
        options: { refresh?: boolean; user?: boolean } = {},
    ): Promise<ModelCatalogItem[]> {
        const user = Boolean(options.user)
        const key = cacheKey(provider, kind, user)
        const now = Date.now()
        const cached = modelCache.get(key)
        if (cached && !options.refresh && now - cached.fetchedAt < MODEL_CACHE_TTL_MS) {
            return cached.items
        }
        const params = new URLSearchParams({ provider, kind })
        if (options.refresh) params.set('refresh', '1')
        if (user) params.set('user', '1')
        const response = await authSession.retryWithAuth(
            (onAuthChallenge) =>
                api.request<{ items: ModelCatalogItem[]; fetchedAt?: string }>(
                    `/internal/v1/configure/models?${params.toString()}`,
                    { onAuthChallenge },
                ),
            'settings-read',
        )
        const items = response.items ?? []
        modelCache.set(key, { fetchedAt: now, items })
        return items
    }

    async function setFavorite(
        provider: string,
        model: string,
        favorite: boolean,
        label?: string,
    ) {
        const response = await authSession.retryWithAuth(
            (onAuthChallenge) =>
                api.request<{ ok: boolean; favorites: ProviderFavoriteModel[] }>(
                    '/internal/v1/configure/favorite-models',
                    {
                        method: 'POST',
                        body: { provider, model, label, favorite },
                        onAuthChallenge,
                    },
                ),
            'settings-change',
        )
        if (providerStatus.value) {
            const item = providerStatus.value.providers.find((p) => p.key === provider)
            if (item) item.favorites = response.favorites ?? []
        } else {
            await loadProviders(true)
        }
        return response
    }

    async function testProvider(payload: {
        provider: string
        role?: string
        model?: string
    }) {
        return await authSession.retryWithAuth(
            (onAuthChallenge) =>
                api.request<{ ok: boolean; error?: string; transient?: boolean }>(
                    '/internal/v1/configure/test',
                    { method: 'POST', body: payload, onAuthChallenge },
                ),
            'settings-change',
        )
    }

    return {
        providerStatus,
        providerLoading,
        providerError,
        loadProviders,
        saveProvider,
        deleteProvider,
        loadModels,
        setFavorite,
        testProvider,
    }
}
