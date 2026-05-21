import { describe, expect, it } from 'vitest';
import {
    BROWSER_CAPABILITIES,
    canShowHostUi,
    defaultSetupState,
    detectRuntimePlatform,
    mapPresetToServiceConfig,
    sanitizeSetupState,
    shouldShowFirstRunSetup,
} from '../../app/utils/electron-host';

describe('electron host setup utilities', () => {
    it('sanitizes invalid setup state back to safe defaults', () => {
        const state = sanitizeSetupState({ version: 1, mode: 'weird', currentStep: 'bad' });

        expect(state?.mode).toBe('undecided');
        expect(state?.currentStep).toBe('role');
        expect(state?.securityPreset).toBe('private');
    });

    it('detects host UI only for Electron host mode with service capability', () => {
        expect(
            canShowHostUi(
                {
                    platform: 'electron',
                    canManageLocalService: true,
                    canPickFolders: true,
                    canInstallIntern: true,
                    canManageAutostart: true,
                    canOpenNativeLogs: true,
                },
                'host',
            ),
        ).toBe(true);
        expect(canShowHostUi(BROWSER_CAPABILITIES, 'host')).toBe(false);
        expect(
            canShowHostUi(
                { ...BROWSER_CAPABILITIES, platform: 'electron', canManageLocalService: true },
                'remote',
            ),
        ).toBe(false);
    });

    it('shows first-run setup only for Electron without completed setup', () => {
        const state = defaultSetupState();
        expect(shouldShowFirstRunSetup({ ...BROWSER_CAPABILITIES, platform: 'electron' }, state)).toBe(true);
        expect(shouldShowFirstRunSetup(BROWSER_CAPABILITIES, state)).toBe(false);
        expect(
            shouldShowFirstRunSetup(
                { ...BROWSER_CAPABILITIES, platform: 'electron', forcedClientMode: true },
                state,
            ),
        ).toBe(false);
    });

    it('maps security presets to service listen defaults', () => {
        expect(
            mapPresetToServiceConfig({
                machineName: 'Desk',
                workspaceDir: '/tmp/work',
                securityPreset: 'private',
            }).listenHost,
        ).toBe('127.0.0.1');
        expect(
            mapPresetToServiceConfig({
                machineName: 'Desk',
                workspaceDir: '/tmp/work',
                securityPreset: 'home',
            }).listenHost,
        ).toBe('private');
        expect(
            mapPresetToServiceConfig({
                machineName: 'Desk',
                workspaceDir: '/tmp/work',
                securityPreset: 'advanced',
                listenHost: '0.0.0.0',
            }).listenHost,
        ).toBe('0.0.0.0');
    });

    it('detects platform from bridge before user agent', () => {
        expect(detectRuntimePlatform(true, 'Mozilla/5.0')).toBe('electron');
        expect(detectRuntimePlatform(false, 'Mozilla/5.0 Android')).toBe('android');
        expect(detectRuntimePlatform(false, 'Mozilla/5.0 iPhone')).toBe('ios');
        expect(detectRuntimePlatform(false, 'Mozilla/5.0')).toBe('web');
    });
});
