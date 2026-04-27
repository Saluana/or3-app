<template>
    <SurfaceCard class-name="space-y-4">
        <div class="flex items-stretch gap-3 sm:gap-4">
            <div class="or3-overview__mascot">
                <RetroComputerMascot
                    :size="112"
                    :sparkle="online"
                    class="or3-overview__mascot-img"
                />
            </div>

            <div class="min-w-0 flex-1 pt-1">
                <p
                    class="or3-command text-[11px] uppercase tracking-[0.18em]"
                >
                    Connected to
                </p>
                <h2
                    class="mt-1 font-mono text-[1.45rem] font-semibold leading-tight text-(--or3-text) sm:text-[1.6rem]"
                >
                    {{ hostName }}
                </h2>
                <div class="mt-2 flex flex-wrap items-center gap-2">
                    <StatusPill
                        :label="statusLabel"
                        :tone="statusTone"
                        :pulse="online"
                    />
                </div>
                <p class="mt-3 text-sm leading-6 text-(--or3-text-muted)">
                    {{ statusMessage }}
                </p>
            </div>
        </div>

        <nav class="or3-overview__tabs">
            <NuxtLink
                v-for="tab in tabs"
                :key="tab.to"
                :to="tab.to"
                class="or3-overview__tab"
                :class="{
                    'or3-overview__tab--active': tab.to === activeTab,
                }"
            >
                <Icon :name="tab.icon" class="size-5" />
                <span>{{ tab.label }}</span>
            </NuxtLink>
        </nav>
    </SurfaceCard>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import type { CapabilitiesResponse, HealthResponse } from '~/types/or3-api';

const props = withDefaults(
    defineProps<{
        hostName?: string;
        baseUrl?: string;
        health?: HealthResponse | null;
        capabilities?: CapabilitiesResponse | null;
        connected?: boolean;
        activeTab?: string;
    }>(),
    {
        hostName: 'No computer paired',
        baseUrl: '',
        health: null,
        capabilities: null,
        connected: false,
        activeTab: '/computer/files',
    },
);

const tabs = [
    { label: 'Files', icon: 'i-lucide-folder', to: '/computer/files' },
    { label: 'Terminal', icon: 'i-lucide-terminal', to: '/computer/terminal' },
    { label: 'Approvals', icon: 'i-lucide-shield-check', to: '/approvals' },
    { label: 'Preferences', icon: 'i-lucide-settings', to: '/settings' },
];

const online = computed(
    () =>
        props.connected &&
        (props.health?.status === 'ok' ||
            props.health?.status === 'healthy'),
);

const statusLabel = computed(() => {
    if (!props.connected) return 'not paired';
    if (online.value) return 'Online';
    if (props.health) return 'check connection';
    return 'connecting…';
});

const statusTone = computed<'green' | 'amber' | 'neutral'>(() => {
    if (!props.connected) return 'neutral';
    if (online.value) return 'green';
    return 'amber';
});

const statusMessage = computed(() => {
    if (!props.connected)
        return 'Pair a computer in Settings to connect or3-intern to your machine.';
    if (online.value)
        return "Everything looks good. You're connected and ready to go.";
    if (props.health)
        return 'Connection trouble — check that or3-intern is running on your computer.';
    return 'Reaching your computer…';
});
</script>

<style scoped>
.or3-overview__mascot {
    flex-shrink: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    width: 120px;
}
.or3-overview__mascot-img {
    width: 100%;
    height: auto;
}

.or3-overview__tabs {
    display: grid;
    grid-template-columns: repeat(4, minmax(0, 1fr));
    gap: 0.4rem;
    padding: 0.4rem;
    border-radius: 18px;
    background: color-mix(in srgb, var(--or3-surface-soft) 70%, white 30%);
    border: 1px solid var(--or3-border);
}

.or3-overview__tab {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 0.3rem;
    padding: 0.55rem 0.25rem;
    border-radius: 14px;
    color: var(--or3-text);
    font-size: 0.78rem;
    font-weight: 500;
    transition:
        background 0.15s ease,
        color 0.15s ease,
        box-shadow 0.15s ease,
        transform 0.15s ease;
    text-decoration: none;
}
.or3-overview__tab :deep(svg) {
    color: var(--or3-text);
}
.or3-overview__tab:hover {
    background: white;
}
.or3-overview__tab:active {
    transform: scale(0.98);
}
.or3-overview__tab--active {
    background: var(--or3-green-soft);
    color: var(--or3-green-dark);
    border: 1px solid color-mix(in srgb, var(--or3-green) 30%, white 70%);
    box-shadow: var(--or3-shadow-soft);
}
.or3-overview__tab--active :deep(svg) {
    color: var(--or3-green-dark);
}
</style>
