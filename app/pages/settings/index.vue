<template>
    <AppShell>
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
                                {{
                                    activeHost?.token
                                        ? `Connected to ${activeHost.name || 'My Computer'}`
                                        : 'No computer paired'
                                }}
                            </p>
                            <StatusPill
                                v-if="activeHost?.token"
                                label="Connected"
                                tone="green"
                                pulse
                            />
                        </div>
                        <p
                            class="mt-1 text-sm leading-6 text-(--or3-text-muted)"
                        >
                            {{
                                activeHost?.token
                                    ? 'Your or3-intern app is connected and ready.'
                                    : 'Pair this app to your computer to get started.'
                            }}
                        </p>
                    </div>
                </div>

                <div
                    v-if="activeHost?.token"
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

                <div v-if="!activeHost?.token">
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
import { useActiveHost } from '~/composables/useActiveHost';
import { useComputerStatus } from '~/composables/useComputerStatus';
import { useSettingsSnapshots } from '~/composables/settings/useSettingsSnapshots';
import { useSimpleSettings } from '~/composables/settings/useSimpleSettings';

const { activeHost } = useActiveHost();
const computerStatus = useComputerStatus();
const snapshots = useSettingsSnapshots();
const simple = useSimpleSettings();
const undoing = ref(false);

const isPaired = computed(() => Boolean(activeHost.value?.token));
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
    try {
        await computerStatus.refreshStatus();
    } catch (err) {
        console.error('[settings] connection stats failed', err);
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
        console.error('[settings] undo failed', err);
    } finally {
        undoing.value = false;
    }
}
</script>
