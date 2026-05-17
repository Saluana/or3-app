<template>
    <div
        v-if="ready && shouldShowSetup"
        class="fixed inset-0 z-50 overflow-auto bg-(--or3-bg)/95 p-4 backdrop-blur"
        data-testid="electron-host-setup"
    >
        <div class="mx-auto flex min-h-full max-w-3xl items-center justify-center py-8">
            <SurfaceCard class-name="w-full space-y-5 p-5 sm:p-6">
                <div class="flex items-start gap-3">
                    <BrandMark size="md" />
                    <div>
                        <p class="font-mono text-lg font-semibold text-(--or3-text)">
                            Set up OR3
                        </p>
                        <p class="mt-1 text-sm leading-6 text-(--or3-text-muted)">
                            Choose how this desktop app should work. You can change this later in Settings.
                        </p>
                    </div>
                </div>

                <div v-if="step === 'role'" class="grid gap-3 sm:grid-cols-2">
                    <button
                        type="button"
                        class="or3-focus-ring rounded-2xl border border-(--or3-border) bg-white/70 p-4 text-left shadow-(--or3-shadow-soft) transition hover:-translate-y-0.5 hover:bg-white"
                        @click="selectHost"
                    >
                        <Icon name="i-pixelarticons-monitor" class="size-6 text-(--or3-green-dark)" />
                        <p class="mt-3 font-mono text-sm font-semibold text-(--or3-text)">
                            Use this computer
                        </p>
                        <p class="mt-2 text-sm leading-6 text-(--or3-text-muted)">
                            Run OR3 here and connect your phone or browser.
                        </p>
                    </button>
                    <button
                        type="button"
                        class="or3-focus-ring rounded-2xl border border-(--or3-border) bg-white/70 p-4 text-left shadow-(--or3-shadow-soft) transition hover:-translate-y-0.5 hover:bg-white"
                        @click="selectRemote"
                    >
                        <Icon name="i-pixelarticons-link" class="size-6 text-(--or3-text-muted)" />
                        <p class="mt-3 font-mono text-sm font-semibold text-(--or3-text)">
                            Control another computer
                        </p>
                        <p class="mt-2 text-sm leading-6 text-(--or3-text-muted)">
                            Connect this app to OR3 running somewhere else.
                        </p>
                    </button>
                </div>

                <div v-else-if="step === 'host-essentials'" class="space-y-4">
                    <UForm :state="form" class="space-y-4" @submit="saveEssentialsStep">
                        <UFormField label="Computer name" name="machineName">
                            <UInput v-model="form.machineName" placeholder="Brendon's Mac" />
                        </UFormField>
                        <UFormField label="Workspace folder" name="workspaceDir" description="OR3 uses this folder when local agents work on this computer.">
                            <div class="grid gap-2 sm:grid-cols-[1fr_auto]">
                                <UInput v-model="form.workspaceDir" readonly placeholder="Choose a folder" />
                                <UButton label="Choose folder" icon="i-pixelarticons-folder" color="neutral" variant="soft" @click="chooseWorkspace" />
                            </div>
                        </UFormField>
                        <details class="rounded-2xl border border-(--or3-border) bg-white/60 p-3">
                            <summary class="cursor-pointer font-mono text-xs uppercase tracking-wide text-(--or3-text-muted)">
                                Advanced
                            </summary>
                            <div class="mt-3 grid gap-3 sm:grid-cols-2">
                                <UFormField label="Data directory" name="dataDir">
                                    <div class="grid gap-2 sm:grid-cols-[1fr_auto]">
                                        <UInput v-model="form.dataDir" readonly placeholder="Default" />
                                        <UButton label="Pick" color="neutral" variant="ghost" @click="chooseDataDir" />
                                    </div>
                                </UFormField>
                                <UFormField label="Intern binary" name="internBinaryPath">
                                    <div class="grid gap-2 sm:grid-cols-[1fr_auto]">
                                        <UInput v-model="form.internBinaryPath" readonly placeholder="Auto-detect" />
                                        <UButton label="Pick" color="neutral" variant="ghost" @click="chooseBinary" />
                                    </div>
                                </UFormField>
                                <UFormField label="Listen address" name="listenHost">
                                    <UInput v-model="form.listenHost" placeholder="127.0.0.1" />
                                </UFormField>
                                <UFormField label="Port" name="listenPort">
                                    <UInput v-model="form.listenPort" type="number" placeholder="9100" />
                                </UFormField>
                            </div>
                        </details>
                        <div class="flex justify-between gap-2">
                            <UButton label="Back" color="neutral" variant="ghost" @click="goRole" />
                            <UButton label="Continue" type="submit" :disabled="!form.workspaceDir" />
                        </div>
                    </UForm>
                </div>

                <div v-else-if="step === 'security'" class="space-y-4">
                    <div class="grid gap-3 sm:grid-cols-3">
                        <button
                            v-for="preset in presets"
                            :key="preset.id"
                            type="button"
                            class="or3-focus-ring rounded-2xl border p-3 text-left"
                            :class="form.securityPreset === preset.id ? 'border-(--or3-green) bg-(--or3-green-soft)' : 'border-(--or3-border) bg-white/70'"
                            @click="form.securityPreset = preset.id"
                        >
                            <p class="font-mono text-sm font-semibold">{{ preset.label }}</p>
                            <p class="mt-2 text-xs leading-5 text-(--or3-text-muted)">{{ preset.shortDescription }}</p>
                        </button>
                    </div>
                    <details class="rounded-2xl border border-(--or3-border) bg-white/60 p-3">
                        <summary class="cursor-pointer font-mono text-xs uppercase tracking-wide text-(--or3-text-muted)">
                            Advanced
                        </summary>
                        <div class="mt-3 grid gap-3 sm:grid-cols-2">
                            <UCheckbox v-model="form.autostartEnabled" label="Start OR3 when I sign in" />
                            <USelect
                                v-model="form.serviceBehavior"
                                :items="serviceBehaviorOptions"
                                label-key="label"
                                value-key="value"
                            />
                        </div>
                    </details>
                    <div class="rounded-2xl border border-(--or3-border) bg-white/60 p-3 text-sm text-(--or3-text-muted)">
                        Private and Home network keep OR3 local-only by default. Custom network exposure requires a hardened service profile.
                    </div>
                    <div class="flex justify-between gap-2">
                        <UButton label="Back" color="neutral" variant="ghost" @click="step = 'host-essentials'" />
                        <UButton label="Start OR3" @click="startSetup" />
                    </div>
                </div>

                <div v-else class="space-y-4">
                    <div class="rounded-2xl border border-(--or3-border) bg-white/70 p-4">
                        <p class="font-mono text-sm font-semibold text-(--or3-text)">
                            {{ progressTitle }}
                        </p>
                        <p class="mt-2 text-sm leading-6 text-(--or3-text-muted)">
                            {{ progressMessage }}
                        </p>
                        <ul class="mt-4 space-y-2 text-sm text-(--or3-text-muted)">
                            <li v-for="item in progress" :key="item.label" class="flex items-center gap-2">
                                <Icon :name="item.done ? 'i-pixelarticons-check' : 'i-pixelarticons-clock'" class="size-4" />
                                {{ item.label }}
                            </li>
                        </ul>
                    </div>
                    <div class="flex flex-wrap justify-end gap-2">
                        <UButton
                            v-if="serviceStatus.state !== 'online'"
                            label="Retry"
                            icon="i-pixelarticons-reload"
                            color="neutral"
                            variant="soft"
                            :loading="starting"
                            @click="startSetup"
                        />
                        <UButton
                            v-if="serviceStatus.state === 'not-installed'"
                            label="Choose binary"
                            color="neutral"
                            variant="soft"
                            @click="chooseBinary"
                        />
                        <UButton
                            v-if="serviceStatus.state === 'online'"
                            label="Connect a device"
                            icon="i-pixelarticons-smartphone"
                            to="/computer/connect-device"
                        />
                        <UButton
                            label="Go to dashboard"
                            color="neutral"
                            variant="ghost"
                            to="/computer"
                        />
                    </div>
                </div>
            </SurfaceCard>
        </div>
    </div>
</template>

<script setup lang="ts">
import { computed, onMounted, reactive, ref, watch } from 'vue';
import { SECURITY_PRESETS } from '~/utils/electron-host';
import { useElectronHostSetup } from '~/composables/useElectronHostSetup';
import type { SecurityPresetId } from '~/types/electron-host';

const host = useElectronHostSetup();
const {
    ready,
    shouldShowSetup,
    setupState,
    serviceStatus,
    ensureLoaded,
    chooseMode,
    saveEssentials,
    saveSecurity,
    persistState,
    pickWorkspaceDirectory,
    pickDataDirectory,
    pickInternBinary,
    locateIntern,
    configureAndStart,
} = host;

const step = ref(setupState.value.currentStep);
const starting = ref(false);
const form = reactive({
    machineName: setupState.value.machineName || 'This computer',
    workspaceDir: setupState.value.workspaceDir || setupState.value.workspaceDirDisplay || '',
    dataDir: setupState.value.dataDir || '',
    internBinaryPath: setupState.value.internBinary?.path || '',
    listenHost: '127.0.0.1',
    listenPort: 9100,
    securityPreset: (setupState.value.securityPreset || 'private') as SecurityPresetId,
    autostartEnabled: setupState.value.autostartEnabled,
    serviceBehavior: setupState.value.serviceBehavior,
});

const presets = Object.values(SECURITY_PRESETS);
const serviceBehaviorOptions = [
    { label: 'Stop service when app quits', value: 'stop-with-app' },
    { label: 'Keep service running in background', value: 'keep-running' },
];

const progress = computed(() => [
    { label: 'Find OR3 Intern', done: Boolean(setupState.value.internBinary) || serviceStatus.value.state !== 'not-installed' },
    { label: 'Apply safe service settings', done: ['starting', 'online'].includes(serviceStatus.value.state) },
    { label: 'Start local service', done: serviceStatus.value.state === 'online' },
]);

const progressTitle = computed(() => {
    if (starting.value) return 'Starting OR3…';
    if (serviceStatus.value.state === 'online') return 'OR3 is ready on this computer';
    if (serviceStatus.value.state === 'not-installed') return 'OR3 Intern is not installed yet';
    if (serviceStatus.value.state === 'error') return 'OR3 could not start';
    return 'Finish setup';
});
const progressMessage = computed(() => serviceStatus.value.message || serviceStatus.value.baseUrl || 'OR3 will start with local-first defaults.');

onMounted(async () => {
    await ensureLoaded();
    step.value = setupState.value.currentStep;
});

watch(
    () => setupState.value.currentStep,
    (value) => {
        step.value = value;
    },
);

async function selectHost() {
    await chooseMode('host');
    step.value = 'host-essentials';
}

async function selectRemote() {
    await chooseMode('remote');
}

async function goRole() {
    await persistState({ currentStep: 'role', mode: 'undecided' });
}

async function chooseWorkspace() {
    const result = await pickWorkspaceDirectory();
    if (!result.canceled && result.path) form.workspaceDir = result.path;
}

async function chooseDataDir() {
    const result = await pickDataDirectory();
    if (!result.canceled && result.path) form.dataDir = result.path;
}

async function chooseBinary() {
    const result = await pickInternBinary();
    if (!result.canceled && result.path) {
        form.internBinaryPath = result.path;
        await persistState({ internBinary: { source: 'manual', path: result.path, version: result.version } });
    }
}

async function saveEssentialsStep() {
    await saveEssentials({
        machineName: form.machineName,
        workspaceDir: form.workspaceDir,
        workspaceDirDisplay: form.workspaceDir,
    });
    await persistState({
        dataDir: form.dataDir,
        internBinary: form.internBinaryPath ? { source: 'manual', path: form.internBinaryPath } : setupState.value.internBinary,
    });
    step.value = 'security';
}

async function startSetup() {
    starting.value = true;
    try {
        await saveSecurity({
            securityPreset: form.securityPreset,
            autostartEnabled: form.autostartEnabled,
            serviceBehavior: form.serviceBehavior,
        });
        await locateIntern();
        await configureAndStart({
            workspaceDir: form.workspaceDir,
            dataDir: form.dataDir || undefined,
            listenHost: form.listenHost,
            listenPort: Number(form.listenPort || 9100),
            internBinaryPath: form.internBinaryPath || undefined,
        });
        step.value = 'starting';
    } finally {
        starting.value = false;
    }
}
</script>
