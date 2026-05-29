<template>
    <ConnectionSummaryCard
        :headline="resolvedHeadline"
        :description="resolvedDescription"
        :active-host="activeHost"
        :is-paired="isPaired"
        :is-connected="isConnected"
        :pill-label="connectionPillLabel"
        :pill-tone="connectionPillTone"
        :stats="stats"
        :host-mode="hostMode"
        :host-base-url="hostBaseUrl"
        :unpaired-layout="unpairedLayout"
        @disconnect="requestDisconnect"
    />

    <DestructiveActionConfirmModal
        v-model:open="disconnectConfirmOpen"
        title="Disconnect this app?"
        :item-name="activeHost?.name || 'This computer'"
        consequence="This app will forget the saved computer and stop using its chat and computer tools."
        undo-availability="There is no undo in this app. You can pair this app again later. Trusted device records on the computer stay there until revoked."
        confirm-label="Disconnect"
        @confirm="confirmDisconnect"
    />
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { useConnectionSummary } from '~/composables/useConnectionSummary';

const props = withDefaults(
    defineProps<{
        unpairedLayout?: 'large' | 'compact';
        headline?: string;
        description?: string;
        stats?: Array<{
            label: string;
            value: string;
            icon: string;
            tone?: string;
        }>;
        hostMode?: boolean;
        hostBaseUrl?: string;
    }>(),
    {
        unpairedLayout: 'compact',
        hostMode: false,
    },
);

const {
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
} = useConnectionSummary();

const resolvedHeadline = computed(
    () => props.headline ?? connectionHeadline.value,
);
const resolvedDescription = computed(
    () => props.description ?? connectionDescription.value,
);
</script>
