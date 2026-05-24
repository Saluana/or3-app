import { describe, expect, it } from 'vitest';

import {
    clearServiceCapabilityCeilingHost,
    effectiveToolPolicyForHost,
    hostLikelyRequiresAskToolPolicy,
    isLoopbackServiceHost,
    loadPersistedServiceCapabilityCeilingHosts,
    persistServiceCapabilityCeilingHost,
} from '../../app/utils/assistant-stream/tool-policy-host';

describe('tool-policy-host', () => {
    it('detects loopback service hosts', () => {
        expect(isLoopbackServiceHost({ baseUrl: 'http://127.0.0.1:9100' })).toBe(
            true,
        );
        expect(
            isLoopbackServiceHost({ baseUrl: 'http://localhost:9100' }),
        ).toBe(true);
        expect(
            isLoopbackServiceHost({ baseUrl: 'http://100.82.202.111:9100' }),
        ).toBe(false);
    });

    it('keeps work mode when the session host id is loopback', () => {
        expect(
            hostLikelyRequiresAskToolPolicy({
                hostId: '',
                sessionKey: 'or3-app:localhost-9100:session_abc',
                rememberedHosts: new Set(['localhost-9100']),
                policy: { mode: 'work' },
            }),
        ).toBe(false);
        expect(
            effectiveToolPolicyForHost({
                hostId: '',
                sessionKey: 'or3-app:localhost-9100:session_abc',
                rememberedHosts: new Set(['localhost-9100']),
                policy: { mode: 'work' },
            }),
        ).toEqual({ mode: 'work' });
    });

    it('keeps work mode on loopback hosts before the first request', () => {
        expect(
            hostLikelyRequiresAskToolPolicy({
                host: { baseUrl: 'http://127.0.0.1:9100' },
                rememberedHosts: new Set(),
                policy: { mode: 'work' },
            }),
        ).toBe(false);
        expect(
            effectiveToolPolicyForHost({
                host: { baseUrl: 'http://127.0.0.1:9100' },
                rememberedHosts: new Set(),
                policy: { mode: 'work' },
            }),
        ).toEqual({ mode: 'work' });
    });

    it('keeps admin mode for admin hosts even if a stale ceiling was remembered', () => {
        expect(
            hostLikelyRequiresAskToolPolicy({
                hostId: 'local',
                host: { baseUrl: 'http://127.0.0.1:9100', role: 'admin' },
                rememberedHosts: new Set(['local']),
                policy: { mode: 'admin' },
            }),
        ).toBe(false);
        expect(
            effectiveToolPolicyForHost({
                hostId: 'local',
                host: { baseUrl: 'http://127.0.0.1:9100', role: 'admin' },
                rememberedHosts: new Set(['local']),
                policy: { mode: 'admin' },
            }),
        ).toEqual({ mode: 'admin' });
    });

    it('clears remembered ceiling hosts from local storage', () => {
        localStorage.setItem(
            'or3.serviceCapabilityCeilingHosts',
            JSON.stringify(['stale-host']),
        );
        persistServiceCapabilityCeilingHost('stale-host');
        clearServiceCapabilityCeilingHost('stale-host');
        expect(loadPersistedServiceCapabilityCeilingHosts().size).toBe(0);
    });

    it('still downgrades remembered non-admin hosts after a real service ceiling error', () => {
        expect(
            hostLikelyRequiresAskToolPolicy({
                hostId: 'remote-safe',
                host: { baseUrl: 'http://100.82.202.111:9100' },
                rememberedHosts: new Set(['remote-safe']),
                policy: { mode: 'work' },
            }),
        ).toBe(true);
        expect(
            effectiveToolPolicyForHost({
                hostId: 'remote-safe',
                host: { baseUrl: 'http://100.82.202.111:9100' },
                rememberedHosts: new Set(['remote-safe']),
                policy: { mode: 'work' },
            }),
        ).toEqual({ mode: 'ask' });
    });
});
