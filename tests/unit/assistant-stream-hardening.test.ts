import { describe, expect, it } from 'vitest';

import {
    modeToolPolicy,
    normalizeTurnEvent,
} from '../../app/composables/useAssistantStream';

describe('assistant stream hardening helpers', () => {
    it('builds mode-derived tool policy payloads', () => {
        expect(modeToolPolicy('ask')).toEqual({ mode: 'ask' });
        expect(modeToolPolicy('work')).toEqual({ mode: 'work' });
        expect(modeToolPolicy('admin')).toEqual({ mode: 'admin' });
    });

    it('normalizes enriched job events without losing old fields', () => {
        const normalized = normalizeTurnEvent({
            sequence: 7,
            type: 'tool_result',
            data: {
                job_id: 'job_1',
                name: 'exec',
                tool_call_id: 'call_1',
                status: 'failed',
                public_code: 'tool_execution_error',
            },
        });

        expect(normalized).toMatchObject({
            type: 'tool_result',
            sequence: 7,
            jobId: 'job_1',
            payload: {
                name: 'exec',
                tool_call_id: 'call_1',
                public_code: 'tool_execution_error',
            },
        });
    });
});
