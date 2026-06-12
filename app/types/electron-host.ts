export type Or3RuntimePlatform = 'web' | 'ios' | 'android' | 'electron';

export interface PlatformCapabilities {
    platform: Or3RuntimePlatform;
    canManageLocalService: boolean;
    canPickFolders: boolean;
    canInstallIntern: boolean;
    canManageAutostart: boolean;
    canOpenNativeLogs: boolean;
    forcedClientMode?: boolean;
}

export type AppUseMode = 'undecided' | 'host' | 'remote';
export type ElectronSetupStep =
    | 'role'
    | 'host-essentials'
    | 'security'
    | 'starting'
    | 'done';

export type SecurityPresetId = 'private' | 'home' | 'advanced';
export type ServiceBehavior = 'keep-running' | 'stop-with-app';

export interface InternBinaryRef {
    source: 'bundled' | 'path' | 'manual';
    path: string;
    version?: string;
}

export interface ElectronSetupState {
    version: 1;
    completed: boolean;
    mode: AppUseMode;
    currentStep: ElectronSetupStep;
    machineName: string;
    workspaceDir?: string;
    workspaceDirDisplay?: string;
    dataDir?: string;
    securityPreset?: SecurityPresetId;
    autostartEnabled: boolean;
    serviceBehavior: ServiceBehavior;
    internBinary?: InternBinaryRef;
    serviceBaseUrl?: string;
    updatedAt: string;
}

export interface PersistedRendererSetupState {
    version: 1;
    mode: AppUseMode;
    setupCompleted: boolean;
    currentStep?: ElectronSetupStep;
    machineName?: string;
    workspaceDirDisplay?: string;
    securityPreset?: SecurityPresetId;
    serviceBaseUrl?: string;
}

export interface SecurityPreset {
    id: SecurityPresetId;
    label: string;
    shortDescription: string;
    serviceListenMode: 'loopback' | 'private-network' | 'custom';
    preferSecureQr: boolean;
    requireApprovals: boolean;
    exposeOnLan: boolean;
}

export interface HostServiceConfig {
    machineName: string;
    workspaceDir: string;
    dataDir?: string;
    listenHost: '127.0.0.1' | 'private' | string;
    listenPort: number;
    securityPreset: SecurityPresetId;
    autostartEnabled: boolean;
    serviceBehavior: ServiceBehavior;
    internBinaryPath?: string;
}

export interface ServiceStatus {
    state:
        | 'not-installed'
        | 'stopped'
        | 'starting'
        | 'online'
        | 'unhealthy'
        | 'error';
    baseUrl?: string;
    version?: string;
    processId?: number;
    startedAt?: string;
    deviceCount?: number;
    health?: 'ok' | 'warning' | 'failed';
    authMismatch?: boolean;
    roleMismatch?: boolean;
    message?: string;
}

export interface FolderPickResult {
    canceled: boolean;
    path?: string;
    displayPath?: string;
}

export interface FilePickResult extends FolderPickResult {
    version?: string;
}

export interface InternBinaryStatus {
    found: boolean;
    compatible: boolean;
    binary?: InternBinaryRef;
    message?: string;
}

export interface InstallProgressSummary {
    state: 'idle' | 'running' | 'succeeded' | 'failed';
    message: string;
    recoverable: boolean;
    steps?: Array<{ label: string; state: 'pending' | 'running' | 'done' | 'failed' }>;
}

export interface ServiceConfigResult {
    ok: boolean;
    config?: HostServiceConfig;
    serviceBaseUrl?: string;
    message?: string;
}

export interface AutostartStatus {
    enabled: boolean;
    supported: boolean;
    message?: string;
}

export interface ServiceTokenRequest {
    method?: string;
    path?: string;
}

export interface ServiceTokenResult {
    token: string;
    expiresAt: string;
}

export interface HostDeviceInvite {
    id: string;
    kind: 'secure-qr';
    qrText?: string;
    inviteLink?: string;
    qrImageDataUrl?: string;
    routes?: Array<{ kind: 'app-proxy' | 'direct' | 'loopback'; baseUrl: string; priority: number }>;
    requestId?: number;
    code?: string;
    expiresAt: string;
    serviceBaseUrl: string;
    instructions: string[];
    status?: 'created' | 'joined' | 'completed' | 'expired' | 'failed';
    message?: string;
}

export interface DesktopResult<T> {
    ok: boolean;
    data?: T;
    error?: {
        code: string;
        message: string;
        detail?: string;
        recoverable: boolean;
    };
}

export interface Or3DesktopBridge {
    platform: {
        getCapabilities(): Promise<PlatformCapabilities>;
        getSetupState(): Promise<ElectronSetupState | null>;
        saveSetupState(input: Partial<ElectronSetupState>): Promise<ElectronSetupState>;
    };
    filesystem: {
        pickWorkspaceDirectory(): Promise<FolderPickResult>;
        pickDataDirectory(): Promise<FolderPickResult>;
        pickInternBinary(): Promise<FilePickResult>;
    };
    intern: {
        locate(): Promise<InternBinaryStatus>;
        install(): Promise<InstallProgressSummary>;
        configure(input: HostServiceConfig): Promise<ServiceConfigResult>;
        start(): Promise<ServiceStatus>;
        stop(): Promise<ServiceStatus>;
        restart(): Promise<ServiceStatus>;
        status(): Promise<ServiceStatus>;
        issueServiceToken(input: ServiceTokenRequest): Promise<ServiceTokenResult>;
        setAutostart(enabled: boolean): Promise<AutostartStatus>;
        createSecureInvite(input?: { appOrigin?: string; requestedRole?: string; capabilities?: string[] }): Promise<HostDeviceInvite>;
        listSecureDevices(): Promise<Array<Record<string, unknown>>>;
        revokeSecureDevice(deviceId: string): Promise<{ deviceId: string; status: string }>;
    };
}

declare global {
    interface Window {
        or3Desktop?: Or3DesktopBridge;
    }
}
