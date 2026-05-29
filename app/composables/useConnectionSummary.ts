import { computed, ref } from 'vue';
import { useToast } from '@nuxt/ui/composables';
import { useActiveHost } from '~/composables/useActiveHost';

/**
 * Shared paired/connected copy and disconnect flow for settings pages.
 */
export function useConnectionSummary() {
    const { activeHost, isConnected, isPaired, disconnectActiveHost } =
        useActiveHost();
    const toast = useToast();
    const disconnectConfirmOpen = ref(false);

    const connectionHeadline = computed(() => {
        if (!isPaired.value) return 'No computer paired';
        return isConnected.value
            ? `Connected to ${activeHost.value?.name || 'My Computer'}`
            : `Paired to ${activeHost.value?.name || 'My Computer'}`;
    });

    const connectionDescription = computed(() => {
        if (!isPaired.value) {
            return 'Pair this app to your computer to get started.';
        }
        if (isConnected.value) {
            return 'Your or3-intern app is connected and ready.';
        }
        return 'This app still has a saved pairing, but it cannot reach that computer right now.';
    });

    const connectionPillLabel = computed(() => {
        if (isConnected.value) return 'Connected';
        if (isPaired.value) return 'Connecting…';
        return 'Unavailable';
    });

    const connectionPillTone = computed<'green' | 'amber'>(() =>
        isConnected.value ? 'green' : 'amber',
    );

    function requestDisconnect() {
        disconnectConfirmOpen.value = true;
    }

    function confirmDisconnect() {
        if (!disconnectActiveHost()) return;
        disconnectConfirmOpen.value = false;
        toast.add({
            title: 'Disconnected',
            description:
                'This app forgot the saved computer. Revoke the device on the computer only if you want to remove trust there too.',
            color: 'neutral',
            icon: 'i-pixelarticons-close',
            duration: 7000,
        });
    }

    return {
        activeHost,
        isConnected,
        isPaired,
        connectionHeadline,
        connectionDescription,
        connectionPillLabel,
        connectionPillTone,
        disconnectConfirmOpen,
        requestDisconnect,
        confirmDisconnect,
    };
}
