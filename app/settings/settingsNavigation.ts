/**
 * Typed settings destination metadata for mobile landing and desktop sidebar.
 */

export type SettingsSurface =
    | 'mobile-home'
    | 'advanced'
    | 'super-advanced'
    | 'desktop-sidebar';

type SurfaceCopy = string | Partial<Record<SettingsSurface, string>>;

type RouteTarget = string | ((isElectronHostMode: boolean) => string);

interface SettingsDestinationDef {
    key: string;
    label: SurfaceCopy;
    description: SurfaceCopy;
    icon: string;
    to: RouteTarget;
    surfaces: SettingsSurface[];
}

export interface SettingsDestination {
    key: string;
    label: string;
    description: string;
    icon: string;
    to: string;
}

export const SETTINGS_ROUTES = {
    home: '/settings',
    advanced: '/settings/advanced',
    superAdvanced: '/settings/super-advanced',
    health: '/settings/health',
    pair: '/settings/pair',
    addons: '/settings/addons',
    skills: '/settings/skills',
    passkeys: '/settings/passkeys',
    heartbeat: '/settings/heartbeat',
    permissions: '/settings/permissions',
    observability: '/settings/observability',
    approvalAutopilot: '/settings/approval-autopilot',
    connectDevice: '/computer/connect-device',
    trustedDevices: '/computer/trusted-devices',
} as const;

export function resolveDeviceManagementRoute(isElectronHostMode: boolean): string {
    return isElectronHostMode
        ? SETTINGS_ROUTES.connectDevice
        : SETTINGS_ROUTES.pair;
}

export function resolveTrustedDevicesRoute(isElectronHostMode: boolean): string {
    return isElectronHostMode
        ? SETTINGS_ROUTES.trustedDevices
        : SETTINGS_ROUTES.pair;
}

function resolveSurfaceCopy(copy: SurfaceCopy, surface: SettingsSurface): string {
    if (typeof copy === 'string') return copy;
    return copy[surface] ?? Object.values(copy).find(Boolean) ?? '';
}

function resolveRoute(to: RouteTarget, isElectronHostMode: boolean): string {
    return typeof to === 'function' ? to(isElectronHostMode) : to;
}

function resolveDestination(
    def: SettingsDestinationDef,
    surface: SettingsSurface,
    isElectronHostMode: boolean,
): SettingsDestination {
    return {
        key: def.key,
        label: resolveSurfaceCopy(def.label, surface),
        description: resolveSurfaceCopy(def.description, surface),
        icon: def.icon,
        to: resolveRoute(def.to, isElectronHostMode),
    };
}

export function filterDestinations(
    surfaces: SettingsSurface[],
    isElectronHostMode: boolean,
): SettingsDestination[] {
    const want = new Set(surfaces);
    return SETTINGS_DESTINATIONS.filter((def) =>
        def.surfaces.some((surface) => want.has(surface)),
    ).map((def) => {
        const surface =
            def.surfaces.find((s) => want.has(s)) ?? def.surfaces[0]!;
        return resolveDestination(def, surface, isElectronHostMode);
    });
}

export function destinationsForSurface(
    surface: SettingsSurface,
    isElectronHostMode: boolean,
): SettingsDestination[] {
    return SETTINGS_DESTINATIONS.filter((def) =>
        def.surfaces.includes(surface),
    ).map((def) => resolveDestination(def, surface, isElectronHostMode));
}

/** Essential actions on the mobile Settings landing. */
export function mobileHomeDestinations(
    isElectronHostMode: boolean,
): SettingsDestination[] {
    return destinationsForSurface('mobile-home', isElectronHostMode);
}

/** Fixed desktop/electron sidebar destinations (excluding dynamic configure sections). */
export function desktopSidebarFixedDestinations(
    isElectronHostMode: boolean,
): SettingsDestination[] {
    return destinationsForSurface('desktop-sidebar', isElectronHostMode);
}

/** Labels required on desktop sidebar for regression coverage. */
export const REQUIRED_DESKTOP_SIDEBAR_KEYS = [
    'settings-home',
    'pair',
    'health',
    'permissions',
    'skills',
    'addons',
    'passkeys',
    'observability',
    'approval-autopilot',
    'advanced',
    'super-advanced',
] as const;

export function desktopSidebarInventory(isElectronHostMode: boolean): string[] {
    return desktopSidebarFixedDestinations(isElectronHostMode).map(
        (item) => item.key,
    );
}

const SETTINGS_DESTINATIONS: SettingsDestinationDef[] = [
    {
        key: 'devices',
        label: 'Devices & pairing',
        description: 'Connect, review, or re-pair this app to your computer.',
        icon: 'i-pixelarticons-link',
        to: resolveDeviceManagementRoute,
        surfaces: ['mobile-home'],
    },
    {
        key: 'settings-home',
        label: 'Settings',
        description: 'Overview and essential controls.',
        icon: 'i-pixelarticons-sliders',
        to: SETTINGS_ROUTES.home,
        surfaces: ['desktop-sidebar'],
    },
    {
        key: 'pair',
        label: {
            'desktop-sidebar': 'Connect devices',
            'mobile-home': 'Pair computer',
        },
        description: {
            'desktop-sidebar':
                'Add phones, browsers, and trusted devices to this computer.',
            'mobile-home': 'Connect or re-pair this app to or3-intern.',
        },
        icon: 'i-pixelarticons-link',
        to: resolveDeviceManagementRoute,
        surfaces: ['desktop-sidebar'],
    },
    {
        key: 'trusted-devices',
        label: {
            'desktop-sidebar': 'Trusted devices',
            'mobile-home': 'Connected devices',
        },
        description: {
            'desktop-sidebar':
                'Review and revoke devices trusted by this computer.',
            'mobile-home':
                'Review secure and legacy devices on the paired computer.',
        },
        icon: 'i-pixelarticons-shield',
        to: resolveTrustedDevicesRoute,
        surfaces: ['desktop-sidebar'],
    },
    {
        key: 'health',
        label: 'Doctor',
        description: 'Ask Doctor to diagnose and change settings.',
        icon: 'i-pixelarticons-heart',
        to: SETTINGS_ROUTES.health,
        surfaces: ['desktop-sidebar'],
    },
    {
        key: 'permissions',
        label: 'Permissions',
        description: 'What OR3 can access on this device.',
        icon: 'i-pixelarticons-lock',
        to: SETTINGS_ROUTES.permissions,
        surfaces: ['desktop-sidebar'],
    },
    {
        key: 'addons',
        label: {
            'mobile-home': 'Add-ons (MCP)',
            'desktop-sidebar': 'Add-ons',
        },
        description: {
            'mobile-home': 'Connect external tools and MCP servers.',
            'desktop-sidebar': 'Manage external tools and advanced add-ons.',
        },
        icon: 'i-lucide-plug',
        to: SETTINGS_ROUTES.addons,
        surfaces: ['mobile-home', 'desktop-sidebar'],
    },
    {
        key: 'skills',
        label: 'Skills',
        description: {
            'mobile-home': 'Turn agent skills on or off and tune how they behave.',
            'desktop-sidebar': 'Toggle and configure agent skills.',
        },
        icon: 'i-pixelarticons-tool-case',
        to: SETTINGS_ROUTES.skills,
        surfaces: ['mobile-home', 'desktop-sidebar'],
    },
    {
        key: 'heartbeat',
        label: 'Automatic check-ins',
        description: 'Turn on heartbeat and edit its background checklist.',
        icon: 'tabler:activity-heartbeat',
        to: SETTINGS_ROUTES.heartbeat,
        surfaces: ['desktop-sidebar', 'advanced'],
    },
    {
        key: 'approval-autopilot',
        label: 'Approval autopilot',
        description: 'Choose what OR3 can approve by itself.',
        icon: 'i-pixelarticons-shield',
        to: SETTINGS_ROUTES.approvalAutopilot,
        surfaces: ['desktop-sidebar', 'advanced'],
    },
    {
        key: 'passkeys',
        label: 'Passkeys',
        description: {
            'mobile-home':
                'Verify it is really you before sensitive changes.',
            'desktop-sidebar': 'Manage device passkeys for security.',
        },
        icon: 'i-pixelarticons-shield',
        to: SETTINGS_ROUTES.passkeys,
        surfaces: ['mobile-home', 'desktop-sidebar'],
    },
    {
        key: 'observability',
        label: 'Observability',
        description: 'Logs, telemetry, and diagnostics.',
        icon: 'i-pixelarticons-chart',
        to: SETTINGS_ROUTES.observability,
        surfaces: ['desktop-sidebar', 'advanced'],
    },
    {
        key: 'advanced',
        label: 'Advanced Settings',
        description: 'Grouped controls for models, memory, workspace, and more.',
        icon: 'i-pixelarticons-sliders',
        to: SETTINGS_ROUTES.advanced,
        surfaces: ['desktop-sidebar', 'advanced'],
    },
    {
        key: 'super-advanced',
        label: 'Super Advanced Settings',
        description: 'Raw config keys for people who know what they are changing.',
        icon: 'i-pixelarticons-warning-box',
        to: SETTINGS_ROUTES.superAdvanced,
        surfaces: ['desktop-sidebar', 'advanced', 'super-advanced'],
    },
];
