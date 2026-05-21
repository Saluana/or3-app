import { spawn } from 'node:child_process';
import { watch } from 'node:fs';
import http from 'node:http';
import net from 'node:net';

const devUrl = process.env.OR3_ELECTRON_DEV_URL || 'http://127.0.0.1:3060';
const nuxtPort = new URL(devUrl).port || '3060';
let electronProcess = null;
let restarting = null;
let stopping = false;

function run(command, args, options = {}) {
    return spawn(command, args, {
        stdio: 'inherit',
        shell: false,
        ...options,
    });
}

function assertPortAvailable(port) {
    return new Promise((resolve, reject) => {
        const server = net.createServer();
        server.once('error', (error) => {
            if (error?.code === 'EADDRINUSE') {
                reject(
                    new Error(
                        `Port ${port} is already in use. Stop the old Nuxt dev server first, or run Electron with bun run electron:dev:raw against the server you want.`,
                    ),
                );
                return;
            }
            reject(error);
        });
        server.once('listening', () => {
            server.close(() => resolve());
        });
        server.listen(Number(port), '0.0.0.0');
    });
}

function waitForUrl(url, timeoutMs = 45_000) {
    const deadline = Date.now() + timeoutMs;
    return new Promise((resolve, reject) => {
        const check = () => {
            const request = http.get(url, (response) => {
                response.resume();
                resolve();
            });
            request.on('error', () => {
                if (Date.now() >= deadline) {
                    reject(new Error(`Timed out waiting for ${url}`));
                    return;
                }
                setTimeout(check, 300);
            });
            request.setTimeout(1000, () => {
                request.destroy();
            });
        };
        check();
    });
}

function startElectron() {
    if (stopping) return;
    electronProcess = run('bunx', ['electron', 'electron/main.js'], {
        env: {
            ...process.env,
            OR3_ELECTRON_DEV_URL: devUrl,
        },
    });
    electronProcess.on('exit', () => {
        electronProcess = null;
    });
}

function stopElectron() {
    return new Promise((resolve) => {
        if (!electronProcess || electronProcess.killed) {
            resolve();
            return;
        }
        const child = electronProcess;
        const timer = setTimeout(() => {
            child.kill('SIGKILL');
        }, 3000);
        child.once('exit', () => {
            clearTimeout(timer);
            resolve();
        });
        child.kill('SIGTERM');
    });
}

function restartElectron() {
    if (restarting) return;
    restarting = setTimeout(async () => {
        restarting = null;
        console.log('\n[electron-dev] Electron files changed. Restarting Electron...\n');
        await stopElectron();
        startElectron();
    }, 150);
}

async function shutdown(nuxtProcess) {
    if (stopping) return;
    stopping = true;
    await stopElectron();
    if (nuxtProcess && !nuxtProcess.killed) nuxtProcess.kill('SIGTERM');
    process.exit(0);
}

await assertPortAvailable(nuxtPort);

const nuxtProcess = run('bunx', ['nuxt', 'dev', '--host', '0.0.0.0', '--port', nuxtPort]);
nuxtProcess.on('exit', (code) => {
    if (!stopping) process.exit(code ?? 0);
});

await waitForUrl(devUrl);
startElectron();

const watcher = watch('electron', { recursive: true }, (_eventType, filename) => {
    if (!filename || !/\.(?:cjs|js|json)$/.test(filename)) return;
    restartElectron();
});

process.on('SIGINT', () => {
    watcher.close();
    void shutdown(nuxtProcess);
});
process.on('SIGTERM', () => {
    watcher.close();
    void shutdown(nuxtProcess);
});
