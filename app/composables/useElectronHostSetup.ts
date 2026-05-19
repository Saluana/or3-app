import { computed, ref } from 'vue';
import type {
    AppUseMode,
    ElectronSetupState,
    FolderPickResult,
    HostDeviceInvite,
    HostServiceConfig,
    InternBinaryStatus,
    PlatformCapabilities,
    SecurityPresetId,
    ServiceStatus,
} from '~/types/electron-host';
import {
    BROWSER_CAPABILITIES,
    ELECTRON_SETUP_STORAGE_KEY,
    canShowHostUi,
    defaultSetupState,
    detectRuntimePlatform,
    mapPresetToServiceConfig,
    sanitizeSetupState,
    shouldShowFirstRunSetup,
} from '~/utils/electron-host';

const capabilities = ref<PlatformCapabilities>({ ...BROWSER_CAPABILITIES });
const setupState = ref<ElectronSetupState>(defaultSetupState());
const serviceStatus = ref<ServiceStatus>({ state: 'stopped' });
const binaryStatus = ref<InternBinaryStatus | null>(null);
const activeInvite = ref<HostDeviceInvite | null>(null);
const ready = ref(false);
let loading: Promise<void> | null = null;

function delay(ms: number) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

function desktopBridge() {
    if (!import.meta.client) return null;
    return window.or3Desktop ?? null;
}

function readRendererState() {
    if (!import.meta.client) return null;
    const raw = localStorage.getItem(ELECTRON_SETUP_STORAGE_KEY);
    if (!raw) return null;
    try {
        return sanitizeSetupState(JSON.parse(raw));
    } catch {
        localStorage.removeItem(ELECTRON_SETUP_STORAGE_KEY);
        return null;
    }
}

function persistRendererState(state: ElectronSetupState) {
    if (!import.meta.client) return;
    localStorage.setItem(ELECTRON_SETUP_STORAGE_KEY, JSON.stringify(toPlainData(state)));
}

function toPlainData<T>(value: T): T {
    return JSON.parse(JSON.stringify(value)) as T;
}

async function persistState(input: Partial<ElectronSetupState>) {
    const next = sanitizeSetupState({
        ...setupState.value,
        ...input,
        version: 1,
        updatedAt: new Date().toISOString(),
    });
    if (!next) return setupState.value;

    const bridge = desktopBridge();
    const plainNext = toPlainData(next);
    setupState.value = bridge ? await bridge.platform.saveSetupState(plainNext) : plainNext;
    persistRendererState(setupState.value);
    return setupState.value;
}

async function pollServiceUntilSettled(bridge: NonNullable<ReturnType<typeof desktopBridge>>) {
    for (let attempt = 0; attempt < 16; attempt++) {
        await delay(500);
        const next = await bridge.intern.status().catch(() => null);
        if (!next) continue;
        serviceStatus.value = next;
        if (next.state === 'online' || next.state === 'not-installed' || next.state === 'error') return next;
    }
    return serviceStatus.value;
}

async function startCompletedHostService(bridge: NonNullable<ReturnType<typeof desktopBridge>>) {
    if (!canShowHostUi(capabilities.value, setupState.value.mode)) return;
    if (!setupState.value.completed) return;
    if (serviceStatus.value.state === 'online') return;
    if (serviceStatus.value.state === 'not-installed' || serviceStatus.value.state === 'error') return;

    serviceStatus.value = await bridge.intern.start().catch(() => serviceStatus.value);
    if (serviceStatus.value.state === 'starting' || serviceStatus.value.state === 'stopped') {
        await pollServiceUntilSettled(bridge);
    }
}

export function useElectronHostSetup() {
    async function ensureLoaded() {
        if (loading) return loading;
        loading = (async () => {
            if (!import.meta.client) {
                ready.value = true;
                return;
            }

            const bridge = desktopBridge();
            if (!bridge) {
                capabilities.value = {
                    ...BROWSER_CAPABILITIES,
                    platform: detectRuntimePlatform(false, navigator.userAgent),
                };
                setupState.value = readRendererState() ?? defaultSetupState();
                ready.value = true;
                return;
            }

            const [detectedCapabilities, persistedSetup] = await Promise.all([
                bridge.platform.getCapabilities().catch(() => ({
                    ...BROWSER_CAPABILITIES,
                    platform: 'electron' as const,
                })),
                bridge.platform.getSetupState().catch(() => null),
            ]);
            capabilities.value = detectedCapabilities;
            setupState.value =
                sanitizeSetupState(persistedSetup) ?? readRendererState() ?? defaultSetupState();
            persistRendererState(setupState.value);
            serviceStatus.value = await bridge.intern.status().catch(() => ({ state: 'stopped' }));
            await startCompletedHostService(bridge);
            ready.value = true;
        })();
        await loading;
    }

    async function chooseMode(mode: AppUseMode) {
        if (mode === 'remote') {
            await persistState({ mode: 'remote', completed: true, currentStep: 'done' });
            return;
        }
        await persistState({ mode: 'host', completed: false, currentStep: 'host-essentials' });
    }

    async function saveEssentials(input: { machineName: string; workspaceDir?: string; workspaceDirDisplay?: string }) {
        await persistState({ ...input, currentStep: 'security' });
    }

    async function saveSecurity(input: { securityPreset: SecurityPresetId; autostartEnabled: boolean; serviceBehavior: 'keep-running' | 'stop-with-app' }) {
        await persistState({ ...input, currentStep: 'starting' });
    }

    async function pickWorkspaceDirectory(): Promise<FolderPickResult> {
        const result = await desktopBridge()?.filesystem.pickWorkspaceDirectory();
        return result ?? { canceled: true };
    }

    async function pickDataDirectory(): Promise<FolderPickResult> {
        const result = await desktopBridge()?.filesystem.pickDataDirectory();
        return result ?? { canceled: true };
    }

    async function pickInternBinary() {
        return desktopBridge()?.filesystem.pickInternBinary() ?? Promise.resolve({ canceled: true });
    }

    async function refreshStatus() {
        const bridge = desktopBridge();
        serviceStatus.value = bridge ? await bridge.intern.status() : { state: 'stopped' };
        return serviceStatus.value;
    }

    async function locateIntern() {
        const bridge = desktopBridge();
        binaryStatus.value = bridge ? await bridge.intern.locate() : { found: false, compatible: false };
        if (binaryStatus.value.binary) await persistState({ internBinary: binaryStatus.value.binary });
        return binaryStatus.value;
    }

    async function configureAndStart(overrides: Partial<HostServiceConfig> = {}) {
        const bridge = desktopBridge();
        if (!bridge) return { state: 'error', message: 'Desktop bridge is unavailable.' } satisfies ServiceStatus;
        const config = mapPresetToServiceConfig({
            machineName: setupState.value.machineName,
            workspaceDir: setupState.value.workspaceDir || setupState.value.workspaceDirDisplay || '',
            dataDir: setupState.value.dataDir,
            securityPreset: setupState.value.securityPreset || 'private',
            autostartEnabled: setupState.value.autostartEnabled,
            serviceBehavior: setupState.value.serviceBehavior,
            internBinaryPath: setupState.value.internBinary?.path,
            ...overrides,
        });
        const configured = await bridge.intern.configure(config);
        if (!configured.ok) {
            serviceStatus.value = {
                state: 'error',
                message: configured.message || 'OR3 could not apply setup.',
            };
            return serviceStatus.value;
        }
        await bridge.intern.setAutostart(config.autostartEnabled).catch(() => null);
        serviceStatus.value = await bridge.intern.start();
        await persistState({
            completed: serviceStatus.value.state === 'online',
            currentStep: serviceStatus.value.state === 'online' ? 'done' : 'starting',
            serviceBaseUrl: serviceStatus.value.baseUrl || configured.serviceBaseUrl,
        });
        return serviceStatus.value;
    }

    async function startService() {
        const status = await desktopBridge()?.intern.start();
        serviceStatus.value = status ?? { state: 'error', message: 'Desktop bridge is unavailable.' };
        return serviceStatus.value;
    }

    async function stopService() {
        const status = await desktopBridge()?.intern.stop();
        serviceStatus.value = status ?? { state: 'stopped' };
        return serviceStatus.value;
    }

    async function restartService() {
        const status = await desktopBridge()?.intern.restart();
        serviceStatus.value = status ?? { state: 'error', message: 'Desktop bridge is unavailable.' };
        return serviceStatus.value;
    }

    async function switchMode(mode: AppUseMode) {
        if (mode === 'host') {
            await persistState({ mode: 'host', completed: false, currentStep: 'host-essentials' });
        } else if (mode === 'remote') {
            await persistState({ mode: 'remote', completed: true, currentStep: 'done' });
        }
    }

    async function createSecureInvite(input: { requestedRole?: string; capabilities?: string[] } = {}) {
        const invite = await desktopBridge()?.intern.createSecureInvite({
            appOrigin: import.meta.client ? window.location.origin : '',
            requestedRole: input.requestedRole,
            capabilities: input.capabilities,
        });
        activeInvite.value = invite ?? null;
        return activeInvite.value;
    }

    async function createCliInvite() {
        const invite = await desktopBridge()?.intern.createCliInvite();
        activeInvite.value = invite ?? null;
        return activeInvite.value;
    }

    return {
        ready,
        capabilities,
        setupState,
        serviceStatus,
        binaryStatus,
        activeInvite,
        isElectron: computed(() => capabilities.value.platform === 'electron'),
        isElectronHostMode: computed(() => canShowHostUi(capabilities.value, setupState.value.mode)),
        shouldShowSetup: computed(() => shouldShowFirstRunSetup(capabilities.value, setupState.value)),
        ensureLoaded,
        chooseMode,
        saveEssentials,
        saveSecurity,
        persistState,
        pickWorkspaceDirectory,
        pickDataDirectory,
        pickInternBinary,
        refreshStatus,
        locateIntern,
        configureAndStart,
        startService,
        stopService,
        restartService,
        switchMode,
        createSecureInvite,
        createCliInvite,
    };
}
