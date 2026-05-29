import { describe, expect, it } from 'vitest';
import {
    desktopSidebarFixedDestinations,
    desktopSidebarInventory,
    mobileHomeDestinations,
    REQUIRED_DESKTOP_SIDEBAR_KEYS,
    resolveDeviceManagementRoute,
    resolveTrustedDevicesRoute,
    SETTINGS_ROUTES,
} from '../../app/settings/settingsNavigation';

describe('settingsNavigation', () => {
    it('resolves device routes for remote vs electron host mode', () => {
        expect(resolveDeviceManagementRoute(false)).toBe(SETTINGS_ROUTES.pair);
        expect(resolveDeviceManagementRoute(true)).toBe(
            SETTINGS_ROUTES.connectDevice,
        );
        expect(resolveTrustedDevicesRoute(false)).toBe(SETTINGS_ROUTES.pair);
        expect(resolveTrustedDevicesRoute(true)).toBe(
            SETTINGS_ROUTES.trustedDevices,
        );
    });

    it('lists mobile home essentials without heartbeat or model roles', () => {
        const items = mobileHomeDestinations(false);
        const keys = items.map((item) => item.key);
        expect(keys).toEqual(['devices', 'addons', 'skills', 'passkeys']);
        expect(items.find((item) => item.key === 'addons')?.label).toBe(
            'Add-ons (MCP)',
        );
    });

    it('resolves per-surface copy from the shared destination catalog', () => {
        const mobile = mobileHomeDestinations(false);
        const desktop = desktopSidebarFixedDestinations(false);
        expect(mobile.find((item) => item.key === 'passkeys')?.description).toBe(
            'Verify it is really you before sensitive changes.',
        );
        expect(desktop.find((item) => item.key === 'passkeys')?.description).toBe(
            'Manage device passkeys for security.',
        );
    });

    it('keeps the full desktop sidebar destination inventory', () => {
        for (const hostMode of [false, true]) {
            const inventory = desktopSidebarInventory(hostMode);
            for (const key of REQUIRED_DESKTOP_SIDEBAR_KEYS) {
                expect(inventory).toContain(key);
            }
        }
    });

    it('includes Advanced and Super Advanced entries on desktop sidebar', () => {
        const items = desktopSidebarFixedDestinations(false);
        expect(items.find((item) => item.key === 'advanced')?.to).toBe(
            SETTINGS_ROUTES.advanced,
        );
        expect(items.find((item) => item.key === 'super-advanced')?.to).toBe(
            SETTINGS_ROUTES.superAdvanced,
        );
    });

    it('routes electron host device actions to computer pages', () => {
        const items = desktopSidebarFixedDestinations(true);
        expect(items.find((item) => item.key === 'pair')?.to).toBe(
            SETTINGS_ROUTES.connectDevice,
        );
        expect(items.find((item) => item.key === 'trusted-devices')?.to).toBe(
            SETTINGS_ROUTES.trustedDevices,
        );
    });
});
