import { describe, expect, it } from 'vitest';

import {
    effectiveToolPolicyForHost,
    hostLikelyRequiresAskToolPolicy,
    isLoopbackServiceHost,
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

    it('downgrades work mode when the session host id is loopback', () => {
        expect(
            hostLikelyRequiresAskToolPolicy({
                hostId: '',
                sessionKey: 'or3-app:localhost-9100:session_abc',
                rememberedHosts: new Set(),
                policy: { mode: 'work' },
            }),
        ).toBe(true);
        expect(
            effectiveToolPolicyForHost({
                hostId: '',
                sessionKey: 'or3-app:localhost-9100:session_abc',
                rememberedHosts: new Set(),
                policy: { mode: 'work' },
            }),
        ).toEqual({ mode: 'ask' });
    });

    it('downgrades work mode on loopback hosts before the first request', () => {
        expect(
            hostLikelyRequiresAskToolPolicy({
                host: { baseUrl: 'http://127.0.0.1:9100' },
                rememberedHosts: new Set(),
                policy: { mode: 'work' },
            }),
        ).toBe(true);
        expect(
            effectiveToolPolicyForHost({
                host: { baseUrl: 'http://127.0.0.1:9100' },
                rememberedHosts: new Set(),
                policy: { mode: 'work' },
            }),
        ).toEqual({ mode: 'ask' });
    });
});
