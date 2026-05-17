import { app, BrowserWindow, protocol, shell } from 'electron';
import { readFile } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';
import { OR3_ELECTRON_CSP, isAllowedNavigation } from './security-policy.js';

const root = join(fileURLToPath(new URL('..', import.meta.url)));
function createWindow() {
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
    win.webContents.session.webRequest.onHeadersReceived(
        (details, callback) => {
            callback({
                responseHeaders: {
                    ...details.responseHeaders,
                    'Content-Security-Policy': [OR3_ELECTRON_CSP],
                },
            });
        },
    );
    win.webContents.setWindowOpenHandler(({ url }) => {
        if (url.startsWith('https://')) void shell.openExternal(url);
        return { action: 'deny' };
    });
    win.webContents.on('will-navigate', (event, url) => {
        if (!isAllowedNavigation(url)) event.preventDefault();
    });
    win.once('ready-to-show', () => win.show());
    if (process.env.OR3_ELECTRON_DEV_URL) {
        void win.loadURL(process.env.OR3_ELECTRON_DEV_URL);
    } else {
        void win.loadURL('app://or3/index.html');
    }
    return win;
}

protocol.registerSchemesAsPrivileged([
    {
        scheme: 'app',
        privileges: { standard: true, secure: true, supportFetchAPI: true },
    },
]);

app.whenReady().then(() => {
    protocol.handle('app', async (request) => {
        const url = new URL(request.url);
        const requested = normalize(
            url.pathname === '/' ? '/index.html' : url.pathname,
        );
        if (requested.includes('..'))
            return new Response('blocked', { status: 403 });
        const file = join(root, '.output', 'public', requested);
        const data = await readFile(file);
        return new Response(data, {
            headers: { 'content-type': contentType(file) },
        });
    });
    createWindow();
});

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit();
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
