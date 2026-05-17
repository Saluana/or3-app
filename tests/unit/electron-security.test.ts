import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import {
    buildElectronCsp,
    extractInlineScriptHashes,
    IPC_CHANNELS,
    OR3_ELECTRON_CSP,
    isAllowedNavigation,
    validateIpcChannel,
} from '../../electron/security-policy.js';

const appRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const appFile = (...parts: string[]) => resolve(appRoot, ...parts);

function scriptSrcDirective(csp: string) {
    return csp
        .split(';')
        .map((part) => part.trim())
        .find((part) => part.startsWith('script-src'));
}

describe('Electron security baseline', () => {
    it('keeps renderer isolation and sandbox enabled', () => {
        const main = readFileSync(appFile('electron/main.js'), 'utf8');
        expect(main).toContain('nodeIntegration: false');
        expect(main).toContain('contextIsolation: true');
        expect(main).toContain('sandbox: true');
        expect(main).toContain('setWindowOpenHandler');
        expect(main).toContain('will-navigate');
        expect(main).toContain('registerDesktopIpc');
        expect(main).toContain('validateIpcChannel');
    });

    it('uses a restrictive CSP', () => {
        const scriptSrc = scriptSrcDirective(OR3_ELECTRON_CSP);
        expect(OR3_ELECTRON_CSP).toContain("default-src 'self'");
        expect(OR3_ELECTRON_CSP).toContain("script-src 'self'");
        expect(OR3_ELECTRON_CSP).toContain("object-src 'none'");
        expect(OR3_ELECTRON_CSP).toContain("frame-ancestors 'none'");
        expect(scriptSrc).toBeDefined();
        expect(scriptSrc).not.toContain("'unsafe-inline'");
    });

    it('allows only hashed inline bootstrap scripts for packaged HTML', () => {
        const html = readFileSync(appFile('.output/public/index.html'), 'utf8');
        const hashes = extractInlineScriptHashes(html);
        const csp = buildElectronCsp({ scriptHashes: hashes });
        const scriptSrc = scriptSrcDirective(csp);

        expect(hashes.length).toBeGreaterThan(0);
        expect(csp).toContain("script-src 'self'");
        expect(scriptSrc).toBeDefined();
        expect(scriptSrc).not.toContain("'unsafe-inline'");
        for (const hash of hashes) {
            expect(csp).toContain(`'sha256-${hash}'`);
        }
    });

    it('validates IPC and navigation allowlists', () => {
        expect(validateIpcChannel(IPC_CHANNELS.hostIdentity)).toBe(true);
        expect(validateIpcChannel(IPC_CHANNELS.platformCapabilities)).toBe(true);
        expect(validateIpcChannel(IPC_CHANNELS.internStart)).toBe(true);
        expect(validateIpcChannel(IPC_CHANNELS.filesystemPickWorkspace)).toBe(true);
        expect(validateIpcChannel('shell:open')).toBe(false);
        expect(isAllowedNavigation('app://or3/index.html')).toBe(true);
        expect(isAllowedNavigation('https://example.com')).toBe(false);
    });

    it('exposes only the typed desktop bridge in preload', () => {
        const preload = readFileSync(appFile('electron/preload.cjs'), 'utf8');
        expect(preload).toContain('contextBridge.exposeInMainWorld');
        expect(preload).toContain('or3Desktop');
        expect(preload).toContain('Object.freeze');
        expect(preload).toContain('Object.values(channels).includes(channel)');
        expect(preload).not.toContain('shell');
        expect(preload).not.toContain('require(\'fs\')');
        expect(preload).not.toContain('require("fs")');
    });

    it('keeps every preload IPC channel in the shared allowlist', () => {
        const preload = readFileSync(appFile('electron/preload.cjs'), 'utf8');
        for (const channel of preload.matchAll(/'or3:[^']+'/g)) {
            expect(validateIpcChannel(channel[0].slice(1, -1))).toBe(true);
        }
    });

    it('loads the packaged app only from ASAR', () => {
        const fuses = JSON.parse(
            readFileSync(appFile('electron/fuses.config.json'), 'utf8'),
        );
        expect(fuses.onlyLoadAppFromAsar).toBe(true);
    });
});
