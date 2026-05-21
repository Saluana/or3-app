import { readFile, stat } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import {
    buildElectronCsp,
    extractInlineScriptHashes,
    isAllowedNavigation,
    IPC_CHANNELS,
    validateIpcChannel,
} from './security-policy.js';
import {
    configureService,
    createCliInvite,
    createSecureInvite,
    getSetupState,
    installInternPlaceholder,
    issueServiceToken,
    listLegacyDevices,
    listSecureDevices,
    locateInternBinary,
    restartService,
    revokeLegacyDevice,
    revokeSecureDevice,
    saveSetupState,
    serviceStatus,
    setHostServiceUserDataPath,
    startService,
    stopService,
    stopServiceForAppQuit,
} from './host-service.js';

const require = createRequire(import.meta.url);
const electron = require('electron');
const { app, BrowserWindow, dialog, ipcMain, protocol, shell } = electron;

const root = join(fileURLToPath(new URL('..', import.meta.url)));
const devForcedClientMode = process.env.OR3_ELECTRON_FORCE_CLIENT_MODE === 'true';
const publicRoot = join(root, '.output', 'public');
let quitAfterServiceStop = false;

function registerIpc(channel, handler) {
    if (!validateIpcChannel(channel)) throw new Error(`IPC channel is not allowlisted: ${channel}`);
    ipcMain.handle(channel, async (_event, payload) => handler(payload));
}

function serviceContext() {
    return {
        appPath: root,
        resourcesPath: process.resourcesPath,
    };
}

function registerDesktopIpc() {
    registerIpc(IPC_CHANNELS.platformCapabilities, async () => ({
        platform: 'electron',
        canManageLocalService: !devForcedClientMode,
        canPickFolders: true,
        canInstallIntern: !devForcedClientMode,
        canManageAutostart: true,
        canOpenNativeLogs: true,
        forcedClientMode: devForcedClientMode,
    }));
    registerIpc(IPC_CHANNELS.setupGetState, () => getSetupState());
    registerIpc(IPC_CHANNELS.setupSaveState, (payload) => saveSetupState(payload));
    registerIpc(IPC_CHANNELS.filesystemPickWorkspace, () => pickDirectory('Choose OR3 workspace folder'));
    registerIpc(IPC_CHANNELS.filesystemPickData, () => pickDirectory('Choose OR3 data folder'));
    registerIpc(IPC_CHANNELS.filesystemPickInternBinary, () => pickInternBinary());
    registerIpc(IPC_CHANNELS.internLocate, () => locateInternBinary(serviceContext()));
    registerIpc(IPC_CHANNELS.internInstall, () => installInternPlaceholder());
    registerIpc(IPC_CHANNELS.internConfigure, (payload) => configureService(payload));
    registerIpc(IPC_CHANNELS.internStart, () => startService(serviceContext()));
    registerIpc(IPC_CHANNELS.internStop, () => stopService());
    registerIpc(IPC_CHANNELS.internRestart, () => restartService(serviceContext()));
    registerIpc(IPC_CHANNELS.internStatus, () => serviceStatus());
    registerIpc(IPC_CHANNELS.internIssueServiceToken, (payload) => issueServiceToken(payload));
    registerIpc(IPC_CHANNELS.internSetAutostart, (payload) => setAutostart(Boolean(payload?.enabled)));
    registerIpc(IPC_CHANNELS.internCreateSecureInvite, (payload) => createSecureInvite(payload));
    registerIpc(IPC_CHANNELS.internCreateCliInvite, () => createCliInvite());
    registerIpc(IPC_CHANNELS.internListSecureDevices, () => listSecureDevices());
    registerIpc(IPC_CHANNELS.internRevokeSecureDevice, (payload) => revokeSecureDevice(payload?.deviceId));
    registerIpc(IPC_CHANNELS.internListLegacyDevices, () => listLegacyDevices());
    registerIpc(IPC_CHANNELS.internRevokeLegacyDevice, (payload) => revokeLegacyDevice(payload?.deviceId));
}

async function pickDirectory(title) {
    const result = await dialog.showOpenDialog({
        title,
        properties: ['openDirectory', 'createDirectory'],
    });
    const path = result.filePaths[0];
    return {
        canceled: result.canceled || !path,
        path,
        displayPath: path,
    };
}

async function pickInternBinary() {
    const result = await dialog.showOpenDialog({
        title: 'Choose or3-intern binary',
        properties: ['openFile'],
    });
    const path = result.filePaths[0];
    if (result.canceled || !path) return { canceled: true };
    const status = await locateInternBinary({ ...serviceContext(), manualPath: path });
    return {
        canceled: false,
        path,
        displayPath: path,
        version: status.binary?.version,
    };
}

function setAutostart(enabled) {
    try {
        app.setLoginItemSettings({ openAtLogin: enabled, openAsHidden: true });
        return {
            enabled: app.getLoginItemSettings().openAtLogin,
            supported: true,
        };
    } catch (error) {
        const message = error instanceof Error ? error.message : 'macOS did not allow login item changes.';
        console.warn('or3-app autostart unavailable:', message);
        return {
            enabled: false,
            supported: false,
            message,
        };
    }
}

function createWindow() {
    const devServerUrl = String(process.env.OR3_ELECTRON_DEV_URL || '').trim();
    const allowDevNavigation =
        !app.isPackaged ||
        process.env.OR3_ELECTRON_ALLOW_DEV_NAVIGATION === 'true';
    const win = new BrowserWindow({
        width: 1180,
        height: 820,
        show: false,
        webPreferences: {
            preload: join(root, 'electron', 'preload.cjs'),
            nodeIntegration: false,
            contextIsolation: true,
            sandbox: true,
            webSecurity: true,
            allowRunningInsecureContent: false,
        },
    });
    win.webContents.setWindowOpenHandler(({ url }) => {
        if (url.startsWith('https://')) void shell.openExternal(url);
        return { action: 'deny' };
    });
    win.webContents.on('will-navigate', (event, url) => {
        if (
            !isAllowedNavigation(url) &&
            !(allowDevNavigation && devServerUrl && url.startsWith(devServerUrl))
        ) {
            event.preventDefault();
        }
    });
    win.once('ready-to-show', () => win.show());
    if (allowDevNavigation && devServerUrl) {
        void win.loadURL(devServerUrl);
    } else {
        void win.loadURL(process.env.OR3_ELECTRON_START_URL || 'app://or3/');
    }
    return win;
}

async function readPackagedAsset(pathname) {
    const requested = normalize(pathname === '/' ? '/index.html' : decodeURIComponent(pathname));
    if (requested.includes('..')) {
        return { status: 403, data: 'blocked', type: 'text/plain' };
    }

    const relativePath = requested.replace(/^[/\\]+/, '');
    let file = join(publicRoot, relativePath);

    try {
        const info = await stat(file);
        if (info.isDirectory()) file = join(file, 'index.html');
        return { status: 200, data: await readFile(file), type: contentType(file) };
    } catch (error) {
        if (!extname(relativePath)) {
            file = join(publicRoot, 'index.html');
            return { status: 200, data: await readFile(file), type: contentType(file) };
        }
        return {
            status: 404,
            data: error instanceof Error ? error.message : 'not found',
            type: 'text/plain',
        };
    }
}

protocol.registerSchemesAsPrivileged([
    {
        scheme: 'app',
        privileges: { standard: true, secure: true, supportFetchAPI: true },
    },
]);

app.whenReady().then(() => {
    setHostServiceUserDataPath(app.getPath('userData'));
    registerDesktopIpc();
    if (!devForcedClientMode) {
        void startService(serviceContext()).catch((error) => {
            console.error('or3-intern autostart failed:', error);
        });
    }
    protocol.handle('app', async (request) => {
        const url = new URL(request.url);
        const asset = await readPackagedAsset(url.pathname);
        const data = asset.data;
        const type = asset.type;
        const headers = { 'content-type': type };

        if (type === 'text/html') {
            headers['content-security-policy'] = buildElectronCsp({
                scriptHashes: extractInlineScriptHashes(data.toString('utf8')),
            });
        }

        return new Response(data, {
            status: asset.status,
            headers,
        });
    });
    createWindow();
});

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit();
});

app.on('before-quit', (event) => {
    if (quitAfterServiceStop) return;
    event.preventDefault();
    quitAfterServiceStop = true;
    void stopServiceForAppQuit().finally(() => app.quit());
});

function contentType(file) {
    switch (extname(file)) {
        case '.js':
            return 'text/javascript';
        case '.css':
            return 'text/css';
        case '.json':
            return 'application/json';
        case '.svg':
            return 'image/svg+xml';
        default:
            return 'text/html';
    }
}
