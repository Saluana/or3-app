import { describe, expect, it } from 'vitest';
import {
    bootstrapCalloutFingerprint,
    readinessCalloutFingerprint,
} from '../../app/utils/or3/computerCalloutDismiss';
import type { ReadinessResponse } from '../../app/types/or3-api';

describe('computer callout dismiss fingerprints', () => {
    it('changes when blocker or warning counts change', () => {
        const base: ReadinessResponse = {
            status: 'not ready',
            ready: false,
            summary: { blockCount: 1, warnCount: 13 },
            findings: [
                {
                    id: 'sandbox',
                    severity: 'block',
                    summary: 'privileged tools are enabled without Bubblewrap sandboxing',
                },
            ],
        };

        const first = readinessCalloutFingerprint(base);
        const second = readinessCalloutFingerprint({
            ...base,
            summary: { blockCount: 2, warnCount: 13 },
        });

        expect(first).not.toBe(second);
    });

    it('tracks bootstrap warning identity', () => {
        const first = bootstrapCalloutFingerprint({
            code: 'host_not_ready',
            message: 'Host is not ready',
            severity: 'warning',
        });
        const second = bootstrapCalloutFingerprint({
            code: 'host_not_ready',
            message: 'Host is not ready',
            severity: 'warning',
        });
        const third = bootstrapCalloutFingerprint({
            code: 'integration_quarantined',
            message: 'Host is not ready',
            severity: 'warning',
        });

        expect(first).toBe(second);
        expect(first).not.toBe(third);
    });
});
