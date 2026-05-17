import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import {
    IPC_CHANNELS,
    OR3_ELECTRON_CSP,
    isAllowedNavigation,
    validateIpcChannel,
} from '../../electron/security-policy.js';

const appRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const appFile = (...parts: string[]) => resolve(appRoot, ...parts);

describe('Electron security baseline', () => {
    it('keeps renderer isolation and sandbox enabled', () => {
        const main = readFileSync(appFile('electron/main.js'), 'utf8');
        expect(main).toContain('nodeIntegration: false');
        expect(main).toContain('contextIsolation: true');
        expect(main).toContain('sandbox: true');
        expect(main).toContain('setWindowOpenHandler');
        expect(main).toContain('will-navigate');
        expect(main).not.toContain('ipcMain.handle');
    });

    it('uses a restrictive CSP', () => {
        expect(OR3_ELECTRON_CSP).toContain("default-src 'self'");
        expect(OR3_ELECTRON_CSP).toContain("object-src 'none'");
        expect(OR3_ELECTRON_CSP).toContain("frame-ancestors 'none'");
    });

    it('validates IPC and navigation allowlists', () => {
        expect(validateIpcChannel(IPC_CHANNELS.hostIdentity)).toBe(true);
        expect(validateIpcChannel('shell:open')).toBe(false);
        expect(isAllowedNavigation('app://or3/index.html')).toBe(true);
        expect(isAllowedNavigation('https://example.com')).toBe(false);
    });

    it('does not expose ipcRenderer directly in preload', () => {
        const preload = readFileSync(appFile('electron/preload.cjs'), 'utf8');
        expect(preload).toContain('contextBridge.exposeInMainWorld');
        expect(preload).not.toContain('ipcRenderer.invoke');
    });

    it('loads the packaged app only from ASAR', () => {
        const fuses = JSON.parse(
            readFileSync(appFile('electron/fuses.config.json'), 'utf8'),
        );
        expect(fuses.onlyLoadAppFromAsar).toBe(true);
    });
});
