import { computed } from 'vue';
import { useProviderSettings } from '~/composables/settings/useProviderSettings';

export function useChatModelRouting() {
    const settings = useProviderSettings();

    const chatRole = computed(() => settings.providerStatus.value?.roles?.chat);

    const chatProvider = computed(() => {
        const fromRole = String(chatRole.value?.primary?.provider ?? '').trim();
        if (fromRole) return fromRole;
        // Fallback for configs that only populate the legacy provider block:
        // prefer a configured provider, else the first one we know about.
        const providers = settings.providerStatus.value?.providers ?? [];
        const configured = providers.find((item) => item.apiKeyConfigured);
        return String((configured ?? providers[0])?.key ?? '').trim();
    });

    const defaultChatModel = computed(() =>
        String(chatRole.value?.primary?.model ?? '').trim(),
    );

    async function ensureLoaded() {
        if (!settings.providerStatus.value) {
            await settings.loadProviders();
        }
    }

    return {
        settings,
        chatProvider,
        defaultChatModel,
        ensureLoaded,
    };
}
