import type {
    AppUseMode,
    ElectronSetupState,
    HostServiceConfig,
    Or3RuntimePlatform,
    PlatformCapabilities,
    SecurityPreset,
    SecurityPresetId,
    ServiceStatus,
} from '~/types/electron-host';

export const ELECTRON_SETUP_STORAGE_KEY = 'or3-app:v1:electron-host-setup';

export const SECURITY_PRESETS: Record<SecurityPresetId, SecurityPreset> = {
    private: {
        id: 'private',
        label: 'Private',
        shortDescription: 'OR3 stays local to this computer until you allow other devices.',
        serviceListenMode: 'loopback',
        allowLegacyPairing: false,
        preferSecureQr: true,
        requireApprovals: true,
        exposeOnLan: false,
    },
    home: {
        id: 'home',
        label: 'Home network',
        shortDescription: 'Expose OR3 on your private LAN or Tailscale so trusted devices can pair.',
        serviceListenMode: 'private-network',
        allowLegacyPairing: false,
        preferSecureQr: true,
        requireApprovals: true,
        exposeOnLan: true,
    },
    advanced: {
        id: 'advanced',
        label: 'Custom',
        shortDescription: 'I know what I am changing.',
        serviceListenMode: 'custom',
        allowLegacyPairing: true,
        preferSecureQr: true,
        requireApprovals: true,
        exposeOnLan: true,
    },
};

export const BROWSER_CAPABILITIES: PlatformCapabilities = {
    platform: 'web',
    canManageLocalService: false,
    canPickFolders: false,
    canInstallIntern: false,
    canManageAutostart: false,
    canOpenNativeLogs: false,
};

export function defaultSetupState(machineName = 'This computer'): ElectronSetupState {
    return {
        version: 1,
        completed: false,
        mode: 'undecided',
        currentStep: 'role',
        machineName,
        securityPreset: 'private',
        autostartEnabled: false,
        serviceBehavior: 'stop-with-app',
        updatedAt: new Date().toISOString(),
    };
}

export function sanitizeSetupState(input: unknown): ElectronSetupState | null {
    if (!input || typeof input !== 'object') return null;
    const raw = input as Partial<ElectronSetupState>;
    if (raw.version !== 1) return null;
    const mode: AppUseMode = ['host', 'remote', 'undecided'].includes(String(raw.mode))
        ? (raw.mode as AppUseMode)
        : 'undecided';
    const currentStep = ['role', 'host-essentials', 'security', 'starting', 'done'].includes(
        String(raw.currentStep),
    )
        ? raw.currentStep!
        : 'role';
    const preset = ['private', 'home', 'advanced'].includes(String(raw.securityPreset))
        ? (raw.securityPreset as SecurityPresetId)
        : 'private';

    return {
        ...defaultSetupState(String(raw.machineName || 'This computer')),
        ...raw,
        version: 1,
        completed: Boolean(raw.completed),
        mode,
        currentStep,
        securityPreset: preset,
        autostartEnabled: Boolean(raw.autostartEnabled),
        serviceBehavior: raw.serviceBehavior === 'keep-running' ? 'keep-running' : 'stop-with-app',
        updatedAt: String(raw.updatedAt || new Date().toISOString()),
    };
}

export function canShowHostUi(capabilities: PlatformCapabilities, mode: AppUseMode) {
    return capabilities.platform === 'electron' && mode === 'host' && capabilities.canManageLocalService;
}

export function shouldShowFirstRunSetup(capabilities: PlatformCapabilities, state: ElectronSetupState) {
    if (capabilities.platform !== 'electron') return false;
    if (capabilities.forcedClientMode) return false;
    return !state.completed || state.mode === 'undecided';
}

export function serviceBaseUrlFromConfig(input: Pick<HostServiceConfig, 'listenHost' | 'listenPort'>) {
    const host = input.listenHost === 'private' ? '127.0.0.1' : input.listenHost || '127.0.0.1';
    return `http://${host}:${input.listenPort || 9100}`;
}

export function mapPresetToServiceConfig(input: {
    machineName: string;
    workspaceDir: string;
    dataDir?: string;
    securityPreset?: SecurityPresetId;
    listenHost?: string;
    listenPort?: number;
    autostartEnabled?: boolean;
    serviceBehavior?: 'keep-running' | 'stop-with-app';
    internBinaryPath?: string;
}): HostServiceConfig {
    const preset = input.securityPreset || 'private';
    const selected = SECURITY_PRESETS[preset];
    const listenHost =
        preset === 'advanced'
            ? input.listenHost || '127.0.0.1'
            : selected.serviceListenMode === 'private-network'
              ? 'private'
              : '127.0.0.1';

    return {
        machineName: input.machineName.trim() || 'This computer',
        workspaceDir: input.workspaceDir,
        dataDir: input.dataDir,
        listenHost,
        listenPort: Number(input.listenPort || 9100),
        securityPreset: preset,
        autostartEnabled: Boolean(input.autostartEnabled),
        serviceBehavior: input.serviceBehavior || 'stop-with-app',
        internBinaryPath: input.internBinaryPath,
    };
}

export function hostStatusLabel(status: ServiceStatus) {
    switch (status.state) {
        case 'online':
            return 'Online';
        case 'starting':
            return 'Starting';
        case 'unhealthy':
            return 'Needs attention';
        case 'not-installed':
            return 'Set up OR3';
        case 'error':
            return 'Error';
        default:
            return 'Offline';
    }
}

export function detectRuntimePlatform(hasDesktopBridge: boolean, userAgent = ''): Or3RuntimePlatform {
    if (hasDesktopBridge) return 'electron';
    const ua = userAgent.toLowerCase();
    if (ua.includes('android')) return 'android';
    if (/iphone|ipad|ipod/.test(ua)) return 'ios';
    return 'web';
}
