<template>
    <div class="space-y-4">
        <SettingsConnectionBlock
            unpaired-layout="large"
            :headline="hostMode ? hostHeadline : undefined"
            :description="hostMode ? hostDescription : undefined"
            :stats="connectionStats"
            :host-mode="hostMode"
            :host-base-url="hostStatus.baseUrl"
        />

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
                <StatusPill
                    :label="hostMode ? 'Use this computer' : 'Control another computer'"
                    :tone="hostMode ? 'green' : 'amber'"
                />
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

        <SurfaceCard v-if="latestSnapshot" tone="tip" class-name="space-y-2">
            <p class="font-mono text-xs uppercase tracking-wide text-(--or3-green-dark)">
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
</template>

<script setup lang="ts">
import { computed, ref } from 'vue';
import { useToast } from '@nuxt/ui/composables';
import { useComputerStatus } from '~/composables/useComputerStatus';
import { useSettingsSnapshots } from '~/composables/settings/useSettingsSnapshots';
import { useSimpleSettings } from '~/composables/settings/useSimpleSettings';
import { useElectronHostSetup } from '~/composables/useElectronHostSetup';
import { createLogger } from '~/utils/logger';

const logger = createLogger('settings');
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
        : 'Start or fix the local or3-intern service from the sidebar status card.',
);
const modeDescription = computed(() =>
    hostMode.value
        ? 'This desktop app manages the or3-intern service on this computer.'
        : 'This desktop app behaves like web, iOS, and Android clients.',
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

async function switchDesktopMode(mode: 'host' | 'remote') {
    await electronHost.switchMode(mode);
    if (mode === 'host') {
        toast.add({
            title: 'Host setup ready',
            description: 'Finish setup to use this computer.',
            color: 'neutral',
        });
    } else {
        toast.add({
            title: 'Remote mode enabled',
            description:
                'Local service controls are hidden. Use pairing to control another computer.',
            color: 'neutral',
        });
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
