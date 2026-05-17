<template>
    <AppShell
        desktop-title="Settings"
        desktop-subtitle="Configure models, memory, runtime, and connection settings."
    >
        <template #sidebar>
            <SettingsSidebar />
        </template>
        <AppHeader subtitle="SETTINGS" />

        <div class="space-y-4">
            <!-- Connection summary card -->
            <SurfaceCard class-name="space-y-4">
                <div class="flex items-start gap-3">
                    <BrandMark size="md" />
                    <div class="min-w-0 flex-1">
                        <div class="flex flex-wrap items-center gap-2">
                            <p
                                class="font-mono text-base font-semibold text-(--or3-text)"
                            >
                                {{ hostMode ? hostHeadline : connectionHeadline }}
                            </p>
                            <StatusPill
                                v-if="isPaired"
                                :label="connectionPillLabel"
                                :tone="connectionPillTone"
                                :pulse="isConnected"
                            />
                        </div>
                        <p
                            class="mt-1 text-sm leading-6 text-(--or3-text-muted)"
                        >
                            {{ hostMode ? hostDescription : connectionDescription }}
                        </p>
                    </div>
                </div>

                <div
                    v-if="isPaired"
                    class="flex overflow-hidden rounded-2xl border border-(--or3-border) bg-white/70"
                >
                    <div
                        v-for="stat in connectionStats"
                        :key="stat.label"
                        class="min-w-1/4 border-(--or3-border) px-3 py-3 text-center not-last:border-r sm:border-r"
                    >
                        <Icon
                            :name="stat.icon"
                            class="mx-auto size-4 text-(--or3-text-muted)"
                        />
                        <p
                            class="mt-2 font-mono text-[10px] font-light uppercase text-(--or3-text-muted)"
                        >
                            {{ stat.label }}
                        </p>
                        <p
                            :class="[
                                'mt-1 truncate font-mono text-[8px] font-extralight ',
                                stat.tone === 'green'
                                    ? 'text-(--or3-green-dark)'
                                    : 'text-(--or3-text)',
                            ]"
                            :title="stat.value"
                        >
                            {{ stat.value }}
                        </p>
                    </div>
                </div>

                <div v-if="hostMode" class="flex flex-wrap items-center gap-2">
                    <code
                        v-if="hostStatus.baseUrl"
                        class="min-w-0 flex-1 truncate rounded-xl border border-(--or3-border) bg-white/70 px-3 py-2 font-mono text-xs text-(--or3-text)"
                        >{{ hostStatus.baseUrl }}</code
                    >
                    <UButton
                        label="Connect devices"
                        icon="i-pixelarticons-smartphone"
                        color="primary"
                        variant="solid"
                        size="sm"
                        class="shrink-0 rounded-full"
                        to="/computer/connect-device"
                    />
                    <UButton
                        label="Trusted devices"
                        icon="i-pixelarticons-shield"
                        color="neutral"
                        variant="soft"
                        size="sm"
                        class="shrink-0 rounded-full"
                        to="/computer/trusted-devices"
                    />
                </div>

                <div v-else-if="isPaired" class="flex flex-wrap items-center gap-2">
                    <code
                        v-if="activeHost?.baseUrl"
                        class="min-w-0 flex-1 truncate rounded-xl border border-(--or3-border) bg-white/70 px-3 py-2 font-mono text-xs text-(--or3-text)"
                        >{{ activeHost.baseUrl }}</code
                    >
                    <UButton
                        label="Pair new computer"
                        icon="i-pixelarticons-link"
                        color="primary"
                        variant="solid"
                        size="sm"
                        class="shrink-0 rounded-full"
                        to="/settings/pair"
                    />
                    <UButton
                        label="Disconnect this app"
                        icon="i-pixelarticons-close"
                        color="neutral"
                        variant="ghost"
                        size="sm"
                        class="shrink-0 rounded-full"
                        @click="disconnectHost"
                    />
                </div>

                <div v-else>
                    <UButton
                        label="Pair new computer"
                        icon="i-pixelarticons-link"
                        color="primary"
                        variant="solid"
                        size="xl"
                        block
                        class="min-h-14 rounded-2xl font-mono text-base shadow-(--or3-shadow-soft)"
                        to="/settings/pair"
                    />
                </div>
            </SurfaceCard>

            <SurfaceCard v-if="isElectron" class-name="space-y-3">
                <div class="flex items-start justify-between gap-3">
                    <div>
                        <p class="font-mono text-base font-semibold text-(--or3-text)">
                            Desktop mode
                        </p>
                        <p class="mt-1 text-sm leading-6 text-(--or3-text-muted)">
                            {{ modeDescription }}
                        </p>
                    </div>
                    <StatusPill :label="hostMode ? 'Use this computer' : 'Control another computer'" :tone="hostMode ? 'green' : 'amber'" />
                </div>
                <div class="flex flex-wrap gap-2">
                    <UButton
                        label="Use this computer"
                        color="primary"
                        variant="soft"
                        :disabled="hostMode"
                        @click="switchDesktopMode('host')"
                    />
                    <UButton
                        label="Control another computer"
                        color="neutral"
                        variant="outline"
                        :disabled="!hostMode"
                        @click="switchDesktopMode('remote')"
                    />
                </div>
                <p v-if="hostMode" class="text-xs leading-5 text-(--or3-text-muted)">
                    Switching to remote mode hides local service controls. If autostart is enabled, review whether the local service should keep running.
                </p>
            </SurfaceCard>

            <SimpleSettingsHome />

            <SurfaceCard
                v-if="latestSnapshot"
                tone="tip"
                class-name="space-y-2"
            >
                <p
                    class="font-mono text-xs uppercase tracking-wide text-(--or3-green-dark)"
                >
                    Last change
                </p>
                <p class="text-xs leading-5 text-(--or3-text)">
                    {{ latestSnapshot.label }} — {{ formattedTime }}
                </p>
                <div class="flex justify-end gap-2">
                    <UButton
                        size="xs"
                        color="neutral"
                        variant="outline"
                        label="Undo last change"
                        icon="i-pixelarticons-undo"
                        :loading="undoing"
                        @click="undoLast"
                    />
                </div>
            </SurfaceCard>
        </div>
    </AppShell>
</template>

<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue';
import { useToast } from '@nuxt/ui/composables';
import { useActiveHost } from '../../composables/useActiveHost';
import { useComputerStatus } from '../../composables/useComputerStatus';
import { useSettingsSnapshots } from '../../composables/settings/useSettingsSnapshots';
import { useSimpleSettings } from '../../composables/settings/useSimpleSettings';
import { useElectronHostSetup } from '../../composables/useElectronHostSetup';
import { createLogger } from '../../utils/logger';

const logger = createLogger('settings');

const { activeHost, isConnected, disconnectActiveHost } = useActiveHost();
const computerStatus = useComputerStatus();
const snapshots = useSettingsSnapshots();
const simple = useSimpleSettings();
const electronHost = useElectronHostSetup();
const toast = useToast();
const undoing = ref(false);

void electronHost.ensureLoaded();

const isElectron = electronHost.isElectron;
const hostMode = electronHost.isElectronHostMode;
const hostStatus = electronHost.serviceStatus;
const hostHeadline = computed(() =>
    hostStatus.value.state === 'online'
        ? 'OR3 is running on this computer'
        : 'This computer is set up for OR3',
);
const hostDescription = computed(() =>
    hostStatus.value.state === 'online'
        ? 'Connect phones, browsers, and remote apps from this desktop host.'
        : 'Start or fix the local OR3 Intern service from the sidebar status card.',
);
const modeDescription = computed(() =>
    hostMode.value
        ? 'This desktop app manages the OR3 Intern service on this computer.'
        : 'This desktop app behaves like web, iOS, and Android clients.',
);

const isPaired = computed(() => Boolean(activeHost.value?.token));
const connectionHeadline = computed(() => {
    if (!isPaired.value) return 'No computer paired';
    return isConnected.value
        ? `Connected to ${activeHost.value?.name || 'My Computer'}`
        : `Paired to ${activeHost.value?.name || 'My Computer'}`;
});
const connectionDescription = computed(() => {
    if (!isPaired.value)
        return 'Pair this app to your computer to get started.';
    if (isConnected.value) return 'Your or3-intern app is connected and ready.';
    return 'This app still has a saved pairing, but it cannot reach that computer right now.';
});
const connectionPillLabel = computed(() =>
    isConnected.value ? 'Connected' : 'Unavailable',
);
const connectionPillTone = computed<'green' | 'amber'>(() =>
    isConnected.value ? 'green' : 'amber',
);
const activeJobCount = computed(
    () => computerStatus.bootstrap.value?.counts?.active_jobs ?? 0,
);
const pendingApprovalCount = computed(
    () => computerStatus.bootstrap.value?.counts?.pending_approvals ?? 0,
);
const activeTerminalCount = computed(
    () => computerStatus.bootstrap.value?.counts?.active_terminals ?? 0,
);

const connectionStats = computed(() => [
    {
        label: 'Mode',
        value: computerStatus.capabilities.value?.runtimeProfile || 'unknown',
        icon: 'i-pixelarticons-terminal',
    },
    {
        label: 'Approvals',
        value:
            pendingApprovalCount.value > 0
                ? `${pendingApprovalCount.value} pending`
                : approvalModeLabel.value,
        icon: 'i-pixelarticons-shield',
        tone: 'green',
    },
    {
        label: 'Jobs',
        value:
            activeJobCount.value === 1
                ? '1 running'
                : `${activeJobCount.value} running`,
        icon: 'i-pixelarticons-briefcase',
        tone: activeJobCount.value > 0 ? 'green' : undefined,
    },
    {
        label: 'Terminals',
        value:
            activeTerminalCount.value === 1
                ? '1 active'
                : `${activeTerminalCount.value} active`,
        icon: 'i-pixelarticons-clock',
        tone: activeTerminalCount.value > 0 ? 'green' : undefined,
    },
]);

const approvalModeLabel = computed(() => {
    const modes = computerStatus.capabilities.value?.approvalModes;
    if (!modes || !Object.keys(modes).length) return 'on';
    const values = Object.values(modes).map((value) => String(value).trim());
    if (values.some((value) => value && value !== 'auto')) return 'on';
    return 'auto';
});

const latestSnapshot = computed(() => snapshots.latest());
const formattedTime = computed(() => {
    const s = latestSnapshot.value;
    if (!s) return '';
    try {
        return new Date(s.createdAt).toLocaleString();
    } catch {
        return s.createdAt;
    }
});

async function refreshConnectionStats() {
    if (!isPaired.value) return;
    if (
        activeHost.value?.status === 'offline' ||
        activeHost.value?.status === 'unauthorized'
    )
        return;
    try {
        await computerStatus.refreshStatus();
    } catch (err) {
        logger.error(
            'connection_stats:failed',
            'Connection stats refresh failed',
            {
                error: err instanceof Error ? err.message : String(err),
            },
        );
    }
}

onMounted(() => {
    void refreshConnectionStats();
});

watch(
    () => activeHost.value?.id,
    () => {
        void refreshConnectionStats();
    },
);

function disconnectHost() {
    if (!disconnectActiveHost()) return;
    toast.add({
        title: 'Disconnected',
        description:
            'This app forgot the saved computer. Revoke the device on the computer only if you want to remove trust there too.',
        color: 'neutral',
        icon: 'i-pixelarticons-close',
        duration: 7000,
    });
}

async function switchDesktopMode(mode: 'host' | 'remote') {
    await electronHost.switchMode(mode);
    if (mode === 'host') {
        toast.add({ title: 'Host setup ready', description: 'Finish setup to use this computer.', color: 'neutral' });
    } else {
        toast.add({ title: 'Remote mode enabled', description: 'Local service controls are hidden. Use pairing to control another computer.', color: 'neutral' });
    }
}

async function undoLast() {
    const s = snapshots.latest();
    if (!s) return;
    undoing.value = true;
    try {
        await simple.applyChanges(s.inverse);
        snapshots.remove(s.id);
        simple.reset();
        await simple.ensureLoaded();
    } catch (err) {
        logger.error('undo:failed', 'Settings undo failed', {
            error: err instanceof Error ? err.message : String(err),
        });
    } finally {
        undoing.value = false;
    }
}
</script>
