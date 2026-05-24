import type { Or3HostProfile } from '~/types/app-state';
import type { ToolPolicy } from '~/types/or3-api';
import { downgradeToolPolicyForServiceCapability } from './errors';

const SERVICE_CEILING_HOSTS_KEY = 'or3.serviceCapabilityCeilingHosts';

function isLoopbackHostname(hostname: string) {
    const host = hostname.trim().toLowerCase();
    return (
        host === 'localhost' ||
        host === '127.0.0.1' ||
        host === '::1' ||
        host === '[::1]'
    );
}

export function isLoopbackServiceHost(host?: Pick<Or3HostProfile, 'baseUrl'> | null) {
    const baseUrl = host?.baseUrl?.trim();
    if (!baseUrl) return false;
    try {
        return isLoopbackHostname(new URL(baseUrl).hostname);
    } catch {
        const hostname =
            baseUrl.replace(/^https?:\/\//i, '').split('/')[0]?.split(':')[0] ??
            '';
        return isLoopbackHostname(hostname);
    }
}

export function loadPersistedServiceCapabilityCeilingHosts() {
    if (!import.meta.client || !window.localStorage) return new Set<string>();
    try {
        const raw = window.localStorage.getItem(SERVICE_CEILING_HOSTS_KEY);
        if (!raw) return new Set<string>();
        const parsed = JSON.parse(raw);
        if (!Array.isArray(parsed)) return new Set<string>();
        return new Set(
            parsed
                .map((value) => String(value ?? '').trim())
                .filter(Boolean),
        );
    } catch {
        return new Set<string>();
    }
}

export function persistServiceCapabilityCeilingHost(hostId?: string | null) {
    const normalized = hostId?.trim();
    if (!normalized || !import.meta.client || !window.localStorage) return;
    const hosts = loadPersistedServiceCapabilityCeilingHosts();
    hosts.add(normalized);
    window.localStorage.setItem(
        SERVICE_CEILING_HOSTS_KEY,
        JSON.stringify([...hosts]),
    );
}

export function servicePolicyMode(policy?: ToolPolicy) {
    return String(policy?.mode ?? 'work').trim().toLowerCase();
}

export function hostIdFromSessionKey(sessionKey?: string) {
    const parts = String(sessionKey ?? '')
        .trim()
        .split(':');
    if (parts.length >= 3 && parts[0] === 'or3-app') {
        return parts[1]?.trim() ?? '';
    }
    return '';
}

function hostIdLooksLoopback(hostId?: string) {
    const normalized = String(hostId ?? '').trim().toLowerCase();
    if (!normalized) return false;
    return (
        normalized.includes('localhost') ||
        normalized.includes('127.0.0.1') ||
        normalized === '::1'
    );
}

export function hostLikelyRequiresAskToolPolicy(options: {
    hostId?: string | null;
    host?: Pick<Or3HostProfile, 'baseUrl'> | null;
    sessionKey?: string;
    rememberedHosts: Set<string>;
    policy?: ToolPolicy;
}) {
    const mode = servicePolicyMode(options.policy);
    if (mode !== 'work' && mode !== 'admin') return false;
    const hostId =
        options.hostId?.trim() ||
        hostIdFromSessionKey(options.sessionKey) ||
        '';
    if (hostId && options.rememberedHosts.has(hostId)) return true;
    if (hostIdLooksLoopback(hostId)) return true;
    return isLoopbackServiceHost(options.host);
}

export function effectiveToolPolicyForHost(options: {
    hostId?: string | null;
    host?: Pick<Or3HostProfile, 'baseUrl'> | null;
    sessionKey?: string;
    rememberedHosts: Set<string>;
    policy?: ToolPolicy;
}) {
    if (
        !hostLikelyRequiresAskToolPolicy({
            hostId: options.hostId,
            host: options.host,
            sessionKey: options.sessionKey,
            rememberedHosts: options.rememberedHosts,
            policy: options.policy,
        })
    ) {
        return options.policy;
    }
    return downgradeToolPolicyForServiceCapability(options.policy);
}
