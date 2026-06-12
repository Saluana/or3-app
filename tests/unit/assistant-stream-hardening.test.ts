import { describe, expect, it } from 'vitest';

import {
    normalizeTurnEvent,
} from '../../app/composables/useAssistantStream';
import { previewValue } from '../../app/utils/assistant-stream/activity';

describe('assistant stream hardening helpers', () => {
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

    it('redacts token-shaped values from activity previews', () => {
        const preview = previewValue({
            stdout:
                'token: ya29.a0AQvPyExampleSecret\nAuthorization: Bearer abc.def.ghi',
            access_token: 'plain-secret',
        });

        expect(preview).toContain('[redacted]');
        expect(preview).not.toContain('ya29.a0AQvPyExampleSecret');
        expect(preview).not.toContain('abc.def.ghi');
        expect(preview).not.toContain('plain-secret');
    });
});
