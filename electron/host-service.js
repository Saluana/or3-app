import { access, mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import { constants } from 'node:fs';
import { createHash, createHmac, randomBytes } from 'node:crypto';
import { networkInterfaces } from 'node:os';
import { dirname, join } from 'node:path';
import { execFile, spawn } from 'node:child_process';

const CONFIG_FILE = 'or3-electron-host.json';
const DEFAULT_STATUS = Object.freeze({ state: 'stopped' });
const DEFAULT_CONFIG = Object.freeze({
    version: 1,
    mode: 'undecided',
    setupState: null,
    hostService: null,
    serviceAuth: null,
    autostart: { enabled: false, supported: true },
    lastServiceStatus: DEFAULT_STATUS,
});
const DEFAULT_TRUSTED_BROWSER_CIDRS = [
    '127.0.0.0/8',
    '::1/128',
    '10.0.0.0/8',
    '172.16.0.0/12',
    '192.168.0.0/16',
    '100.64.0.0/10',
    'fc00::/7',
    'fe80::/10',
];

let serviceProcess = null;
let startedAt = '';
let lastLogs = [];
let userDataPath = '';
let writeConfigQueue = Promise.resolve();

export function setHostServiceUserDataPath(path) {
    userDataPath = path;
}

function configPath() {
    return join(userDataPath || process.cwd(), CONFIG_FILE);
}

async function readConfig() {
    try {
        return { ...DEFAULT_CONFIG, ...JSON.parse(await readFile(configPath(), 'utf8')) };
    } catch {
        return { ...DEFAULT_CONFIG };
    }
}

async function writeConfigAtomic(config) {
    const file = configPath();
    await mkdir(dirname(file), { recursive: true });
    const tmpFile = `${file}.${process.pid}.${Date.now()}.${randomBytes(6).toString('hex')}.tmp`;
    await writeFile(tmpFile, JSON.stringify({ ...DEFAULT_CONFIG, ...config }, null, 2));
    await rename(tmpFile, file);
    return config;
}

async function writeConfig(config) {
    const write = writeConfigQueue.then(() => writeConfigAtomic(config));
    writeConfigQueue = write.catch(() => undefined);
    return write;
}

function now() {
    return new Date().toISOString();
}

function delay(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

function baseUrlFromServiceConfig(config) {
    const host = config?.listenHost === 'private' ? '127.0.0.1' : config?.listenHost || '127.0.0.1';
    return `http://${host}:${Number(config?.listenPort || 9100)}`;
}

function uniqueBaseUrls(values) {
    const seen = new Set();
    return values
        .map((value) => String(value || '').trim().replace(/\/+$/g, ''))
        .filter((value) => {
            if (!value || seen.has(value)) return false;
            try {
                const parsed = new URL(value);
                if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return false;
            } catch {
                return false;
            }
            seen.add(value);
            return true;
        });
}

function isNetworkListenHost(host) {
    const value = String(host || '').trim().toLowerCase();
    return value === 'private' || value === '0.0.0.0' || value === '::' || value === '[::]';
}

function serviceCandidateBaseUrls(config) {
    const port = Number(config?.hostService?.listenPort || 9100);
    const candidates = [
        baseUrlFromServiceConfig(config?.hostService),
        config?.lastServiceStatus?.baseUrl,
        config?.setupState?.serviceBaseUrl,
    ];
    for (const address of lanIPv4Addresses()) {
        candidates.push(`http://${address}:${port}`);
    }
    return uniqueBaseUrls(candidates);
}

async function migrateHostServiceConfig(config) {
    if (
        config?.hostService?.securityPreset === 'home' &&
        config.hostService.listenHost === '127.0.0.1'
    ) {
        const hostService = { ...config.hostService, listenHost: 'private' };
        const setupState = config.setupState
            ? { ...config.setupState, serviceBaseUrl: baseUrlFromServiceConfig(hostService), updatedAt: now() }
            : config.setupState;
        const next = { ...config, hostService, setupState };
        await writeConfig(next);
        return next;
    }
    return config;
}

function mergeCommaList(...values) {
    return [...new Set(values
        .flatMap((value) => String(value || '').split(','))
        .map((value) => value.trim())
        .filter(Boolean))].join(',');
}

function randomSecret() {
    return randomBytes(32).toString('hex');
}

function base64UrlBuffer(buffer) {
    return Buffer.from(buffer).toString('base64url');
}

function decodeBase64Url(raw) {
    return Buffer.from(String(raw || '').trim(), 'base64url');
}

function isLoopbackHost(hostname) {
    const host = String(hostname || '').toLowerCase();
    return host === 'localhost' || host === '127.0.0.1' || host === '::1' || host === '[::1]';
}

function safeHttpOrigin(raw) {
    try {
        const parsed = new URL(String(raw || ''));
        if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return '';
        return parsed.origin;
    } catch {
        return '';
    }
}

function lanIPv4Addresses() {
    return Object.values(networkInterfaces())
        .flat()
        .filter((item) => item && item.family === 'IPv4' && !item.internal)
        .map((item) => item.address)
        .filter(Boolean);
}

function pushUniqueRoute(routes, route) {
    const baseUrl = String(route?.baseUrl || '').replace(/\/+$/g, '');
    if (!baseUrl) return;
    if (routes.some((item) => item.kind === route.kind && item.baseUrl === baseUrl)) return;
    routes.push({ kind: route.kind, baseUrl, priority: route.priority });
}

export function buildInviteRoutes(status, appOrigin, config) {
    const routes = [];
    const origin = safeHttpOrigin(appOrigin);
    const listenHost = config?.hostService?.listenHost;
    const serviceIsNetworkReachable = isNetworkListenHost(listenHost);
    if (origin) {
        const parsedOrigin = new URL(origin);
        const appPort = Number(parsedOrigin.port || (origin.startsWith('https:') ? 443 : 80));
        pushUniqueRoute(routes, { kind: 'app-proxy', baseUrl: `${origin}/api/or3`, priority: 10 });
        if (isLoopbackHost(parsedOrigin.hostname)) {
            for (const address of lanIPv4Addresses()) {
                pushUniqueRoute(routes, { kind: 'app-proxy', baseUrl: `http://${address}:${appPort}/api/or3`, priority: 10 });
            }
        }
    }
    if (serviceIsNetworkReachable) {
        for (const address of lanIPv4Addresses()) {
            pushUniqueRoute(routes, { kind: 'direct', baseUrl: `http://${address}:${Number(config?.hostService?.listenPort || 9100)}`, priority: 20 });
        }
    }
    if (status?.baseUrl) {
        try {
            const parsed = new URL(status.baseUrl);
            pushUniqueRoute(routes, {
                kind: isLoopbackHost(parsed.hostname) ? 'loopback' : 'direct',
                baseUrl: parsed.origin,
                priority: isLoopbackHost(parsed.hostname) ? 90 : 20,
            });
        } catch {}
    }
    pushUniqueRoute(routes, { kind: 'loopback', baseUrl: `http://127.0.0.1:${Number(config?.hostService?.listenPort || 9100)}`, priority: 90 });
    return routes.sort((a, b) => a.priority - b.priority);
}

function readCborValue(data, state = { offset: 0 }) {
    const first = data[state.offset++];
    if (first === undefined) throw new Error('Invalid pairing QR payload.');
    const major = first >> 5;
    const additional = first & 0x1f;
    const readLength = () => {
        if (additional < 24) return additional;
        if (additional === 24) return data[state.offset++];
        if (additional === 25) {
            const value = data.readUInt16BE(state.offset);
            state.offset += 2;
            return value;
        }
        if (additional === 26) {
            const value = data.readUInt32BE(state.offset);
            state.offset += 4;
            return value;
        }
        if (additional === 27) {
            const value = Number(data.readBigUInt64BE(state.offset));
            state.offset += 8;
            return value;
        }
        throw new Error('Unsupported pairing QR payload.');
    };
    const length = readLength();
    if (major === 0) return length;
    if (major === 1) return -1 - length;
    if (major === 2) {
        const out = data.subarray(state.offset, state.offset + length);
        state.offset += length;
        return out;
    }
    if (major === 3) {
        const out = data.subarray(state.offset, state.offset + length).toString('utf8');
        state.offset += length;
        return out;
    }
    if (major === 4) {
        return Array.from({ length }, () => readCborValue(data, state));
    }
    if (major === 5) {
        const out = {};
        for (let index = 0; index < length; index += 1) {
            out[String(readCborValue(data, state))] = readCborValue(data, state);
        }
        return out;
    }
    if (major === 7) {
        if (additional === 20) return false;
        if (additional === 21) return true;
        if (additional === 22 || additional === 23) return null;
    }
    throw new Error('Unsupported pairing QR payload.');
}

function decodeLegacyPairingQR(raw) {
    const prefix = 'or3pair:v1:';
    if (!String(raw || '').startsWith(prefix)) throw new Error('Invalid pairing QR prefix.');
    return readCborValue(decodeBase64Url(String(raw).slice(prefix.length)));
}

function encodeInviteV2(invite) {
    return base64UrlBuffer(Buffer.from(JSON.stringify(invite), 'utf8'));
}

function inviteChecksum(invite) {
    const unsigned = { ...invite, checksum: '' };
    return `sha256:${base64UrlBuffer(createHash('sha256').update(JSON.stringify(unsigned)).digest())}`;
}

function createInviteLink(invite, appOrigin) {
    const routes = invite.routes || [];
    const appProxyRoute =
        routes.find((route) => {
            if (route.kind !== 'app-proxy') return false;
            try {
                return !isLoopbackHost(new URL(route.baseUrl).hostname);
            } catch {
                return false;
            }
        }) || routes.find((route) => route.kind === 'app-proxy');
    const origin = appProxyRoute ? new URL(appProxyRoute.baseUrl).origin : safeHttpOrigin(appOrigin);
    if (!origin) return '';
    return `${origin}/pair#invite=${encodeInviteV2(invite)}`;
}

function normalizeInviteRole(value) {
    const role = String(value || '').trim().toLowerCase();
    return role === 'viewer' || role === 'operator' ? role : 'operator';
}

function normalizeInviteCapabilities(value) {
    const allowed = new Set(['chat', 'files', 'terminal']);
    const capabilities = Array.isArray(value)
        ? value.map((item) => String(item || '').trim().toLowerCase()).filter((item) => allowed.has(item))
        : [];
    return [...new Set(capabilities.length ? capabilities : ['chat', 'files', 'terminal'])];
}

async function ensureServiceAuth(config) {
    const existing = String(config?.serviceAuth?.secret || '').trim();
    if (existing) return { config, secret: existing };
    const next = {
        ...config,
        serviceAuth: {
            version: 1,
            secret: randomSecret(),
            createdAt: now(),
        },
    };
    await writeConfig(next);
    return { config: next, secret: next.serviceAuth.secret };
}

function base64Url(input) {
    return Buffer.from(input).toString('base64url');
}

function signServiceToken(secret, payloadPart) {
    return createHmac('sha256', secret).update(payloadPart).digest('hex');
}

function normalizeTokenPath(path) {
    const raw = String(path || '').trim();
    if (!raw) return '';
    try {
        const pathname = new URL(raw, 'http://127.0.0.1').pathname;
        return decodeURIComponent(pathname);
    } catch {
        return raw.startsWith('/') ? raw : `/${raw}`;
    }
}

function issueServiceBearerToken(secret, input = {}) {
    const claims = {
        iat: Math.floor(Date.now() / 1000),
        nonce: randomBytes(12).toString('hex'),
    };
    const method = String(input.method || '').trim().toUpperCase();
    const path = normalizeTokenPath(input.path);
    if (method) claims.method = method;
    if (path) claims.path = path;
    const payloadPart = base64Url(JSON.stringify(claims));
    return `${payloadPart}.${signServiceToken(secret, payloadPart)}`;
}

function normalizeExpiry(value, fallbackMs = 5 * 60_000) {
    if (typeof value === 'number' && Number.isFinite(value)) {
        const ms = value > 10_000_000_000 ? value : value * 1000;
        return new Date(ms).toISOString();
    }
    const text = String(value || '').trim();
    if (text) {
        const numeric = Number(text);
        if (Number.isFinite(numeric)) {
            const ms = numeric > 10_000_000_000 ? numeric : numeric * 1000;
            return new Date(ms).toISOString();
        }
        const parsed = Date.parse(text);
        if (Number.isFinite(parsed)) return new Date(parsed).toISOString();
    }
    return new Date(Date.now() + fallbackMs).toISOString();
}

async function authHeadersFor(path, method = 'GET') {
    const config = await readConfig();
    const { secret } = await ensureServiceAuth(config);
    return {
        Authorization: `Bearer ${issueServiceBearerToken(secret, { method, path })}`,
        'X-Or3-Auth-Method': 'shared-secret',
    };
}

async function stopExternalOr3Service(processId) {
    const pid = Number(processId || 0);
    if (!Number.isFinite(pid) || pid <= 0) return false;
    if (serviceProcess?.pid === pid) return false;
    let command = '';
    try {
        command = await execFileText('ps', ['-p', String(pid), '-o', 'command=']);
    } catch {
        return false;
    }
    if (!command.includes('or3-intern') || !command.includes(' service')) return false;
    try {
        process.kill(pid, 'SIGTERM');
    } catch {
        return false;
    }
    for (let attempt = 0; attempt < 20; attempt++) {
        await delay(250);
        try {
            process.kill(pid, 0);
        } catch {
            return true;
        }
    }
    try {
        process.kill(pid, 'SIGKILL');
        return true;
    } catch {
        return false;
    }
}

function normalizeSetupState(input, previous = null) {
    return {
        version: 1,
        completed: Boolean(input?.completed),
        mode: ['host', 'remote', 'undecided'].includes(input?.mode) ? input.mode : previous?.mode || 'undecided',
        currentStep: ['role', 'host-essentials', 'security', 'starting', 'done'].includes(input?.currentStep)
            ? input.currentStep
            : previous?.currentStep || 'role',
        machineName: String(input?.machineName || previous?.machineName || 'This computer'),
        workspaceDir: input?.workspaceDir || previous?.workspaceDir,
        workspaceDirDisplay: input?.workspaceDirDisplay || previous?.workspaceDirDisplay,
        dataDir: input?.dataDir || previous?.dataDir,
        securityPreset: ['private', 'home', 'advanced'].includes(input?.securityPreset)
            ? input.securityPreset
            : previous?.securityPreset || 'private',
        autostartEnabled: Boolean(input?.autostartEnabled),
        serviceBehavior: input?.serviceBehavior === 'keep-running' ? 'keep-running' : 'stop-with-app',
        internBinary: input?.internBinary || previous?.internBinary,
        serviceBaseUrl: input?.serviceBaseUrl || previous?.serviceBaseUrl,
        updatedAt: now(),
    };
}

function execFileText(file, args, options = {}) {
    return new Promise((resolve, reject) => {
        execFile(file, args, { timeout: 5000, windowsHide: true, ...options }, (error, stdout, stderr) => {
            if (error) {
                error.stdout = stdout;
                error.stderr = stderr;
                reject(error);
                return;
            }
            resolve(String(stdout || stderr || '').trim());
        });
    });
}

async function isExecutable(path) {
    if (!path) return false;
    try {
        await access(path, constants.X_OK);
        return true;
    } catch {
        return false;
    }
}

async function versionForBinary(path) {
    const commands = [['--version'], ['version']];
    for (const args of commands) {
        try {
            const output = await execFileText(path, args);
            if (output) return output.split('\n')[0] || 'or3-intern';
        } catch {
            // Older/newer or3-intern builds disagree on version flag shape.
        }
    }
    try {
        const output = await execFileText(path, ['help']);
        return output ? 'or3-intern' : '';
    } catch {
        return '';
    }
}

function packagedBinaryCandidates(appPath, resourcesPath) {
    const executable = process.platform === 'win32' ? 'or3-intern.exe' : 'or3-intern';
    return [
        join(resourcesPath || '', 'bin', executable),
        join(appPath || '', 'bin', executable),
        join(appPath || '', '..', 'or3-intern', executable),
        join(appPath || '', '..', 'or3-intern', 'bin', executable),
    ];
}

async function binaryStatus(path, source) {
    if (!(await isExecutable(path))) return null;
    const version = await versionForBinary(path);
    return {
        found: true,
        compatible: Boolean(version),
        binary: { source, path, version: version || undefined },
        message: version ? `Found ${version}.` : 'Found or3-intern but could not read its version.',
    };
}

async function fetchJson(baseUrl, path, options = {}) {
    const response = await fetch(`${baseUrl}${path}`, {
        headers: { Accept: 'application/json', 'Content-Type': 'application/json', ...(options.headers || {}) },
        ...options,
    });
    if (!response.ok) {
        const text = await response.text().catch(() => '');
        let message = `HTTP ${response.status}`;
        if (text) {
            try {
                const payload = JSON.parse(text);
                message = payload.message || payload.error || payload.code || message;
            } catch {
                message = text;
            }
        }
        const error = new Error(message);
        error.status = response.status;
        throw error;
    }
    return response.json();
}

async function healthFor(baseUrl) {
    try {
        const health = await fetchJson(baseUrl, '/internal/v1/health');
        return { ok: true, health };
    } catch {
        try {
            const bootstrap = await fetchJson(baseUrl, '/internal/v1/bootstrap');
            return { ok: true, health: bootstrap };
        } catch (error) {
            return { ok: false, error };
        }
    }
}

async function healthForConfiguredService(config) {
    const candidates = serviceCandidateBaseUrls(config);
    for (const baseUrl of candidates) {
        const result = await healthFor(baseUrl);
        if (result.ok) return { ...result, baseUrl };
    }
    return { ok: false, baseUrl: candidates[0] || baseUrlFromServiceConfig(config?.hostService) };
}

async function authenticatedBootstrapFor(baseUrl) {
    const path = '/internal/v1/app/bootstrap';
    try {
        const bootstrap = await fetchJson(baseUrl, path, {
            headers: await authHeadersFor(path, 'GET'),
        });
        return { ok: true, bootstrap };
    } catch (error) {
        return { ok: false, error };
    }
}

async function authenticatedOperatorAccessFor(baseUrl) {
    const path = '/internal/v1/secure-connections/capabilities';
    try {
        const capabilities = await fetchJson(baseUrl, path, {
            headers: await authHeadersFor(path, 'GET'),
        });
        return { ok: true, capabilities };
    } catch (error) {
        return { ok: false, error };
    }
}

function processStatus(config, overrides = {}) {
    const baseUrl = baseUrlFromServiceConfig(config?.hostService);
    if (serviceProcess && !serviceProcess.killed) {
        return {
            state: 'starting',
            baseUrl,
            processId: serviceProcess.pid,
            startedAt,
            message: 'OR3 Intern is starting.',
            ...overrides,
        };
    }
    return { ...DEFAULT_STATUS, baseUrl, ...overrides };
}

export async function getSetupState() {
    const config = await readConfig();
    return config.setupState || null;
}

export async function saveSetupState(input) {
    const config = await readConfig();
    const setupState = normalizeSetupState(input, config.setupState);
    await writeConfig({ ...config, mode: setupState.mode, setupState });
    return setupState;
}

export async function locateInternBinary({ appPath = '', resourcesPath = '', manualPath = '' } = {}) {
    if (manualPath) {
        const manual = await binaryStatus(manualPath, 'manual');
        if (manual) return manual;
    }
    for (const candidate of packagedBinaryCandidates(appPath, resourcesPath)) {
        const bundled = await binaryStatus(candidate, 'bundled');
        if (bundled) return bundled;
    }
    try {
        const version = await execFileText('or3-intern', ['--version']);
        return {
            found: true,
            compatible: true,
            binary: { source: 'path', path: 'or3-intern', version: version.split('\n')[0] || undefined },
            message: 'Found or3-intern on PATH.',
        };
    } catch {
        return {
            found: false,
            compatible: false,
            message: 'OR3 Intern is not installed yet.',
        };
    }
}

export async function configureService(input) {
    if (!input || typeof input !== 'object') return { ok: false, message: 'Invalid service configuration.' };
    if (!String(input.workspaceDir || '').trim()) return { ok: false, message: 'Choose a workspace folder first.' };
    const config = await readConfig();
    const hostService = {
        machineName: String(input.machineName || 'This computer'),
        workspaceDir: String(input.workspaceDir),
        dataDir: input.dataDir ? String(input.dataDir) : undefined,
        listenHost: String(input.listenHost || '127.0.0.1'),
        listenPort: Number(input.listenPort || 9100),
        securityPreset: String(input.securityPreset || 'private'),
        autostartEnabled: Boolean(input.autostartEnabled),
        serviceBehavior: input.serviceBehavior === 'keep-running' ? 'keep-running' : 'stop-with-app',
        internBinaryPath: input.internBinaryPath ? String(input.internBinaryPath) : undefined,
    };
    const serviceBaseUrl = baseUrlFromServiceConfig(hostService);
    const auth = await ensureServiceAuth(config);
    await writeConfig({
        ...auth.config,
        mode: 'host',
        hostService,
        lastServiceStatus: { state: 'stopped', baseUrl: serviceBaseUrl },
    });
    return { ok: true, config: hostService, serviceBaseUrl };
}

export async function installInternPlaceholder() {
    return {
        state: 'failed',
        message: 'Automatic installation is not bundled in this build yet. Choose an existing or3-intern binary to continue.',
        recoverable: true,
        steps: [
            { label: 'Check bundled companion service', state: 'done' },
            { label: 'Download installer', state: 'failed' },
            { label: 'Choose existing binary', state: 'pending' },
        ],
    };
}

export async function serviceStatus() {
    const config = await migrateHostServiceConfig(await readConfig());
    const configuredBaseUrl = baseUrlFromServiceConfig(config.hostService);
    if (!config.hostService) return { state: 'stopped', message: 'Host setup is not configured yet.' };
    const health = await healthForConfiguredService(config);
    const baseUrl = health.baseUrl || configuredBaseUrl;
    if (health.ok) {
        const processId = Number(health.health?.processId || health.health?.process_id || serviceProcess?.pid || 0) || undefined;
        const authenticated = await authenticatedBootstrapFor(baseUrl);
        if (!authenticated.ok) {
            const statusCode = typeof authenticated.error?.status === 'number' ? authenticated.error.status : undefined;
            const status = {
                state: 'unhealthy',
                baseUrl,
                processId,
                health: 'warning',
                authMismatch: statusCode === 401 || statusCode === 403 || statusCode === 429,
                message: statusCode === 429
                    ? 'The local OR3 service is temporarily rate-limiting failed desktop auth. Restarting it will clear this.'
                    : 'The local OR3 service is running, but it does not trust this desktop session yet.',
            };
            await writeConfig({ ...config, lastServiceStatus: status });
            return status;
        }
        const operatorAccess = await authenticatedOperatorAccessFor(baseUrl);
        if (!operatorAccess.ok) {
            const statusCode = typeof operatorAccess.error?.status === 'number' ? operatorAccess.error.status : undefined;
            const status = {
                state: 'unhealthy',
                baseUrl,
                processId,
                health: 'warning',
                authMismatch: statusCode === 401 || statusCode === 403 || statusCode === 429,
                roleMismatch: statusCode === 403,
                message: statusCode === 403
                    ? 'The local OR3 service is running, but this desktop session does not have host operator access yet.'
                    : 'The local OR3 service is running, but this desktop session cannot manage host pairing yet.',
            };
            await writeConfig({ ...config, lastServiceStatus: status });
            return status;
        }
        const status = {
            state: 'online',
            baseUrl,
            processId,
            startedAt: startedAt || undefined,
            health: 'ok',
            message: 'OR3 Intern is online.',
        };
        await writeConfig({ ...config, lastServiceStatus: status });
        return status;
    }
    if (serviceProcess && !serviceProcess.killed) return processStatus(config);
    return { state: 'stopped', baseUrl: configuredBaseUrl, message: 'OR3 Intern is not running.' };
}

export async function startService({ appPath = '', resourcesPath = '' } = {}) {
    let config = await migrateHostServiceConfig(await readConfig());
    if (!config.hostService) return { state: 'error', message: 'Host setup is not configured yet.' };
    const auth = await ensureServiceAuth(config);
    config = auth.config;
    const adopted = await serviceStatus();
    if (adopted.state === 'online') return adopted;
    if (adopted.state === 'unhealthy' && adopted.authMismatch && adopted.processId) {
        const stopped = await stopExternalOr3Service(adopted.processId);
        if (!stopped) return adopted;
    }
    if (serviceProcess && !serviceProcess.killed) return processStatus(config);

    const located = await locateInternBinary({
        appPath,
        resourcesPath,
        manualPath: config.hostService.internBinaryPath || config.setupState?.internBinary?.path,
    });
    if (!located.found || !located.binary) {
        return { state: 'not-installed', message: located.message || 'OR3 Intern is not installed yet.' };
    }

    const env = {
        ...process.env,
        OR3_SERVICE_LISTEN: `${config.hostService.listenHost === 'private' ? '0.0.0.0' : config.hostService.listenHost}:${config.hostService.listenPort}`,
        OR3_SERVICE_ENABLED: 'true',
        OR3_SERVICE_SECRET: auth.secret,
        OR3_SERVICE_SHARED_SECRET_ROLE: 'operator',
        OR3_SERVICE_ALLOW_UNAUTHENTICATED_PAIRING: config.hostService.securityPreset === 'private' ? 'false' : 'true',
        OR3_SERVICE_TRUSTED_BROWSER_ORIGINS: mergeCommaList(process.env.OR3_SERVICE_TRUSTED_BROWSER_ORIGINS, 'app://or3'),
        OR3_SERVICE_TRUSTED_BROWSER_CIDRS: mergeCommaList(process.env.OR3_SERVICE_TRUSTED_BROWSER_CIDRS, ...DEFAULT_TRUSTED_BROWSER_CIDRS),
        OR3_APP_WORKSPACE_DIR: config.hostService.workspaceDir,
    };
    if (config.hostService.dataDir) env.OR3_DATA_DIR = config.hostService.dataDir;

    serviceProcess = spawn(located.binary.path, ['service'], {
        cwd: config.hostService.workspaceDir,
        env,
        shell: false,
        stdio: ['ignore', 'pipe', 'pipe'],
    });
    startedAt = now();
    lastLogs = [];
    const collect = (chunk) => {
        lastLogs.push(String(chunk).slice(-2000));
        lastLogs = lastLogs.slice(-20);
    };
    serviceProcess.stdout?.on('data', collect);
    serviceProcess.stderr?.on('data', collect);
    serviceProcess.once('exit', () => {
        serviceProcess = null;
    });

    const starting = processStatus(config);
    await writeConfig({ ...config, lastServiceStatus: starting });
    return starting;
}

export async function stopService() {
    const config = await readConfig();
    if (serviceProcess && !serviceProcess.killed) {
        serviceProcess.kill('SIGTERM');
        serviceProcess = null;
    }
    const status = { state: 'stopped', baseUrl: baseUrlFromServiceConfig(config.hostService), message: 'OR3 Intern stopped.' };
    await writeConfig({ ...config, lastServiceStatus: status });
    return status;
}

export async function stopServiceForAppQuit() {
    const config = await readConfig();
    if (config.hostService?.serviceBehavior !== 'stop-with-app') return serviceStatus();
    return stopService();
}

export async function restartService(context) {
    await stopService();
    return startService(context);
}

export async function createSecureInvite(input = {}) {
    const status = await serviceStatus();
    const config = await readConfig();
    if (status.state !== 'online') {
        return {
            id: `invite-${Date.now()}`,
            kind: 'secure-qr',
            expiresAt: new Date(Date.now() + 5 * 60_000).toISOString(),
            serviceBaseUrl: status.baseUrl || 'http://127.0.0.1:9100',
            instructions: ['Start OR3 on this computer first, then refresh the invite.'],
            status: 'failed',
            message: status.message || 'OR3 Intern is not online yet.',
        };
    }
    try {
        const path = '/internal/v1/secure-connections/pairing/intents';
        const requestedRole = normalizeInviteRole(input?.requestedRole);
        const requestedCapabilities = normalizeInviteCapabilities(input?.capabilities);
        const response = await fetchJson(status.baseUrl, '/internal/v1/secure-connections/pairing/intents', {
            method: 'POST',
            headers: await authHeadersFor(path, 'POST'),
            body: JSON.stringify({
                relay_origin: 'https://relay.or3.chat',
                host_display_name: 'This computer',
                requested_role: requestedRole,
                capabilities: requestedCapabilities,
            }),
        });
        const qrText = String(response.qr || response.qr_text || response.encoded_qr || response.payload || '');
        let legacyPayload;
        try {
            legacyPayload = decodeLegacyPairingQR(qrText);
        } catch {
            return {
                id: String(response.rendezvous_id || response.id || `invite-${Date.now()}`),
                kind: 'secure-qr',
                qrText,
                expiresAt: normalizeExpiry(response.expires_at),
                serviceBaseUrl: status.baseUrl,
                instructions: ['Scan this QR or copy the link.', 'It opens pairing and connects automatically.'],
                status: 'created',
            };
        }
        const routes = buildInviteRoutes(status, input?.appOrigin, config);
        const invite = {
            version: 2,
            kind: 'or3.pair.invite',
            inviteId: String(response.rendezvous_id || legacyPayload.rendezvousId || response.id || `invite-${Date.now()}`),
            issuedAtUnixMs: Date.now(),
            expiresAtUnixMs: Number(response.expires_at || legacyPayload.expiresAtUnixMs || Date.now() + 5 * 60_000),
            host: {
                id: String(legacyPayload.hostId || ''),
                displayName: String(legacyPayload.hostDisplayName || 'This computer'),
                signingPublicKey: String(legacyPayload.hostSigningPublicKey || ''),
                noisePublicKey: String(legacyPayload.hostNoisePublicKey || ''),
            },
            pairing: {
                rendezvousId: String(legacyPayload.rendezvousId || response.rendezvous_id || ''),
                pairingSecret: String(legacyPayload.pairingSecret || ''),
                qrNonce: String(legacyPayload.qrNonce || ''),
            },
            capabilities: Array.isArray(legacyPayload.capabilities) ? legacyPayload.capabilities : requestedCapabilities,
            routes,
            checksum: '',
            legacyQr: qrText,
        };
        invite.checksum = inviteChecksum(invite);
        const inviteLink = createInviteLink(invite, input?.appOrigin);
        return {
            id: invite.inviteId,
            kind: 'secure-qr',
            qrText: inviteLink || `or3pair:v2:${encodeInviteV2(invite)}`,
            inviteLink,
            legacyQrText: qrText,
            routes,
            expiresAt: normalizeExpiry(response.expires_at),
            serviceBaseUrl: status.baseUrl,
            instructions: ['Scan this QR or copy the link.', 'It opens pairing and connects automatically.'],
            status: 'created',
        };
    } catch (error) {
        const statusCode = typeof error?.status === 'number' ? error.status : undefined;
        const message = statusCode === 401
            ? 'Secure QR needs a trusted desktop session. Generate a code below or refresh after signing in.'
            : error instanceof Error ? error.message : 'Could not create a QR invite.';
        return {
            id: `invite-${Date.now()}`,
            kind: 'secure-qr',
            expiresAt: new Date(Date.now() + 5 * 60_000).toISOString(),
            serviceBaseUrl: status.baseUrl,
            instructions: ['Check that secure connections are enabled, then retry.'],
            status: 'failed',
            message,
        };
    }
}

export async function createCliInvite() {
    const status = await serviceStatus();
    const baseUrl = status.baseUrl || 'http://127.0.0.1:9100';
    try {
        const path = '/internal/v1/pairing/requests';
        const response = await fetchJson(baseUrl, path, {
            method: 'POST',
            headers: await authHeadersFor(path, 'POST'),
            body: JSON.stringify({ role: 'operator', display_name: 'or3-app', origin: 'electron-host' }),
        });
        return {
            id: String(response.id || response.request_id || `cli-${Date.now()}`),
            kind: 'cli-code',
            requestId: Number(response.id || response.request_id || 0),
            code: String(response.code || ''),
            expiresAt: String(response.expires_at || new Date(Date.now() + 10 * 60_000).toISOString()),
            serviceBaseUrl: baseUrl,
            instructions: ['On the other device, choose use a code.', 'Enter the request ID and code shown here.'],
            status: 'created',
        };
    } catch (error) {
        return {
            id: `cli-${Date.now()}`,
            kind: 'cli-code',
            expiresAt: new Date(Date.now() + 10 * 60_000).toISOString(),
            serviceBaseUrl: baseUrl,
            instructions: ['Use or3-intern connect-device from a terminal as a fallback.'],
            status: 'failed',
            message: error instanceof Error ? error.message : 'Could not create a code.',
        };
    }
}

export async function listSecureDevices() {
    const status = await serviceStatus();
    if (status.state !== 'online') return [];
    const path = '/internal/v1/secure-connections/devices';
    const response = await fetchJson(status.baseUrl, path, { headers: await authHeadersFor(path, 'GET') });
    return response.items || response.devices || [];
}

export async function revokeSecureDevice(deviceId) {
    const status = await serviceStatus();
    if (status.state !== 'online') throw new Error('Service is offline.');
    const path = `/internal/v1/secure-connections/devices/${encodeURIComponent(String(deviceId))}/revoke`;
    await fetchJson(status.baseUrl, path, {
        method: 'POST',
        headers: await authHeadersFor(path, 'POST'),
        body: JSON.stringify({}),
    });
    return { deviceId: String(deviceId), status: 'revoked' };
}

export async function listLegacyDevices() {
    const status = await serviceStatus();
    if (status.state !== 'online') return [];
    const path = '/internal/v1/devices';
    const response = await fetchJson(status.baseUrl, path, { headers: await authHeadersFor(path, 'GET') });
    return response.items || response.devices || [];
}

export async function revokeLegacyDevice(deviceId) {
    const status = await serviceStatus();
    if (status.state !== 'online') throw new Error('Service is offline.');
    const path = `/internal/v1/devices/${encodeURIComponent(String(deviceId))}/revoke`;
    await fetchJson(status.baseUrl, path, {
        method: 'POST',
        headers: await authHeadersFor(path, 'POST'),
        body: JSON.stringify({}),
    });
    return { deviceId: String(deviceId), status: 'revoked' };
}


export async function issueServiceToken(input = {}) {
    const config = await readConfig();
    if (!config.hostService) throw new Error('Host setup is not configured yet.');
    const { secret } = await ensureServiceAuth(config);
    return {
        token: issueServiceBearerToken(secret, input),
        expiresAt: new Date(Date.now() + 5 * 60_000).toISOString(),
    };
}
export async function lastDiagnostics() {
    return lastLogs.join('\n');
}
